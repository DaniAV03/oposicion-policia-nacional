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

const paginas = ['index.html', 'tema.html', 'test.html', 'oficiales.html', 'no-oficiales.html'];
const modulos = [
  'assets/js/app.js',
  'assets/js/banco.js',
  'assets/js/diagnostico.js',
  'assets/js/tema-lectura.js',
  'assets/js/test.js',
  'assets/js/test-paginas.js',
];
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
  if (!(await existe(modulo))) {
    fallo(`Falta el módulo ${modulo}`);
    continue;
  }
  const js = await readFile(modulo, 'utf8');
  for (const m of js.matchAll(/fetch\('([^']+)'/g)) referencias.add(m[1]);
  // Los manifiestos se declaran como constante y se pasan a `fetch` por variable,
  // así que se recogen también los literales de datos del módulo: una ruta de
  // datos mal escrita tiene que romper el build, no la página en el navegador.
  for (const m of js.matchAll(/'((?:data)\/[\w./-]+\.json)'/g)) referencias.add(m[1]);
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
  'oficiales.html',
  'no-oficiales.html',
  'assets/js/app.js',
  'assets/js/banco.js',
  'assets/js/tema-lectura.js',
  'assets/js/test.js',
  'assets/js/test-paginas.js',
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

/* --- 9. Apartado Test: portada, destino y enlaces profundos ---------------- */

// El apartado Test es una portada con dos accesos y dos páginas de destino. Las
// páginas ya las revisan las listas de arriba; aquí se comprueba lo que decide
// qué enseña cada una: el filtro que abre un enlace profundo y el recuento de
// cada colección. Se importa el módulo del navegador tal cual, sin transformarlo.
let moduloBanco = null;
let resumenTest = '';
try {
  const fuente = await readFile('assets/js/banco.js', 'utf8');
  moduloBanco = await import(
    `data:text/javascript;base64,${Buffer.from(fuente, 'utf8').toString('base64')}`,
  );
} catch (error) {
  fallo(`assets/js/banco.js no se puede importar sin DOM: ${error.message}`);
}

if (moduloBanco) {
  const manifiestoOficiales = JSON.parse(await readFile('data/examenes/index.json', 'utf8'));
  const manifiestoPropio = JSON.parse(await readFile('data/banco/index.json', 'utf8'));

  const oficiales = moduloBanco.entradasDe('oficiales', manifiestoOficiales);
  const propias = moduloBanco.entradasDe('propio', manifiestoPropio);

  if (oficiales.length === 0) fallo('El manifiesto de oficiales no declara ninguna entrada utilizable');
  if (oficiales.some((e) => !e.id || !e.archivo || e.preguntas < 1)) {
    fallo('Alguna entrada de oficiales se queda sin id, archivo o recuento de preguntas');
  }
  if (propias.some((e) => !e.id || !e.archivo)) {
    fallo('Alguna entrada del banco propio se queda sin id o sin archivo');
  }
  for (const entrada of [...oficiales, ...propias]) {
    if (!(await existe(entrada.ruta))) {
      fallo(`El manifiesto de ${entrada.tipo ?? 'una colección'} apunta a un fichero que no existe: ${entrada.ruta}`);
    }
  }

  // Enlaces profundos: `oficiales.html?convocatoria=2021` y
  // `no-oficiales.html?tema=1` seleccionan su entrada; un valor que no está en
  // el manifiesto se ignora y la página enseña la lista completa.
  const filtro = (coleccion, lista, consulta) =>
    moduloBanco.filtroDesdeParametros(coleccion, lista, new URLSearchParams(consulta));

  const porAnio = filtro('oficiales', oficiales, 'convocatoria=2021');
  if (porAnio !== oficiales.find((e) => e.convocatoria === 2021)?.id) {
    fallo(`oficiales.html?convocatoria=2021 no abre su convocatoria (devuelve ${porAnio})`);
  }
  if (filtro('oficiales', oficiales, 'convocatoria=1999') !== null) {
    fallo('Un año que no está en el manifiesto debería ignorarse');
  }
  if (filtro('oficiales', oficiales, 'convocatoria=todas') !== null) {
    fallo('Un año no numérico debería ignorarse');
  }
  if (filtro('oficiales', oficiales, '') !== null) {
    fallo('Sin parámetro, oficiales.html debe enseñar todas las convocatorias');
  }

  const primerTema = propias.find((e) => e.tipo === 'tema');
  if (primerTema && filtro('propio', propias, `tema=${primerTema.tema}`) !== primerTema.id) {
    fallo(`no-oficiales.html?tema=${primerTema.tema} no abre su tema`);
  }
  if (filtro('propio', propias, 'tema=0') !== null || filtro('propio', propias, 'tema=999') !== null) {
    fallo('Un tema que no está en el manifiesto debería ignorarse');
  }

  // El banco de mezcla puede no existir todavía (hoy no existe): mientras no
  // esté en el manifiesto, el enlace profundo no puede prometer nada.
  const mezcla = propias.find((e) => e.tipo === 'mezcla');
  const pedida = filtro('propio', propias, 'tema=mezcla');
  if (mezcla ? pedida !== mezcla.id : pedida !== null) {
    fallo('El enlace profundo de las preguntas mezcladas no sigue al manifiesto');
  }

  const cuenta = moduloBanco.contarEntradas('oficiales', oficiales);
  const sumaDeclarada = oficiales.reduce((total, e) => total + e.preguntas, 0);
  if (cuenta.preguntas !== sumaDeclarada || cuenta.entradas !== oficiales.length) {
    fallo('El recuento de la portada no suma lo que declara el manifiesto');
  }
  resumenTest = `${oficiales.length} convocatoria(s) · ${cuenta.preguntas} preguntas oficiales · ${moduloBanco.contarEntradas('propio', propias).temas} tema(s) del banco propio`;

  // Las dos páginas de destino tienen que estar enlazadas desde la portada, o
  // los dos accesos que pide la función no llevan a ninguna parte.
  const portadaTest = await readFile('assets/js/test-paginas.js', 'utf8');
  for (const destino of ['oficiales.html', 'no-oficiales.html']) {
    if (!portadaTest.includes(`'${destino}'`)) fallo(`La portada de Test no enlaza ${destino}`);
  }
  for (const pagina of ['test.html', 'oficiales.html', 'no-oficiales.html']) {
    const html = await readFile(pagina, 'utf8');
    const actuales = (html.match(/aria-current="page"/g) ?? []).length;
    if (actuales !== 1) fallo(`${pagina}: se espera un solo aria-current="page" y hay ${actuales}`);
  }
  for (const pagina of ['oficiales.html', 'no-oficiales.html']) {
    const html = await readFile(pagina, 'utf8');
    if (!/<a href="test\.html" aria-current="page">/.test(html)) {
      fallo(`${pagina}: la entrada de navegación marcada como actual debe ser Test`);
    }
  }
}

/* --- 10. Lectura en voz alta del tema -------------------------------------- */

// La lectura usa la voz del navegador (`SpeechSynthesis`): no descarga audio ni
// habla con ningún servicio, así que las tres cosas que se pueden romper en
// silencio son el enganche con el contenido ya pintado, el control que aparece
// sin voz detrás y la normalización del texto. Aquí se comprueban las tres.
// La voz y el DOM no se pueden probar sin navegador: eso queda declarado como
// límite, no simulado.
let moduloLectura = null;
let resumenLectura = '';
let nucleoTest = null;
try {
  const fuente = await readFile('assets/js/tema-lectura.js', 'utf8');
  moduloLectura = await import(
    `data:text/javascript;base64,${Buffer.from(fuente, 'utf8').toString('base64')}`,
  );

  // Sin audio de ninguna clase y sin red. Un `<audio>`, un `AudioContext` o un
  // `fetch` aquí serían la puerta por la que entra la función equivocada.
  const prohibidos = [
    [/\bnew Audio\b/, 'un reproductor de audio'],
    [/\bAudioContext\b/, 'un contexto de audio'],
    [/https?:\/\//, 'una URL absoluta'],
    [/\bfetch\(/, 'una petición de red'],
    [/\.(?:mp3|ogg|wav|m4a|flac|aac)\b/i, 'un fichero de audio'],
    [/\bXMLHttpRequest\b/, 'una petición de red'],
  ];
  for (const [patron, que] of prohibidos) {
    if (patron.test(fuente)) fallo(`tema-lectura.js: la lectura no puede usar ${que}`);
  }

  const fuenteNucleo = await readFile('assets/js/test-core.js', 'utf8');
  nucleoTest = await import(
    `data:text/javascript;base64,${Buffer.from(fuenteNucleo, 'utf8').toString('base64')}`,
  );
} catch (error) {
  fallo(`assets/js/tema-lectura.js no se puede importar sin DOM: ${error.message}`);
}

if (moduloLectura) {
  const {
    CLAVE_POSICION,
    VERSION_POSICION,
    VELOCIDADES,
    FRASE_MAXIMA,
    normalizarParaVoz,
    trocearEnFrases,
    validarPosiciones,
  } = moduloLectura;

  // La clave es propia (no comparte espacio con el progreso del test) y lleva la
  // versión del esquema en el nombre, como la del test.
  if (typeof CLAVE_POSICION !== 'string' || !/-v\d+$/.test(CLAVE_POSICION)) {
    fallo('tema-lectura.js: la clave de localStorage no declara su versión');
  }
  if (nucleoTest && CLAVE_POSICION === nucleoTest.CLAVE_ALMACENAMIENTO) {
    fallo('tema-lectura.js: la lectura guarda su posición en la clave del test');
  }

  // Normalización: las abreviaturas del temario se leen como palabras y las
  // cifras quedan separadas de las letras y de los años.
  const normalizaciones = [
    ['el art. 14 de la Constitución', 'artículo 14'],
    ['los arts. 3 y 4', 'artículos 3'],
    ['el núm. 2 del formulario', 'número 2'],
    ['la pág. 12 del temario', 'página 12'],
    ['§ 3 de la Ley 39/2015', 'sección 3'],
    ['los plazos (p. ej. el de un año)', 'por ejemplo'],
    ['art.14', 'artículo 14'],
    ['el periodo 2011-2015', '2011 a 2015'],
  ];
  for (const [entrada, esperado] of normalizaciones) {
    const salida = normalizarParaVoz(entrada);
    if (!salida.includes(esperado)) {
      fallo(`tema-lectura.js: «${entrada}» no se normaliza a «${esperado}» (sale «${salida}»)`);
    }
    if (/art\.|núm\.|pág\.|§|p\. ej\./.test(salida)) {
      fallo(`tema-lectura.js: «${entrada}» conserva la abreviatura al hablar (sale «${salida}»)`);
    }
  }

  // Troceado: ninguna locución pasa del tope (Chrome corta o se queda mudo con
  // textos largos), no salen frases vacías y un párrafo sin puntuación también
  // se parte.
  const dosFrases = trocearEnFrases(
    'El plazo general es de un año. Para la nacionalidad por residencia hay que esperar diez años.',
  );
  if (dosFrases.length !== 2) {
    fallo(`tema-lectura.js: dos frases deberían dar dos locuciones y dan ${dosFrases.length}`);
  }
  if (trocearEnFrases('').length !== 0) fallo('tema-lectura.js: un texto vacío debería dar cero frases');

  const parrafoLargo = 'palabra '.repeat(120).trim();
  const trozosLargos = trocearEnFrases(parrafoLargo);
  if (trozosLargos.length < 2) fallo('tema-lectura.js: un párrafo largo debería trocearse en varias frases');
  const demasiadoLarga = trozosLargos.find((t) => t.length > FRASE_MAXIMA);
  if (demasiadoLarga) {
    fallo(`tema-lectura.js: una locución de ${demasiadoLarga.length} caracteres pasa del tope ${FRASE_MAXIMA}`);
  }
  if (trozosLargos.some((t) => !t.trim())) fallo('tema-lectura.js: el troceado produce frases vacías');

  // Posición guardada: un dato de otra versión, de otro tema o fuera de rango se
  // descarta en vez de romper la página.
  const bueno = { version: VERSION_POSICION, temas: { '7': { frase: 4, total: 20 } } };
  if (!validarPosiciones(bueno)?.['7']) fallo('tema-lectura.js: se descarta una posición válida');
  if (validarPosiciones({ ...bueno, version: VERSION_POSICION + 1 }) !== null) {
    fallo('tema-lectura.js: una posición de otra versión debería descartarse');
  }
  if (validarPosiciones({ version: VERSION_POSICION, temas: { '7': { frase: 20, total: 20 } } })?.['7']) {
    fallo('tema-lectura.js: una posición al final del tema debería descartarse');
  }
  if (validarPosiciones({ version: VERSION_POSICION, temas: { tema: { frase: 1, total: 20 } } })?.['tema']) {
    fallo('tema-lectura.js: una clave de tema no numérica debería descartarse');
  }

  // El control: nace oculto (un navegador sin voz no pinta un botón muerto), se
  // anuncia como pulsable y ofrece las tres velocidades. Además, la CSP de la
  // página prohíbe el código y el estilo incrustados: aquí no puede haber ni uno.
  const htmlTema = await readFile('tema.html', 'utf8');
  const etiquetaPanel = htmlTema.match(/<section[^>]*\bid="escucha"[^>]*>/)?.[0] ?? '';
  if (!etiquetaPanel) fallo('tema.html: falta el control de lectura en voz alta');
  else if (!/\shidden(?:\s|>)/.test(etiquetaPanel)) {
    fallo('tema.html: el control de lectura debe nacer oculto y descubrirse sólo con voz disponible');
  }
  if (!/id="escucha-boton"[^>]*aria-pressed="false"/.test(htmlTema)) {
    fallo('tema.html: el botón de lectura no declara su estado con aria-pressed');
  }
  if (/<script(?![^>]*\bsrc=)/i.test(htmlTema)) {
    fallo('tema.html: hay un script incrustado y la CSP sólo permite script-src \'self\'');
  }
  if (/<style[\s>]/i.test(htmlTema) || /\sstyle="/i.test(htmlTema)) {
    fallo('tema.html: hay CSS incrustado y la CSP sólo permite style-src \'self\'');
  }

  const velocidades = [...htmlTema.matchAll(/name="escucha-velocidad"[^>]*value="([\d.]+)"/g)].map(
    (m) => Number(m[1]),
  );
  if (velocidades.join() !== VELOCIDADES.join()) {
    fallo(
      `tema.html: las velocidades ofrecidas (${velocidades.join(', ')}) no son las del módulo (${VELOCIDADES.join(', ')})`,
    );
  }

  // El enganche: la lectura recoge el tema después de que `pintarTema` lo haya
  // pintado. Si se llamara antes, no habría texto que leer.
  const arranque = await readFile('assets/js/tema-inicio.js', 'utf8');
  if (!/from '\.\/tema-lectura\.js'/.test(arranque)) {
    fallo('tema-inicio.js: no importa el módulo de lectura en voz alta');
  }
  if (!/pintarTema\(\)[\s\S]*iniciarLectura\(/.test(arranque)) {
    fallo('tema-inicio.js: la lectura tiene que arrancar detrás de pintarTema()');
  }

  resumenLectura = `lectura en voz alta · ${VELOCIDADES.map((v) => `${String(v).replace('.', ',')}×`).join(' ')} · clave ${CLAVE_POSICION}`;
}

/* --- 11. Panel de puntos débiles ------------------------------------------ */

// El diagnóstico vive en un módulo sin DOM (para poder probarlo como el motor) y
// se pinta sólo en la página del banco propio. Lo que se puede romper en
// silencio es el enganche: un módulo que no se importa, un panel que no está en
// la página, un criterio que se queda sin sus umbrales o un script incrustado
// que la CSP bloquearía. La lógica en sí la comprueba verificar-test.mjs.
let resumenPuntos = '';
try {
  const fuenteDiagnostico = await readFile('assets/js/diagnostico.js', 'utf8');
  const moduloDiagnostico = await import(
    `data:text/javascript;base64,${Buffer.from(fuenteDiagnostico, 'utf8').toString('base64')}`,
  );

  for (const [patron, que] of [
    [/\bdocument\b/, 'el DOM'],
    [/\bwindow\b/, 'el objeto window'],
    [/\blocalStorage\b/, 'el almacén del navegador'],
    [/\bfetch\(/, 'una petición de red'],
  ]) {
    if (patron.test(fuenteDiagnostico)) {
      fallo(`diagnostico.js: el diagnóstico no puede tocar ${que}`);
    }
  }

  const { MIN_FALLOS_QUEMADA, MIN_INTENTOS_TEMA, UMBRAL_ACIERTO_FLOJO, diagnosticar } =
    moduloDiagnostico;
  if (![MIN_FALLOS_QUEMADA, MIN_INTENTOS_TEMA, UMBRAL_ACIERTO_FLOJO].every(Number.isInteger)) {
    fallo('diagnostico.js: los umbrales del diagnóstico deben ser constantes numéricas exportadas');
  }

  const sinDatos = diagnosticar(
    { porPregunta: {} },
    [{ id: 't01-g001', tema: 1, enunciado: 'Pregunta', referencia: { apartado: '1. Uno' } }],
  );
  if (sinDatos.vacio !== true) {
    fallo('diagnostico.js: sin datos el diagnóstico debe declararse vacío, no inventar ceros');
  }

  const pagina = await readFile('no-oficiales.html', 'utf8');
  const panelPuntos =
    pagina.match(/<section[^>]*\baria-labelledby="titulo-puntos"[^>]*>/)?.[0] ?? '';
  if (!panelPuntos) {
    fallo('no-oficiales.html: falta el panel de puntos débiles');
  } else if (!/class="puntos"/.test(panelPuntos)) {
    fallo('no-oficiales.html: el panel de puntos débiles no lleva la clase «puntos»');
  }
  if (!/<h3[^>]*id="titulo-puntos"/.test(pagina)) {
    fallo('no-oficiales.html: el panel de puntos débiles necesita un encabezado de verdad');
  }
  if (!/<div id="puntos"><\/div>/.test(pagina)) {
    fallo('no-oficiales.html: falta el contenedor donde se pintan las tres listas');
  }
  if (/<script(?![^>]*\bsrc=)/i.test(pagina)) {
    fallo('no-oficiales.html: hay un script incrustado y la CSP sólo permite script-src \'self\'');
  }
  if (/<style[\s>]/i.test(pagina) || /\sstyle="/i.test(pagina)) {
    fallo('no-oficiales.html: hay CSS incrustado y la CSP sólo permite style-src \'self\'');
  }

  const codigoTest = await readFile('assets/js/test.js', 'utf8');
  if (!/from '\.\/diagnostico\.js'/.test(codigoTest)) {
    fallo('test.js: no importa el módulo de diagnóstico');
  }
  if (!/pintarHistorial\(\)[\s\S]{0,120}pintarPuntos\(\)/.test(codigoTest)) {
    fallo('test.js: el panel de puntos débiles no se pinta al arrancar la página');
  }
  if (!/preguntas:\s*resultadosPorPregunta\(\)/.test(codigoTest)) {
    fallo('test.js: el intento no guarda el resultado de cada pregunta');
  }
  for (const grupo of ['puntos-quemadas', 'puntos-flojos', 'puntos-riesgo']) {
    if (!codigoTest.includes(`'${grupo}'`)) {
      fallo(`test.js: falta el grupo «${grupo}» del panel de puntos débiles`);
    }
  }

  resumenPuntos = `puntos débiles · quemada desde ${MIN_FALLOS_QUEMADA} fallos · flojo con ${MIN_INTENTOS_TEMA} intentos y menos del ${UMBRAL_ACIERTO_FLOJO} %`;
} catch (error) {
  fallo(`assets/js/diagnostico.js no se puede importar sin DOM: ${error.message}`);
}

/* --- Informe -------------------------------------------------------------- */

console.log(`Temas: ${temas.length}`);
console.log(`Bloques: ${programa.bloques.length}`);
console.log(`Publicados: ${publicados}`);
console.log(`Pendientes: ${pendientes.length}${pendientes.length ? ` → ${pendientes.join(', ')}` : ''}`);
if (resumenTest) console.log(`Test: ${resumenTest}`);
if (resumenPuntos) console.log(`Diagnóstico: ${resumenPuntos}`);
if (resumenLectura) console.log(`Tema: ${resumenLectura}`);

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
