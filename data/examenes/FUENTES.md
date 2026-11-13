# Fuentes del banco de preguntas

Banco construido con los **cuestionarios oficiales de conocimientos** de la oposición a
Policía Nacional, Escala Básica, y sus **plantillas de corrección** (hoja A9) publicadas
por el Área de Procesos Selectivos de la Dirección General de la Policía.

Reutilización amparada por la Ley 37/2007, de 16 de noviembre, sobre reutilización de la
información del sector público, y por el RD 1495/2011, de 24 de octubre, con atribución al
Ministerio del Interior. No se incluye material de academias ni de editoriales.

## Estado por convocatoria (ventana 2020-2026)

| Convocatoria | Promoción | Cuestionario | Plantilla | Preguntas en el banco |
| ------------ | --------- | ------------ | --------- | --------------------- |
| 2020 | 37 | no publicado | — | 0 (bloqueada) |
| 2021 | 38 | texto | escaneo | 100 |
| 2022 | 39 | texto | escaneo | 100 |
| 2023 | 40 | texto | escaneo | 0 (bloqueada) |
| 2024 | 41 | escaneo | escaneo | 0 (bloqueada) |
| 2025 | 42 | no publicado | — | 0 (bloqueada) |
| 2026 | 43 | no publicado | — | 0 (bloqueada) |

La tabla real, con el tamaño del texto extraído de cada PDF, la produce
`node scripts/extraer-examenes.mjs --listar`.

### Motivos de bloqueo

- **2020 (p37)**: no hay cuestionario oficial de conocimientos publicado en la fuente
  consultada. Solo existe un «ANÁLISIS EXAMEN BÁSICA 2020» de Academia Águilas, que es
  material de academia y no el cuestionario oficial.
- **2023 (p40)**: el único cuestionario disponible es una republicación de JURISPOL que
  lleva el aviso «©JURISPOL. RESERVADOS TODOS LOS DERECHOS». Es material de editorial y
  no se reutiliza.
- **2024 (p41)**: el cuestionario es un escaneo sin capa de texto (`pdftotext` devuelve 14
  caracteres). En el equipo de extracción no hay OCR instalado (`tesseract`, `pdftoppm`,
  `qpdf` y `mutool` no están disponibles) y no se instala software para ello. Transcribir a
  mano 100 preguntas de derecho por visión no alcanza el listón de fiabilidad exigido.
- **2025 (p42) y 2026 (p43)**: no hay cuestionario publicado en la fuente consultada.

## Documentos utilizados

Los PDF se descargan de `https://infopol.es/test-oficiales-policia/<fichero>.pdf`, que
reproduce los cuadernillos y las hojas A9 del proceso selectivo. El banco cita en el campo
`fuente` la URL exacta del cuestionario utilizado.

### 2021 · promoción 38

- **Cuestionario**: `EB-38-TEST.pdf` (100 preguntas, 12 páginas).
- **Plantilla de corrección**: `EB-38-TEST-PLANTILLA.pdf`. Es la hoja A9 oficial
  «ESCALA BÁSICA - 2021 / CONVOCATORIA (24/08/2021) / EXAMEN DE CONOCIMIENTOS».
- **Salvedad de procedencia**: el cuadernillo llega como reexportación cifrada (RC4 con
  contraseña de propietario) y sin la cabecera de la Dirección General, aunque conserva el
  pie de página del cuadernillo oficial («Bás_38 … PASE A LA PÁGINA SIGUIENTE … Pág N»). No
  contiene ningún aviso de derechos de terceros. Su maquetación no se puede acreditar como
  la original; el contenido coincide con la plantilla oficial de la misma promoción.

### 2022 · promoción 39

- **Cuestionario**: `examen-escala-basica-39-2023-oposiciones-policia-nacional-modelo-A.pdf`.
  Documento de la Dirección General de la Policía, División de Formación y
  Perfeccionamiento, Área de Procesos Selectivos (metadatos: autor
  `PROCESOS_SELECTIVOS`), 100 preguntas, 11 páginas, modelo A.
- **Plantilla de corrección**:
  `plantilla-A-respuestas-examen-escala-basica-39-2023-oposiciones-policia-nacional-modelo-A.pdf`.
  Hoja A9 «ESCALA BÁSICA 39 / CONV. 15/11/2022 / CONOCIMIENTOS / MODELO A», también del
  Área de Procesos Selectivos.

## Cómo se obtiene la clave de respuestas

1. `pdftotext -layout -enc UTF-8` extrae el texto del cuestionario; no de la plantilla, que
   es un escaneo sin capa de texto.
2. La plantilla se abre como imagen. Cada fila de la hoja A9 tiene una sola marca rellena
   por bloque de 25 preguntas; la posición de esa marca (columna A, B o C) da la respuesta.
   En 2022 la hoja trae además dos zonas idénticas (ZONA 1 y ZONA 2), lo que sirve de
   contraste.
3. La transcripción se contrastó a mano sobre ampliaciones de la imagen: 32 respuestas en
   2022 y 28 en 2021, elegidas en la primera fila, la última y el centro de cada bloque.
4. `correcta` es el índice de base 0: `0` = opción a), `1` = b), `2` = c). No se deduce
   nunca del enunciado ni se corrige contra el criterio propio: si la plantilla oficial y
   el criterio del redactor discrepasen, manda la plantilla.

La clave transcrita se pasa al extractor, de modo que el JSON se puede reconstruir sin
editar a mano:

```sh
# 2021 · promoción 38
node scripts/extraer-examenes.mjs --id 2021-p38 \
  --respuestas CBBCBBCCACACACCBCBABCBBCBABCBBABBCCACCBCAACBBCACABABACABAAABBBACCCAAABCCBBAACACBCACACBBAABBABBCBBBAC \
  --json data/examenes/2021-p38.json

# 2022 · promoción 39
node scripts/extraer-examenes.mjs --id 2022-p39 \
  --respuestas ABBCAACACCACAACBBBBBBBACCCCAACCAACBBBCCACBCBBBBCACCCCAACAAACBBCACAABAABACCBBCABBBABCBCBCABABACBBCCBB \
  --json data/examenes/2022-p39.json
```

Después, `node scripts/verificar-examenes.mjs` comprueba la estructura del banco.

## Estructura de cada fichero

Un fichero por convocatoria, `data/examenes/<año>-p<numero>.json`:

```json
{
  "convocatoria": 2021,
  "promocion": 38,
  "tipo": "teorico",
  "fuente": "<URL del cuestionario oficial>",
  "licencia": "Reutilización de información del sector público (Ley 37/2007, RD 1495/2011)",
  "preguntas": [
    { "id": "2021-p38-001", "enunciado": "…", "opciones": ["…", "…", "…"], "correcta": 2, "tema": null }
  ]
}
```

`id` identifica la convocatoria y el número de pregunta del cuadernillo oficial. `tema`
queda en `null`: el cuestionario no etiqueta sus preguntas por tema del programa y no se
asigna ninguno por aproximación.

### Un enunciado repetido en el cuadernillo de 2022

El cuadernillo oficial de la promoción 39 plantea tres preguntas de ortografía con el mismo
enunciado genérico, «¿Cuál de las siguientes opciones es correcta?», y opciones distintas:

| Pregunta | Primera opción |
| -------- | -------------- |
| 2022-p39-003 | Lo planificamos a grosso modo, sin entrar en detalles. |
| 2022-p39-011 | Cuando vi a Marta la conminé a cejar en su actitud. |
| 2022-p39-029 | Mi hermano es mayor que tú. |

No es un defecto de extracción: el texto oficial las numera por separado y cada una tiene
sus propias opciones. Por eso `scripts/verificar-examenes.mjs` entiende que **una pregunta
está duplicada cuando coinciden el enunciado y las opciones**, no cuando solo coincide el
enunciado. Con esa definición las tres conviven en el banco y una extracción que repita una
pregunta entera se sigue detectando. La comparación ignora mayúsculas y diferencias de
espaciado.

## Psicotécnicos

No se incorporan. Los cuadernillos psicotécnicos que circulan pueden contener material
licenciado de terceros, así que esa parte del examen se cubre generando ejercicios propios
por algoritmo, no copiando los oficiales.
