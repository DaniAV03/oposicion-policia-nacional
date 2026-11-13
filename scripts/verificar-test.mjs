// Verifica el motor de test: manifiesto del banco, muestreo sin repetición,
// reproducibilidad con una fuente aleatoria inyectada, barajado de opciones,
// corrección de un intento y desglose por convocatoria.
// Sin dependencias, sin red y sin navegador: importa la lógica pura del motor.
//
// Uso: node scripts/verificar-test.mjs
// Sale con código 1 si cualquier aserción falla.

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const RUTA_NUCLEO = 'assets/js/test-core.js';
const RUTA_INDICE = 'data/examenes/index.json';
const DIRECTORIO_BANCOS = 'data/examenes';

let comprobaciones = 0;
let fallos = 0;

/** Imprime exactamente una línea por aserción. */
function comprobar(descripcion, condicion, detalle = '') {
  comprobaciones += 1;
  if (condicion) {
    console.log(`ok    ${descripcion}`);
  } else {
    fallos += 1;
    console.error(`FALLO ${descripcion}${detalle ? ` — ${detalle}` : ''}`);
  }
}

const iguales = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const unicos = (valores) => new Set(valores).size === valores.length;
const cerca = (a, b, tolerancia = 1e-9) => Math.abs(a - b) <= tolerancia;

/**
 * Carga el motor como módulo ES.
 *
 * El repositorio no tiene package.json, así que Node interpreta los ficheros .js
 * como CommonJS y no puede importar `assets/js/test-core.js` con `import` directo.
 * Se carga el mismo texto, byte a byte, como módulo ES mediante una URL de datos:
 * no se transforma ni se copia código, y sigue siendo el fichero que usa el
 * navegador el que se está comprobando.
 */
async function cargarNucleo() {
  const fuente = await readFile(RUTA_NUCLEO, 'utf8');
  const base64 = Buffer.from(fuente, 'utf8').toString('base64');
  return import(`data:text/javascript;base64,${base64}`);
}

let core = null;
try {
  core = await cargarNucleo();
  comprobar(`${RUTA_NUCLEO} se puede importar sin DOM ni efectos al cargar`, typeof core === 'object' && core !== null);
} catch (error) {
  comprobar(`${RUTA_NUCLEO} se puede importar sin DOM ni efectos al cargar`, false, error.message);
}

if (!core) {
  console.error(`\n${fallos} fallo(s) en ${comprobaciones} comprobación(es).`);
  process.exit(1);
}

/* --- 1. Manifiesto y bancos ------------------------------------------------ */

console.log('\nManifiesto del banco');

let manifiesto = null;
try {
  manifiesto = JSON.parse(await readFile(RUTA_INDICE, 'utf8'));
  comprobar(`${RUTA_INDICE} es JSON válido`, true);
} catch (error) {
  comprobar(`${RUTA_INDICE} es JSON válido`, false, error.message);
}

const archivosEnDisco = (await readdir(DIRECTORIO_BANCOS))
  .filter((f) => f.endsWith('.json') && f !== 'index.json')
  .sort();

const entradas = Array.isArray(manifiesto?.examenes) ? manifiesto.examenes : [];
comprobar('el manifiesto declara al menos un examen', entradas.length > 0);
comprobar(
  'el manifiesto no repite ficheros',
  unicos(entradas.map((e) => e.archivo)),
);
comprobar(
  'el manifiesto lista exactamente los bancos publicados',
  iguales([...entradas.map((e) => e.archivo)].sort(), archivosEnDisco),
  `${JSON.stringify([...entradas.map((e) => e.archivo)].sort())} frente a ${JSON.stringify(archivosEnDisco)}`,
);

const bancos = [];
for (const entrada of entradas) {
  const ruta = join(DIRECTORIO_BANCOS, entrada.archivo);
  let banco = null;
  try {
    banco = JSON.parse(await readFile(ruta, 'utf8'));
  } catch (error) {
    comprobar(`${entrada.archivo} se puede leer`, false, error.message);
    continue;
  }
  bancos.push(banco);
  comprobar(
    `${entrada.archivo} coincide con su entrada del manifiesto`,
    banco.convocatoria === entrada.convocatoria &&
      banco.promocion === entrada.promocion &&
      banco.preguntas.length === entrada.preguntas,
    `convocatoria ${banco.convocatoria}/${entrada.convocatoria}, promoción ${banco.promocion}/${entrada.promocion}, ${banco.preguntas.length}/${entrada.preguntas} preguntas`,
  );
}

/* --- 2. Pool combinado ----------------------------------------------------- */

console.log('\nPool de preguntas');

const pool = core.construirPool(bancos);
const idsPool = pool.map((p) => p.id);
const totalEsperado = bancos.reduce((suma, b) => suma + b.preguntas.length, 0);

comprobar(
  `el pool de ${bancos.length} bancos reúne las ${totalEsperado} preguntas`,
  pool.length === totalEsperado && totalEsperado > 0,
  `${pool.length} preguntas`,
);
comprobar('el pool combinado no repite ningún id', unicos(idsPool), `${pool.length - new Set(idsPool).size} repetido(s)`);
comprobar(
  'cada pregunta del pool conserva su convocatoria de origen',
  pool.every((p) => Number.isInteger(p.convocatoria) && preguntasDeBanco(p, bancos)),
);

const solo2021 = core.construirPool(bancos, { convocatoria: bancos[0]?.convocatoria ?? 0 });
comprobar(
  'el filtro por convocatoria devuelve sólo esa convocatoria',
  solo2021.length === (bancos[0]?.preguntas.length ?? -1) && solo2021.every((p) => p.convocatoria === bancos[0]?.convocatoria),
  `${solo2021.length} preguntas`,
);
comprobar(
  'un filtro por tema sin preguntas etiquetadas devuelve el pool vacío',
  core.construirPool(bancos, { tema: 1 }).length === 0,
);

const conteo = core.contarPorConvocatoria(bancos);
comprobar(
  'contarPorConvocatoria devuelve una fila por banco con su total',
  conteo.length === bancos.length &&
    conteo.reduce((suma, fila) => suma + fila.total, 0) === totalEsperado,
  JSON.stringify(conteo),
);

/* --- 3. Muestreo ----------------------------------------------------------- */

console.log('\nMuestreo aleatorio');

const SEMILLA = 20250101;
const cantidad = 30;
const muestra = core.muestrear(pool, cantidad, core.crearGeneradorAleatorio(SEMILLA));
const idsMuestra = muestra.map((p) => p.id);

comprobar(
  `muestrear(pool, ${cantidad}) devuelve ${cantidad} preguntas`,
  muestra.length === cantidad,
  `${muestra.length} preguntas`,
);
comprobar('la muestra no repite ninguna pregunta', unicos(idsMuestra));
comprobar('toda pregunta muestreada existe en el pool', idsMuestra.every((id) => idsPool.includes(id)));

const muestraCompleta = core.muestrear(pool, pool.length + 50, core.crearGeneradorAleatorio(SEMILLA));
comprobar(
  'muestrear nunca devuelve más preguntas que el pool',
  muestraCompleta.length === pool.length,
  `${muestraCompleta.length} de ${pool.length}`,
);
comprobar('muestrear el pool entero tampoco repite preguntas', unicos(muestraCompleta.map((p) => p.id)));
comprobar('muestrear 0 preguntas devuelve una lista vacía', core.muestrear(pool, 0).length === 0);

const otraMuestra = core.muestrear(pool, cantidad, core.crearGeneradorAleatorio(SEMILLA));
comprobar(
  'con la misma semilla el muestreo es reproducible',
  iguales(muestra.map((p) => p.id), otraMuestra.map((p) => p.id)),
);
const muestraOtraSemilla = core.muestrear(pool, cantidad, core.crearGeneradorAleatorio(SEMILLA + 1));
comprobar(
  'con otra semilla el orden de la muestra cambia',
  !iguales(muestra.map((p) => p.id), muestraOtraSemilla.map((p) => p.id)),
);

/* --- 4. Barajado de opciones ----------------------------------------------- */

console.log('\nBarajado de opciones');

let conservaCorrecta = true;
let opcionesIntactas = true;
let correctaValida = true;
let posicionesCambiadas = 0;

for (const pregunta of pool) {
  for (let semilla = 1; semilla <= 5; semilla += 1) {
    const barajada = core.barajarOpciones(pregunta, core.crearGeneradorAleatorio(semilla));
    const textoOriginal = pregunta.opciones[pregunta.correcta];
    const textoBarajado = barajada.opciones[barajada.correcta];

    if (textoBarajado !== textoOriginal) conservaCorrecta = false;
    if (!iguales([...barajada.opciones].sort(), [...pregunta.opciones].sort())) opcionesIntactas = false;
    if (!Number.isInteger(barajada.correcta) || barajada.correcta < 0 || barajada.correcta > 2) correctaValida = false;
    if (barajada.correcta !== pregunta.correcta) posicionesCambiadas += 1;
  }
}

comprobar('barajarOpciones mantiene la opción correcta en el índice «correcta»', conservaCorrecta);
comprobar('barajarOpciones no altera el conjunto de textos de las opciones', opcionesIntactas);
comprobar('barajarOpciones deja «correcta» en 0, 1 o 2', correctaValida);
comprobar(
  'barajarOpciones cambia de posición la respuesta correcta en algún caso',
  posicionesCambiadas > 0,
  `${posicionesCambiadas} de ${pool.length * 5} barajados`,
);

/* --- 5. Corrección --------------------------------------------------------- */

console.log('\nCorrección de un intento');

comprobar('la penalización por defecto es 0', core.PENALIZACION_POR_DEFECTO === 0);

const cuatro = core.muestrear(pool, 4, core.crearGeneradorAleatorio(7));
const intento = core.crearIntento(cuatro, core.crearGeneradorAleatorio(11)).map((entrada, i) => {
  const correcta = entrada.pregunta.correcta;
  if (i === 0 || i === 1) return { ...entrada, respuesta: correcta };
  if (i === 2) return { ...entrada, respuesta: (correcta + 1) % 3 };
  return { ...entrada, respuesta: null };
});

const resultado = core.corregir(intento);
comprobar(
  'la corrección cuenta los aciertos',
  resultado.aciertos === 2 && resultado.total === 4,
  JSON.stringify(resultado),
);
comprobar('la corrección cuenta los fallos', resultado.fallos === 1);
comprobar('una respuesta en blanco no cuenta como acierto ni como fallo', resultado.blancos === 1);
comprobar(
  'con penalización 0 la puntuación neta es igual a los aciertos',
  resultado.netas === 2 && resultado.penalizacion === 0,
  JSON.stringify({ netas: resultado.netas, penalizacion: resultado.penalizacion }),
);
comprobar(
  'la corrección devuelve sólo las preguntas falladas',
  resultado.falladas.length === 1 && resultado.falladas[0].pregunta.id === intento[2].pregunta.id,
);

const conPenalizacion = core.corregir(intento, { penalizacion: 0.33 });
comprobar(
  'la penalización explícita se aplica a los fallos',
  cerca(conPenalizacion.netas, 2 - 0.33),
  `${conPenalizacion.netas}`,
);

const desglose = core.resumirPorConvocatoria(intento);
comprobar(
  'el desglose por convocatoria reparte las preguntas del intento',
  desglose.length === 2 && desglose.reduce((suma, fila) => suma + fila.total, 0) === 4,
  JSON.stringify(desglose),
);
comprobar(
  'el desglose cuadra aciertos, fallos y blancos con el total',
  desglose.every((fila) => fila.aciertos + fila.fallos + fila.blancos === fila.total),
);

/* --- 6. Utilidades de presentación ----------------------------------------- */

console.log('\nUtilidades');

const tiempos = [
  [0, '00:00'],
  [59, '00:59'],
  [90, '01:30'],
  [3600, '60:00'],
];
comprobar(
  'formatearTiempo compone mm:ss',
  tiempos.every(([segundos, esperado]) => core.formatearTiempo(segundos) === esperado),
  JSON.stringify(tiempos.map(([s]) => core.formatearTiempo(s))),
);
comprobar('formatearTiempo no devuelve tiempos negativos', core.formatearTiempo(-5) === '00:00');

/* --- Informe --------------------------------------------------------------- */

console.log('');
if (fallos > 0) {
  console.error(`${fallos} fallo(s) en ${comprobaciones} comprobación(es).`);
  process.exit(1);
}
console.log(`Motor de test válido: ${comprobaciones} comprobaciones.`);

/** Comprueba que la pregunta viene de alguno de los bancos cargados. */
function preguntasDeBanco(pregunta, listaBancos) {
  return listaBancos.some(
    (banco) =>
      banco.convocatoria === pregunta.convocatoria &&
      banco.promocion === pregunta.promocion &&
      banco.preguntas.some((original) => original.id === pregunta.id),
  );
}
