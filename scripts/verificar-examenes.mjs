// Verifica el banco de preguntas extraído de los exámenes oficiales.
// Comprueba, fichero a fichero y sobre el conjunto:
//   · que cada pregunta tenga exactamente 3 opciones no vacías;
//   · que «correcta» sea 0, 1 o 2 (índice de la opción correcta);
//   · que ningún identificador de pregunta esté repetido;
//   · que ninguna pregunta esté repetida dentro del mismo fichero: se considera repetida
//     cuando coinciden el enunciado Y las opciones. Un enunciado genérico que el cuadernillo
//     oficial repite con opciones distintas («¿Cuál de las siguientes opciones es
//     correcta?» en tres preguntas de ortografía) no es una pregunta duplicada.
//
// Uso: node scripts/verificar-examenes.mjs [directorio]
//   Sin argumento revisa data/examenes. Sale con código 1 si hay cualquier fallo.

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const directorio = process.argv[2] ?? 'data/examenes';
const OPCIONES = 3;

const errores = [];
const ids = new Map();
let totalPreguntas = 0;

const fallo = (msg) => errores.push(msg);

/** Clave de comparación de textos: sin diferencias de espaciado ni de caja. */
const normalizar = (texto) => texto.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Clave de una pregunta para detectar duplicados: enunciado y opciones normalizados.
 * El separador NUL evita que dos preguntas distintas colisionen al concatenar.
 */
const clavePregunta = (pregunta) => {
  const opciones = Array.isArray(pregunta.opciones) ? pregunta.opciones : [];
  const textos = opciones.map((opcion) => normalizar(typeof opcion === 'string' ? opcion : ''));
  return [normalizar(pregunta.enunciado), ...textos].join('\u0000');
};

// `index.json` es el manifiesto que consume el motor de test, no un banco de preguntas.
const archivos = (await readdir(directorio))
  .filter((f) => f.endsWith('.json') && f !== 'index.json')
  .sort();
if (archivos.length === 0) fallo(`No hay ningún fichero .json en ${directorio}`);

for (const archivo of archivos) {
  const ruta = join(directorio, archivo);
  let banco;
  try {
    banco = JSON.parse(await readFile(ruta, 'utf8'));
  } catch (error) {
    fallo(`${archivo}: no es JSON válido (${error.message})`);
    continue;
  }

  for (const campo of ['convocatoria', 'promocion', 'tipo', 'fuente', 'licencia']) {
    if (banco[campo] === undefined || banco[campo] === null || banco[campo] === '') {
      fallo(`${archivo}: falta el campo «${campo}»`);
    }
  }
  if (!Number.isInteger(banco.convocatoria)) fallo(`${archivo}: «convocatoria» no es un año entero`);
  if (!Number.isInteger(banco.promocion)) fallo(`${archivo}: «promocion» no es un número entero`);

  const preguntas = banco.preguntas;
  if (!Array.isArray(preguntas) || preguntas.length === 0) {
    fallo(`${archivo}: no contiene preguntas`);
    continue;
  }

  const vistas = new Map();
  preguntas.forEach((pregunta, posicion) => {
    const etiqueta = `${archivo} · pregunta ${posicion + 1}`;

    if (typeof pregunta.id !== 'string' || pregunta.id.trim() === '') {
      fallo(`${etiqueta}: el «id» está vacío`);
    } else if (ids.has(pregunta.id)) {
      fallo(`${etiqueta}: el «id» ${pregunta.id} ya existe en ${ids.get(pregunta.id)}`);
    } else {
      ids.set(pregunta.id, archivo);
    }

    if (typeof pregunta.enunciado !== 'string' || pregunta.enunciado.trim() === '') {
      fallo(`${etiqueta}: el enunciado está vacío`);
    } else {
      const clave = clavePregunta(pregunta);
      if (vistas.has(clave)) {
        fallo(
          `${etiqueta}: repite la pregunta ${vistas.get(clave)} del mismo fichero (mismo enunciado y mismas opciones)`,
        );
      } else {
        vistas.set(clave, posicion + 1);
      }
    }

    const opciones = pregunta.opciones;
    if (!Array.isArray(opciones) || opciones.length !== OPCIONES) {
      fallo(`${etiqueta}: tiene ${Array.isArray(opciones) ? opciones.length : '—'} opciones en lugar de ${OPCIONES}`);
    } else {
      opciones.forEach((opcion, i) => {
        if (typeof opcion !== 'string' || opcion.trim() === '') {
          fallo(`${etiqueta}: la opción ${i + 1} está vacía`);
        }
      });
    }

    if (![0, 1, 2].includes(pregunta.correcta)) {
      fallo(`${etiqueta}: «correcta» vale ${JSON.stringify(pregunta.correcta)} y debe ser 0, 1 o 2`);
    }
  });

  const declara = `${banco.convocatoria}-p${banco.promocion}`;
  if (!archivo.startsWith(declara)) fallo(`${archivo}: el nombre no coincide con «${declara}»`);

  totalPreguntas += preguntas.length;
  console.log(`${archivo}: ${preguntas.length} preguntas (${declara})`);
}

console.log('');
if (errores.length) {
  for (const error of errores) console.error(`Fallo: ${error}`);
  console.error(`\n${errores.length} fallo(s) en ${archivos.length} fichero(s), ${totalPreguntas} preguntas.`);
  process.exitCode = 1;
} else {
  console.log(`Banco válido: ${archivos.length} convocatoria(s), ${totalPreguntas} preguntas.`);
}
