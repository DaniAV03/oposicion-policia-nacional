// Interfaz del motor de test.
//
// Es el único fichero del motor que toca el DOM: la lógica pura (tamaños de
// sesión, muestreo, barajado de opciones, corrección, rachas, reto diario,
// comparación con marcas anteriores y almacenamiento versionado) vive en
// test-core.js, que no depende del navegador y se puede importar desde Node.
//
// Sin JavaScript incrustado y sin atributos de estilo: la CSP del sitio es
// script-src 'self' y style-src 'self', así que todos los manejadores se
// enlazan desde aquí y las marcas de estado se resuelven con clases CSS.
//
// Criterio de diseño: la sesión tiene que poder terminarse en cualquier momento
// sin que la página insista. No hay cuenta atrás en práctica, no hay rachas que
// se puedan perder por salir, no hay avisos de «no pierdas tu progreso» y el
// resultado propone parar cuando la sesión ha sido larga.

import { normalizarEnlaces } from './app.js';
import {
  CLAVE_ALMACENAMIENTO,
  PENALIZACION_POR_DEFECTO,
  SEGUNDOS_POR_PREGUNTA,
  calcularRacha,
  claveFecha,
  compararConRecord,
  construirPool,
  contarPorConvocatoria,
  corregir,
  crearAlmacenVacio,
  crearGeneradorAleatorio,
  crearIntento,
  duracionExamen,
  exportarAlmacen,
  formatearDuracion,
  formatearTiempo,
  hitoDeRacha,
  importarAlmacen,
  mejorDeModo,
  muestrear,
  preguntasDeSesion,
  registrarIntento,
  registrarRespuesta,
  resumirPorConvocatoria,
  seleccionDiaria,
  sugerirParada,
  tasaDeAcierto,
  validarAlmacen,
} from './test-core.js';

const RUTA_INDICE = 'data/examenes/index.json';
const LETRAS = ['a', 'b', 'c'];
const AVISO_RELOJ_SEGUNDOS = 60;
const MODOS_CON_MARCA = ['corta', 'media', 'completa', 'examen'];

const NOMBRE_MODO = {
  corta: 'Sesión corta',
  media: 'Sesión media',
  completa: 'Banco completo',
  examen: 'Examen con tiempo',
  reto: 'Reto del día',
};

const estado = {
  bancos: [],
  intento: [],
  indice: 0,
  modo: 'corta',
  motivo: 'fin',
  finalizada: false,
  registrar: true,
  restante: 0,
  inicioMs: 0,
  limiteMs: 0,
  intervalo: null,
  ritmoIntervalo: null,
  ultimoRitmo: '',
  minutoAvisado: false,
  inicioSesionMs: 0,
  hitoActual: null,
  almacen: crearAlmacenVacio(),
  confirmarBorrado: false,
  recordPrevio: null,
};

/* --- Utilidades de DOM ----------------------------------------------------- */

const $ = (id) => document.getElementById(id);

function crear(etiqueta, { clase, texto, atributos } = {}, hijos = []) {
  const nodo = document.createElement(etiqueta);
  if (clase) nodo.className = clase;
  if (texto !== undefined) nodo.textContent = texto;
  for (const [nombre, valor] of Object.entries(atributos ?? {})) {
    nodo.setAttribute(nombre, String(valor));
  }
  for (const hijo of hijos) nodo.append(hijo);
  return nodo;
}

function boton(texto, clase, alPulsar, id) {
  const nodo = crear('button', { clase, texto, atributos: { type: 'button' } });
  if (id) nodo.id = id;
  nodo.addEventListener('click', alPulsar);
  return nodo;
}

const letra = (indice) => LETRAS[indice] ?? '?';

function anunciar(texto) {
  $('anuncio').textContent = texto;
}

function mostrarEstado(texto, tono = 'listo') {
  const nodo = $('estado');
  nodo.textContent = texto;
  nodo.dataset.tono = tono;
  nodo.hidden = texto === '';
}

function mostrarPanel(cual) {
  for (const nombre of ['inicio', 'sesion', 'resultado']) {
    $(`panel-${nombre}`).hidden = nombre !== cual;
  }
  globalThis.scrollTo(0, 0);
}

/* --- Progreso local -------------------------------------------------------- */

/**
 * Lectura defensiva de `localStorage`.
 *
 * El navegador puede denegar el acceso (ventana privada, política del usuario) o
 * devolver un JSON de otra aplicación o de una versión anterior. En cualquiera
 * de esos casos se empieza de cero en silencio: la página nunca se rompe por un
 * dato guardado.
 */
function leerAlmacen() {
  try {
    const bruto = globalThis.localStorage?.getItem(CLAVE_ALMACENAMIENTO);
    if (!bruto) return crearAlmacenVacio();
    let datos = null;
    try {
      datos = JSON.parse(bruto);
    } catch {
      return crearAlmacenVacio();
    }
    return validarAlmacen(datos) ?? crearAlmacenVacio();
  } catch {
    return crearAlmacenVacio();
  }
}

/** Guarda el progreso. Devuelve false si el navegador no lo permite. */
function guardarAlmacen() {
  try {
    globalThis.localStorage?.setItem(CLAVE_ALMACENAMIENTO, exportarAlmacen(estado.almacen));
    $('aviso-almacen').hidden = true;
    return true;
  } catch {
    const aviso = $('aviso-almacen');
    aviso.textContent =
      'Este navegador no permite guardar el progreso (por ejemplo, en una ventana privada). La sesión funciona igual; si quieres conservar las marcas, exporta el progreso a un fichero antes de cerrar.';
    aviso.hidden = false;
    return false;
  }
}

/* --- Carga del banco ------------------------------------------------------- */

async function leerBanco(entrada) {
  const respuesta = await fetch(`data/examenes/${entrada.archivo}`);
  if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
  const banco = await respuesta.json();
  if (!Array.isArray(banco.preguntas) || banco.preguntas.length === 0) {
    throw new Error('el fichero no contiene preguntas');
  }
  return banco;
}

async function cargarBancos() {
  const respuesta = await fetch(RUTA_INDICE);
  if (!respuesta.ok) {
    throw new Error(`No se pudo leer el índice del banco (HTTP ${respuesta.status}).`);
  }

  const manifiesto = await respuesta.json();
  const entradas = Array.isArray(manifiesto.examenes) ? manifiesto.examenes : [];
  if (entradas.length === 0) {
    throw new Error('El índice del banco no declara ninguna convocatoria.');
  }

  const resultados = await Promise.allSettled(entradas.map((entrada) => leerBanco(entrada)));
  const bancos = [];
  const errores = [];

  resultados.forEach((resultado, i) => {
    if (resultado.status === 'fulfilled') bancos.push(resultado.value);
    else errores.push(`${entradas[i].archivo} (${resultado.reason?.message ?? 'error desconocido'})`);
  });

  return { bancos, errores };
}

async function iniciar() {
  try {
    const { bancos, errores } = await cargarBancos();

    if (bancos.length === 0) {
      mostrarEstado(
        `No se pudo cargar ningún banco de preguntas: ${errores.join(' · ')}. Comprueba la conexión y recarga la página.`,
        'error',
      );
      return;
    }

    estado.bancos = bancos;
    estado.almacen = leerAlmacen();

    const pool = construirPool(bancos);
    if (pool.length === 0) {
      mostrarEstado('Los bancos cargados no contienen ninguna pregunta válida.', 'error');
      return;
    }

    const resumen = contarPorConvocatoria(bancos)
      .map((fila) => `${fila.convocatoria} · promoción ${fila.promocion}: ${fila.total}`)
      .join(' · ');
    const base = `Banco cargado: ${pool.length} preguntas (${resumen}).`;
    const aviso = errores.length
      ? ` No se pudo cargar ${errores.join(' · ')}; la sesión continúa con las convocatorias disponibles.`
      : '';
    mostrarEstado(`${base}${aviso}`, errores.length ? 'aviso' : 'listo');

    pintarInicio();
    mostrarPanel('inicio');
  } catch (error) {
    console.error(error);
    mostrarEstado(
      `No se pudo cargar el banco de preguntas: ${error.message} Recarga la página; si sigue igual, abre la consola del navegador para ver el detalle.`,
      'error',
    );
  }
}

/* --- Configuración de la sesión -------------------------------------------- */

function pintarInicio() {
  const convocatoriaPrevia = $('filtro-convocatoria').value;
  const total = construirPool(estado.bancos).length;

  const opciones = [
    crear('option', {
      texto: `Todas las convocatorias (${total} preguntas)`,
      atributos: { value: '' },
    }),
  ];

  for (const fila of contarPorConvocatoria(estado.bancos)) {
    opciones.push(
      crear('option', {
        texto: `${fila.convocatoria} · promoción ${fila.promocion} (${fila.total} preguntas)`,
        atributos: { value: String(fila.convocatoria) },
      }),
    );
  }
  $('filtro-convocatoria').replaceChildren(...opciones);
  if (convocatoriaPrevia && $('filtro-convocatoria').querySelector(`option[value="${convocatoriaPrevia}"]`)) {
    $('filtro-convocatoria').value = convocatoriaPrevia;
  }

  const fuentes = estado.bancos.map((banco) => {
    const item = crear('li', {
      texto: `Convocatoria ${banco.convocatoria} · promoción ${banco.promocion} — ${banco.preguntas.length} preguntas. `,
    });
    if (typeof banco.fuente === 'string' && /^https?:/i.test(banco.fuente)) {
      item.append(
        crear('a', {
          texto: 'Cuestionario oficial',
          atributos: { href: banco.fuente, rel: 'noopener noreferrer' },
        }),
      );
    }
    return item;
  });
  $('lista-fuentes').replaceChildren(...fuentes);
  $('fuentes-banco').hidden = false;
  normalizarEnlaces($('fuentes-banco'));

  alternarConfirmacionBorrado(false, { enfocar: false });
  pintarHistorial();
  pintarReto();
  actualizarControles();
}

const tamanoSeleccionado = () =>
  document.querySelector('input[name="tamano"]:checked')?.value ?? 'corta';

const valorConvocatoria = () => {
  const valor = $('filtro-convocatoria').value;
  return valor === '' ? null : Number(valor);
};

const poolDelFiltro = () => construirPool(estado.bancos, { convocatoria: valorConvocatoria() });

function actualizarControles() {
  const tamano = tamanoSeleccionado();
  const total = poolDelFiltro().length;
  const campo = $('preguntas-sesion');
  const ayuda = $('ayuda-preguntas');

  campo.max = String(Math.max(1, total));
  campo.disabled = tamano !== 'examen';

  const pedidasExamen = preguntasDeSesion('examen', total, { cantidadExamen: campo.value });
  for (const modo of MODOS_CON_MARCA) {
    const pedidas =
      modo === 'examen'
        ? pedidasExamen
        : preguntasDeSesion(modo, total, { cantidadExamen: campo.value });
    $(`cuenta-${modo}`).textContent = `${pedidas} ${pedidas === 1 ? 'pregunta' : 'preguntas'}`;
  }

  if (tamano === 'examen') {
    ayuda.textContent = `${pedidasExamen} preguntas con un temporizador orientativo de ${formatearTiempo(
      duracionExamen(pedidasExamen),
    )} (${SEGUNDOS_POR_PREGUNTA} s por pregunta). El tiempo real lo fijan las bases oficiales.`;
    return;
  }

  if (tamano === 'corta') {
    ayuda.textContent =
      'Diez preguntas al azar entre las del filtro, sin repetir. Se termina en un par de minutos.';
  } else if (tamano === 'media') {
    ayuda.textContent = `Treinta preguntas al azar (o las que haya) entre las ${total} del filtro, sin repetir.`;
  } else {
    ayuda.textContent = `Las ${total} preguntas del filtro, sin repetir. Puedes dejarlo cuando quieras: la sesión no se guarda a medias ni te reclama nada.`;
  }
}

function semillaAleatoria() {
  const valores = globalThis.crypto?.getRandomValues?.(new Uint32Array(1));
  return valores ? valores[0] : (Math.random() * 0xffffffff) >>> 0;
}

function empezarSesion() {
  const pool = poolDelFiltro();
  if (pool.length === 0) {
    mostrarEstado('La convocatoria elegida no tiene preguntas en el banco. Elige otra o todas.', 'aviso');
    return;
  }

  const modo = tamanoSeleccionado();
  const pedidas = preguntasDeSesion(modo, pool.length, { cantidadExamen: $('preguntas-sesion').value });
  if (pedidas === 0) {
    mostrarEstado('No hay preguntas que pedir con este filtro.', 'aviso');
    return;
  }

  const aleatorio = crearGeneradorAleatorio(semillaAleatoria());
  mostrarEstado('');
  iniciarSesion(crearIntento(muestrear(pool, pedidas, aleatorio), aleatorio), modo);
}

function empezarReto() {
  const pool = construirPool(estado.bancos);
  if (pool.length === 0) {
    mostrarEstado('El banco no tiene preguntas cargadas para el reto del día.', 'aviso');
    return;
  }

  const preguntas = seleccionDiaria(pool, claveFecha(new Date()));
  const aleatorio = crearGeneradorAleatorio(semillaAleatoria());
  mostrarEstado('');
  iniciarSesion(crearIntento(preguntas, aleatorio), 'reto');
}

function iniciarSesion(intento, modo, { registrar = true } = {}) {
  detenerReloj();
  detenerRitmo();
  estado.intento = intento;
  estado.indice = 0;
  estado.modo = modo;
  estado.motivo = 'fin';
  estado.finalizada = false;
  estado.registrar = registrar;
  estado.minutoAvisado = false;
  estado.hitoActual = null;
  estado.recordPrevio = registrar ? mejorDeModo(estado.almacen, modo) : null;
  estado.inicioSesionMs = Date.now();
  estado.ultimoRitmo = '';

  limpiarResultado();
  mostrarPanel('sesion');
  $('racha-hito').hidden = true;
  $('racha-hito').textContent = '';

  const examen = modo === 'examen';
  $('reloj').hidden = !examen;
  $('ritmo').hidden = examen;

  if (examen) {
    estado.limiteMs = duracionExamen(intento.length) * 1000;
    estado.inicioMs = Date.now();
    iniciarReloj();
  } else {
    iniciarRitmo();
  }

  pintarPregunta('enunciado');
}

/* --- Pregunta en curso ----------------------------------------------------- */

const entradaActual = () => estado.intento[estado.indice];

const estaRespondida = () => {
  const entrada = entradaActual();
  return !!entrada && entrada.respuesta !== null && entrada.respuesta !== undefined;
};

function pintarPregunta(foco = 'enunciado') {
  const entrada = entradaActual();
  if (!entrada) {
    finalizar('fin');
    return;
  }

  const pregunta = entrada.pregunta;
  const revelar = estaRespondida() && estado.modo !== 'examen';

  $('progreso').textContent = `Pregunta ${estado.indice + 1} de ${estado.intento.length}`;
  const medidor = $('medidor');
  medidor.max = Math.max(1, estado.intento.length);
  medidor.value = estado.indice + (revelar ? 1 : 0);

  pintarMarcador();
  pintarRacha();

  $('origen').textContent = `Convocatoria ${pregunta.convocatoria} · promoción ${pregunta.promocion}`;
  $('enunciado').textContent = pregunta.enunciado;

  $('opciones').replaceChildren(
    ...pregunta.opciones.map((texto, i) => botonOpcion(entrada, texto, i, revelar)),
  );

  pintarRetroalimentacion(entrada, revelar);
  pintarAcciones(revelar);

  if (foco === 'siguiente') $('boton-siguiente')?.focus();
  else $('enunciado').focus();
}

function botonOpcion(entrada, texto, indice, revelar) {
  const pregunta = entrada.pregunta;
  const clases = ['opcion'];
  let nota = '';
  let marca = '';

  if (revelar) {
    if (indice === pregunta.correcta) {
      clases.push('opcion--correcta');
      marca = '✓';
      if (entrada.respuesta === indice) {
        clases.push('opcion--elegida');
        nota = ' (tu respuesta, correcta)';
      } else {
        nota = ' (respuesta correcta)';
      }
    } else if (entrada.respuesta === indice) {
      clases.push('opcion--fallada', 'opcion--elegida');
      marca = '✗';
      nota = ' (tu respuesta, incorrecta)';
    }
  }

  const nodo = crear('button', { clase: clases.join(' '), atributos: { type: 'button' } }, [
    crear('span', {
      clase: 'opcion__numero',
      texto: String(indice + 1),
      atributos: { 'aria-hidden': 'true' },
    }),
    crear('span', { clase: 'opcion__texto', texto }),
  ]);

  if (marca) {
    nodo.append(crear('span', { clase: 'opcion__marca', texto: marca, atributos: { 'aria-hidden': 'true' } }));
  }
  if (nota) nodo.append(crear('span', { clase: 'visualmente-oculto', texto: nota }));

  nodo.disabled = revelar;
  nodo.addEventListener('click', () => responder(indice));
  return nodo;
}

/**
 * Marcador de la sesión: en práctica, una línea tranquila con el acierto hasta
 * ahora; en examen, nada que despiste antes de la corrección final.
 */
function pintarMarcador() {
  if (estado.modo === 'examen') {
    $('marcador').textContent = 'Corrección al final';
    return;
  }

  const resultado = corregir(estado.intento);
  const respondidas = resultado.aciertos + resultado.fallos;

  if (respondidas === 0) {
    $('marcador').textContent = 'Sin respuestas todavía';
    return;
  }
  $('marcador').textContent = `${resultado.aciertos} de ${respondidas} correctas · ${tasaDeAcierto(
    resultado.aciertos,
    respondidas,
  )} % de acierto`;
}

/** Contador de racha: aparece a partir de dos aciertos seguidos y nada más. */
function pintarRacha() {
  const nodo = $('racha');
  if (estado.modo === 'examen') {
    nodo.hidden = true;
    nodo.textContent = '';
    return;
  }

  const { actual } = calcularRacha(estado.intento.slice(0, estado.indice + 1));
  nodo.hidden = actual < 2;
  nodo.textContent = actual >= 2 ? `Racha: ${actual} aciertos seguidos` : '';
}

/**
 * Reconocimiento de la racha, sólo en 5 y en 10.
 *
 * Vive en su propia región `role="status"` para que quien use lector de pantalla
 * lo oiga una sola vez. No hay sonido, ni animación larga, ni nada más alto:
 * pasada la racha, el aviso desaparece sin dejar rastro.
 */
function reconocerRacha(actual) {
  const nodo = $('racha-hito');

  if (estado.modo === 'examen') {
    nodo.hidden = true;
    return;
  }

  const hito = hitoDeRacha(actual);
  if (hito !== null && hito !== estado.hitoActual) {
    estado.hitoActual = hito;
    nodo.textContent =
      hito === 5
        ? 'Cinco aciertos seguidos.'
        : 'Diez aciertos seguidos. Buen momento para parar, si quieres.';
    nodo.hidden = false;
    return;
  }

  if (actual === 0) {
    estado.hitoActual = null;
    nodo.hidden = true;
    nodo.textContent = '';
  }
}

function pintarRetroalimentacion(entrada, revelar) {
  const bloque = $('retroalimentacion');

  if (!revelar) {
    bloque.hidden = true;
    bloque.replaceChildren();
    return;
  }

  const pregunta = entrada.pregunta;
  const acierto = entrada.respuesta === pregunta.correcta;
  const correcta = `${letra(pregunta.correcta)}) «${pregunta.opciones[pregunta.correcta]}»`;

  bloque.className = `retroalimentacion retroalimentacion--${acierto ? 'acierto' : 'fallo'}`;
  bloque.hidden = false;
  bloque.replaceChildren(
    crear('p', {
      clase: 'retroalimentacion__titulo',
      texto: acierto ? 'Respuesta correcta' : 'Respuesta incorrecta',
    }),
    crear('p', {
      texto: acierto
        ? `Has marcado la opción correcta: ${correcta}.`
        : `La opción correcta era la ${correcta}.`,
    }),
    crear('p', { clase: 'retroalimentacion__id', texto: `Pregunta ${pregunta.id}` }),
  );
}

function pintarAcciones(revelar) {
  const acciones = $('acciones-sesion');
  const botones = [];

  if (estado.modo === 'examen') {
    botones.push(boton('Dejar en blanco y avanzar', 'boton boton--secundario', avanzar));
  } else if (revelar) {
    const ultima = estado.indice === estado.intento.length - 1;
    botones.push(
      boton(ultima ? 'Ver el resultado' : 'Siguiente pregunta', 'boton', avanzar, 'boton-siguiente'),
    );
  } else {
    botones.push(boton('Dejar en blanco', 'boton boton--secundario', avanzar));
  }

  botones.push(boton('Salir de la sesión', 'boton boton--secundario', salirSesion));
  acciones.replaceChildren(...botones);
}

function responder(opcion) {
  const entrada = entradaActual();
  if (!entrada || estaRespondida()) return;

  estado.intento = registrarRespuesta(estado.intento, estado.indice, opcion);

  if (estado.modo === 'examen') {
    avanzar();
    return;
  }

  const acierto = opcion === entrada.pregunta.correcta;
  anunciar(
    acierto
      ? 'Respuesta correcta.'
      : `Respuesta incorrecta. La opción correcta es la ${letra(entrada.pregunta.correcta)}.`,
  );

  // La corrección se pinta en el mismo fotograma y el foco pasa a «Siguiente»:
  // quien responde con el teclado puede encadenar sin buscar el ratón.
  const { actual } = calcularRacha(estado.intento.slice(0, estado.indice + 1));
  reconocerRacha(actual);
  pintarPregunta('siguiente');
}

function avanzar() {
  if (estado.indice >= estado.intento.length - 1) {
    finalizar('fin');
    return;
  }
  estado.indice += 1;
  pintarPregunta('enunciado');
}

function salirSesion() {
  detenerReloj();
  detenerRitmo();
  estado.intento = [];
  estado.indice = 0;
  estado.finalizada = false;
  mostrarEstado('');
  pintarInicio();
  mostrarPanel('inicio');
  anunciar('Sesión cancelada. No se ha guardado ningún resultado.');
  $('empezar')?.focus();
}

/* --- Ritmo y reloj --------------------------------------------------------- */

/** Práctica: sólo cuánto lleva la sesión. Sin cuenta atrás y sin color de alarma. */
function iniciarRitmo() {
  detenerRitmo();
  pintarRitmo();
  estado.ritmoIntervalo = globalThis.setInterval(pintarRitmo, 1000);
}

function pintarRitmo() {
  const transcurrido = Math.max(0, Math.round((Date.now() - estado.inicioSesionMs) / 1000));
  const texto = `En curso: ${formatearDuracion(transcurrido)}`;
  if (texto === estado.ultimoRitmo) return;
  estado.ultimoRitmo = texto;
  $('ritmo').textContent = texto;
}

function detenerRitmo() {
  if (estado.ritmoIntervalo !== null) {
    globalThis.clearInterval(estado.ritmoIntervalo);
    estado.ritmoIntervalo = null;
  }
}

function iniciarReloj() {
  detenerReloj();
  estado.restante = Math.round(estado.limiteMs / 1000);
  pintarReloj();
  estado.intervalo = globalThis.setInterval(comprobarReloj, 250);
}

function comprobarReloj() {
  const restante = Math.max(0, Math.ceil((estado.limiteMs - (Date.now() - estado.inicioMs)) / 1000));

  if (restante !== estado.restante) {
    estado.restante = restante;
    pintarReloj();
  }

  if (restante <= AVISO_RELOJ_SEGUNDOS && !estado.minutoAvisado) {
    estado.minutoAvisado = true;
    anunciar('Queda un minuto de examen.');
  }

  if (restante <= 0) {
    detenerReloj();
    finalizar('tiempo');
  }
}

function pintarReloj() {
  const nodo = $('reloj');
  nodo.textContent = `Tiempo ${formatearTiempo(estado.restante)}`;
  nodo.classList.toggle('sesion__reloj--aviso', estado.restante <= AVISO_RELOJ_SEGUNDOS);
}

function detenerReloj() {
  if (estado.intervalo !== null) {
    globalThis.clearInterval(estado.intervalo);
    estado.intervalo = null;
  }
}

/* --- Resultado -------------------------------------------------------------- */

const pendientes = () =>
  estado.intento.filter(
    (entrada) =>
      entrada.respuesta === null ||
      entrada.respuesta === undefined ||
      entrada.respuesta !== entrada.pregunta.correcta,
  );

function limpiarResultado() {
  $('resultado-cifras').replaceChildren();
  $('comparacion').textContent = '';
  $('parada').hidden = true;
  $('parada').textContent = '';
  $('nota-puntuacion').textContent = '';
  $('desglose').replaceChildren();
  $('fallos').replaceChildren();
  $('acciones-resultado').replaceChildren();
}

function finalizar(motivo) {
  if (estado.finalizada) return;
  estado.finalizada = true;
  estado.motivo = motivo;
  detenerReloj();
  detenerRitmo();

  const resultado = corregir(estado.intento, { penalizacion: PENALIZACION_POR_DEFECTO });
  const racha = calcularRacha(estado.intento).maxima;
  const duracion = Math.max(0, Math.round((Date.now() - estado.inicioSesionMs) / 1000));
  const comparacion = estado.registrar
    ? compararConRecord(resultado.porcentajeAcierto, estado.recordPrevio)
    : { estado: 'repaso', diferencia: 0, mejor: null };

  if (estado.registrar) {
    estado.almacen = registrarIntento(estado.almacen, {
      modo: estado.modo,
      aciertos: resultado.aciertos,
      total: resultado.total,
      porcentaje: resultado.porcentajeAcierto,
      fecha: claveFecha(new Date()),
      rachaMaxima: racha,
    });
    guardarAlmacen();
  }

  pintarResultado(resultado, motivo, { comparacion, duracion, racha });
  mostrarPanel('resultado');
  anunciar(`Sesión terminada: ${resultado.aciertos} aciertos de ${resultado.total}.`);
  $('titulo-resultado').focus();
}

function pintarResultado(resultado, motivo, { comparacion, duracion, racha }) {
  $('resultado-cifras').replaceChildren(crearCifras(resultado, { duracion, racha }));
  $('comparacion').textContent = textoComparacion(comparacion, resultado);
  $('parada').hidden = !sugerirParada(resultado.total);
  $('parada').textContent = $('parada').hidden
    ? ''
    : `${resultado.total} preguntas seguidas es una sesión larga. Es un buen momento para parar: el repaso rinde más después de un descanso y lo que has hecho ya queda guardado.`;
  $('nota-puntuacion').textContent = notaPuntuacion(resultado, motivo);
  $('desglose').replaceChildren(crearDesglose());
  $('fallos').replaceChildren(crearRepaso());
  $('acciones-resultado').replaceChildren(...crearAccionesResultado());
}

function crearCifras(resultado, { duracion, racha }) {
  const filas = [
    ['Aciertos', `${resultado.aciertos} de ${resultado.total}`],
    ['Fallos', String(resultado.fallos)],
    ['En blanco', String(resultado.blancos)],
    ['Acierto sobre el total', `${resultado.porcentajeAcierto} %`],
    ['Racha máxima', racha > 0 ? `${racha} seguidas` : 'Ninguna'],
    ['Duración', formatearDuracion(duracion)],
  ];

  return crear(
    'dl',
    { clase: 'cifras' },
    filas.map(([titulo, valor]) =>
      crear('div', { clase: 'cifras__fila' }, [
        crear('dt', { texto: titulo }),
        crear('dd', { texto: valor }),
      ]),
    ),
  );
}

const nombreModo = (modo) => NOMBRE_MODO[modo] ?? 'este modo';

function textoComparacion(comparacion, resultado) {
  const modo = nombreModo(estado.modo);

  switch (comparacion.estado) {
    case 'repaso':
      return 'Sesión de repaso de las preguntas falladas: sirve para practicar, no cuenta como marca.';
    case 'primera':
      return `Primera marca de «${modo}»: queda anotada como referencia para la próxima vez.`;
    case 'mejor':
      return `Mejor que tu marca anterior en «${modo}»: ${resultado.porcentajeAcierto} % frente a ${
        comparacion.mejor
      } % (${comparacion.diferencia > 0 ? '+' : ''}${comparacion.diferencia} puntos).`;
    case 'igual':
      return `Igualas tu mejor marca en «${modo}» (${comparacion.mejor} %).`;
    default:
      return `Tu mejor marca en «${modo}» sigue siendo ${comparacion.mejor} %; esta vez ha sido el ${
        resultado.porcentajeAcierto
      } %. No hay nada que recuperar.`;
  }
}

function notaPuntuacion(resultado, motivo) {
  const partes = [];
  if (motivo === 'tiempo') {
    partes.push('Se ha agotado el tiempo: las preguntas sin responder cuentan como en blanco.');
  }
  partes.push(
    `Recuento de práctica, no una nota oficial. Penalización aplicada: ${resultado.penalizacion} aciertos por fallo.`,
  );
  partes.push(
    'La fórmula oficial de corrección debe confirmarse en las bases de la convocatoria publicadas en el BOE antes de interpretar estas cifras como calificación.',
  );
  return partes.join(' ');
}

function crearDesglose() {
  const filas = resumirPorConvocatoria(estado.intento);
  const contenedor = crear('div', { clase: 'desglose' });

  if (filas.length === 0) {
    contenedor.append(crear('p', { texto: 'No hay preguntas que desglosar.' }));
    return contenedor;
  }

  const encabezados = ['Convocatoria', 'Promoción', 'Preguntas', 'Aciertos', 'Fallos', 'En blanco'];
  const tabla = crear('table', {}, [
    crear('caption', { texto: 'Desglose por convocatoria' }),
    crear('thead', {}, [
      crear(
        'tr',
        {},
        encabezados.map((texto) => crear('th', { texto, atributos: { scope: 'col' } })),
      ),
    ]),
  ]);

  const cuerpo = crear('tbody');
  for (const fila of filas) {
    cuerpo.append(
      crear(
        'tr',
        {},
        [fila.convocatoria, fila.promocion, fila.total, fila.aciertos, fila.fallos, fila.blancos].map(
          (valor) => crear('td', { texto: String(valor) }),
        ),
      ),
    );
  }

  tabla.append(cuerpo);
  contenedor.append(tabla);
  return contenedor;
}

function crearRepaso() {
  const revisables = pendientes();
  const contenedor = crear('div', { clase: 'repaso' });

  contenedor.append(crear('h3', { texto: 'Preguntas falladas y en blanco' }));

  if (revisables.length === 0) {
    contenedor.append(crear('p', { texto: 'Ninguna: todas las preguntas se han contestado bien.' }));
    return contenedor;
  }

  contenedor.append(
    crear('p', {
      clase: 'repaso__nota',
      texto: 'Se pueden repetir en una sesión de repaso, con las mismas opciones y el mismo orden.',
    }),
  );

  const lista = crear('ol', { clase: 'repaso__lista' });

  for (const entrada of revisables) {
    const pregunta = entrada.pregunta;
    const enBlanco = entrada.respuesta === null || entrada.respuesta === undefined;
    const item = crear('li', { clase: 'repaso__item' }, [
      crear('p', {
        clase: 'repaso__origen',
        texto: `Convocatoria ${pregunta.convocatoria} · promoción ${pregunta.promocion} · ${pregunta.id} · ${enBlanco ? 'En blanco' : 'Incorrecta'}`,
      }),
      crear('p', { clase: 'repaso__enunciado', texto: pregunta.enunciado }),
    ]);

    if (!enBlanco) {
      item.append(
        crear('p', {
          clase: 'repaso__respuesta',
          texto: `Tu respuesta: ${letra(entrada.respuesta)}) ${pregunta.opciones[entrada.respuesta]}`,
        }),
      );
    }

    item.append(
      crear('p', {
        clase: 'repaso__respuesta repaso__respuesta--correcta',
        texto: `Correcta: ${letra(pregunta.correcta)}) ${pregunta.opciones[pregunta.correcta]}`,
      }),
    );

    lista.append(item);
  }

  contenedor.append(lista);
  return contenedor;
}

function crearAccionesResultado() {
  const acciones = [];
  const revisables = pendientes();

  if (revisables.length > 0) {
    acciones.push(
      boton(`Repetir las ${revisables.length} falladas`, 'boton', repetirPendientes),
    );
  }

  acciones.push(boton('Terminar y volver al inicio', 'boton boton--secundario', volverAlInicio));
  return acciones;
}

function repetirPendientes() {
  const revisables = pendientes();
  if (revisables.length === 0) return;
  iniciarSesion(
    revisables.map((entrada) => ({ ...entrada, respuesta: null })),
    'reto',
    { registrar: false },
  );
}

function volverAlInicio() {
  detenerReloj();
  detenerRitmo();
  pintarInicio();
  mostrarPanel('inicio');
  actualizarControles();
  anunciar('Sesión guardada. Puedes parar aquí.');
  $('empezar')?.focus();
}

/* --- Historial, reto del día y copias -------------------------------------- */

function pintarHistorial() {
  const filas = MODOS_CON_MARCA.map((modo) => {
    const registro = mejorDeModo(estado.almacen, modo);
    return [
      NOMBRE_MODO[modo],
      registro
        ? `${registro.aciertos} de ${registro.total} · ${registro.porcentaje} % · ${registro.fecha}`
        : 'Sin marca todavía',
    ];
  });

  filas.push([
    'Récord de racha',
    estado.almacen.rachaMaxima > 0 ? `${estado.almacen.rachaMaxima} aciertos seguidos` : 'Sin datos',
  ]);

  const ultimo = estado.almacen.ultimoIntento;
  filas.push([
    'Último intento',
    ultimo
      ? `${nombreModo(ultimo.modo)} · ${ultimo.aciertos} de ${ultimo.total} · ${ultimo.porcentaje} %`
      : 'Sin datos',
  ]);

  $('historial').replaceChildren(
    crear(
      'dl',
      { clase: 'historial' },
      filas.map(([titulo, valor]) =>
        crear('div', { clase: 'historial__fila' }, [
          crear('dt', { texto: titulo }),
          crear('dd', { texto: valor }),
        ]),
      ),
    ),
  );
}

function pintarReto() {
  const reto = estado.almacen.reto;
  const hoy = claveFecha(new Date());
  const nodo = $('reto-estado');
  const botonReto = $('empezar-reto');

  if (reto && reto.fecha === hoy) {
    nodo.textContent = `Ya has hecho el reto de hoy: ${reto.aciertos} de ${reto.total} (${
      tasaDeAcierto(reto.aciertos, reto.total)
    } % de acierto). Mañana habrá otro distinto.`;
    botonReto.textContent = 'Repetir el reto de hoy';
    return;
  }

  nodo.textContent = 'Diez preguntas, sin reloj y sin comparar con nadie.';
  botonReto.textContent = 'Hacer el reto de hoy';
}

function alternarConfirmacionBorrado(mostrar, { enfocar = true } = {}) {
  estado.confirmarBorrado = mostrar;
  $('confirmar-borrado').hidden = !mostrar;
  $('borrar').setAttribute('aria-expanded', String(mostrar));
  if (!enfocar) return;
  if (mostrar) $('borrar-confirmar').focus();
  else $('borrar').focus();
}

function borrarProgreso() {
  estado.almacen = crearAlmacenVacio();
  try {
    globalThis.localStorage?.removeItem(CLAVE_ALMACENAMIENTO);
  } catch {
    // Si el navegador no deja escribir, tampoco deja borrar: no hay nada guardado.
  }
  pintarHistorial();
  pintarReto();
  alternarConfirmacionBorrado(false, { enfocar: false });
  mostrarEstado('Progreso borrado de este navegador.', 'listo');
  anunciar('Progreso borrado.');
  $('borrar').focus();
}

function exportarProgreso() {
  const texto = exportarAlmacen(estado.almacen);
  const blob = new Blob([texto], { type: 'application/json' });
  const url = globalThis.URL.createObjectURL(blob);
  const enlace = crear('a', {
    atributos: { href: url, download: `progreso-test-${claveFecha(new Date())}.json` },
  });

  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  globalThis.setTimeout(() => globalThis.URL.revokeObjectURL(url), 1000);
  anunciar('Progreso exportado a un fichero JSON.');
}

async function importarProgreso(archivo) {
  if (!archivo) return;

  let texto = '';
  try {
    texto = await archivo.text();
  } catch {
    texto = '';
  }

  const resultado = importarAlmacen(texto);
  if (!resultado.ok) {
    mostrarEstado(
      'El fichero elegido no es un progreso válido de esta web. No se ha cambiado nada.',
      'aviso',
    );
    anunciar('Importación rechazada: el fichero no contiene un progreso válido.');
    return;
  }

  estado.almacen = resultado.almacen;
  pintarHistorial();
  pintarReto();
  const guardado = guardarAlmacen();
  mostrarEstado(
    guardado
      ? 'Progreso importado.'
      : 'Progreso importado en esta pestaña, pero el navegador no permite guardarlo.',
    guardado ? 'listo' : 'aviso',
  );
  anunciar('Progreso importado.');
}

/* --- Teclado y arranque ----------------------------------------------------- */

document.addEventListener('keydown', (evento) => {
  if (evento.altKey || evento.ctrlKey || evento.metaKey) return;
  if ($('panel-sesion').hidden) return;

  const destino = evento.target;
  if (destino instanceof Element && destino.closest('input, select, textarea')) return;

  if (evento.key === 'Enter') {
    // Sobre un botón, Intro ya lo activa: aquí sólo se atiende al resto del documento.
    if (destino instanceof HTMLButtonElement) return;
    if (estaRespondida() && estado.modo !== 'examen') {
      evento.preventDefault();
      avanzar();
    }
    return;
  }

  if (!['1', '2', '3'].includes(evento.key) || estaRespondida()) return;
  evento.preventDefault();
  responder(Number(evento.key) - 1);
});

$('filtro-convocatoria').addEventListener('change', actualizarControles);
$('preguntas-sesion').addEventListener('input', actualizarControles);
for (const radio of document.querySelectorAll('input[name="tamano"]')) {
  radio.addEventListener('change', actualizarControles);
}
$('empezar').addEventListener('click', empezarSesion);
$('empezar-reto').addEventListener('click', empezarReto);

$('exportar').addEventListener('click', exportarProgreso);
$('borrar').addEventListener('click', () => alternarConfirmacionBorrado(!estado.confirmarBorrado));
$('borrar-confirmar').addEventListener('click', borrarProgreso);
$('borrar-cancelar').addEventListener('click', () => alternarConfirmacionBorrado(false));
$('importar').addEventListener('change', async (evento) => {
  const campo = evento.currentTarget;
  await importarProgreso(campo.files?.[0] ?? null);
  campo.value = '';
});

iniciar();
