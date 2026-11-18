// Interfaz del motor de test.
//
// Es el único fichero del motor que toca el DOM: la lógica pura (tamaños de
// sesión, muestreo, barajado de opciones, corrección, rachas, reto diario,
// comparación con marcas anteriores y almacenamiento versionado) vive en
// test-core.js, que no depende del navegador y se puede importar desde Node.
//
// El mismo módulo sirve a las dos páginas de destino del apartado Test:
// `oficiales.html` (cuadernillos de convocatorias anteriores) y
// `no-oficiales.html` (banco propio por tema y mezclado). El atributo
// `data-coleccion` del <body> dice cuál de los dos manifiestos se carga; todo lo
// demás —sesiones, corrección, rachas, reto del día, repaso de fallos,
// marcador y progreso— es exactamente el mismo código.
//
// Sin JavaScript incrustado y sin atributos de estilo: la CSP del sitio es
// script-src 'self' y style-src 'self', así que todos los manejadores se
// enlazan desde aquí y las marcas de estado se resuelven con clases CSS.
//
// Criterio de diseño: la sesión tiene que poder terminarse en cualquier momento
// sin que la página insista. No hay cuenta atrás en práctica, no hay rachas que
// se puedan perder por salir, no hay avisos de «no pierdas tu progreso» y el
// resultado propone parar cuando la sesión ha sido larga.

import {
  CLAVE_ALMACENAMIENTO,
  PENALIZACION_POR_DEFECTO,
  SEGUNDOS_POR_PREGUNTA,
  calcularRacha,
  claveFecha,
  compararConRecord,
  construirPool,
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
import { cargarColeccion, filtroDesdeParametros } from './banco.js';
import {
  MIN_FALLOS_QUEMADA,
  MIN_INTENTOS_TEMA,
  UMBRAL_ACIERTO_FLOJO,
  diagnosticar,
} from './diagnostico.js';

// La colección la declara la página: `oficiales` para los cuadernillos de
// convocatorias anteriores y `propio` para el banco por tema.
const COLECCION = document.body.dataset.coleccion === 'propio' ? 'propio' : 'oficiales';
const ES_OFICIALES = COLECCION === 'oficiales';

const LETRAS = ['a', 'b', 'c'];
const AVISO_RELOJ_SEGUNDOS = 60;
const MODOS_CON_MARCA = ['corta', 'media', 'completa', 'examen'];

const NOMBRE_MODO = {
  corta: 'Sesión corta',
  media: 'Sesión media',
  completa: 'Examen completo',
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

/**
 * Explicación docente de una pregunta, si el banco la trae.
 *
 * El banco oficial no la tiene; el propio, sí: dice por qué la correcta lo es y
 * por qué fallan las otras. Cuando no hay texto no se pinta nada, así que la
 * misma interfaz sirve a las dos colecciones sin huecos vacíos.
 */
function textoExplicacion(pregunta) {
  const texto = pregunta?.explicacion;
  return typeof texto === 'string' ? texto.trim() : '';
}

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

/**
 * Carga los bancos de la colección que declara la página.
 *
 * Los dos manifiestos los lee `banco.js`: aquí sólo se cuentan los fallos. Un
 * banco que no carga deja su acceso fuera de la lista, así que la página nunca
 * ofrece un test que no se puede hacer.
 */
async function iniciar() {
  try {
    const { bancos, errores } = await cargarColeccion(COLECCION);

    if (bancos.length === 0) {
      const detalle = errores.length
        ? errores.join(' · ')
        : ES_OFICIALES
          ? 'el índice no declara ninguna convocatoria'
          : 'el índice no declara ningún banco';
      mostrarEstado(
        `No se pudieron cargar las preguntas: ${detalle}. Comprueba la conexión y recarga la página.`,
        'error',
      );
      return;
    }

    estado.bancos = bancos;
    estado.almacen = leerAlmacen();

    const pool = construirPool(bancos);
    if (pool.length === 0) {
      mostrarEstado('No hay ninguna pregunta válida en lo que se ha cargado.', 'error');
      return;
    }

    const resumen = bancosOrdenados()
      .map((banco) => `${etiquetaBanco(banco)}: ${banco.preguntas.length}`)
      .join(' · ');
    const base = `${pool.length} preguntas cargadas (${resumen}).`;
    const aviso = errores.length
      ? ` No se pudo cargar ${errores.join(' · ')}; la sesión continúa con los bancos disponibles.`
      : '';
    mostrarEstado(`${base}${aviso}`, errores.length ? 'aviso' : 'listo');

    pintarInicio();
    mostrarPanel('inicio');
    abrirEnlaceProfundo();
  } catch (error) {
    console.error(error);
    mostrarEstado(
      `No se pudieron cargar las preguntas: ${error.message} Recarga la página; si sigue igual, abre la consola del navegador para ver el detalle.`,
      'error',
    );
  }
}

/* --- Configuración de la sesión -------------------------------------------- */

/** Bancos en el orden en que se presentan: por año y promoción, o por tema. */
function bancosOrdenados() {
  const lista = [...estado.bancos];

  if (ES_OFICIALES) {
    lista.sort((a, b) => a.convocatoria - b.convocatoria || a.promocion - b.promocion);
  } else {
    // Los temas del programa primero y, al final, el banco de mezcla.
    lista.sort((a, b) => {
      const mezclaA = a.tipo === 'mezcla' ? 1 : 0;
      const mezclaB = b.tipo === 'mezcla' ? 1 : 0;
      return mezclaA - mezclaB || (a.tema ?? 0) - (b.tema ?? 0);
    });
  }

  return lista;
}

/** Nombre corto del banco: la convocatoria, o el tema, sin la palabra del filtro. */
const etiquetaBanco = (banco) =>
  ES_OFICIALES ? `${banco.convocatoria} · promoción ${banco.promocion}` : banco.origen;

/** Recuento con la palabra en singular o en plural: «1 pregunta», «10 preguntas». */
const plural = (cantidad, singular, vario) =>
  `${cantidad} ${cantidad === 1 ? singular : vario}`;

const pluralPreguntas = (cantidad) => plural(cantidad, 'pregunta', 'preguntas');

/**
 * Una entrada por banco (y la mezcla) con su recuento real.
 *
 * La tarjeta es un enlace con la misma forma que la rejilla de temas del
 * temario. Al pulsarla se aplica su filtro y se puede empezar: el enlace lleva
 * el parámetro en la URL para que el mismo test se pueda compartir o guardar.
 */
function tarjetaDeAcceso(acceso) {
  const enlace = crear(
    'a',
    { clase: 'acceso', atributos: { href: acceso.href } },
    [
      ...(acceso.insignia
        ? [
            crear('span', {
              clase: 'acceso__numero',
              texto: acceso.insignia,
              atributos: { 'aria-hidden': 'true' },
            }),
          ]
        : []),
      crear('span', { clase: 'acceso__cuerpo' }, [
        crear('span', { clase: 'acceso__titulo', texto: acceso.titulo }),
        crear('span', { clase: 'acceso__texto', texto: acceso.texto }),
        crear('span', { clase: 'acceso__cuenta', texto: pluralPreguntas(acceso.preguntas) }),
      ]),
    ],
  );

  enlace.addEventListener('click', (evento) => {
    // Con modificador o con un botón distinto del principal se deja que el
    // navegador abra el enlace en otra pestaña, como cualquier otro enlace.
    if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey || evento.button !== 0) {
      return;
    }
    evento.preventDefault();
    aplicarFiltro(acceso.valor);
  });

  return crear('li', {}, [enlace]);
}

/** Epígrafe del tema sin el prefijo «Tema N · », que ya está en el título. */
function descripcionDelTema(banco) {
  const titulo = String(banco.titulo ?? '')
    .replace(/^Tema\s+\d+\s*·\s*/i, '')
    .trim();
  return titulo || 'Preguntas propias de este tema, con la explicación de cada respuesta.';
}

function gruposDeEntradas() {
  if (ES_OFICIALES) {
    const porConvocatoria = bancosOrdenados().map((banco) => ({
      insignia: String(banco.convocatoria).slice(-2),
      titulo: etiquetaBanco(banco),
      texto: 'Cuadernillo completo del examen teórico de esa convocatoria.',
      preguntas: banco.preguntas.length,
      href: `oficiales.html?convocatoria=${banco.convocatoria}`,
      valor: banco.id,
    }));

    const todos = {
      titulo: 'Mezcla de todos los años',
      texto: 'Todas las preguntas de todas las convocatorias, barajadas en una sola sesión.',
      preguntas: construirPool(estado.bancos).length,
      href: 'oficiales.html',
      valor: '',
    };

    return [
      { titulo: 'Por convocatoria', tarjetas: porConvocatoria },
      { titulo: 'Todos los años', tarjetas: [todos] },
    ];
  }

  const temas = bancosOrdenados()
    .filter((banco) => banco.tipo !== 'mezcla')
    .map((banco) => ({
      insignia: String(banco.tema ?? 0).padStart(2, '0'),
      titulo: `Tema ${banco.tema}`,
      texto: descripcionDelTema(banco),
      preguntas: banco.preguntas.length,
      href: `no-oficiales.html?tema=${banco.tema}`,
      valor: banco.id,
    }));

  const mezclas = bancosOrdenados()
    .filter((banco) => banco.tipo === 'mezcla')
    .map((banco) => ({
      titulo: banco.origen,
      texto: 'Preguntas que cruzan dos temas, pensadas para examinar de forma docente.',
      preguntas: banco.preguntas.length,
      href: 'no-oficiales.html?tema=mezcla',
      valor: banco.id,
    }));

  const grupos = [{ titulo: 'Por tema', tarjetas: temas }];
  // El banco de mezcla puede no existir todavía: mientras el manifiesto no lo
  // declare, la página no pinta un acceso que llevaría a una lista vacía.
  if (mezclas.length > 0) grupos.push({ titulo: 'Mezcladas', tarjetas: mezclas });
  return grupos;
}

/** Rejilla de accesos: una entrada por convocatoria, por tema o la mezcla. */
function pintarEntradas() {
  const grupos = gruposDeEntradas().filter((grupo) => grupo.tarjetas.length > 0);

  $('entradas').replaceChildren(
    ...grupos.map((grupo) =>
      crear('section', {}, [
        crear('h3', { texto: grupo.titulo }),
        crear('ul', { clase: 'accesos' }, grupo.tarjetas.map(tarjetaDeAcceso)),
      ]),
    ),
  );
}

/**
 * Procedencia de las preguntas.
 *
 * En los oficiales se nombra al organismo que publica el cuestionario; la
 * página nunca enlaza el fichero del PDF, así que no se expone el sitio que lo
 * aloja (L26). Las URL de procedencia siguen en data/examenes/FUENTES.md y en el
 * campo `fuente` de cada banco, que la página no pinta.
 */
function pintarFuentes() {
  const fuentes = bancosOrdenados().map((banco) =>
    crear('li', {
      texto: ES_OFICIALES
        ? `${banco.origen} — ${banco.preguntas.length} preguntas. Cuestionario de la Dirección General de la Policía, Área de Procesos Selectivos.`
        : `${banco.origen} — ${banco.preguntas.length} preguntas. Preguntas de elaboración propia, con la norma que sostiene cada respuesta.`,
    }),
  );

  $('fuentes-intro').textContent = ES_OFICIALES
    ? 'Cuestionarios de la Dirección General de la Policía, Área de Procesos Selectivos, reutilizados con atribución conforme a la Ley 37/2007 y al RD 1495/2011. No se incluye material de academias ni de editoriales.'
    : 'Preguntas escritas para este sitio desde la fuente legal que cita cada explicación, no copiadas de bancos de academias ni de editoriales. Cada pregunta declara su dificultad y la norma en la que se apoya.';

  $('lista-fuentes').replaceChildren(...fuentes);
  $('fuentes-banco').hidden = false;
}

function pintarInicio() {
  const filtroPrevio = $('filtro').value;
  const total = construirPool(estado.bancos).length;

  const opciones = [
    crear('option', {
      texto: `${ES_OFICIALES ? 'Todas las convocatorias' : 'Todas las preguntas'} (${total} preguntas)`,
      atributos: { value: '' },
    }),
  ];

  for (const banco of bancosOrdenados()) {
    opciones.push(
      crear('option', {
        texto: `${etiquetaBanco(banco)} (${banco.preguntas.length} preguntas)`,
        atributos: { value: banco.id },
      }),
    );
  }

  $('etiqueta-filtro').textContent = ES_OFICIALES ? 'Convocatoria' : 'Tema';
  $('filtro').replaceChildren(...opciones);
  if (filtroPrevio && $('filtro').querySelector(`option[value="${filtroPrevio}"]`)) {
    $('filtro').value = filtroPrevio;
  }

  pintarEntradas();
  pintarFuentes();

  alternarConfirmacionBorrado(false, { enfocar: false });
  pintarHistorial();
  pintarReto();
  pintarPuntos();
  actualizarControles();
}

const tamanoSeleccionado = () =>
  document.querySelector('input[name="tamano"]:checked')?.value ?? 'corta';

/** Bancos que entran en la sesión según el filtro elegido. */
function bancosDelFiltro() {
  const valor = $('filtro').value;
  if (valor === '') return estado.bancos;
  return estado.bancos.filter((banco) => banco.id === valor);
}

const poolDelFiltro = () => construirPool(bancosDelFiltro());

/**
 * Aplica un filtro y deja la página lista para empezar.
 *
 * Devuelve false si el valor no corresponde a ninguna opción del desplegable:
 * así un enlace profundo con un parámetro raro se ignora y la página sigue
 * enseñando la lista completa, sin romperse.
 */
function aplicarFiltro(valor, { enfocar = true } = {}) {
  const select = $('filtro');
  if (![...select.options].some((opcion) => opcion.value === valor)) return false;

  select.value = valor;
  actualizarControles();
  anunciar(
    `Filtro aplicado: ${select.selectedOptions[0]?.textContent ?? ''} Elige el tamaño de la sesión y pulsa Empezar.`,
  );
  if (enfocar) $('empezar').focus();
  return true;
}

/** Enlace profundo: `oficiales.html?convocatoria=2021`, `no-oficiales.html?tema=1`. */
function abrirEnlaceProfundo() {
  const parametros = new URLSearchParams(globalThis.location?.search ?? '');
  const valor = filtroDesdeParametros(COLECCION, estado.bancos, parametros);
  if (valor === null) return;
  aplicarFiltro(valor, { enfocar: false });
}

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
    mostrarEstado('El filtro elegido no tiene preguntas. Elige otro o todas.', 'aviso');
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
    mostrarEstado('No hay preguntas cargadas para el reto del día.', 'aviso');
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

  $('origen').textContent = pregunta.origen ?? 'Pregunta';
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
  const explicacion = textoExplicacion(pregunta);

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
    ...(explicacion
      ? [crear('p', { clase: 'retroalimentacion__explicacion', texto: explicacion })]
      : []),
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
      preguntas: resultadosPorPregunta(),
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
  const filas = ES_OFICIALES ? filasPorConvocatoria() : filasPorOrigen();
  const contenedor = crear('div', { clase: 'desglose' });

  if (filas.length === 0) {
    contenedor.append(crear('p', { texto: 'No hay preguntas que desglosar.' }));
    return contenedor;
  }

  contenedor.append(
    ES_OFICIALES
      ? tablaDeDesglose(
          'Desglose por convocatoria',
          ['Convocatoria', 'Promoción', 'Preguntas', 'Aciertos', 'Fallos', 'En blanco'],
          filas.map((fila) => [
            fila.convocatoria,
            fila.promocion,
            fila.total,
            fila.aciertos,
            fila.fallos,
            fila.blancos,
          ]),
        )
      : tablaDeDesglose(
          'Desglose por tema',
          ['Origen', 'Preguntas', 'Aciertos', 'Fallos', 'En blanco'],
          filas.map((fila) => [fila.origen, fila.total, fila.aciertos, fila.fallos, fila.blancos]),
        ),
  );

  return contenedor;
}

function filasPorConvocatoria() {
  return resumirPorConvocatoria(estado.intento);
}

/**
 * Desglose del banco propio por procedencia de cada pregunta.
 *
 * El banco propio no tiene convocatoria ni promoción, así que agrupar por años
 * no diría nada: lo que interesa es en qué tema se falla.
 */
function filasPorOrigen() {
  const filas = new Map();

  for (const entrada of estado.intento) {
    const origen = entrada.pregunta.origen ?? 'Preguntas propias';
    const fila = filas.get(origen) ?? {
      origen,
      total: 0,
      aciertos: 0,
      fallos: 0,
      blancos: 0,
    };

    fila.total += 1;
    if (entrada.respuesta === null || entrada.respuesta === undefined) fila.blancos += 1;
    else if (entrada.respuesta === entrada.pregunta.correcta) fila.aciertos += 1;
    else fila.fallos += 1;

    filas.set(origen, fila);
  }

  return [...filas.values()];
}

function tablaDeDesglose(caption, encabezados, filas) {
  const tabla = crear('table', {}, [
    crear('caption', { texto: caption }),
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
    cuerpo.append(crear('tr', {}, fila.map((valor) => crear('td', { texto: String(valor) }))));
  }

  tabla.append(cuerpo);
  return tabla;
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
        texto: `${pregunta.origen ?? 'Pregunta'} · ${pregunta.id} · ${enBlanco ? 'En blanco' : 'Incorrecta'}`,
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

    const explicacion = textoExplicacion(pregunta);
    if (explicacion) {
      item.append(crear('p', { clase: 'repaso__explicacion', texto: explicacion }));
    }

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

/* --- Puntos débiles ------------------------------------------------------- */

/** El banco propio como lista plana de preguntas, que es lo que lee el diagnóstico. */
const preguntasDelBancoPropio = () => estado.bancos.flatMap((banco) => banco.preguntas);

/**
 * Resultados por pregunta de la sesión que se acaba de corregir.
 *
 * Sólo se anotan las contestadas: una pregunta en blanco no dice si se sabía. Las
 * de los cuadernillos oficiales van sin tema y el registro por pregunta las
 * descarta, así que nunca entran en las estadísticas por tema.
 */
function resultadosPorPregunta() {
  return estado.intento
    .filter((entrada) => entrada.respuesta !== null && entrada.respuesta !== undefined)
    .map((entrada) => ({
      id: entrada.pregunta.id,
      tema: entrada.pregunta.tema,
      acierto: entrada.respuesta === entrada.pregunta.correcta,
    }));
}

/** Los criterios se escriben con los umbrales del módulo, no con números sueltos. */
const CRITERIO_QUEMADAS = `Se avisa a partir de ${MIN_FALLOS_QUEMADA} fallos en la misma pregunta.`;
const CRITERIO_FLOJOS = `Con ${MIN_INTENTOS_TEMA} intentos o más en el tema y menos del ${UMBRAL_ACIERTO_FLOJO} % de acierto.`;
const CRITERIO_RIESGO = `Con ${MIN_INTENTOS_TEMA} intentos o más, el tema iba bien y la última vez que contestaste alguna de sus preguntas la fallaste.`;

/** Apartados de un tema, en una línea, sin convertir el aviso en un índice. */
function textoApartados(apartados) {
  const lista = (apartados ?? []).slice(0, 3).map((apartado) => `«${apartado}»`);
  if (lista.length === 0) return '';
  return `Estudia ${lista.join(', ')}.`;
}

/** Aviso de pregunta quemada: la pregunta, sus fallos y el apartado que toca. */
function itemQuemada(aviso) {
  const partes = [`Tema ${aviso.tema}`, `${aviso.fallos} fallos de ${aviso.intentos} intentos`];
  if (aviso.ultimoFallo) partes.push(`último fallo el ${aviso.ultimoFallo}`);

  return crear('li', { clase: 'puntos__item' }, [
    crear('p', { clase: 'puntos__etiqueta', texto: 'Pregunta que siempre fallas' }),
    crear('p', { clase: 'puntos__titulo', texto: `«${aviso.enunciado}»` }),
    crear('p', { clase: 'puntos__detalle', texto: `${partes.join(' · ')}.` }),
    ...(aviso.apartado
      ? [crear('p', { clase: 'puntos__apartado', texto: textoApartados([aviso.apartado]) })]
      : []),
    crear('a', {
      clase: 'puntos__enlace',
      texto: `Repasar el tema ${aviso.tema} en el temario`,
      atributos: { href: aviso.enlace },
    }),
  ]);
}

/** Aviso de tema: el recuento con su porcentaje y los apartados que estudiar. */
function itemTema(aviso, etiqueta, { enRiesgo = false } = {}) {
  const partes = [`${aviso.texto} de acierto`];
  if (enRiesgo && aviso.preguntasEnFallo > 0) {
    const cuando = aviso.ultimoFallo ? ` (${aviso.ultimoFallo})` : '';
    partes.push(
      `${plural(aviso.preguntasEnFallo, 'pregunta fallada', 'preguntas falladas')} la última vez${cuando}`,
    );
  }

  return crear('li', { clase: 'puntos__item' }, [
    crear('p', { clase: 'puntos__etiqueta', texto: etiqueta }),
    crear('p', { clase: 'puntos__titulo', texto: `Tema ${aviso.tema}` }),
    crear('p', { clase: 'puntos__detalle', texto: `${partes.join(' · ')}.` }),
    ...(aviso.apartados?.length
      ? [crear('p', { clase: 'puntos__apartado', texto: textoApartados(aviso.apartados) })]
      : []),
    crear('a', {
      clase: 'puntos__enlace',
      texto: `Repasar el tema ${aviso.tema} en el temario`,
      atributos: { href: aviso.enlace },
    }),
  ]);
}

/**
 * Un grupo de avisos: encabezado de verdad, criterio a la vista y lista.
 *
 * Cuando no hay nada que enseñar en ese grupo se dice con una frase, no con una
 * lista vacía: un cero sin más parece un resultado y aquí no lo es.
 */
function grupoDePuntos({ id, titulo, criterio, items, sinNada }) {
  return crear('section', { clase: 'puntos__grupo', atributos: { 'aria-labelledby': id } }, [
    crear('h4', { texto: titulo, atributos: { id } }),
    crear('p', { clase: 'puntos__criterio', texto: criterio }),
    items.length > 0
      ? crear('ul', { clase: 'puntos__lista', atributos: { role: 'list' } }, items)
      : crear('p', { clase: 'puntos__vacio', texto: sinNada }),
  ]);
}

/** Panel de puntos débiles: las tres listas de S7, o el estado vacío honesto. */
function pintarPuntos() {
  const nodo = $('puntos');
  if (!nodo) return;

  const panel = diagnosticar(estado.almacen, preguntasDelBancoPropio());

  if (panel.vacio) {
    nodo.replaceChildren(
      crear('p', {
        clase: 'puntos__vacio',
        texto:
          'Todavía no hay datos suficientes para un diagnóstico: aparecerá aquí en cuanto contestes preguntas de este banco. Los exámenes oficiales no cuentan, porque no están clasificados por tema.',
      }),
    );
    return;
  }

  nodo.replaceChildren(
    crear('p', {
      clase: 'puntos__resumen',
      texto: `Con datos de ${plural(panel.preguntasConDatos, 'pregunta', 'preguntas')} de ${plural(panel.temasConDatos, 'tema', 'temas')}.`,
    }),
    grupoDePuntos({
      id: 'puntos-quemadas',
      titulo: 'Preguntas que siempre fallas',
      criterio: CRITERIO_QUEMADAS,
      items: panel.quemadas.map(itemQuemada),
      sinNada: `Ninguna pregunta ha llegado a ${MIN_FALLOS_QUEMADA} fallos todavía.`,
    }),
    grupoDePuntos({
      id: 'puntos-flojos',
      titulo: 'Temas flojos',
      criterio: CRITERIO_FLOJOS,
      items: panel.flojas.map((aviso) => itemTema(aviso, 'Tema flojo')),
      sinNada: `Ningún tema con datos suficientes baja del ${UMBRAL_ACIERTO_FLOJO} % de acierto.`,
    }),
    grupoDePuntos({
      id: 'puntos-riesgo',
      titulo: 'Temas en riesgo',
      criterio: CRITERIO_RIESGO,
      items: panel.enRiesgo.map((aviso) => itemTema(aviso, 'Tema en riesgo', { enRiesgo: true })),
      sinNada: 'Ningún tema cumple el criterio de riesgo.',
    }),
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
  pintarPuntos();
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
  pintarPuntos();
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

$('filtro').addEventListener('change', actualizarControles);
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
