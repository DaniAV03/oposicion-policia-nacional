// Arranque de la portada. Vive en un fichero aparte porque la CSP del sitio
// prohíbe el JavaScript incrustado (script-src 'self'): así el documento no
// necesita ni una línea de script en línea.
import { pintarPortada, mostrarError } from './app.js';

pintarPortada(document.getElementById('bloques')).catch(mostrarError);
