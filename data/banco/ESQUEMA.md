# Esquema del banco propio

El banco propio son las preguntas escritas para este sitio. Es distinto del banco oficial
(`data/examenes/`), que son los cuadernillos completos de cada convocatoria y no se tocan.

Todo lo de aquí lo comprueba `scripts/verificar-banco.mjs` en cada build. Si algo no cumple,
el despliegue no sale.

## Manifiesto

`data/banco/index.json` lista los ficheros que el cliente puede cargar. Nada se carga por
convención de nombres: si un fichero no está en el manifiesto, no existe para la web.

```json
{
  "version": 1,
  "descripcion": "…",
  "bancos": [
    {
      "id": "tema-01",
      "archivo": "temas/01.json",
      "tipo": "tema",
      "tema": 1,
      "preguntas": 12
    }
  ]
}
```

- `id`: identificador estable del banco, sin espacios.
- `archivo`: ruta relativa a `data/banco/`.
- `tipo`: `tema` (un tema del programa) o `mezcla` (preguntas no oficiales que cruzan temas).
- `tema`: obligatorio y entre 1 y 45 cuando `tipo` es `tema`; ausente cuando es `mezcla`.
- `preguntas`: recuento declarado. Tiene que coincidir con el fichero, o es que alguien
  editó uno de los dos y se olvidó del otro.

## Fichero de banco

```json
{
  "version": 1,
  "tipo": "tema",
  "tema": 1,
  "titulo": "Tema 1 · El Derecho y las fuentes del ordenamiento",
  "preguntas": [
    {
      "id": "t01-g001",
      "tema": 1,
      "dificultad": "media",
      "trampa": "plazo",
      "enunciado": "¿Cuánto dura el plazo general de residencia para adquirir la nacionalidad española por residencia?",
      "opciones": ["Dos años.", "Diez años.", "Cinco años."],
      "correcta": 1,
      "explicacion": "El plazo general es de diez años. Dos años es el caso de los nacionales de países iberoamericanos y cinco el de los refugiados, que son las dos excepciones que el examen mezcla.",
      "referencia": {
        "apartado": "8. Plazos de la nacionalidad",
        "norma": "Código Civil",
        "articulo": "art. 22"
      }
    }
  ]
}
```

### Campos de cada pregunta

| Campo | Obligatorio | Reglas |
|---|---|---|
| `id` | sí | `tNN-gNNN` en bancos de tema (NN = tema, con dos dígitos) y `mx-NNN` en mezcla. Único en todo el banco. |
| `tema` | sí | 1-45. En bancos de tema tiene que coincidir con el del fichero. En mezcla, el tema principal de la pregunta. |
| `temas` | no | Solo en mezcla: los dos temas que cruza la pregunta, por ejemplo `[1, 26]`. Si está, `tema` tiene que ser el primero de la lista. |
| `dificultad` | sí | `baja`, `media` o `alta`. |
| `trampa` | sí | `plazo`, `organo`, `mayoria`, `jerarquia`, `competencia`, `absoluto` o `ninguna`. Declara qué se está midiendo. |
| `enunciado` | sí | Texto de la pregunta, sin las opciones dentro. |
| `opciones` | sí | Exactamente 3. Es el formato del motor (`OPCIONES_POR_PREGUNTA`). |
| `correcta` | sí | Índice 0-2 de la opción correcta. |
| `explicacion` | sí | Mínimo 40 caracteres. Dice por qué la correcta lo es y por qué fallan las otras. Sin esto la pregunta no enseña, solo examina. |
| `referencia.apartado` | sí | Texto exacto de un `<h2>` o `<h3>` del tema correspondiente en `data/temas/NN.html`. |
| `referencia.norma` | sí | Norma de la que sale la respuesta (Constitución Española, Código Civil, LO 4/2015…). |
| `referencia.articulo` | sí | Artículo concreto. |

## Reglas de autoría

1. **Una sola respuesta defendible.** Las dos opciones falsas tienen que ser falsas de forma
   demostrable, no ambiguas. Una "trampa" legítima es el plazo de 72 horas frente a 7 días;
   una trampa ilegítima es una pregunta donde dos opciones valen.
2. **Todo sale de la fuente legal**, nunca de un banco de academia. La regla del proyecto
   (S4 del documento de función) sigue vigente.
3. **El apartado citado tiene que existir** y tratar de eso. El verificador comprueba que el
   texto del apartado está en el tema; que hable de lo que la pregunta dice es criterio
   humano y se revisa.
4. **`explicacion` docente.** El objetivo no es suspender al que estudia: es que después de
   fallar sepa la respuesta y por qué.
5. **Sin copiar el banco oficial.** Una pregunta del banco propio no puede repetir el
   enunciado de una de `data/examenes/`. El verificador lo compara.

## Recuento previsto

12 preguntas por tema (540 en total) y unas 120-150 en el banco de mezcla. Se escriben por
tandas con revisión, empezando por un piloto de tres temas: uno de cada bloque (1, 27 y 38).
