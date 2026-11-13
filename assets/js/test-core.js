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

/**
 * Tamaños de sesión, pensados como estados de ánimo y no como niveles.
 *
 * La sesión corta es la que de verdad sostiene el estudio: diez preguntas se
 * hacen siempre, y terminar una sesión corta cansa menos que abandonar una
 * larga. Ningún tamaño se presenta como obligatorio ni encadena con el
 * siguiente.
 */
export const PREGUNTAS_SESION_CORTA = 10;
export const PREGUNTAS_SESION_MEDIA = 30;
export const PREGUNTAS_SESION_EXAMEN = 30;
export const PREGUNTAS_RETO_DIARIO = 10;
export const TAMANOS_SESION = Object.freeze(['corta', 'media', 'completa', 'examen']);
export const TAMANO_POR_DEFECTO = 'corta';

/**
 * A partir de cuántas preguntas la propia sesión avisa de que es buen momento
 * para parar. No es un límite: es un permiso explícito para dejarlo.
 */
export const UMBRAL_SESION_LARGA = 40;

/**
 * Modos que pueden tener récord guardado. «reto» es el reto del día y se
 * registra aparte porque no compite con los demás.
 */
export const MODOS_REGISTRO = Object.freeze(['corta', 'media', 'completa', 'examen', 'reto']);

/** Clave de `localStorage` y versión del esquema guardado. */
export const CLAVE_ALMACENAMIENTO = 'policia-nacional-test-progreso-v1';
export const VERSION_ALMACEN = 1;

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

/* --- Tamaño de la sesión ---------------------------------------------------- */

/**
 * Preguntas que pide un tamaño de sesión, acotadas al banco disponible.
 *
 * Nunca devuelve más preguntas de las que hay: pedir «todo el banco» con doce
 * preguntas en el filtro devuelve doce. Con el banco vacío devuelve 0, y el
 * resto de tamaños devuelve como mínimo 1 cuando hay al menos una pregunta.
 */
export function preguntasDeSesion(
  tamano,
  totalPool,
  { cantidadExamen = PREGUNTAS_SESION_EXAMEN } = {},
) {
  const total = Math.max(0, Math.trunc(Number(totalPool) || 0));
  if (total === 0) return 0;

  let pedidas;
  switch (tamano) {
    case 'completa':
      pedidas = total;
      break;
    case 'media':
      pedidas = PREGUNTAS_SESION_MEDIA;
      break;
    case 'examen': {
      const valor = Math.trunc(Number(cantidadExamen));
      pedidas = Number.isFinite(valor) && valor > 0 ? valor : PREGUNTAS_SESION_EXAMEN;
      break;
    }
    case 'corta':
    default:
      pedidas = PREGUNTAS_SESION_CORTA;
      break;
  }

  return Math.min(Math.max(1, pedidas), total);
}

/* --- Rachas ----------------------------------------------------------------- */

/** Rachas que reciben un reconocimiento discreto. Nada más alto que esto. */
export const HITOS_RACHA = Object.freeze([5, 10]);

/**
 * Racha de aciertos de una lista de entradas ya contestadas, en orden.
 *
 * Una entrada acertada suma; un fallo o una pregunta en blanco reinician la
 * racha actual. `maxima` conserva el mejor tramo, que es lo que se guarda como
 * récord. Durante una sesión se pasa sólo el tramo contestado, para que las
 * preguntas que aún no se han visto no corten la racha.
 */
export function calcularRacha(entradas) {
  let actual = 0;
  let maxima = 0;

  for (const entrada of entradas ?? []) {
    const respondida = entrada?.respuesta !== null && entrada?.respuesta !== undefined;
    const acertada = respondida && !!entrada.pregunta && entrada.respuesta === entrada.pregunta.correcta;

    if (acertada) {
      actual += 1;
      if (actual > maxima) maxima = actual;
    } else {
      actual = 0;
    }
  }

  return { actual, maxima };
}

/** Hito que corresponde a una racha, o null si no toca reconocimiento. */
export function hitoDeRacha(racha) {
  const valor = Math.trunc(Number(racha) || 0);
  return HITOS_RACHA.includes(valor) ? valor : null;
}

/** Porcentaje de acierto sobre las preguntas respondidas, con un decimal. */
export function tasaDeAcierto(aciertos, respondidas) {
  const buenas = Math.max(0, Math.trunc(Number(aciertos) || 0));
  const total = Math.max(0, Math.trunc(Number(respondidas) || 0));
  if (total === 0) return 0;
  return Math.round((Math.min(buenas, total) / total) * 1000) / 10;
}

/* --- Reto del día ----------------------------------------------------------- */

const dosDigitos = (valor) => String(valor).padStart(2, '0');
const PATRON_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Compone la fecha local como YYYY-MM-DD, que es la clave del reto diario. */
export function claveFecha(fecha = new Date()) {
  const valor = fecha instanceof Date ? fecha : new Date(fecha);
  const util = Number.isNaN(valor?.getTime?.()) ? new Date() : valor;
  return `${util.getFullYear()}-${dosDigitos(util.getMonth() + 1)}-${dosDigitos(util.getDate())}`;
}

/**
 * Semilla entera y estable para una fecha (FNV-1a sobre «YYYY-MM-DD»).
 *
 * La hora no influye: el reto del día es el mismo a las 8:00 y a las 23:00, y
 * el mismo para todo el mundo. Se alimenta al generador que ya usa el motor,
 * así que la selección es reproducible en las pruebas.
 */
export function semillaDiaria(fecha = new Date()) {
  const clave = typeof fecha === 'string' && PATRON_FECHA.test(fecha) ? fecha : claveFecha(fecha);
  let hash = 0x811c9dc5;

  for (let i = 0; i < clave.length; i += 1) {
    hash ^= clave.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash === 0 ? 1 : hash;
}

/** Reto del día: mismas preguntas para una fecha, distintas al día siguiente. */
export function seleccionDiaria(pool, fecha = new Date(), cantidad = PREGUNTAS_RETO_DIARIO) {
  return muestrear(pool, cantidad, crearGeneradorAleatorio(semillaDiaria(fecha)));
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
    porcentajeAcierto: tasaDeAcierto(aciertos, total),
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

/**
 * Duración en lenguaje llano, para el ritmo de la práctica: «45 s», «1 min»,
 * «2 min 05 s». Sin cuenta atrás y sin color de alarma: sólo cuánto lleva.
 */
export function formatearDuracion(segundos) {
  const total = Math.max(0, Math.trunc(Number(segundos) || 0));
  if (total < 60) return `${total} s`;

  const minutos = Math.floor(total / 60);
  const resto = total % 60;
  return resto === 0 ? `${minutos} min` : `${minutos} min ${dosDigitos(resto)} s`;
}

/**
 * Comparación del resultado con el récord del mismo modo.
 *
 * Devuelve un descriptor, no una frase: la interfaz decide cómo contarlo.
 * «primera» es una sesión sin referencia previa y no es un fallo.
 */
export function compararConRecord(porcentaje, registro) {
  const actual = Math.round((Number(porcentaje) || 0) * 10) / 10;
  const mejor = registro?.porcentaje;

  if (typeof mejor !== 'number' || !Number.isFinite(mejor)) {
    return { estado: 'primera', diferencia: 0, mejor: null };
  }

  const diferencia = Math.round((actual - mejor) * 10) / 10;
  const estado = diferencia > 0 ? 'mejor' : diferencia < 0 ? 'peor' : 'igual';
  return { estado, diferencia, mejor };
}

/** ¿La sesión fue lo bastante larga como para sugerir parar? */
export function sugerirParada(totalPreguntas, umbral = UMBRAL_SESION_LARGA) {
  const total = Math.max(0, Math.trunc(Number(totalPreguntas) || 0));
  const limite = Math.max(0, Math.trunc(Number(umbral) || 0));
  return total > limite;
}

/* --- Almacenamiento versionado --------------------------------------------- */

/*
 * El progreso se guarda en `localStorage` bajo una clave propia y con un número
 * de versión. Todo lo que entra por `validarAlmacen` se comprueba campo a campo:
 * un JSON corrupto, de otra aplicación o de una versión que no es ésta se
 * descarta en silencio, nunca se propaga a la interfaz.
 */

const esObjeto = (valor) => !!valor && typeof valor === 'object' && !Array.isArray(valor);
const esPorcentaje = (valor) =>
  typeof valor === 'number' && Number.isFinite(valor) && valor >= 0 && valor <= 100;
const redondearPorcentaje = (valor) => Math.round(Number(valor) * 10) / 10;

export function crearAlmacenVacio() {
  return {
    version: VERSION_ALMACEN,
    registros: {},
    rachaMaxima: 0,
    ultimoIntento: null,
    reto: null,
  };
}

function normalizarRegistro(valor) {
  if (!esObjeto(valor)) return null;
  const { aciertos, total, porcentaje, fecha } = valor;
  if (!Number.isInteger(aciertos) || !Number.isInteger(total)) return null;
  if (total < 1 || aciertos < 0 || aciertos > total) return null;
  if (!esPorcentaje(porcentaje) || typeof fecha !== 'string' || !PATRON_FECHA.test(fecha)) return null;
  return { aciertos, total, porcentaje: redondearPorcentaje(porcentaje), fecha };
}

function normalizarUltimoIntento(valor) {
  if (!esObjeto(valor) || !MODOS_REGISTRO.includes(valor.modo)) return null;
  const registro = normalizarRegistro(valor);
  return registro ? { modo: valor.modo, ...registro } : null;
}

function normalizarReto(valor) {
  if (!esObjeto(valor)) return null;
  const { fecha, aciertos, total } = valor;
  if (typeof fecha !== 'string' || !PATRON_FECHA.test(fecha)) return null;
  if (!Number.isInteger(aciertos) || !Number.isInteger(total)) return null;
  if (total < 1 || aciertos < 0 || aciertos > total) return null;
  return { fecha, aciertos, total };
}

/** Devuelve una copia normalizada del almacén, o null si no es válido. */
export function validarAlmacen(datos) {
  if (!esObjeto(datos) || datos.version !== VERSION_ALMACEN) return null;
  if (!esObjeto(datos.registros)) return null;

  const registros = {};
  for (const [modo, valor] of Object.entries(datos.registros)) {
    if (!MODOS_REGISTRO.includes(modo)) return null;
    const registro = normalizarRegistro(valor);
    if (!registro) return null;
    registros[modo] = registro;
  }

  if (!Number.isInteger(datos.rachaMaxima) || datos.rachaMaxima < 0) return null;

  let ultimoIntento = null;
  if (datos.ultimoIntento !== null && datos.ultimoIntento !== undefined) {
    ultimoIntento = normalizarUltimoIntento(datos.ultimoIntento);
    if (!ultimoIntento) return null;
  }

  let reto = null;
  if (datos.reto !== null && datos.reto !== undefined) {
    reto = normalizarReto(datos.reto);
    if (!reto) return null;
  }

  return { version: VERSION_ALMACEN, registros, rachaMaxima: datos.rachaMaxima, ultimoIntento, reto };
}

/** Récord guardado de un modo, o null si todavía no hay ninguno. */
export function mejorDeModo(almacen, modo) {
  const registro = almacen?.registros?.[modo];
  return registro ? { ...registro } : null;
}

/**
 * Anota un intento terminado y devuelve un almacén nuevo.
 *
 * Es una función pura: no toca el almacén recibido. El récord de un modo sólo
 * se sustituye cuando el resultado es mejor, así que bajar el rendimiento nunca
 * borra la marca anterior. El último intento y el récord de racha se actualizan
 * siempre.
 */
export function registrarIntento(
  almacen,
  { modo, aciertos, total, porcentaje, fecha, rachaMaxima = 0 } = {},
) {
  const base = validarAlmacen(almacen) ?? crearAlmacenVacio();
  const intento = normalizarUltimoIntento({ modo, aciertos, total, porcentaje, fecha });
  if (!intento) return base;

  const registros = { ...base.registros };
  const previo = registros[intento.modo];
  if (!previo || intento.porcentaje > previo.porcentaje) {
    registros[intento.modo] = {
      aciertos: intento.aciertos,
      total: intento.total,
      porcentaje: intento.porcentaje,
      fecha: intento.fecha,
    };
  }

  const racha = Number.isInteger(rachaMaxima) && rachaMaxima > 0 ? rachaMaxima : 0;

  return {
    version: VERSION_ALMACEN,
    registros,
    rachaMaxima: Math.max(base.rachaMaxima, racha),
    ultimoIntento: intento,
    reto:
      intento.modo === 'reto'
        ? { fecha: intento.fecha, aciertos: intento.aciertos, total: intento.total }
        : base.reto,
  };
}

/** Serializa el almacén para exportarlo a un fichero JSON. */
export function exportarAlmacen(almacen) {
  return JSON.stringify(validarAlmacen(almacen) ?? crearAlmacenVacio(), null, 2);
}

/**
 * Lee un progreso exportado. Devuelve `{ ok, almacen }` o `{ ok: false, error }`:
 * nunca lanza, y un texto que no sea un almacén válido no cambia nada.
 */
export function importarAlmacen(texto) {
  if (typeof texto !== 'string' || texto.trim() === '') return { ok: false, error: 'vacio' };

  let datos;
  try {
    datos = JSON.parse(texto);
  } catch {
    return { ok: false, error: 'json' };
  }

  const almacen = validarAlmacen(datos);
  if (!almacen) return { ok: false, error: 'esquema' };
  return { ok: true, almacen };
}
