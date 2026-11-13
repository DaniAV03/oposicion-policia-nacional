// Interfaz del motor de test.
//
// Es el único fichero del motor que toca el DOM: la lógica pura (muestreo,
// barajado de opciones, corrección y desglose) vive en test-core.js, que no
// depende del navegador y se puede importar desde Node.
//
// Sin JavaScript incrustado y sin atributos de estilo: la CSP del sitio es
// script-src 'self' y style-src 'self', así que todos los manejadores se
// enlazan desde aquí y las marcas de estado se resuelven con clases CSS.

import { normalizarEnlaces } from './app.js';
import {
  PENALIZACION_POR_DEFECTO,
  PREGUNTAS_SESION_RAPIDA,
  SEGUNDOS_POR_PREGUNTA,
  construirPool,
  contarPorConvocatoria,
  corregir,
  crearGeneradorAleatorio,
  crearIntento,
  duracionExamen,
  formatearTiempo,
  muestrear,
  registrarRespuesta,
  resumirPorConvocatoria,
} from './test-core.js';

const RUTA_INDICE = 'data/examenes/index.json';
const LETRAS = ['a', 'b', 'c'];
const AVISO_RELOJ_SEGUNDOS = 60;

const estado = {
  bancos: [],
  intento: [],
  indice: 0,
  modo: 'practica',
  motivo: 'fin',
  finalizada: false,
  restante: 0,
  inicioMs: 0,
  limiteMs: 0,
  intervalo: null,
  minutoAvisado: false,
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

  actualizarControles();
}

const modoSeleccionado = () => document.querySelector('input[name="modo"]:checked')?.value ?? 'practica';

const valorConvocatoria = () => {
  const valor = $('filtro-convocatoria').value;
  return valor === '' ? null : Number(valor);
};

const poolDelFiltro = () => construirPool(estado.bancos, { convocatoria: valorConvocatoria() });

function limitarPreguntas(valor, total) {
  const numero = Math.trunc(Number(valor));
  const tope = Math.max(1, total);
  if (!Number.isFinite(numero) || numero < 1) return Math.min(PREGUNTAS_SESION_RAPIDA, tope);
  return Math.min(numero, tope);
}

function actualizarControles() {
  const modo = modoSeleccionado();
  const total = poolDelFiltro().length;
  const campo = $('preguntas-sesion');
  const ayuda = $('ayuda-preguntas');

  campo.max = String(Math.max(1, total));
  campo.disabled = modo === 'practica';

  if (modo === 'practica') {
    ayuda.textContent = `En modo práctica se usan las ${total} preguntas del filtro, en orden aleatorio.`;
    return;
  }

  const pedidas = limitarPreguntas(campo.value, total);
  ayuda.textContent =
    modo === 'examen'
      ? `${pedidas} preguntas con temporizador orientativo de ${formatearTiempo(duracionExamen(pedidas))} (${SEGUNDOS_POR_PREGUNTA} s por pregunta). El tiempo real lo fijan las bases oficiales.`
      : `${pedidas} preguntas elegidas al azar entre las ${total} del filtro, sin repetir.`;
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

  const modo = modoSeleccionado();
  const pedidas = modo === 'practica' ? pool.length : limitarPreguntas($('preguntas-sesion').value, pool.length);
  const aleatorio = crearGeneradorAleatorio(semillaAleatoria());

  mostrarEstado('');
  iniciarSesion(crearIntento(muestrear(pool, pedidas, aleatorio), aleatorio), modo);
}

function iniciarSesion(intento, modo) {
  detenerReloj();
  estado.intento = intento;
  estado.indice = 0;
  estado.modo = modo;
  estado.motivo = 'fin';
  estado.finalizada = false;
  estado.minutoAvisado = false;

  limpiarResultado();
  mostrarPanel('sesion');

  $('reloj').hidden = modo !== 'examen';
  if (modo === 'examen') {
    estado.limiteMs = duracionExamen(intento.length) * 1000;
    estado.inicioMs = Date.now();
    iniciarReloj();
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
  pintarMarcador();
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

  if (revelar) {
    if (indice === pregunta.correcta) {
      clases.push('opcion--correcta');
      nota = ' (respuesta correcta)';
    }
    if (entrada.respuesta === indice && indice !== pregunta.correcta) {
      clases.push('opcion--fallada');
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

  if (nota) nodo.append(crear('span', { clase: 'visualmente-oculto', texto: nota }));
  nodo.disabled = revelar;
  nodo.addEventListener('click', () => responder(indice));
  return nodo;
}

function pintarMarcador() {
  if (estado.modo === 'examen') {
    $('marcador').textContent = 'Corrección al final';
    return;
  }
  const resultado = corregir(estado.intento);
  $('marcador').textContent = `Aciertos ${resultado.aciertos} · Fallos ${resultado.fallos}`;
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
  estado.intento = [];
  estado.indice = 0;
  estado.finalizada = false;
  mostrarEstado('');
  mostrarPanel('inicio');
  actualizarControles();
  anunciar('Sesión cancelada.');
  $('empezar')?.focus();
}

/* --- Reloj del modo examen -------------------------------------------------- */

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

  const resultado = corregir(estado.intento, { penalizacion: PENALIZACION_POR_DEFECTO });

  pintarResultado(resultado, motivo);
  mostrarPanel('resultado');
  anunciar(`Sesión terminada: ${resultado.aciertos} aciertos de ${resultado.total}.`);
  $('titulo-resultado').focus();
}

function pintarResultado(resultado, motivo) {
  $('resultado-cifras').replaceChildren(crearCifras(resultado));
  $('nota-puntuacion').textContent = notaPuntuacion(resultado, motivo);
  $('desglose').replaceChildren(crearDesglose());
  $('fallos').replaceChildren(crearRepaso());
  $('acciones-resultado').replaceChildren(...crearAccionesResultado());
}

function crearCifras(resultado) {
  const filas = [
    ['Aciertos', `${resultado.aciertos} de ${resultado.total}`],
    ['Fallos', String(resultado.fallos)],
    ['En blanco', String(resultado.blancos)],
    ['Aciertos sobre el total', `${resultado.porcentajeAcierto} %`],
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
      texto: 'Se pueden repetir en una sesión de práctica con las mismas opciones y el mismo orden.',
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
      boton(`Repetir estas preguntas (${revisables.length})`, 'boton', repetirPendientes),
    );
  }

  acciones.push(
    boton('Nueva sesión', 'boton boton--secundario', () => {
      detenerReloj();
      mostrarPanel('inicio');
      actualizarControles();
      anunciar('Configura una nueva sesión.');
      $('empezar')?.focus();
    }),
  );

  return acciones;
}

function repetirPendientes() {
  const revisables = pendientes();
  if (revisables.length === 0) return;
  iniciarSesion(
    revisables.map((entrada) => ({ ...entrada, respuesta: null })),
    'practica',
  );
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
for (const radio of document.querySelectorAll('input[name="modo"]')) {
  radio.addEventListener('change', actualizarControles);
}
$('empezar').addEventListener('click', empezarSesion);

iniciar();
