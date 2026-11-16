# Temario y test de oposición a Policía Nacional (Escala Básica)

Web estática, gratuita y sin servidor, desplegada en GitHub Pages. Dos secciones: temario
teórico autorado desde fuentes legales con diagramas SVG, y banco de test aleatorizado
construido con exámenes oficiales publicados.

Stack: HTML + CSS + módulos ES nativos, sin build ni servidor. Contenido en JSON/Markdown
versionado. Sin PHP (GitHub Pages no ejecuta código de servidor).

## Specs

- **S1.** Despliegue gratuito en GitHub Pages: "una web con php y desplegarla en gitub q es
  gratis". Restricción derivada y aceptada: Pages solo sirve ficheros estáticos, así que no
  hay PHP; se sustituye por generación en el cliente y JSON versionados.
- **S2.** "todo el temario teorico de la policia": los 45 temas del programa oficial de la
  Escala Básica, completos, en tres bloques (Ciencias Jurídicas 1-26, Ciencias Sociales
  27-37, Materias Técnico-Científicas 38-45).
- **S3.** "tipo test que tengan las preguntas de examenes anteriores osea que randomice tipo
  test con las preguntas de antiguos examenes tanto teorico y psicotecnicos": motor de test
  que muestrea aleatoriamente preguntas de convocatorias anteriores, teóricas y
  psicotécnicas, sin repetir dentro de una sesión.
- **S4.** "si es ilegal no lo compies , copialo de fuentes legales siguiendo el indice de
  temas si puede ser una funente oficla mejor": prohibido copiar temarios ni bancos de
  preguntas de academias. Toda frase del temario se escribe desde la fuente legal (BOE,
  EUR-Lex) y todo el índice sigue el programa oficial. Cada bloque lleva su fuente con
  enlace y fecha de consulta.
- **S5.** "quiero un apartado para estudiar con imagenes que tu generes": cada tema lleva
  material visual. Se generan como diagramas SVG escritos en código (nítidos, offline,
  imprimibles, kilobyte-scale), no imágenes raster.
- **S6.** "necesito que pongas el temario a conciencia para sacar un diez hazlo legible y
  facil de estudiar para poder sacar un 10": cada tema con objetivos, texto de estudio,
  tablas comparativas, "trampas del examen", reglas mnemotécnicas, preguntas de
  autoevaluación y resumen final. Legibilidad como requisito, no como adorno: longitud de
  línea, contraste, jerarquía tipográfica y navegación por epígrafes.
- **S8.** "la fuente con la que hagas el temario que sea lexend": todo el texto se compone
  en Lexend, autoalojada y sin peticiones a servidores de terceros. Lexend no tiene
  cursiva: el énfasis se resuelve con peso, color y filetes, nunca con itálicas fingidas.
- **S7.** "y luego un apartado de tipo test con las preguntas de lose xamenes de 2020 , si
  son publicos": banco de test construido con los exámenes oficiales publicados desde 2020
  (promociones 37 en adelante). Los cuestionarios oficiales son documentos del sector
  público reutilizables con atribución (Ley 37/2007, RD 1495/2011). Cada pregunta conserva
  convocatoria, promoción y año.

## Decisiones tomadas

- D1. Sin PHP ni base de datos: Pages es estático. Progreso en `localStorage` con
  exportar/importar JSON, lo que además evita tratar datos personales en servidor (RGPD).
- D2. Ventana de exámenes: 2020-2026 como banco principal, porque la normativa sigue
  vigente. Las preguntas anteriores se archivan aparte y marcadas `legacy`, porque una
  pregunta de 2012 puede tener hoy otra respuesta correcta.
- D3. Los psicotécnicos no se copian: se generan por algoritmo con dificultad
  parametrizada, así la aleatorización es infinita y no hay material de terceros.
- D4. Imágenes = SVG generados en código, no imágenes raster.
- D5. Lexend autoalojada en `assets/fonts/` (SIL OFL 1.1) en lugar de Google Fonts:
  funciona offline y no expone la IP del visitante a un tercero.
- D6. Fuente del programa: Anexo I del PDF oficial BOE-A-2026-15055, de 10 de julio de 2026.
  Se descarta el índice de una academia que se usó en el primer intento: su columna de
  numeración estaba desalineada y desplazaba los temas 27-37.

## Tasks

- T1 · S1,S2 · inline · Scaffold del repo: estructura, README, licencias, atribuciones.
- T2 · S4 · worker · Extraer el programa oficial completo de los 45 temas con fuente.
- T3 · S2,S6 · inline · Motor de navegación: índice de bloques y temas, vista de tema, índice lateral por epígrafe.
- T4 · S5,S6 · worker · Autorar el Tema 1 al estándar de referencia, con diagramas SVG.
- T5 · S3,S7 · worker · Pipeline de extracción de exámenes oficiales (pdftotext + OCR) y primer lote de preguntas.
- T6 · S3 · inline · Motor de test: filtros, muestreo sin repetición, modo examen con penalización, repaso de fallos.
- T7 · S3 · worker · Generador de psicotécnicos (series, matrices, verbal, ortografía).
- T8 · S1 · inline · Progreso local y exportar/importar.
- T9 · S1 · inline · Workflow de GitHub Actions y despliegue en Pages.
- T10 · S6 · verify · Verificación funcional y de legibilidad.
- T11 · S6,S8 · inline · Hoja de estilos: Lexend autoalojada, escala tipográfica y contraste AA.
- T12 · S2,S4,S5,S6 · worker · Autorar el Tema 21 (Derecho Procesal Penal) al estándar de referencia.
- T13 · S2,S4,S5,S6 · worker · Autorar el Tema 18 (Delitos contra el patrimonio) al estándar de referencia.
- T14 · S2,S4,S5,S6 · worker · Autorar el Tema 26 (protección de datos).
- T15 · S2,S4,S5,S6 · worker · Autorar el Tema 17 (penal especial).
- T16 · S2,S4,S5,S6 · worker · Autorar el Tema 20 (delitos informáticos).
- T17 · S2,S4,S5,S6 · worker · Autorar el Tema 10 (extranjería).
- T18 · S2,S4,S5,S6 · worker · Autorar los Temas 11 y 12.
- T19 · S2,S4,S5,S6 · worker · Autorar los Temas 13 y 15.
- T20 · S2,S4,S5,S6 · worker · Autorar los Temas 6 y 7.
- T21 · S2,S4,S5,S6 · worker · Autorar los Temas 19, 22 y 23.
- T22 · S2,S4,S5,S6 · worker · Autorar los Temas 24 y 25.
- T23 · S2,S4,S5,S6 · worker · Autorar los Temas 27-37 (bloque B, sin ley detrás).
- T24 · S2,S4,S5,S6 · worker · Autorar los Temas 38-45 (bloque C).

## Log

### L1 — petición original

> mi jefe me dijo que haga un proyecto paralelo de una web teorica para aprobar la policia
> nacional con cursos con todo el temario teorico de la policia tanto como tipo test que
> tengan las preguntas de examenes anteriores osea que randomice tipo test con las preguntas
> de antiguos examenes tanto teorico y psicotecnicos mi idea era una web con php y
> desplegarla en gitub q es gratis,se puede ?? o que opinas del proyecto sin modificar nada
> es un proyecoto que se va a almacenar en esta web

### L2 — corrección de alcance del contenido

> no wl contenido , lo vas a cogert tu , vas a sacar todo el temario que haya para el examen
> de policia nacional , y todas las preguntas de los examenes desde 2010 ?? o desde donde
> crees quee s correcto , y lo voy a hacer en gitubh page , y sni es php que quieres que
> haga ??

### L3 — decisión de alcance y exigencia

> si es ilegal no lo compies , copialo de fuentes legales siguiendo el indice de temas si
> puede ser una funente oficla mejor quiero un apartado para estudiar con imagenes que tu
> generes y necesito que pongas el temario a conciencia para sacar un diez hazlo legible y
> facil de estudiar para poder sacar un 10 , y luego un apartado de tipo test con las
> preguntas de lose xamenes de 2020 , si son publicos

### L4 — evidencia técnica recogida

- GitHub Pages no ejecuta código de servidor (PHP, Ruby, Python): sólo sirve estáticos.
- Programa oficial: 45 temas, bloques 1-26 jurídicas, 27-37 sociales, 38-45
  técnico-científicas. Fuente: `interior.gob.es`, que publica el índice de epígrafes, no el
  texto de estudio.
- Reutilización de información del sector público: Ley 37/2007 y RD 1495/2011, con
  atribución.
- `interior.gob.es` devuelve 403 a descargas automatizadas; el BOE responde con normalidad.
- `pdftotext` extrae limpio el examen de la promoción 38 (45 241 caracteres, 100 preguntas).
  El de la promoción 41 es un escaneo y requiere OCR. `pdftoppm` no está instalado.

### L5 — tipografía

> la fuente con la que hagas el temario que sea lexend

### L7 — normas derogadas que otros temarios siguen citando

Al redactar los temas 8 y 9 se detectó que la estructura orgánica de la Dirección General de la
Policía ya no está en el RD 734/2020: ese real decreto quedó derogado y la estructura vigente
está en el **RD 207/2024, de 27 de febrero**. Además, el capítulo IV del título II de la
LO 2/1986 (artículos 16 a 26) está derogado por la **LO 9/2015**. Ambos cambios se explican en
el texto y se convierten en trampas de examen, en lugar de reproducir la norma muerta.

Quedan marcados como no verificados, y por tanto sin afirmar en el temario: la composición de
la Junta de Gobierno y del Consejo Asesor de la Dirección General, el régimen disciplinario
vigente de las policías locales, y las denominaciones históricas «Gobernador Civil» y
«Director de la Seguridad del Estado» que siguen literalmente en la LO 2/1986.

Los recuentos de preguntas por tema (13 en el tema 8, 5 en el tema 9) proceden del análisis de
un portal del sector, no del BOE: se usan solo para priorizar el orden de redacción, nunca como
afirmación del temario.

### L9 — interactividad del test

Feedback del dueño: «la interactividad es pocha tienes que hacerlos para que no se saturen ni se
aburran haciendolos». Se rehace la sesión sin patrones oscuros: tamaños de sesión (10, 30,
banco completo, examen cronometrado), línea de progreso discreta, racha con reconocimiento
solo en 5 y 10, reto diario determinista por fecha, pantalla final con comparación contra el
mejor resultado del mismo modo, sugerencia explícita de parar pasadas 40 preguntas, y
persistencia en `localStorage` con exportar/importar validado y reinicio en dos pasos.

### L10 — estado al cierre de sesión

**Publicado y verificado en producción**: 9 de 45 temas (1, 2, 3, 4, 5, 8, 9, 14, 16), banco de
200 preguntas, motor de test con modos y persistencia, CSP estricta, aviso legal, canal de
seguridad y build con tres verificadores como puerta.

**Orden de trabajo pendiente**, por valor:

1. Redactar los 36 temas restantes por lotes de dos, priorizando peso: 21 (procesal penal),
   18 (patrimonio), 26 (protección de datos), 17 (penal especial), 20 (delitos informáticos),
   10-12 (extranjería), 13 (seguridad privada), 15 (infraestructuras críticas), 6, 7, 22-25.
   Los temas de los bloques B y C no tienen ley detrás: ahí el estándar de fuentes cambia y hay
   que decirlo en el propio tema.
2. Auditoría legal de lo publicado, empezando por las cajas «Qué no se ha afirmado» de los temas
   14 y 16, la composición de la Junta de Gobierno y el Consejo Asesor del tema 8, y las cifras
   institucionales del tema 4.
3. Ampliar el banco: 2023 está bloqueado por un aviso de ©JURISPOL y 2024 es un escaneo sin
   `pdftoppm`; 2025 y 2026 no tienen cuestionario publicado. Sin OCR instalado no hay avance
   aquí, y instalar software requiere permiso del dueño.
4. Verificar de forma independiente las 200 claves transcritas a ojo.
5. Psicotécnicos por algoritmo, y pulido visual una vez el dueño confirme la dirección.

**Cómo reanudar**: leer este documento hasta aquí, ejecutar los tres verificadores
(`scripts/verificar.mjs`, `scripts/verificar-examenes.mjs`, `scripts/verificar-test.mjs`) para
confirmar que el árbol está sano, y seguir por el punto 1. La lista visible de tareas refleja el
mismo estado.

### L11 — alcance de la verificación, otra vez

La interactividad nueva está probada con 96 aserciones en `verificar-test.mjs` más una prueba de
humo del DOM con un stub, ambas deterministas. Aun así **no hay navegador**: el contraste, el
foco y las animaciones se validaron de forma estática. La pasada visual sigue siendo del dueño.

Los verificadores del repositorio comprueban estructura, recursos, banco y motor. **No
comprueban verdad jurídica.** Un número de artículo equivocado o una cifra institucional
caducada pasan todas las puertas. Por eso cada tema declara sus preceptos y existe una tarea
de auditoría legal abierta por lote.

El índice de una academia usado en el primer intento tenía la columna de numeración
corrupta: los temas 27-37 aparecían desplazados. Localizada la fuente oficial citada en
las bases: BOE-A-2026-15055, de 10 de julio de 2026, Anexo I, con PDF descargable
(`https://www.boe.es/boe/dias/2026/07/10/pdfs/BOE-A-2026-15055.pdf`). Extracción limpia:
45 temas, numeración 1-45 sin huecos, tres bloques correctos.

### L12 — reanudación del 2026-11-16

> continua por la app poli donde lo dejaste

Árbol sano al reanudar: `scripts/verificar.mjs` (9 publicados, 36 pendientes, sin errores
estructurales), `scripts/verificar-examenes.mjs` (200 preguntas válidas) y
`scripts/verificar-test.mjs` (96 comprobaciones) en verde.

Se retoma el punto 1 de L10 con el lote de dos temas de mayor peso: T21 y T18. El flag
`publicado` de `data/programa/programa.json` es el que decide qué tema se sirve, y es un fichero
compartido: los redactores entregan solo su `data/temas/NN.html` y el padre activa los flags y
pasa los tres verificadores al cerrar el lote.

**Cierre del lote (11 de 45 publicados)**:

- `data/temas/21.html` (153 131 B, 20 apartados, 3 SVG, 13 cajas clave). Escrito desde el BOE
  consolidado: CE, LECrim, LOPJ, LO 6/1984, LO 50/1981, LO 2/1986, RD 769/1987, LO 4/2015 y
  LO 4/1981. Incluye el traslado de la LO 1/2025 (Tribunal de Instancia) frente a la
  terminología antigua que las leyes conservan. La fecha de consulta declarada es 16/11/2026: si
  el tema se revisa más tarde hay que reconfirmar la última actualización de LECrim y LOPJ.
- `data/temas/18.html` (122 582 B, 22 apartados, 3 SVG, 15 cajas clave, 15 tablas). Escrito
  desde el CP consolidado (arts. 234-256, 268 y 269) con las reformas de la LO 9/2022,
  LO 14/2022 y LO 1/2026. Deja fuera a propósito los capítulos VII-XIV del título XIII.
- `data/programa/programa.json` regenerado con `scripts/build-programa.mjs`: el flag
  `publicado` se deriva de la existencia del fichero, así que no hay que editarlo a mano.
- Tres verificadores en verde con 11 publicados y 34 pendientes. Se sustituyeron los dos `<em>`
  del tema 18 por `<strong>`: Lexend no tiene cursiva y el navegador la fingiría (S8). Los temas
  01 y 04 publicados sí usan `<em>`; queda como detalle de estilo a corregir en la auditoría.
- Pendiente del dueño: pasada visual (SVG a 360 px, contraste) y revisión jurídica de los
  artículos citados en ambos temas, en la línea de la tarea de auditoría legal de L11.

### L13 — la revisión nativa se apaga en este clon, y un defecto en dos epígrafes

El dueño desactivó la revisión nativa en este clon (`gentle-ai review mode disable --scope clone`).
Motivo: el candidato del lote 18+21 ocupa 4 619 líneas de diff y el proveedor lo detuvo en el
preflight con `lens_context_budget_exceeded`, sin crear autoridad de revisión. La entrega vuelve a
la política ordinaria del repositorio: los tres verificadores y el commit como unidad de trabajo.

Al preparar el lote siguiente se descubrió que los epígrafes 13 y 26 arrastraban el pie de página
del PDF oficial dentro del texto («… en España. cve: BOE-A-2026-15055 Coordinación. Empresas …
Verificable en https://www.boe.es»). El pie se intercala en la misma línea que el texto y el
extractor solo filtraba las líneas que empezaban por él. Corregido en `scripts/build-programa.mjs`
con un recorte en cualquier posición, más una comprobación nueva en `scripts/verificar.mjs` que
falla si algún epígrafe o título contiene `cve:`, «Verificable en» o una URL. Observado en rojo
antes del arreglo (temas 13 y 26) y en verde después; el resto de los 43 epígrafes quedó idéntico.
