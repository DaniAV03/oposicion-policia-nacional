// Diagnóstico de puntos débiles: qué tema vas mal y qué pregunta fallas siempre.
//
// Reglas de este fichero, las mismas que las de `test-core.js`:
//   · Sin acceso al DOM y sin efectos secundarios al importarlo.
//   · Sin dependencias: no importa nada de otros módulos. Tampoco de
//     `test-core.js`, porque el verificador carga los dos con una URL `data:` y
//     un import relativo dentro de una URL `data:` no se resuelve. Lo que se
//     comparte son las reglas, no el código.
//   · Todo lo que devuelven las funciones es un dato nuevo: ni el almacén ni el
//     banco que reciben se modifican.
//
// Sólo se diagnostica el banco propio. Las preguntas de los cuadernillos
// oficiales no se clasifican por tema (S5), así que quedan fuera por partida
// doble: el almacén no las anota y, si alguna apareciera, el banco no le da tema
// y no hay nada que avisar. Un aviso sin tema no diría qué estudiar.
//
// Los textos de la interfaz no se componen aquí: este módulo devuelve datos y las
// cifras ya formateadas (siempre recuento y porcentaje juntos) para que la
// interfaz no tenga que decidir cómo se cuenta un acierto.

/* --- Umbrales -------------------------------------------------------------- */

/**
 * Fallos de la misma pregunta a partir de los cuales se avisa.
 *
 * Tres, no dos: con dos fallos se puede haber tenido un mal día, y una alerta que
 * salta a la segunda deja de significar nada. Tres fallos en la misma pregunta ya
 * no es azar.
 */
export const MIN_FALLOS_QUEMADA = 3;

/**
 * Intentos mínimos de un tema antes de juzgarlo.
 *
 * Tres es el mínimo con el que un porcentaje dice algo: con uno o dos, un solo
 * acierto o un solo fallo mueve la cifra 33 puntos, y la web estaría avisando de
 * un tema con la misma confianza con la que calla de otro.
 */
export const MIN_INTENTOS_TEMA = 3;

/**
 * Acierto acumulado por debajo del cual el tema es flojo, en porcentaje.
 *
 * 60 % es el suelo de lo que se puede llamar aprobar en un test de tres opciones
 * (el azar da un 33 %), redondeado hacia abajo. La comparación se hace con la
 * fracción exacta, no con el porcentaje redondeado, para que un tema con 3 de 5
 * (60 %) no salga flojo por un decimal.
 */
export const UMBRAL_ACIERTO_FLOJO = 60;

/* --- Utilidades de cifras -------------------------------------------------- */

/** Porcentaje con un decimal, igual que `tasaDeAcierto` de `test-core.js`. */
function porcentajeAcierto(aciertos, intentos) {
  const buenas = Math.max(0, Math.trunc(Number(aciertos) || 0));
  const total = Math.max(0, Math.trunc(Number(intentos) || 0));
  if (total === 0) return 0;
  return Math.round((Math.min(buenas, total) / total) * 1000) / 10;
}

/** Número en castellano: 60 → «60», 33.3 → «33,3». */
function formatearPorcentaje(valor) {
  return String(Math.round(Number(valor) * 10) / 10).replace('.', ',');
}

/**
 * Recuento y porcentaje en la misma frase: «3 de 5 (60 %)».
 *
 * Las cifras del diagnóstico siempre se enseñan así. Un porcentaje solo miente
 * por omisión: «33 %» de tres preguntas y «33 %» de treinta no son el mismo dato,
 * y quien estudia tiene derecho a saber cuánto hay detrás.
 */
export function textoAcierto(aciertos, intentos) {
  const total = Math.max(0, Math.trunc(Number(intentos) || 0));
  const buenas = Math.max(0, Math.min(Math.trunc(Number(aciertos) || 0), total));
  return `${buenas} de ${total} (${formatearPorcentaje(porcentajeAcierto(buenas, total))} %)`;
}

/** Enlace al tema del temario, que es donde se estudia lo que la pregunta pide. */
export function enlaceTema(tema) {
  return `tema.html?n=${Math.trunc(Number(tema) || 0)}`;
}

/* --- Lectura del almacén y del banco --------------------------------------- */

/**
 * Preguntas del banco que se pueden diagnosticar, indexadas por id.
 *
 * Se descartan las que no declaran un tema utilizable, que son todas las de los
 * cuadernillos oficiales. Si el banco repite un id, manda la primera: el motor ya
 * descarta los repetidos al construir el pool.
 */
function preguntasClasificables(banco) {
  const indice = new Map();

  for (const pregunta of Array.isArray(banco) ? banco : []) {
    if (!pregunta || typeof pregunta.id !== 'string' || pregunta.id.trim() === '') continue;
    if (!Number.isInteger(pregunta.tema) || pregunta.tema < 1) continue;
    if (indice.has(pregunta.id)) continue;
    indice.set(pregunta.id, pregunta);
  }

  return indice;
}

/** Texto del apartado del tema que hay que estudiar, o cadena vacía. */
function apartadoDe(pregunta) {
  const texto = pregunta?.referencia?.apartado;
  return typeof texto === 'string' ? texto.trim() : '';
}

/**
 * Cruza el registro por pregunta con el banco.
 *
 * Devuelve una fila por pregunta registrada que el banco puede explicar: sin
 * enunciado ni apartado, un aviso no dice qué estudiar, así que no se pinta. El
 * tema que manda es el del banco, no el del almacén: si el almacén se editó a
 * mano y dice otro, la verdad es la del banco.
 */
function filasClasificadas(almacen, banco) {
  const registros = almacen?.porPregunta;
  if (!registros || typeof registros !== 'object') return [];

  const indice = preguntasClasificables(banco);
  const filas = [];

  for (const [id, registro] of Object.entries(registros)) {
    const pregunta = indice.get(id);
    if (!pregunta) continue;
    if (!registro || !Number.isInteger(registro.intentos) || registro.intentos < 1) continue;

    const intentos = registro.intentos;
    const fallos = Math.min(Math.max(0, Number(registro.fallos) || 0), intentos);
    const rachaFallos = Math.min(Math.max(0, Number(registro.rachaFallos) || 0), fallos);

    filas.push({
      id,
      tema: pregunta.tema,
      enunciado: typeof pregunta.enunciado === 'string' ? pregunta.enunciado.trim() : '',
      apartado: apartadoDe(pregunta),
      intentos,
      fallos,
      aciertos: intentos - fallos,
      rachaFallos,
      ultimoFallo: typeof registro.ultimoFallo === 'string' ? registro.ultimoFallo : null,
    });
  }

  return filas;
}

/** Fecha más reciente de una lista de fechas `YYYY-MM-DD`, o null. */
function fechaMasReciente(fechas) {
  return fechas.filter((fecha) => typeof fecha === 'string').sort().pop() ?? null;
}

/** Apartados que hay que estudiar, del más fallado al menos: sin repetir. */
function apartadosQueEstudiar(filas) {
  const porApartado = new Map();

  for (const fila of filas) {
    if (!fila.apartado || fila.fallos === 0) continue;
    porApartado.set(fila.apartado, (porApartado.get(fila.apartado) ?? 0) + fila.fallos);
  }

  return [...porApartado.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
    .map(([apartado]) => apartado);
}

/** Agrupa las filas clasificadas por tema, con sus totales. */
function resumenPorTema(filas) {
  const temas = new Map();

  for (const fila of filas) {
    const tema = temas.get(fila.tema) ?? {
      tema: fila.tema,
      intentos: 0,
      fallos: 0,
      preguntas: [],
    };
    tema.intentos += fila.intentos;
    tema.fallos += fila.fallos;
    tema.preguntas.push(fila);
    temas.set(fila.tema, tema);
  }

  return [...temas.values()]
    .map((tema) => {
      const aciertos = tema.intentos - tema.fallos;
      return {
        tema: tema.tema,
        intentos: tema.intentos,
        fallos: tema.fallos,
        aciertos,
        porcentaje: porcentajeAcierto(aciertos, tema.intentos),
        texto: textoAcierto(aciertos, tema.intentos),
        preguntas: tema.preguntas,
      };
    })
    .sort((a, b) => a.tema - b.tema);
}

/* --- Los tres avisos ------------------------------------------------------- */

/**
 * Preguntas quemadas: la misma pregunta fallada `MIN_FALLOS_QUEMADA` veces o más.
 *
 * Se ordenan de más fallos a menos y, a igualdad, por id, para que la lista no
 * cambie de orden entre dos visitas con los mismos datos.
 */
export function preguntasQuemadas(almacen, banco) {
  return filasClasificadas(almacen, banco)
    .filter((fila) => fila.fallos >= MIN_FALLOS_QUEMADA)
    .sort((a, b) => b.fallos - a.fallos || a.id.localeCompare(b.id, 'es'))
    .map((fila) => ({
      id: fila.id,
      tema: fila.tema,
      enunciado: fila.enunciado,
      apartado: fila.apartado,
      intentos: fila.intentos,
      fallos: fila.fallos,
      rachaFallos: fila.rachaFallos,
      ultimoFallo: fila.ultimoFallo,
      enlace: enlaceTema(fila.tema),
    }));
}

/**
 * Temas flojos: `MIN_INTENTOS_TEMA` intentos o más y menos de
 * `UMBRAL_ACIERTO_FLOJO` % de acierto.
 *
 * La comparación es exacta sobre la fracción (`aciertos * 100 < umbral *
 * intentos`), no sobre el porcentaje redondeado: con el redondeo, un tema a un
 * decimal del umbral cambiaría de veredicto según cómo se pinte la cifra.
 */
export function temasFlojos(almacen, banco) {
  return resumenPorTema(filasClasificadas(almacen, banco))
    .filter(
      (tema) =>
        tema.intentos >= MIN_INTENTOS_TEMA &&
        tema.aciertos * 100 < UMBRAL_ACIERTO_FLOJO * tema.intentos,
    )
    .sort((a, b) => a.porcentaje - b.porcentaje || b.intentos - a.intentos || a.tema - b.tema)
    .map((tema) => ({
      tema: tema.tema,
      intentos: tema.intentos,
      fallos: tema.fallos,
      aciertos: tema.aciertos,
      porcentaje: tema.porcentaje,
      texto: tema.texto,
      apartados: apartadosQueEstudiar(tema.preguntas),
      enlace: enlaceTema(tema.tema),
    }));
}

/**
 * Temas en riesgo: se acertaba y se ha empezado a fallar.
 *
 * Criterio, y por qué éste:
 *
 *   1. El tema tiene al menos `MIN_INTENTOS_TEMA` intentos, el mismo mínimo que
 *      el tema flojo. Con menos datos, el aviso sería ruido.
 *   2. Su acierto acumulado llega al umbral. Si está por debajo ya es un tema
 *      flojo, y repetirlo aquí con otro nombre no añadiría nada.
 *   3. Hay al menos una pregunta del tema en racha de fallos ahora mismo
 *      (`rachaFallos >= 1`) que además tiene algún acierto anterior. Eso es
 *      literalmente «se acertaba y se ha empezado a fallar».
 *
 * Se mira la racha de fallos de la pregunta y no la última respuesta del tema
 * porque es el único dato del almacén que dice qué está pasando *ahora* sin
 * depender del orden de guardado ni de la fecha: `ultimoFallo` guarda el día,
 * no la hora, y dos intentos del mismo día serían indistinguibles. Se exige
 * además un acierto anterior en esa misma pregunta porque un fallo en el primer
 * intento no es «esto antes lo sabías»: es una pregunta nueva que todavía no
 * está aprendida, y ese caso ya lo cubren las flojas con sus intentos.
 */
export function temasEnRiesgo(almacen, banco) {
  return resumenPorTema(filasClasificadas(almacen, banco))
    .filter((tema) => tema.intentos >= MIN_INTENTOS_TEMA)
    .filter((tema) => tema.aciertos * 100 >= UMBRAL_ACIERTO_FLOJO * tema.intentos)
    .map((tema) => {
      const enFallo = tema.preguntas.filter(
        (fila) => fila.rachaFallos >= 1 && fila.aciertos >= 1,
      );
      return { ...tema, preguntasEnFallo: enFallo };
    })
    .filter((tema) => tema.preguntasEnFallo.length > 0)
    .sort(
      (a, b) =>
        b.preguntasEnFallo.length - a.preguntasEnFallo.length ||
        a.porcentaje - b.porcentaje ||
        a.tema - b.tema,
    )
    .map((tema) => ({
      tema: tema.tema,
      intentos: tema.intentos,
      fallos: tema.fallos,
      aciertos: tema.aciertos,
      porcentaje: tema.porcentaje,
      texto: tema.texto,
      preguntasEnFallo: tema.preguntasEnFallo.length,
      ultimoFallo: fechaMasReciente(tema.preguntasEnFallo.map((fila) => fila.ultimoFallo)),
      apartados: apartadosQueEstudiar(tema.preguntasEnFallo),
      enlace: enlaceTema(tema.tema),
    }));
}

/**
 * Todo el diagnóstico de una vez, para pintar el panel.
 *
 * `vacio` es el estado honesto de quien todavía no ha hecho test del banco
 * propio: sin datos no hay diagnóstico, y la interfaz enseña eso en lugar de tres
 * listas de ceros que parecerían un resultado.
 */
export function diagnosticar(almacen, banco) {
  const filas = filasClasificadas(almacen, banco);

  return {
    quemadas: preguntasQuemadas(almacen, banco),
    flojas: temasFlojos(almacen, banco),
    enRiesgo: temasEnRiesgo(almacen, banco),
    preguntasConDatos: filas.length,
    temasConDatos: new Set(filas.map((fila) => fila.tema)).size,
    vacio: filas.length === 0,
  };
}
