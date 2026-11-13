// Pipeline de extracción de los cuestionarios oficiales de conocimientos de la
// oposición a Policía Nacional (Escala Básica), convocatorias 2020-2026.
//
// Descarga el PDF del cuestionario con User-Agent de navegador, extrae su texto con
// pdftotext y lo convierte en el JSON que consume el banco de test de la web.
//
// Uso:
//   node scripts/extraer-examenes.mjs --listar
//       Descarga cada cuestionario del catálogo, mide el texto extraído y publica la
//       tabla de disponibilidad (texto o escaneado) con el estado de cada promoción.
//
//   node scripts/extraer-examenes.mjs --id 2022-p39 --respuestas <100 letras> [--json ruta]
//       Extrae ese cuestionario, exige 100 preguntas con 3 opciones cada una y, si se
//       facilita la plantilla oficial como cadena de letras A/B/C, escribe el JSON.
//
// La clave de respuestas NO se deduce del enunciado: se transcribe de la plantilla
// oficial (hoja A9) publicada por el Área de Procesos Selectivos. Sin --respuestas el
// script solo valida la extracción de las preguntas y no escribe nada.

import { execFile } from 'node:child_process';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { promisify } from 'node:util';

const ejecutar = promisify(execFile);

const BASE = 'https://infopol.es/test-oficiales-policia';
const LICENCIA = 'Reutilización de información del sector público (Ley 37/2007, RD 1495/2011)';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const TOTAL_PREGUNTAS = 100;
const OPCIONES_POR_PREGUNTA = 3;

// Estado real de cada convocatoria de la ventana 2020-2026, comprobado contra la fuente.
// `estado: 'disponible'` exige cuestionario con capa de texto Y plantilla oficial legible.
const CATALOGO = [
  {
    convocatoria: 2020,
    promocion: 37,
    cuestionario: null,
    plantilla: null,
    estado: 'bloqueado',
    nota: 'No se publica cuestionario oficial de conocimientos: solo un «ANÁLISIS EXAMEN BÁSICA 2020» de Academia Águilas, que es material de academia y no cuestionario oficial.',
  },
  {
    convocatoria: 2021,
    promocion: 38,
    cuestionario: `${BASE}/EB-38-TEST.pdf`,
    plantilla: `${BASE}/EB-38-TEST-PLANTILLA.pdf`,
    estado: 'disponible',
    nota: 'Hoja A9 oficial de corrección («Escala Básica - 2021, convocatoria 24/08/2021»). El cuadernillo llega como reexportación cifrada, sin cabecera de la DGP: no lleva aviso de terceros, pero su maquetación no se puede acreditar como la original.',
  },
  {
    convocatoria: 2022,
    promocion: 39,
    cuestionario: `${BASE}/examen-escala-basica-39-2023-oposiciones-policia-nacional-modelo-A.pdf`,
    plantilla: `${BASE}/plantilla-A-respuestas-examen-escala-basica-39-2023-oposiciones-policia-nacional-modelo-A.pdf`,
    estado: 'disponible',
    nota: 'Cuestionario de la DGP (Área de Procesos Selectivos) con capa de texto y hoja A9 oficial de corrección.',
  },
  {
    convocatoria: 2023,
    promocion: 40,
    cuestionario: `${BASE}/test-conocimientos-policia-promocion-40.pdf`,
    plantilla: `${BASE}/plantilla-conocimiento-policia-promoción-40.pdf`,
    estado: 'bloqueado',
    nota: 'El único cuestionario disponible es una republicación de JURISPOL con reserva expresa de todos los derechos: material de editorial, no reutilizable.',
  },
  {
    convocatoria: 2024,
    promocion: 41,
    cuestionario: `${BASE}/Examen_teoria_ingreso_policia_p41_A.pdf`,
    plantilla: `${BASE}/Plantilla-modelo-A_41.pdf`,
    estado: 'bloqueado',
    nota: 'El cuestionario es un escaneo sin capa de texto (pdftotext devuelve 14 caracteres) y en este equipo no hay OCR instalado.',
  },
  {
    convocatoria: 2025,
    promocion: 42,
    cuestionario: null,
    plantilla: null,
    estado: 'bloqueado',
    nota: 'No hay cuestionario publicado en la fuente consultada.',
  },
  {
    convocatoria: 2026,
    promocion: 43,
    cuestionario: null,
    plantilla: null,
    estado: 'bloqueado',
    nota: 'No hay cuestionario publicado en la fuente consultada.',
  },
];

// Ruido de paginación y de la portada del cuadernillo oficial.
const RUIDO_PAGINA = /(?:Bas_\d+|P[áa]g\.?\s*\d+\s*A|PASE A LA P[AÁ]GINA SIGUIENTE|FIN DEL EJERCICIO|_{5,})/i;

/* --- Descarga y extracción de texto --------------------------------------- */

async function descargar(url, destino) {
  const respuesta = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/pdf,*/*' },
    signal: AbortSignal.timeout(120_000),
    redirect: 'follow',
  });
  if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status} al descargar ${url}`);
  const tipo = respuesta.headers.get('content-type') ?? '';
  if (!tipo.includes('pdf')) throw new Error(`Se esperaba un PDF y llegó «${tipo}» de ${url}`);
  const datos = Buffer.from(await respuesta.arrayBuffer());
  await writeFile(destino, datos);
  return datos.length;
}

async function extraerTexto(pdf, txt) {
  try {
    await ejecutar('pdftotext', ['-layout', '-enc', 'UTF-8', pdf, txt], { timeout: 120_000 });
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error('pdftotext no está instalado en este equipo');
    throw new Error(`pdftotext falló sobre ${pdf}: ${error.message}`);
  }
  return readFile(txt, 'utf8');
}

/* --- Análisis del cuadernillo --------------------------------------------- */

// El separador del número varía según el cuadernillo: «1.», «1.-», «1)». Se consume entero
// para que el enunciado no arranque con el guion del original.
const ES_CABECERA = /^\s*(\d{1,3})\s*(?:[.\-–—)]\s*)+(.*)$/;
const ES_OPCION = /^\s*([a-cA-C])\s*[).\-–]\s*(.*)$/;
const LETRAS = ['a', 'b', 'c'];

/**
 * Convierte el texto de un cuadernillo en preguntas.
 * El número de pregunta solo se acepta si es el siguiente de la serie, de modo que
 * una línea de continuación que empiece por «2.500 euros» no se confunda con la
 * cabecera de la pregunta 2.
 */
export function parsearCuestionario(texto) {
  const preguntas = [];
  const incidencias = [];
  let actual = null;
  let esperado = 1;

  const cerrar = () => {
    if (!actual) return;
    actual.enunciado = actual.enunciado.join(' ').replace(/\s+/g, ' ').trim();
    actual.opciones = actual.opciones.map((o) => o.join(' ').replace(/\s+/g, ' ').trim());
    preguntas.push(actual);
    actual = null;
  };

  for (const linea of texto.replace(/\r\n?/g, '\n').split('\n')) {
    if (RUIDO_PAGINA.test(linea)) continue;

    const cabecera = linea.match(ES_CABECERA);
    if (cabecera && Number(cabecera[1]) === esperado) {
      cerrar();
      actual = { numero: esperado, enunciado: [cabecera[2]], opciones: [] };
      esperado += 1;
      continue;
    }

    if (!actual) continue;

    const opcion = linea.match(ES_OPCION);
    if (opcion) {
      const letra = opcion[1].toLowerCase();
      if (letra !== LETRAS[actual.opciones.length]) {
        incidencias.push(
          `Pregunta ${actual.numero}: se esperaba la opción «${LETRAS[actual.opciones.length] ?? '—'}» y aparece «${letra}»`,
        );
      }
      actual.opciones.push([opcion[2]]);
      continue;
    }

    if (!linea.trim()) continue;

    // Continuación: del enunciado mientras no haya opciones, de la última opción después.
    if (actual.opciones.length === 0) actual.enunciado.push(linea.trim());
    else actual.opciones[actual.opciones.length - 1].push(linea.trim());
  }
  cerrar();

  return { preguntas, incidencias };
}

/** Comprueba que el cuadernillo tiene la forma exigida: 100 preguntas de 3 opciones. */
export function validarCuestionario(preguntas) {
  const fallos = [];
  if (preguntas.length !== TOTAL_PREGUNTAS) {
    fallos.push(`Se esperaban ${TOTAL_PREGUNTAS} preguntas y se han extraído ${preguntas.length}`);
  }
  const numeros = preguntas.map((p) => p.numero);
  const faltan = [];
  for (let n = 1; n <= TOTAL_PREGUNTAS; n += 1) if (!numeros.includes(n)) faltan.push(n);
  if (faltan.length) fallos.push(`Faltan los números de pregunta: ${faltan.join(', ')}`);

  for (const p of preguntas) {
    if (p.opciones.length !== OPCIONES_POR_PREGUNTA) {
      fallos.push(`Pregunta ${p.numero}: ${p.opciones.length} opciones en lugar de ${OPCIONES_POR_PREGUNTA}`);
      continue;
    }
    p.opciones.forEach((o, i) => {
      if (!o.trim()) fallos.push(`Pregunta ${p.numero}: la opción ${LETRAS[i]}) está vacía`);
    });
    if (!p.enunciado.trim()) fallos.push(`Pregunta ${p.numero}: el enunciado está vacío`);
  }
  return fallos;
}

/* --- Catálogo ------------------------------------------------------------- */

/** Descarga y clasifica una entrada del catálogo: texto si hay capa de texto, escaneo si no. */
async function clasificar(entrada) {
  if (!entrada.cuestionario) return { ...entrada, clase: '—', caracteres: 0, preguntas: null };
  const dir = await mkdtemp(join(tmpdir(), 'examenes-'));
  try {
    const pdf = join(dir, 'cuestionario.pdf');
    const txt = join(dir, 'cuestionario.txt');
    await descargar(entrada.cuestionario, pdf);
    const texto = await extraerTexto(pdf, txt);
    const { preguntas, incidencias } = parsearCuestionario(texto);
    const fallos = validarCuestionario(preguntas);
    const valido = fallos.length === 0 && incidencias.length === 0;
    return {
      ...entrada,
      clase: texto.length < 500 ? 'escaneado' : 'texto',
      caracteres: texto.length,
      preguntas: valido ? `${preguntas.length} ✓` : `${preguntas.length} (incompleto)`,
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const rellenar = (texto, ancho) => String(texto).padEnd(ancho);

async function listar() {
  const filas = [];
  for (const entrada of CATALOGO) {
    const info = await clasificar(entrada);
    filas.push(info);
  }

  const cabecera = [
    rellenar('Año', 5),
    rellenar('Prom.', 6),
    rellenar('Cuestionario', 22),
    rellenar('Plantilla', 10),
    rellenar('Caracteres', 11),
    rellenar('Preguntas', 10),
    'Estado',
  ].join(' ');
  console.log(cabecera);
  console.log('-'.repeat(cabecera.length));

  for (const f of filas) {
    const plantilla = f.plantilla ? (await legible(f.plantilla) ? 'sí' : 'no') : '—';
    console.log(
      [
        rellenar(f.convocatoria, 5),
        rellenar(`p${f.promocion}`, 6),
        rellenar(f.clase, 22),
        rellenar(plantilla, 10),
        rellenar(f.caracteres || '—', 11),
        rellenar(f.preguntas ?? '—', 10),
        f.estado === 'disponible' ? 'disponible' : 'bloqueado',
      ].join(' '),
    );
  }

  const disponibles = filas.filter((f) => f.estado === 'disponible');
  console.log('');
  console.log(`Convocatorias con cuestionario y plantilla utilizables: ${disponibles.length} de ${CATALOGO.length}`);
  for (const f of filas) {
    console.log(`  · ${f.convocatoria} (p${f.promocion}) ${f.estado === 'disponible' ? 'disponible' : 'bloqueada'}: ${f.nota}`);
  }
}

/** ¿La plantilla responde con un PDF? Solo comprueba disponibilidad, no su contenido. */
async function legible(url) {
  try {
    const respuesta = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': UA } });
    return respuesta.ok;
  } catch {
    return false;
  }
}

/* --- Construcción del banco ----------------------------------------------- */

function leerArgumentos(argv) {
  const args = { listar: false, id: null, respuestas: null, json: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--listar') args.listar = true;
    else if (a === '--id') args.id = argv[++i];
    else if (a === '--respuestas') args.respuestas = argv[++i];
    else if (a === '--json') args.json = argv[++i];
    else if (a === '--ayuda' || a === '-h') args.ayuda = true;
    else throw new Error(`Argumento desconocido: ${a}`);
  }
  return args;
}

function ayuda() {
  console.log(`Uso:
  node scripts/extraer-examenes.mjs --listar
  node scripts/extraer-examenes.mjs --id <año-pNN> --respuestas <letras A/B/C> [--json ruta]

  --listar       Descarga el catálogo y publica la tabla de disponibilidad.
  --id           Identificador de la convocatoria, por ejemplo 2022-p39.
  --respuestas   Clave transcrita de la plantilla oficial: una letra por pregunta.
  --json         Escribe el banco en esa ruta (por omisión solo lo imprime).`);
}

async function extraer({ id, respuestas, json }) {
  const entrada = CATALOGO.find((e) => `${e.convocatoria}-p${e.promocion}` === id);
  if (!entrada) throw new Error(`No hay ninguna convocatoria «${id}» en el catálogo`);
  if (entrada.estado !== 'disponible') {
    throw new Error(`${id} está bloqueada: ${entrada.nota}`);
  }

  const dir = await mkdtemp(join(tmpdir(), 'examenes-'));
  let preguntas;
  try {
    const pdf = join(dir, 'cuestionario.pdf');
    const txt = join(dir, 'cuestionario.txt');
    const bytes = await descargar(entrada.cuestionario, pdf);
    const texto = await extraerTexto(pdf, txt);
    const analizado = parsearCuestionario(texto);
    const fallos = validarCuestionario(analizado.preguntas);
    console.error(
      `Descargado ${entrada.cuestionario}\n  ${bytes} bytes, ${texto.length} caracteres, ${analizado.preguntas.length} preguntas`,
    );
    if (analizado.incidencias.length) {
      for (const incidencia of analizado.incidencias) console.error(`  Incidencia: ${incidencia}`);
    }
    if (fallos.length) throw new Error(`El cuestionario no valida:\n  - ${fallos.join('\n  - ')}`);
    preguntas = analizado.preguntas;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }

  if (!respuestas) {
    console.error('Sin --respuestas no se escribe banco: falta la plantilla oficial.');
    return null;
  }

  const letras = respuestas.replace(/[\s,]/g, '').toUpperCase();
  if (letras.length !== preguntas.length) {
    throw new Error(`La plantilla tiene ${letras.length} respuestas y hay ${preguntas.length} preguntas`);
  }
  const indice = [...letras].map((letra, i) => {
    const posicion = LETRAS.indexOf(letra.toLowerCase());
    if (posicion < 0) throw new Error(`Respuesta ${i + 1}: «${letra}» no es A, B ni C`);
    return posicion;
  });

  const prefijo = `${entrada.convocatoria}-p${entrada.promocion}`;
  const banco = {
    convocatoria: entrada.convocatoria,
    promocion: entrada.promocion,
    tipo: 'teorico',
    fuente: entrada.cuestionario,
    licencia: LICENCIA,
    preguntas: preguntas.map((p, i) => ({
      id: `${prefijo}-${String(p.numero).padStart(3, '0')}`,
      enunciado: p.enunciado,
      opciones: p.opciones,
      correcta: indice[i],
      tema: null,
    })),
  };

  const serializado = `${JSON.stringify(banco, null, 2)}\n`;
  if (json) {
    await mkdir(dirname(json), { recursive: true });
    await writeFile(json, serializado, 'utf8');
    console.log(`Escrito ${json}: ${banco.preguntas.length} preguntas de ${prefijo}`);
  } else {
    console.log(serializado);
  }
  return banco;
}

/* --- Punto de entrada ------------------------------------------------------ */

const args = leerArgumentos(process.argv.slice(2));
try {
  if (args.ayuda) ayuda();
  else if (args.listar) await listar();
  else if (args.id) await extraer(args);
  else {
    ayuda();
    process.exitCode = 1;
  }
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
}
