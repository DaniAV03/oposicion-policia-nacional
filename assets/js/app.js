// Motor de la web: carga el programa oficial y pinta la portada y la vista de tema.
// Sin dependencias ni compilación: módulos ES nativos sobre GitHub Pages.

const RUTA_PROGRAMA = 'data/programa/programa.json';

/** Carga y memoiza el programa oficial. */
let promesaPrograma = null;
export function cargarPrograma() {
  promesaPrograma ??= fetch(RUTA_PROGRAMA).then((r) => {
    if (!r.ok) throw new Error(`No se pudo cargar el programa (HTTP ${r.status})`);
    return r.json();
  });
  return promesaPrograma;
}

export const temasDe = (programa) => programa.bloques.flatMap((b) => b.temas);
export const buscarTema = (programa, numero) =>
  temasDe(programa).find((t) => t.numero === Number(numero)) ?? null;

const dosDigitos = (n) => String(n).padStart(2, '0');

/** Comprueba si un tema ya tiene contenido publicado (sin pedir el HTML). */
export async function temaPublicado(tema) {
  if (!tema) return false;
  try {
    const r = await fetch(tema.ruta, { method: 'HEAD' });
    return r.ok;
  } catch {
    return false;
  }
}

/* --- Portada --------------------------------------------------------------- */

export async function pintarPortada(contenedor) {
  const programa = await cargarPrograma();
  const temas = temasDe(programa);

  const publicados = await Promise.all(temas.map(temaPublicado));
  const totalPublicados = publicados.filter(Boolean).length;

  const resumen = document.getElementById('resumen');
  if (resumen) {
    resumen.innerHTML = `
      <li><strong>${temas.length}</strong> temas oficiales</li>
      <li><strong>${programa.bloques.length}</strong> bloques</li>
      <li><strong>${totalPublicados}</strong> publicados</li>
      <li>Convocatoria <strong>${programa.convocatoria}</strong></li>`;
  }

  const fuente = document.getElementById('fuente');
  if (fuente) {
    fuente.innerHTML = `Programa: <a href="${programa.fuenteUrl}" rel="noopener">${programa.fuente}</a>`;
  }

  const fragmento = document.createDocumentFragment();

  for (const bloque of programa.bloques) {
    const seccion = document.createElement('section');
    seccion.className = 'bloque';
    seccion.id = `bloque-${bloque.id}`;

    const publicadosBloque = bloque.temas.filter(
      (t) => publicados[temas.indexOf(t)],
    ).length;

    seccion.innerHTML = `
      <div class="bloque__cabecera">
        <span class="bloque__etiqueta">Bloque ${bloque.id}</span>
        <h2>${bloque.nombre}</h2>
        <span class="bloque__cuenta">
          ${bloque.temas.length} temas · ${publicadosBloque} publicados
        </span>
      </div>`;

    const lista = document.createElement('ul');
    lista.className = 'temas';

    for (const tema of bloque.temas) {
      const publicado = publicados[temas.indexOf(tema)];
      const item = document.createElement('li');

      const etiqueta = publicado ? 'a' : 'div';
      const enlace = document.createElement(etiqueta);
      enlace.className = publicado ? 'tema' : 'tema tema--pendiente';
      if (publicado) {
        enlace.href = `tema.html?n=${tema.numero}`;
      } else {
        enlace.setAttribute('aria-disabled', 'true');
      }

      enlace.innerHTML = `
        <span class="tema__numero" aria-hidden="true">${dosDigitos(tema.numero)}</span>
        <span class="tema__cuerpo">
          <span class="tema__titulo">
            <span class="visualmente-oculto">Tema ${tema.numero}: </span>${escapar(tema.titulo)}
          </span>
          <span class="tema__epigrafe">${escapar(tema.epigrafe)}</span>
          ${
            publicado
              ? ''
              : '<span class="tema__estado">En preparación</span>'
          }
        </span>`;

      item.appendChild(enlace);
      lista.appendChild(item);
    }

    seccion.appendChild(lista);
    fragmento.appendChild(seccion);
  }

  contenedor.replaceChildren(fragmento);
}

/* --- Vista de tema --------------------------------------------------------- */

function generarIdTitulo(texto, indice) {
  const base = texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base ? `s-${base}` : `s-${indice}`;
}

export async function pintarTema() {
  const programa = await cargarPrograma();
  const temas = temasDe(programa);
  const numero = new URLSearchParams(location.search).get('n') ?? '1';
  const tema = buscarTema(programa, numero);

  const articulo = document.getElementById('articulo');
  const lateral = document.getElementById('lateral');

  if (!tema) {
    document.title = 'Tema no encontrado';
    articulo.innerHTML = `<h1>Tema no encontrado</h1>
      <p>No existe el tema «${escapar(numero)}» en el programa de la convocatoria
      ${programa.convocatoria}.</p>
      <p><a href="index.html">Volver al índice de temas</a></p>`;
    lateral.hidden = true;
    return;
  }

  document.title = `Tema ${tema.numero} · ${tema.titulo}`;

  const bloque = programa.bloques.find((b) => b.id === tema.bloque);

  document.getElementById('migaja').innerHTML =
    `<a href="index.html">Temario</a> › Bloque ${bloque.id}: ${escapar(bloque.nombre)}`;

  document.getElementById('titulo-tema').textContent = `Tema ${tema.numero}. ${tema.titulo}`;
  document.getElementById('epigrafe-tema').innerHTML =
    `<strong>Epígrafe oficial</strong>${escapar(tema.epigrafe)}`;

  const publicada = await temaPublicado(tema);

  if (!publicada) {
    articulo.querySelector('#contenido').innerHTML = `
      <div class="pendiente">
        <h2>Este tema aún no está desarrollado</h2>
        <p>El epígrafe oficial está arriba y es el que hay que cubrir. El texto de estudio se
        redacta desde la normativa vigente, sin copiar temarios comerciales, así que se publica
        tema a tema.</p>
        <p>Mientras tanto puedes consultar la legislación que lo sustenta en el
        <a href="https://www.boe.es/biblioteca_juridica/" rel="noopener">BOE</a>.</p>
      </div>`;
    lateral.hidden = true;
  } else {
    const html = await fetch(tema.ruta).then((r) => r.text());
    articulo.querySelector('#contenido').innerHTML = html;
    construirIndiceLateral(articulo.querySelector('#contenido'), lateral);
  }

  pintarPaginacion(temas, tema);
}

function construirIndiceLateral(contenido, lateral) {
  const titulos = [...contenido.querySelectorAll('h2')];
  if (titulos.length < 2) {
    lateral.hidden = true;
    return;
  }

  lateral.hidden = false;
  const lista = document.createElement('ol');

  titulos.forEach((h, i) => {
    if (!h.id) h.id = generarIdTitulo(h.textContent, i);
    const item = document.createElement('li');
    const enlace = document.createElement('a');
    enlace.href = `#${h.id}`;
    enlace.textContent = h.textContent;
    item.appendChild(enlace);
    lista.appendChild(item);
  });

  lateral.querySelector('#lateral-lista').replaceChildren(lista);
}

function pintarPaginacion(temas, tema) {
  const contenedor = document.getElementById('paginacion');
  const indice = temas.findIndex((t) => t.numero === tema.numero);
  const anterior = temas[indice - 1];
  const siguiente = temas[indice + 1];

  contenedor.innerHTML = `
    ${
      anterior
        ? `<a href="tema.html?n=${anterior.numero}" rel="prev">← Tema ${anterior.numero}</a>`
        : '<span class="paginacion__vacio">← Primer tema</span>'
    }
    <a href="index.html">Índice</a>
    ${
      siguiente
        ? `<a href="tema.html?n=${siguiente.numero}" rel="next">Tema ${siguiente.numero} →</a>`
        : '<span class="paginacion__vacio">Último tema →</span>'
    }`;
}

/* --- Utilidades ------------------------------------------------------------ */

export function escapar(texto) {
  return String(texto)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function mostrarError(error) {
  console.error(error);
  const aviso = document.createElement('div');
  aviso.className = 'aviso';
  aviso.setAttribute('role', 'alert');
  aviso.innerHTML = `<span class="aviso__titulo">No se pudo cargar el contenido</span>
    ${escapar(error.message)}. Recarga la página; si sigue igual, abre la consola del
    navegador para ver el detalle.`;
  document.body.prepend(aviso);
}
