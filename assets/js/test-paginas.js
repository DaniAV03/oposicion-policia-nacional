// Portada del apartado Test: los dos accesos, oficiales y no oficiales.
//
// Vive en un fichero aparte porque la CSP del sitio prohíbe el JavaScript
// incrustado (script-src 'self'). Como en la portada del temario, cada acceso es
// una tarjeta con el mismo patrón visual que la rejilla de temas: título, una
// línea de qué hay dentro y el recuento real, que sale del manifiesto de cada
// colección (nunca se escribe a mano).
//
// La portada solo lee los manifiestos: no descarga ninguna pregunta, así que se
// pinta con dos peticiones pequeñas.

import { contarColeccion } from './banco.js';

const ACCESOS = [
  {
    coleccion: 'oficiales',
    href: 'oficiales.html',
    titulo: 'Test oficiales',
    texto:
      'Cuadernillos completos de convocatorias anteriores, tal como se publicaron, y una mezcla de todos los años.',
  },
  {
    coleccion: 'propio',
    href: 'no-oficiales.html',
    titulo: 'Test no oficiales',
    texto: 'Preguntas propias por tema, con la explicación de cada respuesta.',
  },
];

const plural = (cantidad, singular, plurales) =>
  `${cantidad} ${cantidad === 1 ? singular : plurales}`;

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

/** Recuento que se lee en la tarjeta, con la unidad que toca en cada colección. */
function textoCuenta(coleccion, cuenta) {
  if (!cuenta) return 'Recuento no disponible';
  if (cuenta.preguntas === 0) return 'Sin preguntas todavía';

  const partes = [];
  if (coleccion === 'oficiales') {
    partes.push(plural(cuenta.entradas, 'convocatoria', 'convocatorias'));
  } else {
    partes.push(plural(cuenta.temas, 'tema', 'temas'));
    if (cuenta.mezclas > 0) partes.push(plural(cuenta.mezclas, 'mezcla', 'mezclas'));
  }
  partes.push(plural(cuenta.preguntas, 'pregunta', 'preguntas'));
  return partes.join(' · ');
}

function textoDe(acceso, cuenta) {
  if (acceso.coleccion === 'oficiales') return acceso.texto;

  // Las preguntas mezcladas se anuncian solo cuando el manifiesto las declara:
  // la portada no promete una página con un banco que todavía no existe.
  const hayMezcla = (cuenta?.mezclas ?? 0) > 0;
  return hayMezcla
    ? 'Preguntas propias por tema, con la explicación de cada respuesta, y una mezcla que cruza temas.'
    : acceso.texto;
}

function tarjeta(acceso, cuenta) {
  const enlace = crear(
    'a',
    { clase: 'acceso', atributos: { href: acceso.href } },
    [
      crear('span', { clase: 'acceso__cuerpo' }, [
        crear('span', { clase: 'acceso__titulo', texto: acceso.titulo }),
        crear('span', { clase: 'acceso__texto', texto: textoDe(acceso, cuenta) }),
        crear('span', { clase: 'acceso__cuenta', texto: textoCuenta(acceso.coleccion, cuenta) }),
      ]),
    ],
  );

  return crear('li', {}, [enlace]);
}

async function pintarAccesos() {
  const contenedor = document.getElementById('accesos');
  const estado = document.getElementById('estado');
  if (!contenedor) return;

  const resultados = await Promise.allSettled(
    ACCESOS.map((acceso) => contarColeccion(acceso.coleccion)),
  );

  const cuentas = resultados.map((resultado) =>
    resultado.status === 'fulfilled' ? resultado.value : null,
  );

  contenedor.replaceChildren(crear('ul', { clase: 'accesos' }, ACCESOS.map((a, i) => tarjeta(a, cuentas[i]))));

  const fallos = resultados
    .map((resultado, i) => (resultado.status === 'rejected' ? ACCESOS[i].coleccion : null))
    .filter(Boolean);

  if (!estado) return;

  if (fallos.length === 0) {
    estado.hidden = true;
    estado.textContent = '';
    return;
  }

  estado.dataset.tono = 'aviso';
  estado.hidden = false;
  estado.textContent = `No se pudo leer el índice de ${fallos.join(' y de ')}. Las páginas de test siguen abiertas: si el índice no carga allí tampoco, recarga en unos minutos.`;
}

pintarAccesos().catch((error) => {
  console.error(error);
  const estado = document.getElementById('estado');
  if (!estado) return;
  estado.dataset.tono = 'error';
  estado.hidden = false;
  estado.textContent = `No se pudo cargar el índice de test: ${error.message} Recarga la página; si sigue igual, abre la consola del navegador para ver el detalle.`;
});
