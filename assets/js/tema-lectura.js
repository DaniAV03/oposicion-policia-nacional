// Lectura en voz alta de un tema con la voz del navegador (`SpeechSynthesis`).
//
// Sin ficheros de audio y sin servicio externo: el texto se queda en la página y
// lo pronuncia la voz que tenga instalada el sistema. Todo lo que se puede probar
// sin navegador —normalizar el texto, trocearlo en frases y validar la posición
// guardada— vive aquí como función pura; el DOM y la voz se tocan sólo dentro de
// `iniciarLectura`.
//
// Arranque: `tema-inicio.js` llama a `iniciarLectura()` cuando `pintarTema()` ya
// ha terminado, porque el texto que hay que leer es el que pinta `app.js`.

/** Clave de `localStorage`, propia y versionada como la del test. */
export const CLAVE_POSICION = 'policia-nacional-tema-lectura-v1';
export const VERSION_POSICION = 1;

/** Velocidades ofrecidas, en el orden en que se pintan. */
export const VELOCIDADES = Object.freeze([1, 1.25, 1.5]);

/**
 * Tope de una locución, en caracteres. Chrome corta o se queda en silencio con
 * textos largos, así que ninguna frase se pasa de aquí.
 */
export const FRASE_MAXIMA = 240;

/** Por debajo de esta longitud, una frase se une a la siguiente: hablar de dos
 *  palabras seguidas suena a tartamudeo. */
export const FRASE_MINIMA = 30;

/** Aviso que se lee en lugar de la tabla: una tabla en voz alta es ruido. */
export const ANUNCIO_TABLA =
  'Aquí hay una tabla con datos. Léela en pantalla y seguimos con el texto.';

/* --- Normalización del texto ---------------------------------------------- */

/**
 * Deja el texto listo para la voz: abreviaturas del temario como palabras,
 * cifras separadas de las letras y de los años, y separadores que el sintetizador
 * leería como basura.
 */
export function normalizarParaVoz(texto) {
  return String(texto)
    // Abreviaturas. Las plurales van primero donde podrían solaparse.
    .replace(/\bp\.\s*ej\./gi, 'por ejemplo')
    .replace(/\barts\./gi, 'artículos')
    .replace(/\bart\./gi, 'artículo')
    .replace(/\bnúms\./gi, 'números')
    .replace(/\bnúm\./gi, 'número')
    .replace(/\bpágs\./gi, 'páginas')
    .replace(/\bpág\./gi, 'página')
    .replace(/§§/g, 'secciones ')
    .replace(/§/g, 'sección ')
    // Cifras pegadas a letras: «art.14» se lee «artículo 14», no «artículo catorce».
    .replace(/([a-záéíóúüñ])(\d)/giu, '$1 $2')
    .replace(/(\d)([a-záéíóúüñ])/giu, '$1 $2')
    // Años y cifras unidos por un guion se leen como intervalo.
    .replace(/(\d)\s*[-–—]\s*(\d)/gu, '$1 a $2')
    // La raya del temario hace de paréntesis: spoken como pausa, se lee mejor.
    .replace(/\s*—\s*/g, ', ')
    .replace(/(\d)\s*%/g, '$1 por ciento')
    // Espacios y comas duplicadas que dejan los cambios anteriores.
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/,\s*,/g, ',')
    .trim();
}

/* --- Troceado en frases ---------------------------------------------------- */

/** Corta una frase que pasa del tope por su última coma, o por el último espacio. */
function partirFrase(trozo) {
  const partes = [];
  let resto = trozo;

  while (resto.length > FRASE_MAXIMA) {
    const ventana = resto.slice(0, FRASE_MAXIMA);
    let corte = FRASE_MAXIMA;
    for (const marca of [', ', '; ', ': ']) {
      const posicion = ventana.lastIndexOf(marca);
      if (posicion >= FRASE_MAXIMA / 2) {
        corte = posicion + 1;
        break;
      }
    }
    if (corte === FRASE_MAXIMA) {
      const espacio = ventana.lastIndexOf(' ');
      if (espacio >= FRASE_MAXIMA / 2) corte = espacio + 1;
    }
    partes.push(resto.slice(0, corte).trim());
    resto = resto.slice(corte).trim();
  }

  if (resto) partes.push(resto);
  return partes;
}

/**
 * Trocea un texto en frases: una `SpeechSynthesisUtterance` por frase, que es lo
 * que evita el corte de Chrome en textos largos y lo que permite pausar y
 * reanudar sin perder el hilo.
 */
export function trocearEnFrases(texto) {
  const limpio = normalizarParaVoz(texto);
  if (!limpio) return [];

  // Sólo corta donde el signo va seguido de espacio o del final: así «2.1.» o
  // «8.1» no se parten por la mitad y una enumeración sigue siendo una frase.
  const MARCA = '\u0000';
  const piezas = limpio
    .replace(/([.!?;:])(?=\s|$)/g, `$1${MARCA}`)
    .split(MARCA)
    .map((pieza) => pieza.trim())
    .filter(Boolean);
  const frases = [];

  for (const pieza of piezas) {
    for (const parte of partirFrase(pieza)) {
      if (!parte) continue;
      const anterior = frases[frases.length - 1];
      const cabe = anterior && anterior.length + parte.length + 1 <= FRASE_MAXIMA;
      if (anterior && anterior.length < FRASE_MINIMA && cabe) {
        frases[frases.length - 1] = `${anterior} ${parte}`;
      } else {
        frases.push(parte);
      }
    }
  }

  return frases;
}

/* --- Extracción del texto del tema ---------------------------------------- */

/** Elementos cuyo texto se lee, en el orden en que aparecen. */
const SE_LEN = new Set(['H2', 'H3', 'P', 'LI']);

/** Elementos que no se leen: una tabla o una figura en voz alta son ruido. */
const SE_CALLAN = new Set(['TABLE', 'FIGURE']);

/**
 * Recoge las frases del contenido ya pintado.
 *
 * Se leen encabezados de dos y tres niveles, párrafos y elementos de lista; las
 * tablas y las figuras se saltan enteras —también lo que cuelgue de ellas— y de
 * cada tabla se deja un aviso breve para que quien escucha sepa que hay datos en
 * pantalla y pueda seguir.
 */
export function extraerFrases(raiz) {
  const frases = [];

  const recorrer = (nodo) => {
    for (const hijo of nodo.children) {
      const etiqueta = hijo.tagName;
      if (etiqueta === 'TABLE') {
        frases.push(ANUNCIO_TABLA);
        continue;
      }
      if (SE_CALLAN.has(etiqueta)) continue;
      if (SE_LEN.has(etiqueta)) {
        // Un <li> con una lista dentro se lee entero una sola vez.
        frases.push(...trocearEnFrases(hijo.textContent ?? ''));
        continue;
      }
      if (hijo.children.length) recorrer(hijo);
    }
  };

  if (raiz) recorrer(raiz);
  return frases;
}

/* --- Posición guardada ---------------------------------------------------- */

/**
 * Valida lo que hay en `localStorage`. Devuelve el mapa limpio o `null` si el
 * dato no es de esta versión: un JSON de otra versión se descarta en silencio, no
 * se intenta interpretar.
 */
export function validarPosiciones(datos) {
  if (!datos || typeof datos !== 'object') return null;
  if (datos.version !== VERSION_POSICION) return null;
  const temas = datos.temas;
  if (!temas || typeof temas !== 'object') return null;

  const limpio = {};
  for (const [clave, valor] of Object.entries(temas)) {
    if (!/^\d{1,3}$/.test(clave) || !valor || typeof valor !== 'object') continue;
    const frase = Number(valor.frase);
    const total = Number(valor.total);
    if (!Number.isInteger(frase) || !Number.isInteger(total)) continue;
    if (total < 1 || frase < 0 || frase >= total) continue;
    limpio[clave] = { frase, total };
  }
  return limpio;
}

/** Cuántas frases tiene cada tema guardado: lo mínimo para poder continuar. */
export function leerPosiciones(almacen = globalThis.localStorage) {
  try {
    const bruto = almacen?.getItem(CLAVE_POSICION);
    if (!bruto) return {};
    return validarPosiciones(JSON.parse(bruto)) ?? {};
  } catch {
    // Ventana privada o dato corrupto: se empieza de cero, nunca se rompe la página.
    return {};
  }
}

/** Posición guardada de un tema, o `null` si no hay ninguna. */
export function posicionDe(tema, almacen = globalThis.localStorage) {
  return leerPosiciones(almacen)[String(tema)] ?? null;
}

/** Guarda la frase por la que va un tema. Devuelve `false` si no se pudo. */
export function guardarPosicion(tema, frase, total, almacen = globalThis.localStorage) {
  try {
    const posiciones = leerPosiciones(almacen);
    posiciones[String(tema)] = { frase, total };
    almacen?.setItem(
      CLAVE_POSICION,
      JSON.stringify({ version: VERSION_POSICION, temas: posiciones }),
    );
    return true;
  } catch {
    return false;
  }
}

/** Olvida la posición de un tema: al terminar no hay nada que continuar. */
export function borrarPosicion(tema, almacen = globalThis.localStorage) {
  try {
    const posiciones = leerPosiciones(almacen);
    delete posiciones[String(tema)];
    almacen?.setItem(
      CLAVE_POSICION,
      JSON.stringify({ version: VERSION_POSICION, temas: posiciones }),
    );
    return true;
  } catch {
    return false;
  }
}

/* --- Voz del navegador ----------------------------------------------------- */

/**
 * Elige la voz: `es-ES` si existe y, si no, cualquier otra variedad del español.
 * Nunca devuelve una voz de otro idioma: leer un tema jurídico en inglés es peor
 * que no ofrecer la lectura.
 */
export function elegirVoz(voces) {
  const lista = Array.isArray(voces) ? voces : [];
  const espanolas = lista.filter((voz) => /^es([-_]|$)/i.test(voz?.lang ?? ''));
  return (
    espanolas.find((voz) => /^es[-_]ES$/i.test(voz.lang)) ??
    espanolas[0] ??
    null
  );
}

/** Número del tema que se está viendo, con el mismo criterio que `app.js`. */
function numeroDeTema() {
  const parametro = new URLSearchParams(globalThis.location?.search ?? '').get('n') ?? '';
  const numero = Number.parseInt(parametro, 10);
  return Number.isInteger(numero) && numero > 0 ? String(numero) : null;
}

const porcentaje = (hechas, total) => (total ? Math.round((hechas / total) * 100) : 0);

/**
 * Pinta y conecta el control de lectura. Devuelve `true` si el control se ha
 * mostrado y `false` si no: sin `SpeechSynthesis`, sin frases que leer o sin voz
 * en español no se pinta nada, porque un botón que no hace nada es peor que no
 * tener botón.
 */
export function iniciarLectura() {
  const sintesis = globalThis.speechSynthesis;
  const crearLocucion = globalThis.SpeechSynthesisUtterance;
  if (!sintesis || typeof crearLocucion !== 'function' || typeof sintesis.speak !== 'function') {
    return false;
  }

  const panel = document.getElementById('escucha');
  const contenido = document.getElementById('contenido');
  if (!panel || !contenido) return false;

  const frases = extraerFrases(contenido);
  if (frases.length === 0) return false;

  const boton = document.getElementById('escucha-boton');
  const detener = document.getElementById('escucha-detener');
  const progreso = document.getElementById('escucha-progreso');
  const medidor = document.getElementById('escucha-medidor');
  const estadoTexto = document.getElementById('escucha-estado');
  const avisoContinuar = document.getElementById('escucha-continuar');
  const continuarTexto = document.getElementById('escucha-continuar-texto');
  const continuarBoton = document.getElementById('escucha-continuar-boton');
  if (
    !boton ||
    !detener ||
    !progreso ||
    !medidor ||
    !estadoTexto ||
    !avisoContinuar ||
    !continuarTexto ||
    !continuarBoton
  ) {
    return false;
  }

  const tema = numeroDeTema();
  const total = frases.length;
  const estado = {
    indice: 0,
    hablando: false,
    pausado: false,
    velocidad: VELOCIDADES[0],
    voz: null,
    locucion: null,
  };

  /** Cambia el mensaje de estado, que la región viva anuncia. */
  const anunciar = (mensaje) => {
    estadoTexto.textContent = mensaje;
  };

  const actualizarProgreso = () => {
    const hechas = estado.hablando || estado.pausado ? estado.indice + 1 : 0;
    progreso.textContent = hechas
      ? `Frase ${hechas} de ${total} · ${porcentaje(hechas, total)} %`
      : `0 de ${total} frases`;
    medidor.max = total;
    medidor.value = hechas;
  };

  const actualizarBoton = () => {
    if (estado.hablando) {
      boton.textContent = 'Pausar la lectura';
      boton.setAttribute('aria-pressed', 'true');
    } else if (estado.pausado) {
      boton.textContent = 'Reanudar la lectura';
      boton.setAttribute('aria-pressed', 'false');
    } else {
      boton.textContent = 'Escuchar este tema';
      boton.setAttribute('aria-pressed', 'false');
    }
    detener.disabled = !estado.hablando && !estado.pausado;
  };

  /** Corta la locución en curso sin que su final cuente como avance. */
  const cortarLocucion = () => {
    const locucion = estado.locucion;
    estado.locucion = null;
    if (!locucion) return;
    locucion.onend = null;
    locucion.onerror = null;
    try {
      sintesis.cancel();
    } catch {
      /* Un navegador sin cola que cancelar no tiene nada que hacer aquí. */
    }
  };

  /** Vuelve al estado inicial: botón listo, progreso a cero y sin nada guardado. */
  const terminar = (mensaje) => {
    cortarLocucion();
    estado.hablando = false;
    estado.pausado = false;
    estado.indice = 0;
    if (tema) borrarPosicion(tema);
    actualizarProgreso();
    actualizarBoton();
    anunciar(mensaje);
  };

  const guardar = () => {
    if (!tema) return;
    // Sólo tiene sentido continuar si queda texto por delante.
    if (estado.indice > 0 && estado.indice < total) guardarPosicion(tema, estado.indice, total);
  };

  /**
   * Pronuncia una frase y encadena la siguiente cuando el navegador termina.
   *
   * `encadenada` distingue el salto automático de frase del arranque: la región
   * viva sólo habla cuando cambia el estado (empezar, reanudar, pausar, acabar),
   * no en cada frase, que si no se solapa con la propia lectura.
   */
  const hablar = (indice, encadenada = false) => {
    if (indice >= total) {
      terminar('Lectura terminada. El progreso vuelve a cero.');
      return;
    }
    if (!estado.voz) {
      // La lista de voces puede llegar tarde: se vuelve a mirar antes de rendirse.
      estado.voz = elegirVoz(sintesis.getVoices?.() ?? []);
      if (!estado.voz) {
        terminar('No hay ninguna voz en español disponible en este navegador.');
        return;
      }
    }

    cortarLocucion();
    estado.indice = indice;
    estado.hablando = true;
    estado.pausado = false;

    const locucion = new crearLocucion(frases[indice]);
    locucion.voice = estado.voz;
    locucion.lang = estado.voz.lang || 'es-ES';
    locucion.rate = estado.velocidad;
    locucion.pitch = 1;

    let cerrada = false;
    locucion.onend = () => {
      if (cerrada || estado.locucion !== locucion) return;
      cerrada = true;
      hablar(indice + 1, true);
    };
    locucion.onerror = (evento) => {
      if (cerrada || estado.locucion !== locucion) return;
      cerrada = true;
      const motivo = evento?.error ?? '';
      if (motivo === 'interrupted' || motivo === 'canceled') return;
      terminar('La lectura se ha detenido: este navegador no ha podido usar la voz.');
    };

    estado.locucion = locucion;
    try {
      sintesis.speak(locucion);
    } catch {
      terminar('La lectura no ha podido empezar en este navegador.');
      return;
    }

    actualizarProgreso();
    actualizarBoton();
    guardar();
    if (!encadenada) anunciar(`Leyendo, frase ${indice + 1} de ${total}.`);
  };

  const pausar = () => {
    cortarLocucion();
    estado.hablando = false;
    estado.pausado = true;
    actualizarProgreso();
    actualizarBoton();
    anunciar(`Lectura en pausa en la frase ${estado.indice + 1} de ${total}.`);
  };

  /* --- Voces ------------------------------------------------------------- */

  const revisarVoces = () => {
    const voces = sintesis.getVoices?.() ?? [];
    estado.voz = elegirVoz(voces);
    if (estado.voz) {
      boton.disabled = false;
      return true;
    }
    boton.disabled = true;
    anunciar(
      voces.length
        ? 'Este navegador no tiene ninguna voz en español, así que el tema no se puede leer en voz alta.'
        : 'Preparando las voces del navegador…',
    );
    return false;
  };

  /* --- Arranque del control ---------------------------------------------- */

  panel.hidden = false;
  actualizarProgreso();
  actualizarBoton();
  revisarVoces();

  // Al principio la lista de voces puede venir vacía y llenarse después, con el
  // evento `voiceschanged`. Hasta entonces el botón está deshabilitado y el
  // control dice qué pasa; no se lee con una voz inglesa por no esperar.
  sintesis.addEventListener?.('voiceschanged', () => {
    if (revisarVoces()) anunciar('Voz lista. Pulsa «Escuchar este tema» para empezar.');
  });

  /* --- Oferta de continuar ----------------------------------------------- */

  const ofrecerContinuar = () => {
    const guardada = tema ? posicionDe(tema) : null;
    if (!guardada || guardada.frase === 0 || guardada.total !== total) {
      // El tema ha cambiado de longitud desde la última vez: la posición vieja no
      // vale y se tira, en vez de mandar a la persona a una frase que no existe.
      if (guardada && guardada.total !== total && tema) borrarPosicion(tema);
      avisoContinuar.hidden = true;
      return;
    }
    continuarTexto.textContent = `Dejaste este tema en la frase ${guardada.frase + 1} de ${total}.`;
    continuarBoton.textContent = `Continuar desde la frase ${guardada.frase + 1}`;
    avisoContinuar.hidden = false;
    avisoContinuar.dataset.frase = String(guardada.frase);
  };

  ofrecerContinuar();

  /* --- Controles --------------------------------------------------------- */

  boton.addEventListener('click', () => {
    avisoContinuar.hidden = true;
    if (estado.hablando) {
      pausar();
      return;
    }
    hablar(estado.pausado ? estado.indice : 0);
  });

  detener.addEventListener('click', () => {
    terminar('Lectura detenida. El progreso vuelve a cero.');
  });

  continuarBoton.addEventListener('click', () => {
    const desde = Number(avisoContinuar.dataset.frase ?? '0');
    avisoContinuar.hidden = true;
    hablar(Number.isInteger(desde) && desde > 0 ? desde : 0);
  });

  for (const radio of document.querySelectorAll('input[name="escucha-velocidad"]')) {
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      const valor = Number(radio.value);
      if (!VELOCIDADES.includes(valor)) return;
      estado.velocidad = valor;
      const etiqueta = `${String(valor).replace('.', ',')}×`;
      if (estado.hablando) {
        // La velocidad no se puede cambiar a mitad de locución: se repite la
        // frase en curso con la nueva.
        anunciar(`Velocidad ${etiqueta}. Se repite la frase en curso.`);
        hablar(estado.indice, true);
      } else {
        anunciar(`Velocidad ${etiqueta}.`);
      }
    });
  }

  /* Al salir de la página se corta la voz: la posición ya está guardada frase a
     frase, así que al volver se ofrece continuar. */
  globalThis.addEventListener?.('pagehide', cortarLocucion);

  return true;
}
