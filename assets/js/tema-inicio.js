// Arranque de la vista de tema. Igual que la portada, sin script en línea:
// la CSP sólo autoriza módulos servidos desde el propio origen.
import { pintarTema, mostrarError } from './app.js';

pintarTema().catch(mostrarError);
