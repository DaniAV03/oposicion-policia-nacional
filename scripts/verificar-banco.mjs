// Verifica el banco propio de preguntas (data/banco/) contra el esquema documentado en
// data/banco/ESQUEMA.md, y contra el validador del propio motor de test: una pregunta que
// el motor descarte por no cumplir `esPreguntaValida` desaparecería del pool sin avisar,
// así que se comprueba aquí y se trata como fallo.
//
// Incluye una autoprueba: construye preguntas rotas a propósito y exige que cada defecto
// se detecte. Sin eso, un verificador que no ve nada no demuestra que el banco esté bien.

import { readFile, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

import { esPreguntaValida } from '../assets/js/test-core.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const carpetaBanco = join(raiz, 'data', 'banco');
const carpetaTemas = join(raiz, 'data', 'temas');
const carpetaExamenes = join(raiz, 'data', 'examenes');

const TOTAL_TEMAS = 45;
const MIN_EXPLICACION = 40;
const MAX_PROPORCION_OPCION = 0.55;
const DIFICULTADES = ['baja', 'media', 'alta'];
const TRAMPAS = ['plazo', 'organo', 'mayoria', 'jerarquia', 'competencia', 'absoluto', 'ninguna'];
const TIPOS = ['tema', 'mezcla'];

let fallos = 0;
let avisos = 0;

const fallo = (mensaje) => {
  fallos += 1;
  console.error(`FALLO ${mensaje}`);
};
const aviso = (mensaje) => {
  avisos += 1;
  console.log(`aviso ${mensaje}`);
};
const bien = (mensaje) => console.log(`ok    ${mensaje}`);

/* --- Utilidades ----------------------------------------------------------- */

const esTexto = (valor) => typeof valor === 'string' && valor.trim() !== '';

function normalizar(texto) {
  return String(texto ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Normaliza una opción para compararla con las otras dos.
 *
 * Aquí **no** se pasa a minúsculas a propósito: hay preguntas de ortografía donde la única
 * diferencia entre dos opciones es la mayúscula («el tribunal de instancia» / «el Tribunal de
 * Instancia»), y tratarlas como iguales invalidaría una pregunta legítima.
 */
function normalizarOpcion(texto) {
  return String(texto ?? '').replace(/\s+/g, ' ').trim();
}

const dosDigitos = (numero) => String(numero).padStart(2, '0');

/**
 * Apartados citables de un tema: el texto de sus <h2> y <h3>. Una referencia que no
 * coincida con ninguno de ellos es una referencia inventada, y eso se detecta.
 */
const cacheApartados = new Map();

async function apartadosDeTema(numero) {
  if (cacheApartados.has(numero)) return cacheApartados.get(numero);
  let conjunto = new Set();
  try {
    const html = await readFile(join(carpetaTemas, `${dosDigitos(numero)}.html`), 'utf8');
    for (const m of html.matchAll(/<h([23])[^>]*>([\s\S]*?)<\/h\1>/g)) {
      conjunto.add(normalizar(m[2]));
    }
  } catch {
    conjunto = null;
  }
  cacheApartados.set(numero, conjunto);
  return conjunto;
}

/** Enunciados del banco oficial, para no repetirlos. */
async function enunciadosOficiales() {
  const conjunto = new Set();
  let manifiesto;
  try {
    manifiesto = JSON.parse(await readFile(join(carpetaExamenes, 'index.json'), 'utf8'));
  } catch {
    return conjunto;
  }
  for (const examen of manifiesto.examenes ?? []) {
    try {
      const banco = JSON.parse(await readFile(join(carpetaExamenes, examen.archivo), 'utf8'));
      for (const pregunta of banco.preguntas ?? []) {
        if (esTexto(pregunta.enunciado)) conjunto.add(normalizar(pregunta.enunciado));
      }
    } catch {
      /* Si el banco oficial no se puede leer, verificar-examenes.mjs es quien lo dice. */
    }
  }
  return conjunto;
}

/* --- Validación de una pregunta ------------------------------------------- */

/**
 * Devuelve la lista de defectos de una pregunta. Cada defecto lleva un `codigo` estable,
 * que es lo que la autoprueba comprueba que se dispara.
 */
export function erroresDePregunta(pregunta, contexto) {
  const {
    tipo,
    temaDelBanco,
    apartados,
    idsVistos = new Set(),
    enunciadosVistos = new Set(),
    oficiales = new Set(),
  } = contexto;

  const errores = [];
  const anota = (codigo, detalle) => errores.push({ codigo, detalle });

  if (!pregunta || typeof pregunta !== 'object') {
    anota('objeto', 'la pregunta no es un objeto');
    return errores;
  }

  // El motor tiene la última palabra sobre la forma.
  if (!esPreguntaValida(pregunta)) {
    anota('motor', 'el motor de test la descartaría (esPreguntaValida devuelve falso)');
  }

  // Id.
  const patronId =
    tipo === 'tema' ? new RegExp(`^t${dosDigitos(temaDelBanco)}-g\\d{3}$`) : /^mx-\d{3}$/;
  if (!esTexto(pregunta.id)) anota('id-formato', 'el id falta');
  else if (!patronId.test(pregunta.id)) {
    anota(
      'id-formato',
      `«${pregunta.id}» no sigue el patrón ${tipo === 'tema' ? `t${dosDigitos(temaDelBanco)}-gNNN` : 'mx-NNN'}`,
    );
  } else if (idsVistos.has(pregunta.id)) {
    anota('id-duplicado', `el id «${pregunta.id}» ya existe`);
  }

  // Tema.
  if (!Number.isInteger(pregunta.tema) || pregunta.tema < 1 || pregunta.tema > TOTAL_TEMAS) {
    anota('tema-rango', `el tema «${pregunta.tema}» no está entre 1 y ${TOTAL_TEMAS}`);
  } else if (tipo === 'tema' && pregunta.tema !== temaDelBanco) {
    anota('tema-no-coincide', `la pregunta declara el tema ${pregunta.tema} y el banco es el ${temaDelBanco}`);
  }

  // Cruce de temas (solo mezcla).
  if (pregunta.temas !== undefined) {
    const temas = pregunta.temas;
    if (!Array.isArray(temas) || temas.length < 2 || temas.length > 2) {
      anota('temas-cruce', '«temas» tiene que ser una lista de dos temas');
    } else if (temas.some((t) => !Number.isInteger(t) || t < 1 || t > TOTAL_TEMAS)) {
      anota('temas-cruce', '«temas» contiene un tema fuera de rango');
    } else if (temas[0] !== pregunta.tema) {
      anota('temas-cruce', 'el primer tema de «temas» tiene que ser el de «tema»');
    } else if (temas[0] === temas[1]) {
      anota('temas-cruce', '«temas» repite el mismo tema: eso no cruza nada');
    }
  }

  // Dificultad y trampa declaradas.
  if (!DIFICULTADES.includes(pregunta.dificultad)) {
    anota('dificultad', `dificultad «${pregunta.dificultad}» no admitida`);
  }
  if (!TRAMPAS.includes(pregunta.trampa)) {
    anota('trampa', `trampa «${pregunta.trampa}» no admitida`);
  }

  // Enunciado.
  if (!esTexto(pregunta.enunciado)) anota('enunciado', 'el enunciado falta');
  else {
    const clave = normalizar(pregunta.enunciado);
    if (enunciadosVistos.has(clave)) anota('enunciado-duplicado', 'el enunciado ya está en el banco');
    if (oficiales.has(clave)) anota('enunciado-oficial', 'el enunciado es de un examen oficial');
  }

  // Opciones.
  if (!Array.isArray(pregunta.opciones) || pregunta.opciones.length !== 3) {
    anota('opciones-numero', 'tiene que haber exactamente 3 opciones');
  } else {
    if (!pregunta.opciones.every(esTexto)) anota('opciones-texto', 'alguna opción está vacía');
    const normalizadas = pregunta.opciones.map(normalizarOpcion);
    if (new Set(normalizadas).size !== normalizadas.length) {
      anota('opciones-texto', 'hay dos opciones idénticas');
    }
  }

  // Respuesta correcta.
  if (!Number.isInteger(pregunta.correcta) || pregunta.correcta < 0 || pregunta.correcta > 2) {
    anota('correcta-rango', `«correcta» vale ${pregunta.correcta} y tiene que ser 0, 1 o 2`);
  }

  // Explicación docente.
  if (!esTexto(pregunta.explicacion)) anota('explicacion-corta', 'la explicación falta');
  else if (pregunta.explicacion.trim().length < MIN_EXPLICACION) {
    anota('explicacion-corta', `la explicación tiene ${pregunta.explicacion.trim().length} caracteres y el mínimo es ${MIN_EXPLICACION}`);
  }

  // Referencia verificable.
  const referencia = pregunta.referencia;
  if (!referencia || typeof referencia !== 'object') {
    anota('referencia-apartado', 'la referencia falta');
  } else {
    if (!esTexto(referencia.norma)) anota('referencia-norma', 'la referencia no nombra la norma');
    if (!esTexto(referencia.articulo)) anota('referencia-articulo', 'la referencia no nombra el artículo');
    if (!esTexto(referencia.apartado)) {
      anota('referencia-apartado', 'la referencia no nombra el apartado');
    } else if (apartados) {
      const buscado = normalizar(referencia.apartado);
      const existe = [...apartados].some((titulo) => titulo === buscado);
      if (!existe) {
        anota('referencia-apartado', `el apartado «${referencia.apartado}» no existe en el tema`);
      }
    }
  }

  return errores;
}

/* --- Autoprueba del validador --------------------------------------------- */

async function autoprueba() {
  console.log('\nAutoprueba del validador');
  const apartados = await apartadosDeTema(1);
  const base = {
    id: 't01-g001',
    tema: 1,
    dificultad: 'media',
    trampa: 'plazo',
    enunciado: 'Pregunta de prueba con un enunciado suficientemente largo.',
    opciones: ['Una.', 'Otra.', 'La tercera.'],
    correcta: 1,
    explicacion: 'Una explicación de prueba que pasa del mínimo de cuarenta caracteres sin problema.',
    referencia: { apartado: '2.2. Acepciones', norma: 'Código Civil', articulo: 'art. 22' },
  };

  const ctx = (extra = {}) => ({
    tipo: 'tema',
    temaDelBanco: 1,
    apartados,
    idsVistos: new Set(),
    enunciadosVistos: new Set(),
    oficiales: new Set(),
    ...extra,
  });

  const codigos = (pregunta, extra) => erroresDePregunta(pregunta, ctx(extra)).map((e) => e.codigo);

  const casos = [
    ['una pregunta correcta no da errores', base, [], (c) => c.length === 0],
    ['el id con mal formato se detecta', { ...base, id: 't1-1' }, [], (c) => c.includes('id-formato')],
    ['el id repetido se detecta', base, { idsVistos: new Set(['t01-g001']) }, (c) => c.includes('id-duplicado')],
    ['el tema fuera de rango se detecta', { ...base, tema: 46 }, [], (c) => c.includes('tema-rango')],
    ['el tema que no coincide con el fichero se detecta', { ...base, tema: 2 }, [], (c) => c.includes('tema-no-coincide')],
    ['la dificultad inventada se detecta', { ...base, dificultad: 'imposible' }, [], (c) => c.includes('dificultad')],
    ['la trampa inventada se detecta', { ...base, trampa: 'suerte' }, [], (c) => c.includes('trampa')],
    ['dos opciones se detectan', { ...base, opciones: ['Una.', 'Otra.'] }, [], (c) => c.includes('correcta-rango') || c.includes('opciones-numero') || c.includes('motor')],
    ['las opciones repetidas se detectan', { ...base, opciones: ['Igual.', 'Igual.', 'Otra.'] }, [], (c) => c.includes('opciones-texto')],
    ['dos opciones que sólo cambian en mayúsculas no se marcan', { ...base, opciones: ['El Tribunal lo acordó.', 'el tribunal lo acordó.', 'Otra cosa distinta.'] }, [], (c) => !c.includes('opciones-texto')],
    ['la correcta fuera de rango se detecta', { ...base, correcta: 3 }, [], (c) => c.includes('correcta-rango')],
    ['la explicación corta se detecta', { ...base, explicacion: 'Porque sí.' }, [], (c) => c.includes('explicacion-corta')],
    ['la explicación ausente se detecta', { ...base, explicacion: '' }, [], (c) => c.includes('explicacion-corta')],
    ['el apartado inventado se detecta', { ...base, referencia: { ...base.referencia, apartado: '33. Un apartado que no existe' } }, [], (c) => c.includes('referencia-apartado')],
    ['la referencia sin norma se detecta', { ...base, referencia: { ...base.referencia, norma: '' } }, [], (c) => c.includes('referencia-norma')],
    ['la referencia sin artículo se detecta', { ...base, referencia: { ...base.referencia, articulo: '' } }, [], (c) => c.includes('referencia-articulo')],
    ['el enunciado repetido se detecta', base, { enunciadosVistos: new Set([normalizar(base.enunciado)]) }, (c) => c.includes('enunciado-duplicado')],
    ['el enunciado copiado del oficial se detecta', base, { oficiales: new Set([normalizar(base.enunciado)]) }, (c) => c.includes('enunciado-oficial')],
    ['el cruce de temas mal formado se detecta', { ...base, temas: [1, 1] }, [], (c) => c.includes('temas-cruce')],
  ];

  for (const [nombre, pregunta, extra, esperado] of casos) {
    const obtenidos = codigos(pregunta, extra);
    if (esperado(obtenidos)) bien(nombre);
    else fallo(`${nombre} (códigos obtenidos: ${obtenidos.join(', ') || 'ninguno'})`);
  }
}

/* --- Lectura del banco ---------------------------------------------------- */

async function ficherosDelBanco(dir = carpetaBanco) {
  const encontrados = [];
  for (const entrada of await readdir(dir, { withFileTypes: true })) {
    const ruta = join(dir, entrada.name);
    if (entrada.isDirectory()) encontrados.push(...(await ficherosDelBanco(ruta)));
    else if (entrada.name.endsWith('.json') && entrada.name !== 'index.json') {
      encontrados.push(relative(carpetaBanco, ruta).replaceAll('\\', '/'));
    }
  }
  return encontrados.sort();
}

async function verificar() {
  await autoprueba();

  /* Manifiesto */
  console.log('\nManifiesto');
  let manifiesto;
  try {
    manifiesto = JSON.parse(await readFile(join(carpetaBanco, 'index.json'), 'utf8'));
    bien('data/banco/index.json es JSON válido');
  } catch (error) {
    fallo(`data/banco/index.json no se puede leer: ${error.message}`);
    return;
  }

  if (manifiesto.version !== 1) fallo(`el manifiesto declara version ${manifiesto.version} y se espera 1`);
  else bien('el manifiesto declara la versión 1');

  if (!Array.isArray(manifiesto.bancos)) {
    fallo('el manifiesto no tiene una lista «bancos»');
    return;
  }
  bien(`el manifiesto declara ${manifiesto.bancos.length} banco(s)`);

  const archivosDeclarados = new Set();
  const idsDeclarados = new Set();
  for (const entrada of manifiesto.bancos) {
    const etiqueta = `banco «${entrada?.id ?? '?'}»`;
    if (!esTexto(entrada?.id)) fallo(`${etiqueta}: falta el id`);
    else if (idsDeclarados.has(entrada.id)) fallo(`${etiqueta}: id repetido`);
    else idsDeclarados.add(entrada.id);

    if (!esTexto(entrada?.archivo)) {
      fallo(`${etiqueta}: falta el archivo`);
      continue;
    }
    if (entrada.archivo.includes('..') || entrada.archivo.startsWith('/')) {
      fallo(`${etiqueta}: la ruta «${entrada.archivo}» sale de data/banco/`);
      continue;
    }
    archivosDeclarados.add(entrada.archivo);

    try {
      await stat(join(carpetaBanco, entrada.archivo));
    } catch {
      fallo(`${etiqueta}: no existe el fichero ${entrada.archivo}`);
      continue;
    }

    if (!TIPOS.includes(entrada.tipo)) {
      fallo(`${etiqueta}: tipo «${entrada.tipo}» no admitido`);
      continue;
    }
    if (entrada.tipo === 'tema') {
      if (!Number.isInteger(entrada.tema) || entrada.tema < 1 || entrada.tema > TOTAL_TEMAS) {
        fallo(`${etiqueta}: un banco de tema necesita «tema» entre 1 y ${TOTAL_TEMAS}`);
        continue;
      }
      const esperado = `temas/${dosDigitos(entrada.tema)}.json`;
      if (entrada.archivo !== esperado) {
        fallo(`${etiqueta}: el tema ${entrada.tema} se guarda en ${esperado}, no en ${entrada.archivo}`);
      }
    } else if (entrada.tema !== undefined && entrada.tema !== null) {
      fallo(`${etiqueta}: un banco de mezcla no declara un tema en el manifiesto`);
    }
  }

  const enDisco = await ficherosDelBanco();
  for (const archivo of enDisco) {
    if (!archivosDeclarados.has(archivo)) {
      fallo(`el fichero ${archivo} existe pero no está en el manifiesto: no se cargaría nunca`);
    }
  }
  bien('no hay ficheros de banco fuera del manifiesto');

  /* Ficheros */
  const idsVistos = new Set();
  const enunciadosVistos = new Set();
  const oficiales = await enunciadosOficiales();
  const temasConBanco = new Set();
  let totalPreguntas = 0;

  for (const entrada of manifiesto.bancos) {
    if (!archivosDeclarados.has(entrada?.archivo)) continue;
    const ruta = join(carpetaBanco, entrada.archivo);
    console.log(`\n${entrada.archivo}`);

    let banco;
    try {
      banco = JSON.parse(await readFile(ruta, 'utf8'));
    } catch (error) {
      fallo(`${entrada.archivo}: no es JSON válido (${error.message})`);
      continue;
    }

    if (banco.version !== 1) fallo(`${entrada.archivo}: declara version ${banco.version} y se espera 1`);
    if (banco.tipo !== entrada.tipo) {
      fallo(`${entrada.archivo}: el fichero dice tipo «${banco.tipo}» y el manifiesto «${entrada.tipo}»`);
    }
    if (entrada.tipo === 'tema') {
      if (banco.tema !== entrada.tema) {
        fallo(`${entrada.archivo}: el fichero dice tema ${banco.tema} y el manifiesto ${entrada.tema}`);
      }
      temasConBanco.add(entrada.tema);
    }
    if (!esTexto(banco.titulo)) fallo(`${entrada.archivo}: falta el título del banco`);

    if (!Array.isArray(banco.preguntas)) {
      fallo(`${entrada.archivo}: no tiene una lista «preguntas»`);
      continue;
    }
    if (banco.preguntas.length === 0) {
      fallo(`${entrada.archivo}: un banco del manifiesto no puede estar vacío`);
      continue;
    }
    if (entrada.preguntas !== banco.preguntas.length) {
      fallo(
        `${entrada.archivo}: el manifiesto declara ${entrada.preguntas} preguntas y el fichero tiene ${banco.preguntas.length}`,
      );
    }

    const apartados = entrada.tipo === 'tema' ? await apartadosDeTema(entrada.tema) : null;
    if (entrada.tipo === 'tema' && apartados === null) {
      fallo(`${entrada.archivo}: no se encuentra data/temas/${dosDigitos(entrada.tema)}.html para verificar las referencias`);
    }

    const recuentoOpciones = [0, 0, 0];
    let defectosDelFichero = 0;

    for (const [indice, pregunta] of banco.preguntas.entries()) {
      const etiqueta = `${entrada.archivo} · pregunta ${indice + 1}`;
      const errores = erroresDePregunta(pregunta, {
        tipo: entrada.tipo,
        temaDelBanco: entrada.tema,
        apartados: entrada.tipo === 'tema' ? apartados : await apartadosDeTema(pregunta?.tema),
        idsVistos,
        enunciadosVistos,
        oficiales,
      });

      if (errores.length === 0) {
        idsVistos.add(pregunta.id);
        enunciadosVistos.add(normalizar(pregunta.enunciado));
        if (Number.isInteger(pregunta.correcta)) recuentoOpciones[pregunta.correcta] += 1;
      } else {
        // Un id con defectos no se anota: si no, el siguiente duplicado se confunde.
        defectosDelFichero += errores.length;
        for (const error of errores) fallo(`${etiqueta}: ${error.detalle} [${error.codigo}]`);
      }
    }

    totalPreguntas += banco.preguntas.length;

    if (banco.preguntas.length >= 5) {
      for (const [opcion, cuantas] of recuentoOpciones.entries()) {
        const proporcion = cuantas / banco.preguntas.length;
        if (proporcion > MAX_PROPORCION_OPCION) {
          aviso(
            `${entrada.archivo}: la opción ${opcion} es la correcta en ${cuantas} de ${banco.preguntas.length} (${Math.round(proporcion * 100)} %); conviene repartir`,
          );
        }
      }
    }

    if (defectosDelFichero === 0) {
      bien(`${entrada.archivo}: ${banco.preguntas.length} pregunta(s) sin defectos`);
    }
  }

  /* Cobertura */
  console.log('\nCobertura');
  console.log(`Temas con banco propio: ${temasConBanco.size} de ${TOTAL_TEMAS}`);
  console.log(`Preguntas propias: ${totalPreguntas}`);
  if (temasConBanco.size === 0) {
    aviso('el banco propio está vacío: el esquema y el verificador están listos, falta el contenido');
  }
}

await verificar();

console.log(
  fallos === 0
    ? `\nBanco propio válido${avisos ? ` (${avisos} aviso(s))` : ''}.`
    : `\n${fallos} defecto(s) en el banco propio.`,
);

process.exit(fallos === 0 ? 0 : 1);
