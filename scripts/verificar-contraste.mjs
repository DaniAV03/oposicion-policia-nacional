// Comprueba el contraste de la paleta declarada en assets/css/style.css contra las
// pautas WCAG 2.1 AA. No mide «cuánto se ve» de forma opinable: calcula la relación
// de contraste de los pares que la hoja realmente usa y falla si alguno baja del
// umbral que le corresponde.
//
// Umbrales: 4.5:1 para texto (AA, texto normal) y 3:1 para los elementos de
// interfaz que no son texto (bordes de control y filetes que delimitan algo).

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const hoja = join(raiz, 'assets', 'css', 'style.css');

const TEXTO = 4.5;
const INTERFAZ = 3;

let fallos = 0;

function fallo(mensaje) {
  fallos += 1;
  console.error(`FALLO ${mensaje}`);
}

/* --- Lectura de los tokens ------------------------------------------------ */

/** Quita los comentarios CSS para no leer tokens comentados. */
function sinComentarios(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Devuelve el bloque `{...}` que empieza en la posición del `{` dado. */
function bloqueDesde(css, inicio) {
  let nivel = 0;
  for (let i = inicio; i < css.length; i += 1) {
    if (css[i] === '{') nivel += 1;
    else if (css[i] === '}') {
      nivel -= 1;
      if (nivel === 0) return css.slice(inicio + 1, i);
    }
  }
  return '';
}

/** Extrae los tokens `--nombre: valor;` de un bloque. */
function tokensDe(bloque) {
  const tokens = {};
  for (const m of bloque.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    tokens[m[1]] = m[2].trim();
  }
  return tokens;
}

const css = sinComentarios(await readFile(hoja, 'utf8'));

const posicionClaro = css.indexOf(':root');
if (posicionClaro === -1) fallo('la hoja no declara un bloque :root con los tokens');

const claro = tokensDe(bloqueDesde(css, css.indexOf('{', posicionClaro)));

const posicionOscuro = css.indexOf('prefers-color-scheme: dark');
let oscuro = {};
if (posicionOscuro === -1) {
  fallo('la hoja no declara una variante para prefers-color-scheme: dark');
} else {
  const abreMedia = css.indexOf('{', posicionOscuro);
  const dentroMedia = bloqueDesde(css, abreMedia);
  const abreRaiz = dentroMedia.indexOf(':root');
  if (abreRaiz === -1) fallo('la variante oscura no declara su propio bloque :root');
  else oscuro = tokensDe(bloqueDesde(dentroMedia, dentroMedia.indexOf('{', abreRaiz)));
}

if (!Object.keys(claro).length) fallo('el bloque de tokens claro está vacío');

const oscuroCompleto = { ...claro, ...oscuro };

/* --- Cálculo de la relación de contraste ---------------------------------- */

function aRgb(valor) {
  const hex = valor.trim().toLowerCase();
  if (hex === 'white') return [255, 255, 255];
  if (hex === 'black') return [0, 0, 0];
  const m = hex.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (!m) return null;
  const ancho = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  return [0, 2, 4].map((i) => Number.parseInt(ancho.slice(i, i + 2), 16));
}

function luminancia([r, g, b]) {
  const canal = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

function contraste(a, b) {
  const la = luminancia(a);
  const lb = luminancia(b);
  const [alta, baja] = la > lb ? [la, lb] : [lb, la];
  return (alta + 0.05) / (baja + 0.05);
}

/** Resuelve un color: `#rrggbb` literal o `--token`. */
function color(tokens, referencia) {
  if (referencia.startsWith('--')) {
    const valor = tokens[referencia];
    if (!valor) return null;
    return aRgb(valor);
  }
  return aRgb(referencia);
}

/**
 * Pares que la hoja compone de verdad, en los dos modos. Cada entrada declara qué
 * se pinta encima de qué; el comentario dice dónde ocurre.
 *
 * Los tokens `--sobre-*` existen justo para esto: son el color del texto que va
 * encima de un relleno saturado. Sin ellos, el modo oscuro acaba pintando blanco
 * sobre salmón y sobre verde claro, que es donde el contraste se hunde.
 */
const pares = [
  ['--texto', '--fondo', TEXTO, 'párrafo sobre el fondo de la página'],
  ['--texto', '--superficie', TEXTO, 'texto dentro de una tarjeta'],
  ['--texto', '--superficie-alt', TEXTO, 'texto sobre superficie hundida'],
  ['--texto-suave', '--fondo', TEXTO, 'texto secundario sobre el fondo'],
  ['--texto-suave', '--superficie', TEXTO, 'texto secundario en tarjeta'],
  ['--acento', '--fondo', TEXTO, 'enlaces sobre el fondo'],
  ['--acento', '--superficie', TEXTO, 'enlaces dentro de una tarjeta'],
  ['--sobre-acento', '--acento', TEXTO, 'sigla de la marca sobre el acento'],
  ['--sobre-acento-vivo', '--acento-vivo', TEXTO, 'botón de llamada a la acción'],
  ['--acento-vivo', '--fondo', TEXTO, 'botón secundario, texto sobre el fondo'],
  ['--acento', '--acento-suave', TEXTO, 'texto de acento sobre su propio tinte'],
  ['--texto', '--acento-suave', TEXTO, 'texto normal sobre el tinte de acento'],
  ['--borde-control', '--fondo', INTERFAZ, 'borde de control sobre el fondo'],
  ['--borde-control', '--superficie', INTERFAZ, 'borde de control en tarjeta'],
  ['--error', '--fondo', TEXTO, 'texto de error sobre el fondo'],
  ['--error', '--error-fondo', TEXTO, 'texto de error sobre su tinte'],
  ['--sobre-error', '--error', TEXTO, 'número de la opción fallada'],
  ['--clave-borde', '--clave-fondo', TEXTO, 'texto de acierto sobre su tinte'],
  ['--clave-borde', '--fondo', TEXTO, 'texto de acierto sobre el fondo'],
  ['--sobre-clave', '--clave-borde', TEXTO, 'número de la opción acertada'],
  ['--aviso-borde', '--aviso-fondo', TEXTO, 'aviso sobre su tinte'],
  ['--aviso-borde', '--fondo', TEXTO, 'aviso sobre el fondo'],
  ['--texto', '--bloque-a-fondo', TEXTO, 'título del bloque A sobre su lavado'],
  ['--texto-suave', '--bloque-a-fondo', TEXTO, 'texto secundario del bloque A'],
  ['--acento', '--bloque-a-fondo', TEXTO, 'etiqueta del bloque A sobre su lavado'],
  ['--texto', '--bloque-b-fondo', TEXTO, 'título del bloque B sobre su lavado'],
  ['--texto-suave', '--bloque-b-fondo', TEXTO, 'texto secundario del bloque B'],
  ['--ambar-oscuro', '--bloque-b-fondo', TEXTO, 'etiqueta del bloque B sobre su lavado'],
  ['--texto', '--bloque-c-fondo', TEXTO, 'título del bloque C sobre su lavado'],
  ['--texto-suave', '--bloque-c-fondo', TEXTO, 'texto secundario del bloque C'],
  ['--verde-oscuro', '--bloque-c-fondo', TEXTO, 'etiqueta del bloque C sobre su lavado'],
  ['--ambar-oscuro', '--fondo', TEXTO, 'acento del bloque de Ciencias Sociales'],
  ['--verde-oscuro', '--fondo', TEXTO, 'acento del bloque Técnico-Científico'],
];

/**
 * En oscuro casi todos los pares se repiten, pero los acentos de bloque cambian de
 * token (`--ambar` y `--verde`) porque en modo oscuro usan el tono luminoso.
 */
const paresOscuro = [
  ...pares.filter(([fondo]) => !['--ambar-oscuro', '--verde-oscuro'].includes(fondo)),
  ['--ambar', '--fondo', TEXTO, 'acento del bloque de Ciencias Sociales'],
  ['--verde', '--fondo', TEXTO, 'acento del bloque Técnico-Científico'],
  ['--ambar', '--bloque-b-fondo', TEXTO, 'etiqueta del bloque B sobre su lavado'],
  ['--verde', '--bloque-c-fondo', TEXTO, 'etiqueta del bloque C sobre su lavado'],
];

/* --- Verificación --------------------------------------------------------- */

function revisar(nombre, tokens, lista) {
  console.log(`\nPaleta ${nombre}`);
  for (const [fondo, sobre, minimo, donde] of lista) {
    const c1 = color(tokens, fondo);
    const c2 = color(tokens, sobre);
    const etiqueta = `${fondo} sobre ${sobre}`;
    if (!c1) {
      fallo(`paleta ${nombre}: falta el token ${fondo} (${donde})`);
      continue;
    }
    if (!c2) {
      fallo(`paleta ${nombre}: falta el token ${sobre} (${donde})`);
      continue;
    }
    const valor = contraste(c1, c2);
    const marca = valor >= minimo ? 'ok  ' : 'FALLO';
    if (valor < minimo) {
      fallo(`paleta ${nombre}: ${etiqueta} = ${valor.toFixed(2)}:1, mínimo ${minimo}:1 (${donde})`);
    }
    console.log(`${marca} ${valor.toFixed(2).padStart(5)}:1  mínimo ${minimo}  ${etiqueta} — ${donde}`);
  }
}

revisar('clara', claro, pares);
revisar('oscura', oscuroCompleto, paresOscuro);

console.log(
  fallos === 0
    ? '\nPaleta conforme: todos los pares superan su umbral.'
    : `\n${fallos} par(es) fuera de umbral.`,
);

process.exit(fallos === 0 ? 0 : 1);
