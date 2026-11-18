// Carga de los manifiestos de test y normalización de sus bancos.
//
// El sitio tiene dos colecciones de preguntas, cada una con su manifiesto:
//   · oficiales — data/examenes/index.json, cuadernillos completos por convocatoria.
//   · propio    — data/banco/index.json, preguntas de elaboración propia por tema
//                 y, cuando exista, un banco de mezcla que cruza temas.
//
// Nada se carga por convención de nombres: se lee lo que declara el manifiesto, y
// si un fichero falla se sigue con los que sí cargan. Un banco que no aparece en
// la lista no existe para la web.
//
// Este módulo no toca el DOM y no tiene dependencias, así que lo importa el
// navegador y también scripts/verificar.mjs desde Node. Las funciones que
// deciden qué se enseña (entradas de un manifiesto, filtro de un enlace
// profundo, recuentos) son puras, para poder comprobarlas sin navegador.

const COLECCIONES = {
  oficiales: {
    ruta: 'data/examenes/index.json',
    clave: 'examenes',
    prefijo: 'data/examenes/',
    parametro: 'convocatoria',
  },
  propio: {
    ruta: 'data/banco/index.json',
    clave: 'bancos',
    prefijo: 'data/banco/',
    parametro: 'tema',
  },
};

export const COLECCIONES_TEST = Object.freeze(Object.keys(COLECCIONES));

/**
 * Entradas declaradas por un manifiesto, ya normalizadas.
 *
 * Cada entrada lleva el id con el que se filtra y se enlaza, la ruta del fichero
 * y el recuento declarado de preguntas. Se descartan las entradas sin archivo:
 * una entrada así no se puede cargar y solo dejaría un acceso roto.
 */
export function entradasDe(coleccion, manifiesto) {
  const config = COLECCIONES[coleccion];
  if (!config) return [];

  const lista = Array.isArray(manifiesto?.[config.clave]) ? manifiesto[config.clave] : [];

  return lista
    .filter((entrada) => typeof entrada?.archivo === 'string' && entrada.archivo.trim() !== '')
    .map((entrada) => ({
      id: String(entrada.id ?? entrada.archivo),
      archivo: entrada.archivo,
      ruta: `${config.prefijo}${entrada.archivo}`,
      tipo: typeof entrada.tipo === 'string' ? entrada.tipo : null,
      tema: Number.isInteger(entrada.tema) ? entrada.tema : null,
      convocatoria: Number(entrada.convocatoria) || null,
      promocion: Number(entrada.promocion) || null,
      preguntas: Math.max(0, Math.trunc(Number(entrada.preguntas) || 0)),
    }));
}

/** Nombre con el que se presenta una entrada: de dónde salen sus preguntas. */
export function etiquetaDeEntrada(coleccion, entrada) {
  if (!entrada) return '';
  if (coleccion === 'oficiales') {
    return `Convocatoria ${entrada.convocatoria} · promoción ${entrada.promocion}`;
  }
  if (entrada.tipo === 'mezcla') return 'Preguntas mezcladas';
  return `Tema ${entrada.tema}`;
}

/**
 * Traduce los parámetros de la URL al id de filtro de una entrada.
 *
 * Devuelve null cuando el parámetro no viene, no es un número o no corresponde a
 * ninguna entrada del manifiesto: entonces la página ignora el enlace profundo y
 * enseña la lista completa. Nunca inventa una entrada que el manifiesto no tenga.
 */
export function filtroDesdeParametros(coleccion, entradas, parametros) {
  const config = COLECCIONES[coleccion];
  if (!config) return null;

  const valor = parametros?.get?.(config.parametro);
  if (typeof valor !== 'string' || valor.trim() === '') return null;

  if (coleccion === 'oficiales') {
    const anio = Number(valor);
    if (!Number.isInteger(anio) || anio < 1) return null;
    return entradas.find((entrada) => entrada.convocatoria === anio)?.id ?? null;
  }

  // El banco de mezcla no tiene número de tema: se pide por su nombre y solo
  // existe si el manifiesto lo declara.
  if (valor === 'mezcla') {
    return entradas.find((entrada) => entrada.tipo === 'mezcla')?.id ?? null;
  }

  const tema = Number(valor);
  if (!Number.isInteger(tema) || tema < 1) return null;
  return entradas.find((entrada) => entrada.tema === tema)?.id ?? null;
}

/** Recuentos de una colección a partir de su manifiesto, sin descargar preguntas. */
export function contarEntradas(coleccion, entradas) {
  const lista = Array.isArray(entradas) ? entradas : [];
  return {
    entradas: lista.length,
    preguntas: lista.reduce((suma, entrada) => suma + entrada.preguntas, 0),
    temas: lista.filter((entrada) => entrada.tipo === 'tema').length,
    mezclas: lista.filter((entrada) => entrada.tipo === 'mezcla').length,
  };
}

/* --- Red ------------------------------------------------------------------ */

async function leerJson(ruta) {
  const respuesta = await fetch(ruta);
  if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
  return respuesta.json();
}

/** Lee el manifiesto de una colección. Lanza si no se puede: la página lo cuenta. */
export async function leerManifiesto(coleccion) {
  const config = COLECCIONES[coleccion];
  if (!config) throw new Error(`Colección desconocida: ${coleccion}`);
  return leerJson(config.ruta);
}

/** Sólo el manifiesto: lo que necesita la portada para sus recuentos. */
export async function contarColeccion(coleccion) {
  const entradas = entradasDe(coleccion, await leerManifiesto(coleccion));
  return { entradas, ...contarEntradas(coleccion, entradas) };
}

/**
 * Un banco cargado, con la etiqueta de origen ya puesta en cada pregunta.
 *
 * El motor (`test-core.js`) recibe bancos con `convocatoria` y `promocion`
 * porque el banco oficial las tiene; el banco propio no las usa y van a null.
 * La etiqueta `origen` es lo que la interfaz enseña sobre cada pregunta: la
 * convocatoria en los oficiales y el tema (o «Preguntas mezcladas») en los propios.
 */
async function leerBanco(coleccion, entrada) {
  const banco = await leerJson(entrada.ruta);
  if (!Array.isArray(banco.preguntas) || banco.preguntas.length === 0) {
    throw new Error('el fichero no contiene preguntas');
  }

  const origen = etiquetaDeEntrada(coleccion, entrada);

  return {
    ...banco,
    id: entrada.id,
    origen,
    convocatoria: entrada.convocatoria,
    promocion: entrada.promocion,
    preguntas: banco.preguntas.map((pregunta) => ({ ...pregunta, origen })),
  };
}

/**
 * Carga todos los bancos de una colección.
 *
 * Devuelve `{ entradas, bancos, errores }`: los bancos que se pudieron leer y una
 * línea por fichero que falló. La página sigue funcionando con los disponibles.
 */
export async function cargarColeccion(coleccion) {
  const entradas = entradasDe(coleccion, await leerManifiesto(coleccion));
  const resultados = await Promise.allSettled(
    entradas.map((entrada) => leerBanco(coleccion, entrada)),
  );

  const bancos = [];
  const errores = [];

  resultados.forEach((resultado, i) => {
    if (resultado.status === 'fulfilled') bancos.push(resultado.value);
    else errores.push(`${entradas[i].archivo} (${resultado.reason?.message ?? 'error desconocido'})`);
  });

  return { entradas, bancos, errores };
}
