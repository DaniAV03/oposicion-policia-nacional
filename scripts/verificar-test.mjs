// Verifica el motor de test: manifiesto del banco, muestreo sin repetición,
// reproducibilidad con una fuente aleatoria inyectada, barajado de opciones,
// corrección de un intento, desglose por convocatoria, tamaño de sesión según el
// ánimo, rachas de aciertos, reto diario determinista, el almacenamiento
// versionado con exportación e importación validadas y el diagnóstico de puntos
// débiles (preguntas quemadas, temas flojos y temas en riesgo).
// Sin dependencias, sin red y sin navegador: importa la lógica pura del motor.
//
// Uso: node scripts/verificar-test.mjs
// Sale con código 1 si cualquier aserción falla.

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const RUTA_NUCLEO = 'assets/js/test-core.js';
const RUTA_DIAGNOSTICO = 'assets/js/diagnostico.js';
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

/**
 * Agrupa las aserciones de un bloque nuevo.
 *
 * Si el motor todavía no expone una función, la sección se reporta como un
 * fallo concreto en lugar de tumbar el verificador entero: así la primera
 * ejecución en rojo dice qué falta exactamente.
 */
function seccion(nombre, cuerpo) {
  console.log(`\n${nombre}`);
  try {
    cuerpo();
  } catch (error) {
    comprobar(nombre, false, error.message);
  }
}
const unicos = (valores) => new Set(valores).size === valores.length;
const cerca = (a, b, tolerancia = 1e-9) => Math.abs(a - b) <= tolerancia;

/**
 * Carga un módulo del navegador como módulo ES.
 *
 * El repositorio no tiene package.json, así que Node interpreta los ficheros .js
 * como CommonJS y no puede importar `assets/js/test-core.js` con `import` directo.
 * Se carga el mismo texto, byte a byte, como módulo ES mediante una URL de datos:
 * no se transforma ni se copia código, y sigue siendo el fichero que usa el
 * navegador el que se está comprobando.
 */
async function cargarModulo(ruta) {
  const fuente = await readFile(ruta, 'utf8');
  const base64 = Buffer.from(fuente, 'utf8').toString('base64');
  return import(`data:text/javascript;base64,${base64}`);
}

const cargarNucleo = () => cargarModulo(RUTA_NUCLEO);

let core = null;
try {
  core = await cargarNucleo();
  comprobar(`${RUTA_NUCLEO} se puede importar sin DOM ni efectos al cargar`, typeof core === 'object' && core !== null);
} catch (error) {
  comprobar(`${RUTA_NUCLEO} se puede importar sin DOM ni efectos al cargar`, false, error.message);
}

// El diagnóstico es un módulo aparte, también sin DOM: se carga igual y las
// pruebas de abajo lo usan con `?.` para que, si falta, cada aserción diga qué
// falta en lugar de tumbar el verificador entero.
let diagnostico = null;
try {
  diagnostico = await cargarModulo(RUTA_DIAGNOSTICO);
  comprobar(
    `${RUTA_DIAGNOSTICO} se puede importar sin DOM ni efectos al cargar`,
    typeof diagnostico === 'object' && diagnostico !== null,
  );
} catch (error) {
  comprobar(`${RUTA_DIAGNOSTICO} se puede importar sin DOM ni efectos al cargar`, false, error.message);
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

/* --- 7. Tamaño de sesión según el ánimo ------------------------------------ */

seccion('Tamaño de sesión', () => {
  comprobar('la sesión corta pide 10 preguntas', core.preguntasDeSesion('corta', 200) === 10);
  comprobar('la sesión media pide 30 preguntas', core.preguntasDeSesion('media', 200) === 30);
  comprobar(
    'la sesión completa pide todo el banco',
    core.preguntasDeSesion('completa', 200) === 200,
  );
  comprobar(
    'el examen respeta la cantidad pedida',
    core.preguntasDeSesion('examen', 200, { cantidadExamen: 100 }) === 100,
  );
  comprobar('con 4 preguntas en el banco la sesión corta pide 4', core.preguntasDeSesion('corta', 4) === 4);
  comprobar('con 12 preguntas en el banco la sesión media pide 12', core.preguntasDeSesion('media', 12) === 12);
  comprobar(
    'con 5 preguntas en el banco el examen pide 5',
    core.preguntasDeSesion('examen', 5, { cantidadExamen: 100 }) === 5,
  );
  comprobar('sin preguntas en el banco la sesión pide 0', core.preguntasDeSesion('completa', 0) === 0);
  comprobar(
    'el tamaño por defecto es la sesión corta',
    core.TAMANO_POR_DEFECTO === 'corta' && core.preguntasDeSesion(undefined, 200) === 10,
  );

  let excede = false;
  let noEntero = false;
  for (const tamano of ['corta', 'media', 'completa', 'examen']) {
    for (let total = 0; total <= 60; total += 1) {
      for (const cantidadExamen of [1, 7, 30, 100, 120]) {
        const pedidas = core.preguntasDeSesion(tamano, total, { cantidadExamen });
        if (!Number.isInteger(pedidas)) noEntero = true;
        if (pedidas > total) excede = true;
      }
    }
  }
  comprobar('ningún tamaño pide más preguntas que el banco', !excede);
  comprobar('el tamaño de sesión siempre es un entero', !noEntero);
});

/* --- 8. Rachas de aciertos -------------------------------------------------- */

seccion('Rachas de aciertos', () => {
  /** Intento sintético: true acierta, false falla, null queda en blanco. */
  const intentoCon = (patron) =>
    patron.map((valor, i) => ({
      pregunta: { id: `sintetica-${i}`, correcta: 0 },
      respuesta: valor === null ? null : valor ? 0 : 1,
    }));

  const cuatro = core.calcularRacha(intentoCon([true, true, true, true]));
  comprobar('la racha sube con cada acierto', cuatro.actual === 4 && cuatro.maxima === 4, JSON.stringify(cuatro));
  comprobar('un fallo reinicia la racha actual', core.calcularRacha(intentoCon([true, true, false, true])).actual === 1);
  comprobar(
    'la racha máxima conserva el mejor tramo',
    core.calcularRacha(intentoCon([true, true, false, true])).maxima === 2,
  );
  comprobar('una pregunta en blanco también corta la racha', core.calcularRacha(intentoCon([true, true, null])).actual === 0);
  comprobar('un intento vacío no tiene racha', iguales(core.calcularRacha([]), { actual: 0, maxima: 0 }));
  comprobar('un intento sin argumentos no rompe la racha', iguales(core.calcularRacha(), { actual: 0, maxima: 0 }));

  comprobar('la racha de 5 aciertos se reconoce en el hito 5', core.hitoDeRacha(5) === 5);
  comprobar('la racha de 10 aciertos se reconoce en el hito 10', core.hitoDeRacha(10) === 10);
  comprobar(
    'fuera de 5 y 10 no hay reconocimiento',
    [0, 1, 4, 6, 7, 9, 11, 50].every((valor) => core.hitoDeRacha(valor) === null),
  );
  comprobar(
    'la tasa de acierto se calcula sobre las respondidas',
    core.tasaDeAcierto(2, 3) === 66.7 && core.tasaDeAcierto(0, 0) === 0,
    `${core.tasaDeAcierto(2, 3)} / ${core.tasaDeAcierto(0, 0)}`,
  );
});

/* --- 9. Reto diario determinista -------------------------------------------- */

seccion('Reto diario', () => {
  const FECHA = '2026-07-10';
  const semilla = core.semillaDiaria(FECHA);

  comprobar(
    'la semilla del día es estable para la misma fecha',
    Number.isInteger(semilla) && semilla > 0 && semilla === core.semillaDiaria(FECHA),
    `${semilla}`,
  );
  comprobar(
    'la semilla del día cambia con la fecha',
    new Set(['2026-07-10', '2026-07-11', '2026-01-01', '2027-07-10', '2026-12-31'].map(core.semillaDiaria)).size === 5,
  );
  comprobar(
    'la semilla del día ignora la hora del objeto Date',
    core.semillaDiaria(new Date(2026, 6, 10, 0, 0, 1)) === core.semillaDiaria(new Date(2026, 6, 10, 23, 59, 59)),
  );
  comprobar('una cadena de fecha y su Date dan la misma semilla', core.semillaDiaria(new Date(2026, 6, 10)) === semilla);
  comprobar(
    'claveFecha compone YYYY-MM-DD con ceros a la izquierda',
    core.claveFecha(new Date(2026, 0, 5)) === '2026-01-05',
    core.claveFecha(new Date(2026, 0, 5)),
  );

  const reto = core.seleccionDiaria(pool, FECHA);
  const idsReto = reto.map((p) => p.id);
  comprobar('el reto del día tiene 10 preguntas', reto.length === 10, `${reto.length}`);
  comprobar('el reto del día no repite preguntas', unicos(idsReto));
  comprobar(
    'el reto del día es reproducible',
    iguales(idsReto, core.seleccionDiaria(pool, FECHA).map((p) => p.id)),
  );
  comprobar(
    'el reto del día cambia de una fecha a otra',
    !iguales(idsReto, core.seleccionDiaria(pool, '2026-07-11').map((p) => p.id)),
  );
  comprobar(
    'el reto del día nunca pide más preguntas que el banco',
    core.seleccionDiaria(pool.slice(0, 4), FECHA).length === 4,
  );
});

/* --- 10. Persistencia versionada -------------------------------------------- */

seccion('Persistencia del progreso', () => {
  const vacio = core.crearAlmacenVacio();
  comprobar('el almacén vacío es válido', core.validarAlmacen(vacio) !== null);
  comprobar(
    'el almacén declara una versión numérica',
    vacio.version === core.VERSION_ALMACEN && Number.isInteger(core.VERSION_ALMACEN),
  );
  comprobar('el almacén vacío no tiene registros', Object.keys(vacio.registros).length === 0);

  let almacen = core.registrarIntento(vacio, {
    modo: 'corta',
    aciertos: 8,
    total: 10,
    porcentaje: 80,
    fecha: '2026-07-10',
    rachaMaxima: 6,
  });
  comprobar(
    'registrarIntento guarda el resultado del modo',
    almacen.registros.corta?.porcentaje === 80 && almacen.registros.corta?.total === 10,
    JSON.stringify(almacen.registros),
  );
  comprobar('registrarIntento guarda el último intento', almacen.ultimoIntento?.porcentaje === 80);
  comprobar('registrarIntento conserva el récord de racha', almacen.rachaMaxima === 6);
  comprobar('registrarIntento no modifica el almacén recibido', Object.keys(vacio.registros).length === 0);

  const peor = core.registrarIntento(almacen, {
    modo: 'corta',
    aciertos: 5,
    total: 10,
    porcentaje: 50,
    fecha: '2026-07-11',
    rachaMaxima: 2,
  });
  comprobar('un resultado peor no rebaja el récord del modo', peor.registros.corta.porcentaje === 80);
  comprobar('el último intento sí se actualiza con un resultado peor', peor.ultimoIntento.porcentaje === 50);
  comprobar('el récord de racha nunca baja', peor.rachaMaxima === 6);

  const conReto = core.registrarIntento(almacen, {
    modo: 'reto',
    aciertos: 9,
    total: 10,
    porcentaje: 90,
    fecha: '2026-07-10',
    rachaMaxima: 9,
  });
  comprobar(
    'el reto del día se anota aparte',
    conReto.reto?.fecha === '2026-07-10' && conReto.reto?.aciertos === 9 && conReto.registros.corta.porcentaje === 80,
    JSON.stringify(conReto.reto),
  );
  comprobar(
    'mejorDeModo devuelve el récord guardado',
    core.mejorDeModo(almacen, 'corta')?.porcentaje === 80 && core.mejorDeModo(almacen, 'media') === null,
  );

  const texto = core.exportarAlmacen(almacen);
  comprobar('exportarAlmacen produce JSON válido', (() => {
    try {
      JSON.parse(texto);
      return true;
    } catch {
      return false;
    }
  })());

  const idaYVuelta = core.importarAlmacen(texto);
  comprobar('un progreso exportado se vuelve a importar', idaYVuelta.ok === true);
  comprobar(
    'la importación conserva los récords y la racha',
    idaYVuelta.ok && idaYVuelta.almacen.registros.corta.porcentaje === 80 && idaYVuelta.almacen.rachaMaxima === 6,
  );
  comprobar(
    'el almacén importado vuelve a validarse',
    idaYVuelta.ok && core.validarAlmacen(idaYVuelta.almacen) !== null,
  );

  const hostiles = [
    '',
    '   ',
    'null',
    '[]',
    '"hola"',
    '42',
    '{',
    '{"carrito":[]}',
    '{"version":2,"registros":{},"rachaMaxima":0}',
    '{"version":"1","registros":{},"rachaMaxima":0}',
    '{"version":1}',
    '{"version":1,"registros":null}',
    '{"version":1,"registros":[],"rachaMaxima":0}',
    '{"version":1,"registros":{"corta":{"mejorPorcentaje":"alto"}},"rachaMaxima":0}',
    '{"version":1,"registros":{"corta":{"aciertos":5,"total":0,"porcentaje":50,"fecha":"2026-07-10"}},"rachaMaxima":0}',
    '{"version":1,"registros":{"corta":{"aciertos":11,"total":10,"porcentaje":110,"fecha":"2026-07-10"}},"rachaMaxima":0}',
    '{"version":1,"registros":{"corta":{"aciertos":5,"total":10,"porcentaje":50,"fecha":"ayer"}},"rachaMaxima":0}',
    '{"version":1,"registros":{"inventado":{"aciertos":5,"total":10,"porcentaje":50,"fecha":"2026-07-10"}},"rachaMaxima":0}',
    '{"version":1,"registros":{},"rachaMaxima":-3}',
    '{"version":1,"registros":{},"rachaMaxima":"3"}',
    '{"version":1,"registros":{},"rachaMaxima":0,"ultimoIntento":{"modo":"inventado"}}',
  ];

  let lanzo = false;
  let aceptados = 0;
  for (const entrada of hostiles) {
    try {
      const resultadoImportacion = core.importarAlmacen(entrada);
      if (resultadoImportacion?.ok) aceptados += 1;
    } catch {
      lanzo = true;
    }
  }
  comprobar('la importación nunca lanza una excepción', !lanzo);
  comprobar('un contenido ajeno o corrupto se rechaza entero', aceptados === 0, `${aceptados} aceptado(s)`);
  comprobar('validarAlmacen rechaza null y listas', core.validarAlmacen(null) === null && core.validarAlmacen([]) === null);
  comprobar(
    'un payload sin campos obligatorios se rechaza',
    core.importarAlmacen('{"version":1,"registros":{"corta":{"aciertos":5,"total":10,"porcentaje":50}}}').ok === false,
  );
});

/* --- 11. Comparación, duración y parada ------------------------------------- */

seccion('Comparación y parada', () => {
  const primera = core.compararConRecord(70, null);
  comprobar('sin récord previo la comparación es la primera', primera.estado === 'primera' && primera.diferencia === 0);

  const mejor = core.compararConRecord(80, { porcentaje: 70, aciertos: 7, total: 10, fecha: '2026-07-09' });
  comprobar(
    'superar el récord se marca como mejora con su diferencia',
    mejor.estado === 'mejor' && mejor.diferencia === 10 && mejor.mejor === 70,
    JSON.stringify(mejor),
  );

  const igual = core.compararConRecord(70, { porcentaje: 70, aciertos: 7, total: 10, fecha: '2026-07-09' });
  comprobar('igualar el récord se marca como empate', igual.estado === 'igual' && igual.diferencia === 0);

  const peor = core.compararConRecord(50, { porcentaje: 80, aciertos: 8, total: 10, fecha: '2026-07-09' });
  comprobar('quedarse por debajo se marca como peor', peor.estado === 'peor' && peor.diferencia === -30);

  comprobar('una sesión de 40 preguntas no sugiere parar', core.sugerirParada(40) === false);
  comprobar('una sesión de 41 preguntas sí sugiere parar', core.sugerirParada(41) === true);
  comprobar('el umbral de sesión larga es 40', core.UMBRAL_SESION_LARGA === 40);

  const duraciones = [
    [0, '0 s'],
    [45, '45 s'],
    [59, '59 s'],
    [60, '1 min'],
    [125, '2 min 05 s'],
  ];
  comprobar(
    'formatearDuracion compone una duración legible',
    duraciones.every(([segundos, esperado]) => core.formatearDuracion(segundos) === esperado),
    JSON.stringify(duraciones.map(([segundos]) => core.formatearDuracion(segundos))),
  );

  comprobar(
    'la duración del examen sigue siendo 60 s por pregunta',
    core.duracionExamen(10) === 600 && core.SEGUNDOS_POR_PREGUNTA === 60,
  );
});

/* --- 12. Diagnóstico de puntos débiles --------------------------------------- */

// El diagnóstico es un módulo sin DOM que lee el registro por pregunta del
// almacén y el banco cargado. Estas pruebas fijan el banco (3 preguntas del tema
// 1, una del 7 y otra del 9, más una oficial sin tema) para que el resultado no
// dependa del contenido publicado.

seccion('Diagnóstico de puntos débiles', () => {
  const referencia = (apartado) => ({ apartado, norma: 'Código Civil', articulo: 'art. 1.1' });
  const BANCO = [
    {
      id: 't01-g001',
      tema: 1,
      enunciado: 'El derecho natural se distingue del derecho positivo porque…',
      referencia: referencia('2.2. Acepciones'),
    },
    {
      id: 't01-g002',
      tema: 1,
      enunciado: '¿Qué dos elementos forman la estructura de la norma jurídica?',
      referencia: referencia('3.1. Concepto y estructura'),
    },
    {
      id: 't01-g003',
      tema: 1,
      enunciado: '¿Qué carácter describe la abstracción de la norma?',
      referencia: referencia('3.3. Caracteres'),
    },
    {
      id: 't07-g001',
      tema: 7,
      enunciado: 'Pregunta del tema 7 sobre el acto administrativo.',
      referencia: referencia('1. El acto administrativo'),
    },
    {
      id: 't05-g001',
      tema: 5,
      enunciado: 'Pregunta del tema 5.',
      referencia: referencia('2. La potestad reglamentaria'),
    },
    {
      id: 't11-g001',
      tema: 11,
      enunciado: 'Pregunta del tema 11.',
      referencia: referencia('4. El procedimiento'),
    },
    {
      id: 't11-g002',
      tema: 11,
      enunciado: 'Otra pregunta del tema 11.',
      referencia: referencia('5. La revisión'),
    },
    // Cuadernillo oficial: sin tema, así que no se clasifica ni ensucia las estadísticas.
    {
      id: '2021-p38-001',
      tema: null,
      convocatoria: 2021,
      enunciado: 'Pregunta de un cuadernillo oficial.',
      referencia: referencia('Apartado del temario'),
    },
  ];

  /** Anota un intento sintético con el resultado de cada pregunta. */
  const anotar = (almacen, fecha, preguntas) =>
    core.registrarIntento(almacen, {
      modo: 'corta',
      aciertos: preguntas.filter((p) => p.acierto).length,
      total: preguntas.length,
      porcentaje: core.tasaDeAcierto(
        preguntas.filter((p) => p.acierto).length,
        preguntas.length,
      ),
      fecha,
      preguntas,
    });

  /* Preguntas quemadas: la misma pregunta fallada tres veces o más. */
  let conFallos = core.crearAlmacenVacio();
  for (let i = 1; i <= 3; i += 1) {
    conFallos = anotar(conFallos, `2026-07-0${i}`, [
      { id: 't01-g001', tema: 1, acierto: false },
    ]);
  }
  conFallos = anotar(conFallos, '2026-07-04', [{ id: 't01-g002', tema: 1, acierto: false }]);
  conFallos = anotar(conFallos, '2026-07-05', [{ id: 't01-g002', tema: 1, acierto: false }]);

  const quemadas = diagnostico?.preguntasQuemadas?.(conFallos, BANCO) ?? [];
  comprobar(
    'una pregunta fallada tres veces aparece como quemada',
    quemadas.length === 1 && quemadas[0].id === 't01-g001',
    JSON.stringify(quemadas.map((q) => q.id)),
  );
  comprobar(
    'la pregunta quemada llega con enunciado, tema, apartado y enlace al tema',
    quemadas[0]?.enunciado === BANCO[0].enunciado &&
      quemadas[0]?.tema === 1 &&
      quemadas[0]?.apartado === '2.2. Acepciones' &&
      quemadas[0]?.enlace === 'tema.html?n=1',
    JSON.stringify(quemadas[0]),
  );
  comprobar(
    'la pregunta quemada trae su recuento de fallos e intentos',
    quemadas[0]?.fallos === 3 && quemadas[0]?.intentos === 3 && quemadas[0]?.ultimoFallo === '2026-07-03',
    JSON.stringify({ fallos: quemadas[0]?.fallos, intentos: quemadas[0]?.intentos }),
  );
  comprobar(
    'una pregunta fallada dos veces todavía no es quemada',
    !quemadas.some((q) => q.id === 't01-g002'),
    JSON.stringify(quemadas.map((q) => q.id)),
  );
  comprobar(
    'el umbral de pregunta quemada es 3 fallos, declarado como constante',
    diagnostico?.MIN_FALLOS_QUEMADA === 3,
    String(diagnostico?.MIN_FALLOS_QUEMADA),
  );

  let masFallos = core.crearAlmacenVacio();
  for (let i = 1; i <= 4; i += 1) {
    masFallos = anotar(masFallos, `2026-06-0${i}`, [{ id: 't01-g003', tema: 1, acierto: false }]);
  }
  for (let i = 5; i <= 7; i += 1) {
    masFallos = anotar(masFallos, `2026-06-0${i}`, [{ id: 't01-g001', tema: 1, acierto: false }]);
  }
  const ordenadas = diagnostico?.preguntasQuemadas?.(masFallos, BANCO) ?? [];
  comprobar(
    'las preguntas quemadas se ordenan de más fallos a menos',
    ordenadas.length === 2 && ordenadas[0].id === 't01-g003' && ordenadas[1].id === 't01-g001',
    JSON.stringify(ordenadas.map((q) => `${q.id}:${q.fallos}`)),
  );

  /* Temas flojos: 3 intentos o más en el tema y menos del 60 % de acierto. */
  let flojo = core.crearAlmacenVacio();
  flojo = anotar(flojo, '2026-07-01', [{ id: 't07-g001', tema: 7, acierto: false }]);
  flojo = anotar(flojo, '2026-07-02', [{ id: 't07-g001', tema: 7, acierto: false }]);
  flojo = anotar(flojo, '2026-07-03', [{ id: 't07-g001', tema: 7, acierto: true }]);
  flojo = anotar(flojo, '2026-07-04', [{ id: 't01-g002', tema: 1, acierto: false }]);

  const flojas = diagnostico?.temasFlojos?.(flojo, BANCO) ?? [];
  comprobar(
    'un tema con 3 intentos y 2 fallos sale flojo',
    flojas.length === 1 && flojas[0].tema === 7 && flojas[0].aciertos === 1 && flojas[0].intentos === 3,
    JSON.stringify(flojas.map((t) => `${t.tema}:${t.aciertos}/${t.intentos}`)),
  );
  comprobar(
    'un tema con un solo intento no sale flojo',
    !flojas.some((t) => t.tema === 1),
    JSON.stringify(flojas.map((t) => t.tema)),
  );
  comprobar(
    'los umbrales del tema flojo son 3 intentos y 60 % de acierto, como constantes',
    diagnostico?.MIN_INTENTOS_TEMA === 3 && diagnostico?.UMBRAL_ACIERTO_FLOJO === 60,
    `${diagnostico?.MIN_INTENTOS_TEMA} / ${diagnostico?.UMBRAL_ACIERTO_FLOJO}`,
  );
  comprobar(
    'un tema flojo enlaza a su tema y nombra el apartado que hay que estudiar',
    flojas[0]?.enlace === 'tema.html?n=7' &&
      Array.isArray(flojas[0]?.apartados) &&
      flojas[0].apartados.includes('1. El acto administrativo'),
    JSON.stringify(flojas[0]?.apartados),
  );

  /* Recuento siempre junto al porcentaje. */
  comprobar(
    'el porcentaje se acompaña del recuento: «3 de 5 (60 %)»',
    diagnostico?.textoAcierto?.(3, 5) === '3 de 5 (60 %)',
    String(diagnostico?.textoAcierto?.(3, 5)),
  );
  comprobar(
    'el recuento usa coma decimal y no añade decimales vacíos',
    diagnostico?.textoAcierto?.(1, 3) === '1 de 3 (33,3 %)' &&
      diagnostico?.textoAcierto?.(2, 3) === '2 de 3 (66,7 %)',
    `${diagnostico?.textoAcierto?.(1, 3)} / ${diagnostico?.textoAcierto?.(2, 3)}`,
  );
  comprobar(
    'cada tema flojo lleva su porcentaje acompañado del recuento',
    flojas[0]?.texto === '1 de 3 (33,3 %)',
    String(flojas[0]?.texto),
  );

  /* Temas en riesgo: se acertaba y se ha empezado a fallar. */
  let riesgo = core.crearAlmacenVacio();
  riesgo = anotar(riesgo, '2026-06-01', [{ id: 't05-g001', tema: 5, acierto: true }]);
  riesgo = anotar(riesgo, '2026-06-02', [{ id: 't05-g001', tema: 5, acierto: true }]);
  riesgo = anotar(riesgo, '2026-07-03', [{ id: 't05-g001', tema: 5, acierto: false }]);

  const enRiesgo = diagnostico?.temasEnRiesgo?.(riesgo, BANCO) ?? [];
  comprobar(
    'un tema que se acertaba y ha empezado a fallar sale en riesgo',
    enRiesgo.length === 1 && enRiesgo[0].tema === 5,
    JSON.stringify(enRiesgo.map((t) => t.tema)),
  );
  comprobar(
    'el aviso de riesgo explica que la última respuesta del tema ha fallado',
    enRiesgo[0]?.ultimoFallo === '2026-07-03' && enRiesgo[0]?.preguntasEnFallo === 1,
    JSON.stringify(enRiesgo[0]),
  );
  comprobar(
    'un tema en riesgo no se presenta además como flojo',
    !(diagnostico?.temasFlojos?.(riesgo, BANCO) ?? []).some((t) => t.tema === 5),
    JSON.stringify(diagnostico?.temasFlojos?.(riesgo, BANCO)),
  );

  let primerFallo = core.crearAlmacenVacio();
  primerFallo = anotar(primerFallo, '2026-07-01', [{ id: 't11-g001', tema: 11, acierto: false }]);
  primerFallo = anotar(primerFallo, '2026-07-02', [{ id: 't11-g001', tema: 11, acierto: false }]);
  primerFallo = anotar(primerFallo, '2026-07-03', [{ id: 't11-g002', tema: 11, acierto: true }]);
  primerFallo = anotar(primerFallo, '2026-07-04', [{ id: 't11-g002', tema: 11, acierto: true }]);
  primerFallo = anotar(primerFallo, '2026-07-05', [{ id: 't11-g002', tema: 11, acierto: true }]);
  comprobar(
    'un fallo en el primer intento de una pregunta no es un tema en riesgo',
    !(diagnostico?.temasEnRiesgo?.(primerFallo, BANCO) ?? []).some((t) => t.tema === 11),
    JSON.stringify(diagnostico?.temasEnRiesgo?.(primerFallo, BANCO)),
  );

  /* Estado vacío honesto. */
  const vacio = diagnostico?.diagnosticar?.(core.crearAlmacenVacio(), BANCO);
  comprobar(
    'sin datos el diagnóstico se declara vacío en vez de inventar ceros',
    vacio?.vacio === true &&
      vacio.quemadas.length === 0 &&
      vacio.flojas.length === 0 &&
      vacio.enRiesgo.length === 0 &&
      vacio.preguntasConDatos === 0,
    JSON.stringify(vacio),
  );

  /* Las preguntas de los cuadernillos oficiales no entran. */
  const soloOficiales = core.registrarIntento(core.crearAlmacenVacio(), {
    modo: 'examen',
    aciertos: 0,
    total: 2,
    porcentaje: 0,
    fecha: '2026-07-10',
    preguntas: [
      { id: '2021-p38-001', tema: null, acierto: false },
      { id: '2021-p38-002', acierto: false },
    ],
  });
  comprobar(
    'un intento de cuadernillo oficial no crea registro por pregunta',
    iguales(soloOficiales.porPregunta, {}),
    JSON.stringify(soloOficiales.porPregunta),
  );
  comprobar(
    'las preguntas de los oficiales no entran en el diagnóstico',
    iguales(diagnostico?.diagnosticar?.(soloOficiales, BANCO), {
      quemadas: [],
      flojas: [],
      enRiesgo: [],
      preguntasConDatos: 0,
      temasConDatos: 0,
      vacio: true,
    }),
    JSON.stringify(diagnostico?.diagnosticar?.(soloOficiales, BANCO)),
  );

  // Un registro que apunta a una pregunta del banco oficial tampoco se clasifica:
  // el banco dice que no tiene tema, y sin tema no hay diagnóstico posible.
  const oficialEnAlmacen = core.validarAlmacen({
    ...core.crearAlmacenVacio(),
    porPregunta: {
      '2021-p38-001': { tema: 1, intentos: 4, fallos: 4, rachaFallos: 4, ultimoFallo: '2026-07-10' },
    },
  });
  comprobar(
    'un registro de una pregunta sin tema en el banco se descarta del diagnóstico',
    (diagnostico?.preguntasQuemadas?.(oficialEnAlmacen, BANCO) ?? []).length === 0 &&
      (diagnostico?.diagnosticar?.(oficialEnAlmacen, BANCO) ?? {}).preguntasConDatos === 0,
    JSON.stringify(diagnostico?.diagnosticar?.(oficialEnAlmacen, BANCO)),
  );

  /* Registro por pregunta en el almacén: compatible con lo ya exportado. */
  comprobar(
    'el almacén guarda un registro por pregunta con tema, intentos, fallos y fecha del último fallo',
    conFallos.porPregunta['t01-g001']?.tema === 1 &&
      conFallos.porPregunta['t01-g001']?.intentos === 3 &&
      conFallos.porPregunta['t01-g001']?.fallos === 3 &&
      conFallos.porPregunta['t01-g001']?.ultimoFallo === '2026-07-03',
    JSON.stringify(conFallos.porPregunta['t01-g001']),
  );
  comprobar(
    'acertar después pone la racha de fallos a cero y conserva el último fallo',
    flojo.porPregunta['t07-g001']?.rachaFallos === 0 &&
      flojo.porPregunta['t07-g001']?.fallos === 2 &&
      flojo.porPregunta['t07-g001']?.ultimoFallo === '2026-07-02',
    JSON.stringify(flojo.porPregunta['t07-g001']),
  );

  // Lo que ya hacía `registrarIntento` no cambia al añadirle el registro nuevo:
  // se le puede seguir llamando sin resultados por pregunta.
  const sinPreguntas = core.registrarIntento(core.crearAlmacenVacio(), {
    modo: 'media',
    aciertos: 7,
    total: 10,
    porcentaje: 70,
    fecha: '2026-07-12',
    rachaMaxima: 3,
  });
  comprobar(
    'registrarIntento sin resultados por pregunta sigue guardando el récord del modo',
    sinPreguntas.registros.media?.porcentaje === 70 &&
      sinPreguntas.ultimoIntento?.modo === 'media' &&
      sinPreguntas.rachaMaxima === 3 &&
      iguales(sinPreguntas.porPregunta, {}),
    JSON.stringify(sinPreguntas.registros),
  );

  const viejo = JSON.stringify({
    version: core.VERSION_ALMACEN,
    registros: { corta: { aciertos: 8, total: 10, porcentaje: 80, fecha: '2026-07-01' } },
    rachaMaxima: 6,
    ultimoIntento: { modo: 'corta', aciertos: 8, total: 10, porcentaje: 80, fecha: '2026-07-01' },
    reto: { fecha: '2026-07-01', aciertos: 8, total: 10 },
  });
  const importado = core.importarAlmacen(viejo);
  comprobar(
    'un almacén exportado antes del registro por pregunta se importa entero',
    importado.ok === true &&
      importado.almacen.registros.corta.porcentaje === 80 &&
      importado.almacen.rachaMaxima === 6 &&
      importado.almacen.ultimoIntento.porcentaje === 80 &&
      importado.almacen.reto.aciertos === 8,
    JSON.stringify(importado),
  );
  comprobar(
    'al almacén viejo se le añade el registro por pregunta vacío, sin perder nada',
    iguales(importado.almacen?.porPregunta, {}) &&
      iguales(core.validarAlmacen(JSON.parse(viejo))?.porPregunta, {}),
    JSON.stringify(importado.almacen?.porPregunta),
  );

  const idaYVueltaDiagnostico = core.importarAlmacen(core.exportarAlmacen(conFallos));
  comprobar(
    'el registro por pregunta sobrevive a exportar e importar',
    idaYVueltaDiagnostico.ok === true &&
      iguales(idaYVueltaDiagnostico.almacen.porPregunta, conFallos.porPregunta),
    JSON.stringify(idaYVueltaDiagnostico.almacen?.porPregunta),
  );

  const porPreguntaHostil = [
    '{"version":1,"registros":{},"rachaMaxima":0,"porPregunta":[]}',
    '{"version":1,"registros":{},"rachaMaxima":0,"porPregunta":"nada"}',
    '{"version":1,"registros":{},"rachaMaxima":0,"porPregunta":{"":{"tema":1,"intentos":1,"fallos":1,"rachaFallos":1,"ultimoFallo":"2026-07-10"}}}',
    '{"version":1,"registros":{},"rachaMaxima":0,"porPregunta":{"t01-g001":{"tema":0,"intentos":1,"fallos":1,"rachaFallos":1,"ultimoFallo":"2026-07-10"}}}',
    '{"version":1,"registros":{},"rachaMaxima":0,"porPregunta":{"t01-g001":{"tema":1,"intentos":0,"fallos":0,"rachaFallos":0,"ultimoFallo":null}}}',
    '{"version":1,"registros":{},"rachaMaxima":0,"porPregunta":{"t01-g001":{"tema":1,"intentos":2,"fallos":3,"rachaFallos":2,"ultimoFallo":"2026-07-10"}}}',
    '{"version":1,"registros":{},"rachaMaxima":0,"porPregunta":{"t01-g001":{"tema":1,"intentos":2,"fallos":1,"rachaFallos":2,"ultimoFallo":"2026-07-10"}}}',
    '{"version":1,"registros":{},"rachaMaxima":0,"porPregunta":{"t01-g001":{"tema":1,"intentos":2,"fallos":1,"rachaFallos":1,"ultimoFallo":"ayer"}}}',
    '{"version":1,"registros":{},"rachaMaxima":0,"porPregunta":{"t01-g001":{"tema":1,"intentos":2,"fallos":0,"rachaFallos":0,"ultimoFallo":"2026-07-10"}}}',
    '{"version":1,"registros":{},"rachaMaxima":0,"porPregunta":{"t01-g001":"muchos"}}',
  ];

  let lanzoDiagnostico = false;
  let aceptadosDiagnostico = 0;
  for (const entrada of porPreguntaHostil) {
    try {
      if (core.importarAlmacen(entrada)?.ok) aceptadosDiagnostico += 1;
    } catch {
      lanzoDiagnostico = true;
    }
  }
  comprobar('el registro por pregunta corrupto no lanza excepciones', !lanzoDiagnostico);
  comprobar(
    'un almacén con el registro por pregunta corrupto se rechaza entero',
    aceptadosDiagnostico === 0,
    `${aceptadosDiagnostico} aceptado(s)`,
  );
});

/* --- Atribución del banco -------------------------------------------------- */

// Comprobación estática de la página: no hay navegador en este repositorio, así que se
// inspecciona el código que se sirve al cliente. La atribución es obligatoria (Ley 37/2007),
// pero el enlace al fichero del cuestionario no debe renderizarse (L26).
const RUTA_PAGINA_TEST = 'assets/js/test.js';
const codigoPaginaTest = await readFile(RUTA_PAGINA_TEST, 'utf8');

seccion('Atribución del banco en la página de test', () => {
  comprobar(
    'la página no enlaza el fichero del cuestionario',
    !/href:\s*banco\.fuente/.test(codigoPaginaTest) && !/https?:\/\/infopol/i.test(codigoPaginaTest),
  );
  comprobar(
    'la atribución nombra al organismo que publica el cuestionario',
    codigoPaginaTest.includes('Dirección General de la Policía'),
  );
});

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
