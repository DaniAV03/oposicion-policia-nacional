// Verificación estructural del sitio, sin red y sin navegador.
// Comprueba que el programa oficial está completo y que todo recurso referenciado
// existe en disco. No sustituye a abrir la web en un navegador.
//
// Uso: node scripts/verificar.mjs

import { readFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';

const errores = [];
const avisos = [];

const existe = async (ruta) => {
  try {
    await access(ruta, constants.R_OK);
    return true;
  } catch {
    return false;
  }
};

const fallo = (msg) => errores.push(msg);
const aviso = (msg) => avisos.push(msg);

/* --- 1. Programa oficial -------------------------------------------------- */

const programa = JSON.parse(await readFile('data/programa/programa.json', 'utf8'));
const temas = programa.bloques.flatMap((b) => b.temas);

if (temas.length !== 45) fallo(`Se esperaban 45 temas y hay ${temas.length}`);

const numeros = temas.map((t) => t.numero);
for (let n = 1; n <= 45; n += 1) {
  if (!numeros.includes(n)) fallo(`Falta el tema ${n}`);
}
if (new Set(numeros).size !== numeros.length) fallo('Hay números de tema repetidos');

const vacios = temas.filter((t) => !t.epigrafe || t.epigrafe.length < 20);
if (vacios.length) fallo(`Epígrafes vacíos o truncados: ${vacios.map((t) => t.numero).join(', ')}`);

// El pie de página del PDF oficial se intercala a mitad de epígrafe al extraer el texto.
const pie = /cve:|Verificable en|https?:\/\//i;
const conPie = temas.filter((t) => pie.test(t.epigrafe) || pie.test(t.titulo));
if (conPie.length) fallo(`Epígrafes con el pie de página del PDF: ${conPie.map((t) => t.numero).join(', ')}`);

for (const campo of ['fuente', 'fuenteUrl', 'licencia']) {
  if (!programa[campo]) fallo(`El programa no declara «${campo}»`);
}

/* --- 2. Recursos referenciados -------------------------------------------- */

const paginas = ['index.html', 'tema.html'];
const modulos = ['assets/js/app.js'];
const estilos = ['assets/css/style.css'];

const referencias = new Set();

for (const pagina of paginas) {
  if (!(await existe(pagina))) {
    fallo(`Falta la página ${pagina}`);
    continue;
  }
  const html = await readFile(pagina, 'utf8');
  for (const m of html.matchAll(/(?:href|src)="(?!https?:|#|mailto:)([^"]+)"/g)) {
    referencias.add(m[1]);
  }
  if (!html.includes('<html lang="es">')) fallo(`${pagina}: falta lang="es"`);
  if (!/<meta name="viewport"/.test(html)) fallo(`${pagina}: falta la meta viewport`);
  if (!/<meta charset="utf-8"/.test(html)) fallo(`${pagina}: falta la declaración de charset`);
}

for (const hoja of estilos) {
  const css = await readFile(hoja, 'utf8');
  for (const m of css.matchAll(/url\('([^']+)'\)/g)) {
    referencias.add(`assets/css/${m[1]}`);
  }
  if (!css.includes('@font-face')) fallo(`${hoja}: no declara la tipografía`);
  if (!css.includes('prefers-color-scheme: dark')) aviso(`${hoja}: sin variante para modo oscuro`);
}

for (const modulo of modulos) {
  const js = await readFile(modulo, 'utf8');
  for (const m of js.matchAll(/fetch\('([^']+)'/g)) referencias.add(m[1]);
}

// Normaliza rutas relativas de CSS a rutas de repositorio.
for (const ref of [...referencias]) {
  const ruta = ref.replace(/^\.\//, '').replace(/^(\.\.\/)+/, 'assets/').split('?')[0];
  if (!ruta || ruta.startsWith('http')) continue;
  if (!(await existe(ruta))) fallo(`Recurso referenciado inexistente: ${ruta} (desde «${ref}»)`)
}

/* --- 3. Tipografía -------------------------------------------------------- */

for (const fuente of [
  'assets/fonts/lexend-latin-wght-normal.woff2',
  'assets/fonts/lexend-latin-ext-wght-normal.woff2',
  'assets/fonts/OFL-lexend.txt',
]) {
  if (!(await existe(fuente))) fallo(`Falta el recurso tipográfico ${fuente}`);
}

/* --- 4. Estado del contenido ---------------------------------------------- */

let publicados = 0;
const pendientes = [];
for (const tema of temas) {
  if (await existe(tema.ruta)) publicados += 1;
  else pendientes.push(tema.numero);
}

/* --- Informe -------------------------------------------------------------- */

console.log(`Temas: ${temas.length}`);
console.log(`Bloques: ${programa.bloques.length}`);
console.log(`Publicados: ${publicados}`);
console.log(`Pendientes: ${pendientes.length}${pendientes.length ? ` → ${pendientes.join(', ')}` : ''}`);

if (avisos.length) {
  console.log('\nAvisos:');
  for (const a of avisos) console.log(`  · ${a}`);
}

if (errores.length) {
  console.error('\nERRORES:');
  for (const e of errores) console.error(`  ✗ ${e}`);
  process.exit(1);
}

console.log('\nSin errores estructurales.');
