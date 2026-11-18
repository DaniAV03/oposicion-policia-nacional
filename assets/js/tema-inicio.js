// Arranque de la vista de tema. Igual que la portada, sin script en línea:
// la CSP sólo autoriza módulos servidos desde el propio origen.
import { pintarTema, mostrarError } from './app.js';
import { iniciarLectura } from './tema-lectura.js';

/* La lectura en voz alta se engancha detrás del pintado: el texto que hay que
   leer lo escribe `pintarTema` en el documento, así que arrancar antes dejaría
   el control sin frases. Un fallo de la lectura no es un fallo del tema: se
   anota en la consola y no se pinta un aviso de contenido roto. */
pintarTema()
  .then(() => {
    try {
      iniciarLectura();
    } catch (error) {
      console.error(error);
    }
  })
  .catch(mostrarError);
