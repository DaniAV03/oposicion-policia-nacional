// Lógica pura del motor de test.
//
// Reglas de este fichero, para que lo pueda importar tanto el navegador como el
// verificador de Node (scripts/verificar-test.mjs):
//   · Sin acceso al DOM y sin efectos secundarios al importarlo.
//   · Sin dependencias: no importa nada de otros módulos.
//   · Las funciones que aleatorizan reciben la fuente aleatoria como parámetro,
//     de modo que una prueba puede fijar la semilla y obtener siempre lo mismo.
//
// Las preguntas del banco no se modifican nunca: se copian las opciones y se
// remapea el índice «correcta», así el JSON original sigue siendo la referencia.

export const OPCIONES_POR_PREGUNTA = 3;
export const PREGUNTAS_SESION_RAPIDA = 30;

/**
 * Segundos por pregunta del temporizador del modo examen.
 *
 * Es un valor orientativo del proyecto, no el reparto oficial de la prueba: las
 * bases de cada convocatoria fijan el tiempo real. Se declara aquí para poder
 * ajustarlo en un solo sitio y para no presentar el cronómetro como oficial.
 */
export const SEGUNDOS_POR_PREGUNTA = 60;

/**
 * Penalización por respuesta fallida, medida en aciertos descontados.
 *
 * Vale 0 por defecto de forma deliberada: la fórmula oficial de penalización no
 * se ha verificado contra las bases publicadas, así que el motor no la inventa.
 * Cualquier valor distinto de 0 que se pase explícitamente a `corregir` es una
 * decisión de quien lo pase, y la interfaz avisa de que la cifra resultante es
 * un recuento de práctica, nunca una nota oficial.
 */
export const PENALIZACION_POR_DEFECTO = 0;

/* --- Aleatoriedad ---------------------------------------------------------- */

/**
 * Generador pseudoaleatorio determinista (mulberry32) con semilla entera.
 * Devuelve una función que produce números en [0, 1), igual que Math.random,
 * para poder inyectarla en `muestrear` y `barajarOpciones`.
 */
export function crearGeneradorAleatorio(semilla) {
  let estado = Number(semilla) >>> 0;
  if (estado === 0) estado = 0x9e3779b9;

  return function aleatorio() {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* --- Banco de preguntas ---------------------------------------------------- */

const esTexto = (valor) => typeof valor === 'string' && valor.trim() !== '';

/** Una pregunta sirve si tiene id, enunciado, exactamente 3 opciones y una correcta válida. */
export function esPreguntaValida(pregunta) {
  return (
    !!pregunta &&
    esTexto(pregunta.id) &&
    esTexto(pregunta.enunciado) &&
    Array.isArray(pregunta.opciones) &&
    pregunta.opciones.length === OPCIONES_POR_PREGUNTA &&
    pregunta.opciones.every(esTexto) &&
    Number.isInteger(pregunta.correcta) &&
    pregunta.correcta >= 0 &&
    pregunta.correcta < OPCIONES_POR_PREGUNTA
  );
}

/**
 * Construye el pool de preguntas a partir de uno o varios bancos.
 *
 * Cada pregunta del pool copia los metadatos del banco del que procede
 * (`convocatoria`, `promocion`, `tipo`, `fuente`), porque el intento y el
 * desglose de resultados se calculan sobre ese dato.
 *
 * Filtros opcionales, todos excluyentes cuando se indican:
 *   · `convocatoria`: año de la convocatoria.
 *   · `tipo`: «teorico», «psicotecnico»…
 *   · `tema`: número de tema del programa (hoy el banco lo tiene a null).
 *
 * Se descartan las preguntas mal formadas y los ids repetidos: un id duplicado
 * haría imposible identificar la pregunta en el repaso de fallos.
 */
export function construirPool(bancos, { convocatoria = null, tipo = null, tema = null } = {}) {
  const pool = [];
  const vistos = new Set();

  for (const banco of bancos ?? []) {
    if (!banco || !Array.isArray(banco.preguntas)) continue;
    if (convocatoria !== null && Number(banco.convocatoria) !== Number(convocatoria)) continue;
    if (tipo !== null && banco.tipo !== tipo) continue;

    for (const pregunta of banco.preguntas) {
      if (!esPreguntaValida(pregunta)) continue;
      if (tema !== null && Number(pregunta.tema) !== Number(tema)) continue;
      if (vistos.has(pregunta.id)) continue;

      vistos.add(pregunta.id);
      pool.push({
        ...pregunta,
        opciones: [...pregunta.opciones],
        convocatoria: banco.convocatoria,
        promocion: banco.promocion,
        tipo: banco.tipo ?? null,
        fuente: banco.fuente ?? null,
      });
    }
  }

  return pool;
}

/** Resumen por convocatoria del pool: total de preguntas disponibles en cada una. */
export function contarPorConvocatoria(bancos) {
  const cuenta = new Map();

  for (const pregunta of construirPool(bancos)) {
    const clave = `${pregunta.convocatoria}-${pregunta.promocion}`;
    const fila = cuenta.get(clave) ?? {
      convocatoria: pregunta.convocatoria,
      promocion: pregunta.promocion,
      total: 0,
    };
    fila.total += 1;
    cuenta.set(clave, fila);
  }

  return [...cuenta.values()].sort(
    (a, b) => a.convocatoria - b.convocatoria || a.promocion - b.promocion,
  );
}

/* --- Muestreo y barajado --------------------------------------------------- */

/**
 * Toma `cantidad` preguntas del pool sin repetir ninguna.
 *
 * Baraja parcial (Fisher-Yates) sobre una copia: cada pregunta movida a la
 * posición i no vuelve a entrar en el sorteo, así que no hay repetición y el
 * resultado nunca supera el tamaño del pool. No muta la lista recibida.
 */
export function muestrear(pool, cantidad, aleatorio = Math.random) {
  const copia = [...(pool ?? [])];
  const pedidas = Math.trunc(Number(cantidad));
  const objetivo = Math.min(Math.max(Number.isFinite(pedidas) ? pedidas : 0, 0), copia.length);

  for (let i = 0; i < objetivo; i += 1) {
    const j = i + Math.floor(aleatorio() * (copia.length - i));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }

  return copia.slice(0, objetivo);
}

/**
 * Baraja las 3 opciones de una pregunta y remapea «correcta» a la nueva posición.
 *
 * Se barajan los índices originales, no los textos, para que el remapeo sea
 * exacto aunque dos opciones tuvieran el mismo texto: la respuesta correcta
 * siempre apunta al mismo texto que en el banco.
 */
export function barajarOpciones(pregunta, aleatorio = Math.random) {
  const originales = [...pregunta.opciones];
  const indices = originales.map((_, i) => i);

  for (let i = indices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(aleatorio() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  return {
    ...pregunta,
    opciones: indices.map((i) => originales[i]),
    correcta: indices.indexOf(pregunta.correcta),
  };
}

/* --- Intento y corrección --------------------------------------------------- */

/**
 * Crea un intento: una entrada por pregunta, con las opciones ya barajadas.
 * `respuesta` es el índice elegido sobre las opciones presentadas, o null si
 * quedó en blanco. Las opciones se barajan una sola vez por intento, así que el
 * repaso de fallos muestra la pregunta tal como se vio.
 */
export function crearIntento(preguntas, aleatorio = Math.random) {
  return (preguntas ?? []).map((pregunta) => ({
    pregunta: barajarOpciones(pregunta, aleatorio),
    respuesta: null,
  }));
}

/** Devuelve una copia del intento con la respuesta de una pregunta sustituida. */
export function registrarRespuesta(intento, indice, opcion) {
  const valida = opcion === null || (Number.isInteger(opcion) && opcion >= 0 && opcion < OPCIONES_POR_PREGUNTA);
  if (!valida) throw new RangeError(`Opción fuera de rango: ${opcion}`);

  return (intento ?? []).map((entrada, i) => (i === indice ? { ...entrada, respuesta: opcion } : entrada));
}

/**
 * Corrige un intento completo.
 *
 * Una respuesta en blanco (null) no suma ni resta: sólo se cuenta en `blancos`.
 * `netas` descuenta la penalización indicada por cada fallo; con el valor por
 * defecto (0) es exactamente el número de aciertos. `porcentajeAcierto` es un
 * recuento de práctica, no una nota: la fórmula oficial de corrección debe
 * confirmarse en las bases publicadas antes de interpretar cualquier cifra.
 */
export function corregir(intento, { penalizacion = PENALIZACION_POR_DEFECTO } = {}) {
  const entradas = intento ?? [];
  const descuento = Number.isFinite(Number(penalizacion)) ? Math.max(0, Number(penalizacion)) : 0;

  let aciertos = 0;
  let fallos = 0;
  let blancos = 0;
  const falladas = [];

  for (const entrada of entradas) {
    if (entrada.respuesta === null || entrada.respuesta === undefined) {
      blancos += 1;
      continue;
    }
    if (entrada.respuesta === entrada.pregunta.correcta) {
      aciertos += 1;
      continue;
    }
    fallos += 1;
    falladas.push(entrada);
  }

  const total = entradas.length;

  return {
    total,
    aciertos,
    fallos,
    blancos,
    penalizacion: descuento,
    netas: total === 0 ? 0 : aciertos - descuento * fallos,
    porcentajeAcierto: total === 0 ? 0 : Math.round((aciertos / total) * 1000) / 10,
    falladas,
  };
}

/** Desglose del intento por convocatoria de origen, ordenado por año y promoción. */
export function resumirPorConvocatoria(intento) {
  const filas = new Map();

  for (const entrada of intento ?? []) {
    const { convocatoria, promocion } = entrada.pregunta;
    const clave = `${convocatoria}-${promocion}`;
    const fila = filas.get(clave) ?? {
      convocatoria,
      promocion,
      total: 0,
      aciertos: 0,
      fallos: 0,
      blancos: 0,
    };

    fila.total += 1;
    if (entrada.respuesta === null || entrada.respuesta === undefined) fila.blancos += 1;
    else if (entrada.respuesta === entrada.pregunta.correcta) fila.aciertos += 1;
    else fila.fallos += 1;

    filas.set(clave, fila);
  }

  return [...filas.values()].sort(
    (a, b) => a.convocatoria - b.convocatoria || a.promocion - b.promocion,
  );
}

/* --- Presentación ---------------------------------------------------------- */

/** Duración orientativa de un examen de `cantidad` preguntas, en segundos. */
export function duracionExamen(cantidad, segundosPorPregunta = SEGUNDOS_POR_PREGUNTA) {
  const preguntas = Math.max(0, Math.trunc(Number(cantidad) || 0));
  return preguntas * Math.max(0, Math.trunc(Number(segundosPorPregunta) || 0));
}

/** Compone un tiempo en segundos como mm:ss, sin valores negativos. */
export function formatearTiempo(segundos) {
  const total = Math.max(0, Math.trunc(Number(segundos) || 0));
  const minutos = Math.floor(total / 60);
  const resto = total % 60;
  return `${String(minutos).padStart(2, '0')}:${String(resto).padStart(2, '0')}`;
}
