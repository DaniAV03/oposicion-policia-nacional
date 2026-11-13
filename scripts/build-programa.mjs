// Convierte el Anexo I de la convocatoria (data/fuentes/programa-2026-boe.txt) en
// data/programa/programa.json, la estructura que consume la web.
//
// Uso: node scripts/build-programa.mjs
//
// La fuente es el texto del Anexo I extraído con `pdftotext -enc UTF-8 -layout` del PDF
// oficial BOE-A-2026-15055. Cada tema empieza por "Tema N." y sus continuaciones van
// indentadas; las cabeceras de bloque son "A) Ciencias Jurídicas", etc.

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname } from 'node:path';

const FUENTE = 'data/fuentes/programa-2026-boe.txt';
const SALIDA = 'data/programa/programa.json';

const TOTAL_TEMAS_ESPERADOS = 45;

/** ¿Existe el fichero de contenido del tema? */
const existe = async (ruta) => {
  try {
    await access(ruta, constants.R_OK);
    return true;
  } catch {
    return false;
  }
};

const NOMBRES_BLOQUE = {
  A: 'Ciencias Jurídicas',
  B: 'Ciencias Sociales',
  C: 'Materias Técnico-Científicas',
};

// Ruido de paginación del PDF oficial.
const RUIDO = /^(cve:|Verificable en|ANEXO|B\.O\.E\.|Núm\.|Página|https?:\/\/)/i;

/** Une las líneas de un epígrafe en un solo párrafo. */
function unir(lineas) {
  return lineas
    .map((l) => l.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Deriva un título corto del epígrafe: su primera oración, sin el inciso romano. */
function derivarTitulo(epigrafe) {
  const corte = epigrafe.search(/\.(\s|$)/);
  const bruto = corte === -1 ? epigrafe : epigrafe.slice(0, corte);
  const titulo = bruto.replace(/\s*\((?:I|II|III|IV)\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
  return titulo.length > 110 ? `${titulo.slice(0, 107).trimEnd()}…` : titulo;
}

const texto = await readFile(FUENTE, 'utf8');
const lineas = texto.split(/\r?\n/);

const bloques = [];
let bloqueActual = null;
let temaActual = null;
let bloquePendiente = null;

function abrirBloque(id, nombreLeido) {
  const nombre = NOMBRES_BLOQUE[id] ?? nombreLeido.replace(/\s+/g, ' ').trim();
  bloqueActual = { id, nombre, temas: [] };
  bloques.push(bloqueActual);
  temaActual = null;
}

for (const cruda of lineas) {
  const linea = cruda.trimEnd();
  if (!linea.trim() || RUIDO.test(linea.trim())) continue;

  // Cabecera de bloque: "A) Ciencias Jurídicas". Puede partirse en dos líneas.
  const cabecera = linea.match(/^\s*([ABC])\)\s*(.*)$/);
  if (cabecera) {
    const [, id, resto] = cabecera;
    bloquePendiente = { id, resto };
    if (resto.trim().length > 3) {
      abrirBloque(id, resto);
      bloquePendiente = null;
    }
    continue;
  }

  // Continuación de una cabecera partida.
  if (bloquePendiente) {
    const completa = `${bloquePendiente.resto} ${linea.trim()}`.trim();
    if (completa.length > 3) {
      abrirBloque(bloquePendiente.id, completa);
      bloquePendiente = null;
      continue;
    }
  }

  // Inicio de tema: "Tema N." (admitiendo que el punto se haya perdido al extraer).
  const inicio = linea.match(/^\s*Tema\s+(\d{1,2})\s*[.:]\s*(.*)$/);
  if (inicio) {
    const numero = Number(inicio[1]);
    if (!bloqueActual) throw new Error(`Tema ${numero} sin bloque asignado`);
    temaActual = { numero, lineas: [inicio[2]] };
    bloqueActual.temas.push(temaActual);
    continue;
  }

  // Continuación de un epígrafe ya abierto.
  if (temaActual) temaActual.lineas.push(linea);
}

for (const bloque of bloques) {
  bloque.temas = bloque.temas.map((t) => {
    const epigrafe = unir(t.lineas);
    return {
      numero: t.numero,
      bloque: bloque.id,
      titulo: derivarTitulo(epigrafe),
      epigrafe,
      ruta: `data/temas/${String(t.numero).padStart(2, '0')}.html`,
      publicado: false,
    };
  });
}

const todos = bloques.flatMap((b) => b.temas);

// El estado de publicación no se declara a mano: se comprueba en disco, para que
// programa.json no mienta cuando alguien añade o retira un tema.
for (const tema of todos) tema.publicado = await existe(tema.ruta);

if (todos.length !== TOTAL_TEMAS_ESPERADOS) {
  console.error(`ERROR: se esperaban ${TOTAL_TEMAS_ESPERADOS} temas y hay ${todos.length}.`);
  const numeros = todos.map((t) => t.numero);
  const faltan = [];
  for (let n = 1; n <= TOTAL_TEMAS_ESPERADOS; n += 1) if (!numeros.includes(n)) faltan.push(n);
  console.error('Faltan:', faltan.join(', ') || '(ninguno)');
  process.exit(1);
}

const vacios = todos.filter((t) => t.epigrafe.length < 20);
if (vacios.length) {
  console.error('ERROR: epígrafes sospechosamente cortos:', vacios.map((t) => t.numero).join(', '));
  process.exit(1);
}

const salida = {
  oposicion: 'Policía Nacional',
  escala: 'Básica',
  convocatoria: 2026,
  fuente: 'BOE-A-2026-15055, de 10 de julio de 2026. Anexo I: temario',
  fuenteUrl: 'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-15055',
  fuentePdf: 'https://www.boe.es/boe/dias/2026/07/10/pdfs/BOE-A-2026-15055.pdf',
  licencia: 'Reutilización de información del sector público (Ley 37/2007, RD 1495/2011)',
  verificadoContra: 'Anexo I del PDF oficial del BOE',
  bloques,
};

await mkdir(dirname(SALIDA), { recursive: true });
await writeFile(SALIDA, `${JSON.stringify(salida, null, 2)}\n`, 'utf8');

const publicados = todos.filter((t) => t.publicado).length;
console.log(
  `OK · ${todos.length} temas en ${bloques.length} bloques · ${publicados} publicados → ${SALIDA}`,
);
for (const b of bloques) {
  console.log(`  ${b.id}) ${b.nombre}: ${b.temas.length} temas (${b.temas[0].numero}-${b.temas.at(-1).numero})`);
}
