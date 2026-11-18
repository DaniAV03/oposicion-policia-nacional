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

// Y la fecha de la cabecera («Viernes 10 de julio de 2026») se pega igual al final del epígrafe.
const fechaPdf = /(lunes|martes|miércoles|jueves|viernes|sábado|domingo)\s+\d{1,2} de \w+ de \d{4}/i;
const conFecha = temas.filter((t) => fechaPdf.test(t.epigrafe) || fechaPdf.test(t.titulo));
if (conFecha.length) fallo(`Epígrafes con la fecha de cabecera del PDF: ${conFecha.map((t) => t.numero).join(', ')}`);

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

/* --- 4. Sin cursivas fingidas --------------------------------------------- */

// Lexend no tiene cursiva: si el marcado usa <em> o <i>, el navegador inclina los
// trazos y el resultado se ve sucio. El énfasis va con <strong>, tablas y cajas (S8).
const cursivaSintetica = /<em[ >]|<i[ >]/gi;
const conCursiva = [];

for (const tema of temas) {
  if (!(await existe(tema.ruta))) continue;
  const html = await readFile(tema.ruta, 'utf8');
  const cuantas = (html.match(cursivaSintetica) ?? []).length;
  if (cuantas) conCursiva.push(`tema ${tema.numero} (${cuantas})`);
}

if (conCursiva.length) fallo(`Marcado con cursiva sintética: ${conCursiva.join(', ')}`);

/* --- 5. Estado del contenido ---------------------------------------------- */

let publicados = 0;
const pendientes = [];
for (const tema of temas) {
  if (await existe(tema.ruta)) publicados += 1;
  else pendientes.push(tema.numero);
}

/* --- 6. Interfaz sin rastros de obra --------------------------------------- */

// Los 45 temas están escritos, así que la interfaz no puede seguir anunciando el
// estado de cada uno («Publicado» / «En preparación») ni recuentos de publicados.
// El campo `publicado` del programa y el recuento de arriba son control de
// integridad del build, no interfaz: aquí se revisa lo que se sirve al visitante.
// «ya publicados» en test.html habla de los cuestionarios oficiales, no del sitio,
// así que se buscan marcas concretas de estado y no la palabra suelta.
const fuentesInterfaz = [
  'index.html',
  'tema.html',
  'test.html',
  'assets/js/app.js',
  'assets/js/test.js',
];

const rastrosDeObra = [
  [/En preparación/i, 'insignia de estado «En preparación»'],
  [/["'`]Publicad[oa]s?["'`]/, 'texto de estado «Publicado»'],
  [/<\/strong>\s*publicad[oa]s?/i, 'recuento de temas publicados'],
  [/tema__estado|tema--pendiente|data-estado/, 'marcado de estado por tema'],
  [/class="pendiente"|class='pendiente'/, 'relleno de tema pendiente'],
];

for (const fuente of fuentesInterfaz) {
  if (!(await existe(fuente))) {
    fallo(`Falta la fuente de interfaz ${fuente}`);
    continue;
  }
  const texto = await readFile(fuente, 'utf8');
  for (const [patron, que] of rastrosDeObra) {
    if (patron.test(texto)) fallo(`${fuente}: queda ${que}`);
  }
}

/* --- 7. Paleta declarada en claro y en oscuro ------------------------------ */

// Los tokens de paleta se declaran dos veces: en el :root claro y en el :root del
// bloque prefers-color-scheme. Un token que falte en uno de los dos deja media
// interfaz con el color del otro modo.
const css = await readFile('assets/css/style.css', 'utf8');
const tokensPaleta = [
  '--fondo',
  '--superficie',
  '--texto',
  '--texto-suave',
  '--borde',
  '--acento',
  '--acento-suave',
  '--error',
];

const raizClara = css.match(/(?:^|\n):root\s*\{([\s\S]*?)\n\}/);
const raizOscura = css.match(
  /@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{([\s\S]*?)\n\s*\}/,
);

if (!raizClara) fallo('style.css: no hay un bloque :root con la paleta clara');
if (!raizOscura) fallo('style.css: no hay un bloque :root dentro de prefers-color-scheme: dark');

for (const token of tokensPaleta) {
  const declaraciones = (css.match(new RegExp(`^\\s*${token}\\s*:`, 'gm')) ?? []).length;
  if (declaraciones !== 2) {
    fallo(`style.css: ${token} se declara ${declaraciones} vez/veces y debería declararse 2`);
  }
  if (raizClara && !new RegExp(`\\n\\s*${token}\\s*:`).test(raizClara[1])) {
    fallo(`style.css: ${token} falta en la paleta clara`);
  }
  if (raizOscura && !new RegExp(`\\n\\s*${token}\\s*:`).test(raizOscura[1])) {
    fallo(`style.css: ${token} falta en la paleta oscura`);
  }
}

/* --- 8. Ninguna clase usada sin regla en el CSS ---------------------------- */

// Las páginas y los módulos piden sus clases por marcado y por DOM; si el CSS no
// tiene regla para una, el elemento se queda sin estilo y nadie se entera hasta
// verlo. Detecta, sobre todo, clases huérfanas tras un borrado.
const clasesUsadas = new Map();
const anotarClases = (valor, fuente) => {
  for (const token of valor.split(/\s+/).filter(Boolean)) {
    if (token.includes('$') || token.includes('{')) continue;
    if (!clasesUsadas.has(token)) clasesUsadas.set(token, fuente);
  }
};

for (const fuente of fuentesInterfaz) {
  if (!(await existe(fuente))) continue;
  const texto = await readFile(fuente, 'utf8');
  for (const m of texto.matchAll(/class="([^"]+)"/g)) anotarClases(m[1], fuente);
  for (const m of texto.matchAll(/className = '([^']+)'/g)) anotarClases(m[1], fuente);
  for (const m of texto.matchAll(/classList\.(?:add|remove|toggle)\('([^']+)'/g)) {
    anotarClases(m[1], fuente);
  }
  for (const m of texto.matchAll(/clase: '([^']+)'/g)) anotarClases(m[1], fuente);
}

for (const [clase, fuente] of clasesUsadas) {
  const escapada = clase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!new RegExp(`\\.${escapada}(?![\\w-])`).test(css)) {
    fallo(`${fuente}: la clase «${clase}» no tiene regla en style.css`);
  }
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
