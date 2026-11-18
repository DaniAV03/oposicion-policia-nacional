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
- **S9.** "psicotenicos temario de como pasarlos": una guía de estudio, no un banco. Un
  apartado por tipo de prueba con qué mide, método paso a paso, un ejemplo resuelto a mano,
  las trampas típicas y el tiempo recomendado por ítem. Debe poder estudiarse sola, sin las
  pruebas delante.
- **S10.** "los examenes psicotecnicos": pruebas generadas por algoritmo, con la lógica de
  D3 (nada copiado de academias, aleatorización infinita), conectadas al motor de sesiones
  que ya existe (modos, progreso en `localStorage`, racha, reto diario).

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
- T25 · S9,S6 · worker · `data/psicotecnicos/guia.html`: guía de estudio por dominio, con
  ejemplo resuelto, trampas y tiempo por ítem.
- T26 · S10,S3 · worker · `assets/js/psicotecnicos-core.js`: generador determinista por
  semilla con ocho tipos, solución única y distractores plausibles.
- T27 · S10,S3 · inline · Integración con el motor de sesiones: entrenamiento por tipo,
  examen cronometrado, sin repetir ítem, progreso propio en `localStorage`.
- T28 · S5,S6 · inline · `psicotecnicos.html` con la CSP estricta, la guía arriba, el
  lanzador debajo y entrada nueva en la portada.
- T29 · S1 · inline · `scripts/verificar-psicotecnicos.mjs` con aserciones deterministas y
  puerta en el build.
- T30 · S6 · verify · Verificación funcional: cronómetro, corrección, progreso y
  exportar/importar.
- T31 · S2,S4 · worker · Auditoría jurídica por lotes: contrastar cada cita normativa de cada
  tema con el texto consolidado del BOE y corregir lo que no cuadre.
- T32 · S9,S10 · worker · Revisión humana del contenido curado del generador de psicotécnicos
  (entradas de ortografía y pares de analogía).
- T33 · S6 · inline · Reacomodar la paleta de las ilustraciones SVG a la nueva identidad.

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

### L14 — lote 26 y 17: 13 de 45 publicados

- `data/temas/26.html` (136 254 B, 26 apartados, 3 SVG, 23 tablas): LO 3/2018 consolidada, LO 7/2021
  y el RGPD (DOUE L 119, pp. 1-88). Declara las fechas de consolidación (LO 3/2018: 27/12/2025;
  LO 7/2021: 29/07/2022) y deja en «Qué no se ha afirmado» el reglamento de desarrollo, el
  Estatuto de la AEPD, las directrices y la jurisprudencia.
- `data/temas/17.html` (166 833 B, 22 apartados, 17 tablas, 3 SVG): CP consolidado a 09/04/2026 de los
  títulos I a VIII del libro II, más LO 2/2010 (aborto, tras LO 1/2023) y LO 3/2021 (eutanasia).
  Declara siete puntos que no afirma, entre ellos la doctrina del dolo eventual y los umbrales
  cuantitativos de las lesiones.
- **Identificadores verificados**: en el encargo del tema 26 se citaron `BOE-A-2021-8809` y
  `DOUE-L-2016-81207` como LO 7/2021 y RGPD; no lo son (son un recurso de inconstitucionalidad y una
  decisión sobre precursores). El identificador bueno de la LO 7/2021 es `BOE-A-2021-8806`
  (`boe.es/eli/es/lo/2021/05/26/7/con`) y el RGPD se leyó en `boe.es/doue/2016/119/L00001-00088.pdf`.
  Conviene no fiarse de identificadores BOE escritos de memoria: se comprueban en el ELI.
- `programa.json` regenerado, 13 publicados y 32 pendientes, y los tres verificadores en verde.
  El siguiente lote del orden de L10 son los temas 20 (delitos informáticos) y 10 (extranjería).

### L15 — lote 20 y 10: 15 de 45 publicados

- `data/temas/20.html` (148 654 B, 21 apartados, 17 tablas, 3 SVG): CP consolidado a 09/04/2026 (197 a
  197 quater, 249.1.a, 264 a 264 quater, 270-274), LECrim (588 bis a 588 octies), CE 18.4, LO 1/1982,
  LO 3/2018, LOPJ y Ley 25/2007. Corrige dos errores del encargo: la estafa informática es el
  **249.1.a** desde la LO 1/2015 y no el «248.2»; y la LO 1/2025 no toca los preceptos penales del tema
  (la última reforma es la LO 1/2026, en 248 y 250.1.8.ª). Tres identificadores BOE del encargo eran
  falsos y quedaron sustituidos; el Convenio de Budapest está en `BOE-A-2010-14221`.
- `data/temas/10.html` (142 566 B, 27 apartados, 20 tablas, 3 SVG): LO 4/2000, RD 240/2007 y
  **RD 1155/2024**. Hallazgo que hay que recordar: el **RD 557/2011 está derogado**; el Reglamento
  vigente de extranjería es el RD 1155/2024, en vigor desde el 20/05/2025, y con él cambian las cifras
  (arraigo general de dos años, renovaciones a dos meses, cinco tipos de arraigo, estancia de larga
  duración, larga duración UE y nacional). Cualquier manual que siga citando el 557/2011 está muerto,
  igual que el RD 734/2020 del tema 8.
- Aviso de método del redactor del tema 10: **boe.es devuelve 200 incluso a un ELI inexistente**, así
  que un 200 no valida un identificador; hay que comprobar el `<title>` de la página.
- `programa.json` regenerado: 15 publicados, 30 pendientes, y los tres verificadores en verde.
- Los redactores no pueden ejecutar `rm` (el arnés de los hijos bloquea comandos destructivos): el
  padre borra el scratch. Restos de este lote: `C:\tmp\t20`, `C:\tmp\t10`,
  `%TEMP%\gpwMcxNs\gaFkcbaZ\t20` y `/tmp/t10`.
- Siguiente lote del orden de L10: 11 y 12 (ambos de extranjería y asilo), o 13 y 15 si se prefiere
  cerrar el bloque A por peso.

### L16 — lote 11, 12, 13 y 15: 19 de 45 publicados, y la devolución del tema 10

- `data/temas/11.html` (119 871 B, 24 apartados, 23 tablas, 2 SVG): LO 4/2000 (arts. 50-66) y el título XIV
  del RD 1155/2024. Catálogo letra por letra y los cuatro relojes del procedimiento.
- `data/temas/12.html` (108 453 B, 24 apartados, 14 tablas, 3 SVG): Ley 12/2009, RD 203/1995, RD 865/2001,
  RD 1325/2003 y el RD 220/2022 del sistema de acogida. Avisa de que no hay reglamento vigente que
  desarrolle la Ley 12/2009 y de las remisiones muertas del propio texto (Ley 5/1984, Reglamento 343/2003).
- `data/temas/13.html` (110 590 B, 26 apartados, 21 tablas, 2 SVG): Ley 5/2014, RD 2364/1994 solo en lo que
  la ley permite, Orden INT/859/2023 y Orden INT/315/2011. Marca que el art. 49.4 remite a la LO 15/1999,
  derogada por la LO 3/2018.
- `data/temas/15.html` (119 840 B, 25 apartados, 20 tablas, 3 SVG): Ley 8/2011 con la reforma de la LO 9/2022,
  RD 704/2011, RDL 12/2018, RD 43/2021, RD 311/2022. Hallazgo: el nombre legal es Catálogo Nacional de
  Infraestructuras **Estratégicas**, el Catálogo es secreto, la Ley 8/2011 no lleva régimen sancionador
  (está en el RDL 12/2018) y no consta transposición española de la NIS 2 ni de la Directiva 2022/2557.
- **Corrección al tema 10 ya publicado**: afirmaba una prohibición de entrada de «máximo 3 años» por
  devolución. El inciso del art. 58.7 de la LO 4/2000 está **declarado inconstitucional y nulo por la
  STC 17/2013** (comprobado en la nota del texto consolidado). Corregido en los cinco lugares donde
  aparecía (dos párrafos, una tabla, el SVG de la prohibición de entrada y el resumen).
- `programa.json` regenerado: 19 publicados, 26 pendientes, tres verificadores en verde.
- Scratch pendiente de borrar por el padre: `%TEMP%\t11`, `%TEMP%\t12`, `%TEMP%\t13`, `%TEMP%\t15` y
  `C:\tmp\t15` (vacío).
- Siguiente lote en el orden de L10: 19 y 22 (o 6 y 7 para cerrar los primeros del bloque A).

### L17 — lote 19, 22, 23, 24 y 25: 24 de 45 publicados

Con este lote el bloque A queda a falta de los temas 6 y 7.

- `19.html` (114 292 B, 19 apartados, 14 tablas, 3 SVG): CP títulos XXI y XXII. Corregido respecto a lo que
  dicen muchos manuales: las penas del atentado están en el 550.2 y 550.3 (el 551 es catálogo de
  agravaciones), la sedición de los arts. 544-549 está **suprimida** por la LO 14/2022, el 557 bis vigente es
  la ocupación de locales y la LO 1/2026 añadió el 568.2 (combustible líquido).
- `22.html` (99 458 B, 25 apartados, 26 tablas, 2 SVG): Ley 4/2015 y RD 1109/2015. Corrección de fondo: el
  párrafo del **art. 448 LECrim está suprimido por la LO 8/2021** y la regla de no confrontación vive en el
  **art. 707.2**, que además cubre a las víctimas. La norma de 27/04/2023 es la **LO 4/2023**, no una ley
  ordinaria, y no toca el Estatuto.
- `23.html` (119 944 B, 25 apartados, 24 tablas, 3 SVG): LO 3/2007, LO 1/2004, Ley 39/2006, Ley 4/2023 y
  discapacidad. Tres cambios recientes que invalidan manuales: el **art. 49 CE reformado el 15/02/2024**, la
  **Ley 4/2026** que deja el catálogo de la dependencia en **9 servicios** (no 6), y el umbral del plan de
  igualdad de empresa en **50** trabajadores, no 250.
- `24.html` (112 206 B, 20 apartados, 13 tablas, 3 SVG): conceptual. Corregido el identificador del cuadro de
  enfermedades profesionales: es `BOE-A-2006-22169`, no `BOE-A-2007-221`.
- `25.html` (169 765 B, 28 apartados, 19 tablas, 3 SVG): normativo. El **título oficial del RD 2/2006 no es
  el que trae el epígrafe del programa** («en la actividad de los funcionarios del CNP»), el RD 2/2006 remite
  al derogado RD 1488/1998 y los **arts. 46-52 de la LPRL están derogados** (la tipificación está en la LISOS).
- `programa.json` regenerado: 24 publicados, 21 pendientes, tres verificadores en verde.
- Scratch pendiente de borrar por el padre: `%TEMP%\t19`, `%TEMP%\t22`, `%TEMP%\t2302rP`, `%TEMP%\t24`,
  `%TEMP%\gpwMcxNs\garkA86L`, `%TEMP%\t25` y `C:\tmp\t22`.
- Siguiente: temas 6 y 7, con los que se cierra el bloque A.

### L18 — temas 6 y 7: el bloque A está completo (26 de 45)

- `06.html` (111 273 B, 23 apartados, 13 tablas, 3 SVG): TREBEP arts. 8-12 y 55-68, LO 9/2015 y la
  particularidad policial. Trampas: el art. 8.2 tiene **cuatro** clases y «funcionario en prácticas» no es
  una de ellas; la renuncia no inhabilita pero la separación sí; el art. 33 de la Ley 30/1984 está derogado
  y se sigue citando; la segunda actividad policial no es jubilación.
- `07.html` (99 871 B, 23 apartados, 12 tablas, 3 SVG): estructura del Ministerio del Interior. Confirma y
  amplía L7: **RD 207/2024** vigente y RD 734/2020 derogado; el **RD 328/2026** añadió la SG de Protección
  Civil y Emergencias y suprimió el art. 13; no existe «Gabinete de Coordinación y Estudios» (es Dirección
  General) ni «DG de Relaciones Internacionales, Migraciones y Extranjería» (es DG de Relaciones
  Internacionales y Extranjería); donde los manuales ponen una DG hay una SG de Instituciones Penitenciarias
  más una DG de Ejecución Penal y Reinserción Social.
- `programa.json` regenerado: 26 publicados, 19 pendientes (27-45), tres verificadores en verde.
- **Bloque A cerrado (temas 1-26).** Lo que queda son los bloques B (27-37, Ciencias Sociales) y C (38-45,
  Materias Técnico-Científicas), donde no hay una ley detrás de cada epígrafe y el estándar de S4 hay que
  adaptarlo con una decisión explícita del dueño antes de seguir.

### L19 — decisión de fuentes para los bloques B y C

Decisión del dueño (16/11/2026), elegida entre tres opciones:

> Solo fuentes primarias públicas, con cajas de límites

Se convierte en **D7**: en los temas 27-45, donde no hay una ley detrás de cada epígrafe, toda afirmación
debe salir de una fuente primaria pública (BOE cuando exista, INE, ministerios y organismos públicos, ONU
y sus organismos, OMS, OIT, RAE/ASALE para la lengua, Defensor del Pueblo, INCIBE). Lo que no tenga fuente
pública verificable se declara en la caja «Qué no se ha afirmado»; nunca se rellena con material de
academia ni con recuerdos del redactor. Los conceptos doctrinales (por ejemplo, los modelos explicativos de
la delincuencia) se presentan como tales, con la etiqueta de doctrina, no como hechos verificados.

Orden de trabajo para los 19 restantes: 27-30, 31-33, 34-35, 36-37 (bloque B) y 38-45 (bloque C).

- D8. La sección de psicotécnicos es **aparte**, con su propia entrada en la portada y su
  propia página `psicotecnicos.html`. No es el tema 46 del temario: no pertenece al Anexo I.
- D9. El progreso de psicotécnicos lleva **contador y mejor resultado propios**, separados
  del marcador del temario, para no contaminar el avance de los 45 temas.
- D10. **No se replica ninguna estructura oficial del psicotécnico**, porque no existe:
  BOE-A-2026-15055, base 6.1.3.c, solo dice «uno o varios test dirigidos a determinar las
  aptitudes (inteligencia general y específica) … con una duración total máxima de sesenta
  minutos», y deja el mínimo al tribunal. Lo único que sí se toma del registro oficial es ese
  techo de 60 minutos y el carácter apto/no apto. Los cinco dominios de ítem salen de los
  criterios de corrección publicados por el Ayuntamiento de Madrid (Policía Municipal, 2025:
  verbal, numérica, espacial, razonamiento y atención-percepción) y del material público del
  IVAP sobre pruebas psicométricas; la ortografía se añade porque el Anexo I la incluye como
  tema 37. Nunca se afirmará que esa mezcla es la del examen real.
- D11. Cronómetro: en entrenamiento se mantiene el reloj de **60 s por ítem** que ya usa el
  motor de test; en examen, **reloj global de 60 minutos** con 80 ítems (45 s por ítem), que
  es el techo oficial y la batería del ejemplo público de Madrid. Nada de recortar el reloj
  por ítem en el modo examen.
- D12. El banco de test se queda **congelado en 2 convocatorias (200 preguntas)**. Desde 2023
  los cuestionarios y plantillas oficiales están detrás de acceso autenticado (Mis
  Inscripciones, cl@ve o DNI + captcha en `sede.policia.gob.es/OPOSITA`), así que no hay URL
  pública que la Ley 37/2007 permita reutilizar; 2020 no tiene cuestionario publicado. Solo
  crece si el dueño aporta un modelo al que tenga acceso legítimo.

### L20 — bloque B (I): temas 27 a 30, 30 de 45 publicados

Primer lote redactado bajo **D7** (solo fuentes primarias públicas), y se nota: en estos temas la caja de
límites es más grande porque el material verificable es menor.

- `27.html` (109 477 B, 19 apartados, 19 tablas, 3 SVG): DUDH, Pactos, Convenio Europeo y sus protocolos,
  Convención contra la Tortura, OPCAT y el MNP del Defensor del Pueblo. Corregidos dos identificadores
  falsos de los que se barajaron y dos ELI mal derivados (los de los protocolos van por fecha del tratado,
  no de publicación).
- `28.html` (96 904 B, 23 apartados, 13 tablas, 3 SVG): el tema más conceptual del programa. Todas las
  cifras llevan organismo, año y enlace; UNCTAD, FMI y OCDE bloquearon el acceso automatizado (403) y por
  eso no hay ninguna cifra suya. Aviso: los dominios históricos del Foro Social Mundial ya no sirven
  contenido del Foro.
- `29.html` (109 813 B, 21 apartados, 20 tablas, 3 SVG): actitudes y valores. Psicología social marcada
  como doctrina, con las réplicas críticas de los experimentos clásicos junto al resultado original, y el
  dato del 14,1 % explicado con su advertencia (nacionalidad no es inmigración).
- `30.html` (112 497 B, 26 apartados, 18 tablas, 3 SVG): valores y delitos de odio. Separación explícita
  entre doctrina y ley; advierte de que **no existe una definición legal de «delito de odio»** en el CP y
  de que todas las cifras oficiales son hechos conocidos policialmente, no condenas. Corregido el
  identificador de la Ley 19/2007 (`BOE-A-2007-13408`, no `-13409`).
- `programa.json` regenerado: 30 publicados, 15 pendientes (31-45), tres verificadores en verde.
- Scratch pendiente de borrar por el padre: `%TEMP%\t27`, `%TEMP%\t28`, `%TEMP%\t29`, `%TEMP%\t30-ZwhK`,
  `%TEMP%\scratch30.txt`, `C:\tmp\t27` y `C:\tmp\t30-ZwhK`.

### L21 — bloque B (II): temas 31 a 35, 35 de 45 publicados

- `31.html` (109 546 B, 25 apartados, 19 tablas): inmigración con datos del INE, Eurostat y ACNUR. Trampa
  central bien separada: nacionalidad extranjera, persona nacida en el extranjero e inmigración no son lo
  mismo.
- `32.html` (109 970 B, 18 apartados, 11 tablas): geografía humana y demografía con **fórmula y ejemplo
  resuelto** para cada indicador, más siete ejercicios. Datos del INE y de la AEMA.
- `33.html` (109 490 B, 27 apartados, 14 tablas): seguridad, inseguridad y teorías criminológicas etiquetadas
  como doctrina con autor, año y límite. Datos del Ministerio del Interior (2025 y primer semestre de 2026) y
  del CIS. Aviso registrado: el balance anual y la serie anual de 2025 difieren en 1.831 hechos y no se
  explica la causa en las fuentes.
- `34.html` (102 094 B, 26 apartados, 18 tablas): drogodependencias con EDADES 2024 y ESTUDES 2025. Las dos
  definiciones de droga (sanitaria y jurídica por listas) van separadas desde el principio.
- `35.html` (109 964 B, 27 apartados, 22 tablas): desarrollo sostenible, con la definición literal de
  A/42/427 y los instrumentos de gestión ambiental en tabla norma/qué exige/qué tramita.
- `programa.json` regenerado: 35 publicados, 10 pendientes (36-45), tres verificadores en verde.
- Scratch pendiente de borrar por el padre: `%TEMP%\t31`, `t32`, `t33`, `t34.cEuw`, `t35`, `C:\tmp\t31` y
  `C:\tmp\t33`.
- Quedan el 36 y el 37 (lengua española) y los ocho del bloque C (38-45).

### L22 — bloque B cerrado y bloque C (I): temas 36 a 40, 40 de 45 publicados

- `36.html` (109 874 B, 28 apartados, 32 tablas): gramática desde el DLE, el GTG 2019 y la NGLE, con **tres
  oraciones analizadas** de principio a fin y la doble nomenclatura declarada (complemento directo / objeto
  directo).
- `37.html` (109 397 B, 26 apartados, 16 tablas): ortografía de la OLE 2010, regla por regla y con parágrafo,
  más 15 preguntas con la respuesta razonada.
- `38.html` (109 748 B, 25 apartados, 17 tablas): sistemas operativos y sistemas de archivos con **límites
  reales** tomados de Microsoft Learn, Apple, Android, kernel.org y POSIX; 44 URL comprobadas una a una.
- `39.html` (109 930 B, 25 apartados, 23 tablas): OSI y TCP/IP desde los RFC y X.200, con **tres ejercicios de
  subred resueltos** y la aritmética verificada contra un cálculo independiente.
- `40.html` (106 442 B, 22 apartados, 17 tablas): inteligencia y OSINT. Separa lo que el CNI publica de la
  ampliación doctrinal de tipologías, y avisa de que «OSINT no es hacking», con los preceptos de intimidad y
  prueba digital.
- `programa.json` regenerado: 40 publicados, 5 pendientes (41-45).
- Scratch pendiente de borrar por el padre: `%TEMP%\t36-Iqao`, `t37`, `t38`, `t39`, `t40`, `C:\tmp\t38`.

### L23 — temario completo: 45 de 45 publicados

- `41.html` (112 598 B, 19 apartados, 29 tablas): las 18 amenazas del epígrafe con ficha homogénea
  (qué es, cómo funciona, vector, objetivo, detección), actores, CaaS, kill chain frente a ATT&CK. INCIBE,
  NIST, OWASP, ENISA y Lockheed; el portal del CCN-CERT daba 403 y no se rellenó nada con eso.
- `42.html` (109 889 B, 24 apartados, 23 tablas): armas de fuego desde el Reglamento de Armas consolidado,
  con las nueve categorías, la documentación de cada una y la balística separada de la norma. Discrepancia
  declarada: el art. 113.1 atribuye la Tarjeta Europea a la DGGC y la ficha de trámite al jefe de Comandancia.
- `43.html` (99 477 B, 20 apartados, 15 tablas): vehículo prioritario con el Reglamento de Circulación **en
  vigor desde el 01/10/2026**, incluido el **art. 32** del carril de emergencia y la detención por luz roja
  (art. 69.2). Nada de cifras de velocidad: la norma habilita y no fija margen, y así se dice.
- `44.html` (112 544 B, 24 apartados, 19 tablas): seguridad activa y pasiva con el Reglamento UE 2019/2144 y
  los reglamentos UNECE como fuente, y la exención del cinturón del art. 119.2 RGC limitada a poblado.
- `45.html` (110 000 B, 24 apartados, 13 tablas): PRL vial con DGT 2025 e INSST 2024. La exclusión de los
  EPI del art. 2.2.c del RD 773/1997 y su resolución por el art. 6.2 del RD 2/2006 es la tesis del tema.
- `programa.json` regenerado: **45 publicados, 0 pendientes**. Los tres verificadores en verde.
- **El temario está completo.** Lo que queda para aspirar a un 10 no es contenido nuevo, es auditoría:
  (1) revisión jurídica independiente de los 45 temas, empezando por las cifras (L11);
  (2) ampliar el banco, bloqueado por el OCR y por el ©JURISPOL de 2023;
  (3) verificar a mano las 200 claves transcritas;
  (4) los psicotécnicos por algoritmo (T7), que hoy no existen;
  (5) la pasada visual del dueño, que ningún agente puede hacer sin navegador.
- Scratch pendiente de borrar por el padre: `%TEMP%\t41` (bajo `gpwMcxNs\ga874tDN`), `t42`, `t43`, `t44`,
  `t45`, `C:\tmp\t43`, `C:\tmp\t44` y `C:\tmp\t45`.

### L24 — encargo nuevo: psicotécnicos (preparación, sin implementar)

Petición del dueño (16/11/2026), literal:

> vale ya esta subido ahora hay que hacer psicotenicos temario de como pasarlos y los examenes
> psicotecnicos pero no hagas nada aun , solo quiero que dejes todo preparado para acontinuar mañana

Se añaden dos requisitos y **no se implementa nada todavía**: queda todo listo para empezar mañana.

- **S9.** "psicotenicos temario de como pasarlos": una guía de estudio, no un banco. Un apartado por tipo
  de prueba con qué mide, método paso a paso, un ejemplo resuelto a mano, las trampas típicas y el tiempo
  recomendado por ítem. Debe poder estudiarse sola, sin las pruebas delante.
- **S10.** "los examenes psicotecnicos": pruebas generadas por algoritmo, con la misma lógica que ya
  decidió D3 (nada copiado de academias, aleatorización infinita), conectadas al motor de sesiones que
  ya existe (modos, progreso en `localStorage`, racha, reto diario).

#### Plan de trabajo para mañana (orden de ejecución)

- **T25 · S9** · inline · `data/psicotecnicos/guia.html` (fragmento de cuerpo, mismo estándar de marcado
  que los temas): series numéricas y de letras, matrices y analogías gráficas, razonamiento verbal,
  ortografía, cálculo y problemas, con ejemplo resuelto y trampas en cada bloque.
- **T26 · S10,S3** · worker · `assets/js/psicotecnicos-core.js`: generador por tipos con dificultad
  parametrizada y **semilla determinista** (misma semilla, mismos ítems), solución única verificable y
  distractores plausibles, sin material de terceros.
- **T27 · S10,S3** · inline · Integración con el motor existente: entrenamiento por tipo, examen
  cronometrado con mezcla equilibrada, sin repetir ítem dentro de la sesión, progreso en `localStorage`.
- **T28 · S5,S6** · inline · `psicotecnicos.html`: misma CSP estricta, misma hoja de estilos, guía arriba
  y lanzador de pruebas debajo; entrada nueva en la portada.
- **T29 · S1** · inline · `scripts/verificar-psicotecnicos.mjs` con aserciones deterministas (semilla
  fija → mismos ítems; solución única; dificultad monótona; ningún ítem repetido en la sesión) y puerta
  en el build, junto a los tres verificadores actuales.
- **T30 · S6** · verify · Verificación funcional: cronómetro, corrección, progreso y exportar/importar.

#### Decisiones que hay que cerrar antes de escribir código (D8-D11)

- **D8.** ¿La guía de psicotécnicos va dentro de la sección de temario como un 46.º documento, o es una
  sección aparte con su propia entrada en la portada?
- **D9.** ¿El progreso de psicotécnicos cuenta en el mismo marcador que el temario, o lleva su propio
  contador y su propio mejor resultado?
- **D10.** ¿El examen psicotécnico replica la estructura oficial (número de ítems, orden y tiempo) o se
  ofrece libertad de configuración? Si se replica, hace falta la fuente oficial del cuestionario.
- **D11.** ¿Cronómetro por prueba o por bloque completo? El motor actual ya cronometra a 60 s por
  pregunta: hay que decidir si esto se mantiene aquí o se cambia.

**Estado del temario al cerrar**: 45 de 45 publicados, tres verificadores en verde. Nada de este encargo
está implementado: no se ha creado ningún fichero de psicotécnicos.

### L25 — «si hazlo»: psicotécnicos en marcha, y el banco de test se queda congelado

Petición del dueño (17/11/2026), literal:

> continua faltaba preparar psicotecnicos y continuar con el los tipo test de más años , no???

Antes de escribir código se buscó el marco oficial (solo lectura, sin descargas). Resultados que cambian el
plan de L24:

- **El nombre oficial es «Test psicotécnicos», parte c) de la tercera prueba** (base 6.1.3.c de
  BOE-A-2026-15055, Resolución de 7/07/2026). No existe «ejercicio psicotécnico» ni «prueba de
  aptitudes» como prueba propia. Cita: «uno o varios test dirigidos a determinar las aptitudes
  (inteligencia general y específica) … teniendo una duración total máxima de sesenta minutos».
- **No fija número de ítems, ni tipos, ni orden**: solo el techo de 60 minutos y la fórmula
  `[A–E/(n–1)]·10/P`, con el mínimo a criterio del tribunal. Por eso D10 se cierra en «no se replica».
- **El psicotécnico no puntúa**: base 6.11, la calificación de la oposición es conocimientos + aptitud
  física; el psicotécnico solo desempata (apto/no apto). Y base 6.7: la primera prueba y los
  psicotécnicos van en acto único. Lo que decide es el examen de conocimientos: 100 ítems en 50
  minutos, mínimo 3 y corte de 1,75 aspirantes por plaza.
- Material público reutilizable para la guía: criterios de corrección del Ayuntamiento de Madrid
  (Policía Municipal 2025, cinco dominios, 80 preguntas con 4 opciones) y el documento del IVAP
  *Pruebas de evaluación psicométrica* (ítems resueltos y baremos).

Segundo frente, el banco. La respuesta del dueño fue «no hagas nada busca de web oficial y no descargues
nada». Resultado: 2020 (p37) sigue sin cuestionario publicado; 2023 (p40), 2024 (p41), 2025 (p42) y 2026
(p43) publican plantillas y modelos **solo tras acceso autenticado** («Mis Inscripciones», cl@ve o DNI y
captcha individualizado en `sede.policia.gob.es/OPOSITA`). No hay URL pública ni en `boe.es` ni en
`datos.gob.es`, así que la reutilización de la Ley 37/2007 no es viable: queda **D12**, banco congelado.

Decisiones del dueño para desbloquear la implementación:

> si hazlo y como hacemos para los test ??

Se cierran D8 a D11 con los valores por defecto recomendados (sección aparte, contador propio, sin
estructura oficial, 60 s por ítem en entrenamiento y reloj global de 60 minutos en examen) y arranca el
lote T25-T29.

### L26 — la atribución del banco, sin enlace

Petición del dueño, literal:

> por cierto no pongas en los test el enlace al cuestionario oficial que no quiero que se vea la imagen de
> jurispol jurispol no pongas el enlace ese

La página de test renderizaba un enlace «Cuestionario oficial» a la URL del fichero del que se extrajeron
las preguntas. Se retira el enlace: la atribución pasa a texto y nombra al organismo que publica el
cuestionario (Dirección General de la Policía, Área de Procesos Selectivos), así que la Ley 37/2007 se sigue
cumpliendo sin publicar dónde está alojado el PDF. Las URL de procedencia se quedan en
`data/examenes/FUENTES.md` y en el campo `fuente` de cada banco, que la página ya no pinta.

Se observó en rojo antes del arreglo (`git show HEAD:assets/js/test.js` seguía teniendo `href: banco.fuente`)
y en verde después: `verificar-test.mjs` suma dos comprobaciones (la página no enlaza el fichero; la
atribución nombra al organismo) y pasa de 96 a 98. Commit `0fced07`.

### L27 — psicotécnicos entregados (T25-T29), T30 a la espera de un navegador

Entregado en la rama `feat/psicotecnicos`, en cinco unidades de trabajo:

- `0fced07` · atribución del banco sin enlace (L26).
- `cdcca04` · `data/psicotecnicos/guia.html` (110 447 B, 16 apartados, ocho dominios, tres SVG).
- `35cbf2e` · `assets/js/psicotecnicos-core.js` (generador determinista, ocho tipos, seis dominios).
- `2a4362e` · `psicotecnicos.html` + `assets/js/psicotecnicos.js` (tres modos, contador propio) y la
  entrada nueva en la navegación de las cuatro páginas.
- `1999f0d` · `scripts/verificar-psicotecnicos.mjs` como cuarta puerta del build.

**La revisión independiente encontró trece defectos reales y se corrigieron todos** (`9f8467a`), entre ellos
tres graves: el modo examen enseñaba el recuento de aciertos en curso (delataba si habías acertado), el
reloj del examen contaba ticks en vez de medir contra una hora límite (en pestaña de fondo se alargaba sin
fin), y la importación de progreso aceptaba decimales y tipos inventados y dejaba `undefined %` en pantalla
con el récord bloqueado para siempre. También se corrigió que la puerta tuviera dos aserciones tautológicas:
la mutación «El examen oficial consta de 80 ítems y 45 segundos por ítem, con la estructura oficial» pasaba
en verde y ahora sale en rojo en la página y en la guía.

**Estado de verificación**: cuatro verificadores en verde — `verificar.mjs` (45 temas, sin errores
estructurales), `verificar-examenes.mjs` (2 convocatorias, 200 preguntas), `verificar-test.mjs` (98
comprobaciones) y `verificar-psicotecnicos.mjs` (87 comprobaciones).

**Lo que ningún agente puede comprobar aquí**: no hay navegador. Contraste, foco visible, comportamiento real
de `aria-live`, descarga del export, composición a 360 px y el estrangulamiento del reloj en pestaña de fondo
quedan en manos del dueño. La lista concreta de siete comprobaciones manuales está en el informe de la
revisión: (1) en examen, responder y mirar el marcador; (2) esperar 60 s en entrenamiento y leer el repaso;
(3) mantener pulsada la tecla `1`; (4) cambiar de pestaña durante el examen; (5) escuchar la región viva al
agotarse el tiempo; (6) bloquear el almacenamiento del sitio y terminar una sesión; (7) pasada visual a
360 px.

**Pendiente y declarado**: T30 (prueba funcional en navegador), una prueba de sesión con stub de DOM —hoy la
lógica pura está cubierta pero el efecto visible no—, la revisión humana del contenido curado del generador
(las 55 entradas de ortografía y los 37 conceptos de analogía, que el código valida en estructura pero no en
exactitud) y la pasada visual del dueño, que sigue pendiente desde L11.

Scratch de los redactores y del verificador: borrado por el padre. Ningún temporal dentro del árbol.

### L28 — «continúa con lo que falta»: inventario y primer lote de la auditoría jurídica

Petición del dueño, literal:

> vale ahora continua con lo que falta en la web , que falt a??

Inventario honesto de lo que queda, por valor:

1. **Auditoría jurídica de los 45 temas** (T31). Es el hueco grande: los cuatro verificadores no comprueban
   verdad jurídica, así que un número de artículo equivocado pasa todas las puertas. Se hará por lotes, dos
   temas por lote, empezando por los de más peso.
2. **Verificar a mano las 200 claves** del banco (L10). Las plantillas son escaneos sin capa de texto: la
   prueba independiente exige abrir la imagen y transcribir otra vez. Sin OCR no hay atajo.
3. **Banco congelado** (D12). Necesita que el dueño aporte un modelo desde Mis Inscripciones.
4. **Pasada visual** de las cuatro páginas y de la sección nueva, que ningún agente puede hacer sin navegador.
5. **Contenido curado del generador** (T32): 55 entradas de ortografía y 37 conceptos de analogía revisados a
   mano, más el reflejo que falta en el tipo «matriz».
6. **T30**, la prueba funcional en navegador de los psicotécnicos.

Antes de arrancar el lote se cerró un defecto de estilo que estaba abierto desde L12: los temas 1 y 4 usaban
`<em>` (siete y cinco veces) y Lexend no tiene cursiva, así que el navegador la fingía. Se sustituyeron por
`<strong>` los énfasis reales y por texto plano los términos latinos y los nombres de sentencias
(*Van Gend en Loos*, *Costa/ENEL*, *Faccini Dori*, *Francovich*). `verificar.mjs` gana la comprobación que lo
habría cazado: ningún tema publicado ni la guía pueden usar `<em>` ni `<i>`.

Sigue pendiente de decisión del dueño: la rama `feat/psicotecnicos` no se ha subido ni fusionado.

### L29 — auditoría jurídica, lote 1: temas 21 y 18

Método fijado para todos los lotes de T31: lectura del texto **consolidado** del BOE por streaming
(`curl | grep`, cabecera XML de la API de datos abiertos), sin guardar un solo fichero, y clasificación de
cada cita en correcta / incorrecta / no verificable con la frase literal que lo demuestra o lo contradice.
Sólo se corrige lo que el BOE contradice, con cambio mínimo. Dos avisos de método que hay que recordar:

- El campo `fecha_actualizacion` de la API **no** es la fecha de la ficha: hoy devuelve el día de la consulta
  para normas que no han cambiado. La fecha de consolidación se lee en la ficha HTML.
- `boe.es` sirve el texto consolidado de forma fiable por `curl`; lo que bloquea son los portales de
  `interior.gob.es`.

**Tema 21 · 131 preceptos de 10 normas auditados, 4 correcciones** (commit `5d3a608`):

1. La entrada en vigor de la LO 1/2025 tiene **un adelanto y un retraso**, no dos adelantos.
2. El EOMF es la **Ley** 50/1981, no «Ley Orgánica 50/1981» (la ficha del BOE declara rango «Ley»).
3. El art. 9 LECrim se remite al **art. 801**, no a la ejecución de las secciones de vigilancia
   penitenciaria. La glosa antigua era una lectura de manual.
4. La tabla de decisión de §9.3 citaba el art. 490 como «podrá detener» cuando el Código dice
   «Cualquier persona **puede** detener». Era la única **cita fabricada** del tema y estaba en la tabla que
   decide la respuesta, no en el cuerpo.

Quedaron sin tocar, por no ser contradicción comprobable y requerir decisión humana: la fianza del art. 492
en los números 3 y 4, el rango de edad 14-18 de la Sección de Menores (viene de la LO 5/2000, que no está en
las fuentes del tema) y la mención de «casación» en la competencia del TSJ.

**Tema 18 · 39 bloques verificados, 0 correcciones.** Los umbrales (400 / 50.000 / 250.000 €), las penas de
los artículos 234 a 256, la regla del art. 268 y los actos preparatorios del 269 coinciden con el texto
consolidado, y la fecha declarada (09/04/2026) sigue siendo la última actualización publicada. Quedan tres
imprecisiones de redacción reportadas sin corregir: el encuadre de los capítulos VII-XIV en el mapa SVG, la
nomenclatura «apartado tercero» del art. 248 y la caracterización de la multa del 252/253.

**Cola de auditoría** (43 temas restantes), por peso: 26 y 17 · 20 y 10 · 6 y 7 · 11 y 12 · 13 y 15 · 22 y 23 ·
19 y 24 · 25 · 27 y 28 · 29 y 30 · 31 y 32 · 33 y 34 · 35 y 36 · 37 y 38 · 39 y 40 · 41 y 42 · 43 y 44 · 45 ·
1 y 2 · 3 y 4 · 5 y 8 · 9 y 14 · 16. Un tema por auditor y dos auditores por lote; el informe se cierra con la
tabla de citas y las correcciones, no con prosa.

### L30 — auditoría jurídica, lote 2: temas 26 y 17

**Tema 26 · ~160 preceptos auditados, 3 correcciones** (commit `dd2584b`):

1. **La edad del RGPD estaba invertida** (Trampa 6): el art. 8.1 fija 16 años y permite a los Estados bajarla
   **hasta 13**, no «bajar hasta los dieciséis». Era la trampa del tema y estaba mal.
2. Art. 78.1 de la LO 3/2018: es prescripción de **sanciones**, no de infracciones (esas son los arts. 72-74).
3. El desarrollo normativo es la **DF 15.ª**, no la DA 15.ª (que es el requerimiento de la CNMV).

Fechas de consolidación confirmadas en la ficha HTML (27/12/2025 y 29/07/2022). Reportado sin tocar: el art. 9.2
lista ocho circunstancias cuando tiene diez letras, el art. 12.7 omite una salvedad y la lista de artículos
modificados de la LO 3/2018 omite el 76.

**Tema 17 · 5 correcciones** (commit `dd2584b`), y dos de ellas habrían costado puntos:

1. **Régimen de la prisión permanente revisable** (arts. 36.1 y 92.1): el tercer grado llega a los **15 años**
   (20 si es terrorismo), los permisos a los **8** (12 en terrorismo) y los **25 años** son para la suspensión,
   no para el tercer grado ni para los permisos. El tema tenía las tres cifras desplazadas.
2. La enumeración del art. 379 recogía temeridad manifiesta y conducción sin permiso, que están en el **380**
   y en el **384**.
3. La cita literal del art. 147.1 llevaba una coma añadida que la volvía infiel.
4. El art. 173.1 añade **tres** conductas, no cuatro.
5. El glosario llamaba «otra ley» al art. 57.1, que es del propio Código.

Reportado sin corregir por requerir criterio: la clase del delito del art. 163.1, la atribución de la LO 11/2022
al 142, el alcance del art. 17 de la LO 2/2010 y la numeración de párrafos del 169.1.º.

**Estado de T31**: 4 de 45 temas auditados (21, 18, 26, 17), 12 correcciones, tres de ellas en trampas de
examen. Quedan 41 en la cola de L29.

### L31 — imagen nueva, fuera los rastros de obra, y auditoría de los temas 20 y 10

Petición del dueño, literal:

> pues ponte con lo que falte quita lo de publicado obviamente quita las cosas que indiquen que estaba en
> desarrollo hazlo profesional y pon algun color más vivo que está muy apagada la página

**Interfaz** (commit `effb56c`). Con los 45 temas escritos, el estado por tema sobraba: el índice ya no sondea
la existencia de cada fichero, no pinta la insignia «Publicado / En preparación», no cuenta publicados, no
deja hueco para el tema inexistente y el reto diario ya no dice «pendiente». Se borraron las seis reglas CSS
que quedaron sin uso. Los contadores del héroe pasan a «45 temas · 3 bloques · convocatoria» y cada bloque a
«N temas».

**Paleta.** El crema y el azul marino eran apagados. Ahora hay un azul saturado de acento, un acento cálido
para la acción principal, tintes por bloque y un borde de control que sí llega al umbral de 3:1. El contraste
se midió par a par en los dos esquemas: el único que incumplía AA era el título del aviso (2,20:1) y ahora
está en 5,16:1; el resto supera 4,5:1 en texto y 3:1 en controles. Se añadieron tres comprobaciones a
`verificar.mjs`: ni un texto de estado de obra en la interfaz, cada token declarado una vez por esquema, y
ninguna clase usada sin regla. Si alguien vuelve a meter una insignia o borra un token, el build falla.

**Sigue pendiente y es visible**: las ilustraciones SVG (`assets/img/portada.svg` y `bloque-*.svg`) conservan
la paleta anterior. La banda tintada del héroe hace que el cuadrado claro del emblema se funda con el fondo:
queda como T33.

**Auditoría, lote 3** (temas 20 y 10, ocho correcciones):

- **Tema 20 · delitos informáticos** (commit `db06478`). La trampa central estaba a medias: la estafa
  informática sí está en el **249.1.a** y el 248.2 ya no existe, pero el trasvase lo hizo la **LO 14/2022**, no
  la LO 1/2015. El error estaba en tres sitios, incluida la lista de fuentes, que además atribuía a la LO
  14/2022 la reforma del 250 cuando toca el 248. La agravante del apartado 3 de los daños informáticos cubre
  el **264 y el 264 bis**, no tres artículos.
- **Tema 10 · extranjería** (commit `c441164`). La prohibición de entrada de tres años por devolución se había
  corregido en cinco lugares, pero **quedaban dos vivos**: la Trampa 10 y la lista de repaso de cinco
  minutos. El inciso del art. 58.7 está anulado por la STC 17/2013 y el quebrantamiento solo reinicia el
  cómputo, así que la respuesta correcta es que no hay plazo propio. Además: los supuestos de colaboración
  con la justicia son los arts. **311 a 318 y 510**, no 311 a 315, y el órgano competente en los demás casos
  es la **Dirección General de Gestión Migratoria** (art. 130.4 del Reglamento).

**Estado de T31**: 6 de 45 auditados (21, 18, 26, 17, 20, 10), **20 correcciones**. Quedan 39: la cola sigue
por 6 y 7, 11 y 12, 13 y 15, 22 y 23, 19 y 24, 25, y los bloques B y C.

### L32 — lote 4, ilustraciones repintadas, y el tema 6 sale limpio

- **Tema 6 · estatuto de los funcionarios: 0 correcciones** sobre ~65 preceptos del TREBEP, la LO 9/2015 y la
  LO 2/1986. Las cinco trampas del tema están bien resueltas en prosa, tablas, los tres SVG, trampas,
  autoevaluación y resumen. Seis imprecisiones de redacción reportadas sin tocar, entre ellas que el capítulo
  de segunda actividad de la LO 9/2015 llega al art. 74 y el tema cita «66 a 71», y que el tope de seis meses
  del art. 98.3 debería convivir con los tres meses del régimen policial del art. 65.2.
  Aviso de método: el identificador `BOE-A-2015-10565` que se le dio al auditor **no es el TREBEP** (es la Ley
  39/2015); el correcto, que el tema ya usaba, es `BOE-A-2015-11719`. Confirma la regla de L25: los ELI escritos
  de memoria se comprueban siempre.
- **Tema 7 · estructura del Interior: 2 correcciones** (commit `4780e37`). El art. 55.6 de la Ley 40/2015
  excluye expresamente a los subdirectores generales de la condición de alto cargo, y el nombramiento de los
  directores generales de Policía y Guardia Civil se rige por el **art. 64.3** al que remite la DA 1.ª del RD
  207/2024, no por el 66.2. Confirmados los tres hallazgos que el tema ya declaraba: RD 734/2020 derogado,
  inexistencia del «Gabinete de Coordinación y Estudios» y de la «DG de Relaciones Internacionales, Migraciones
  y Extranjería», y la supresión del art. 13 por el RD 328/2026.
- **Ilustraciones (T33, commit `1ed5662`)**: los seis SVG se repintaron con los tokens reales y el emblema de la
  portada gana un anillo de 6 px que lo separa de la banda tintada (5,4:1). Treinta y cinco pares de color
  medidos, ninguno por debajo de 3:1. De paso se corrigió un **XML inválido**: `portada.svg` tenía un comentario
  con guion doble, que un analizador XML rechaza. Queda anotado que los SVG van en `<img>` y por tanto mantienen
  su paleta fija en modo oscuro, igual que antes.

**Estado de T31**: **8 de 45 temas auditados** (21, 18, 26, 17, 20, 10, 6, 7) y **22 correcciones**. Siguiente
lote: 11 y 12, y después 13 y 15, 22 y 23, 19 y 24, 25, y los bloques B y C.

### L33 — lote 5: temas 11 y 12

- **Tema 11 · régimen sancionador de extranjería** (commit `2fb3ad6`), 2 correcciones de cita: la asistencia
  letrada no se apoya en el art. 63 bis (que solo regula el procedimiento ordinario, el plazo de cumplimiento
  voluntario y la excepción del internamiento) y una celda llamaba reglamento al art. 63.4 de la ley. El
  catálogo letra por letra, las escalas de multa, las prescripciones y los cuatro relojes del procedimiento
  coinciden con el texto consolidado. Reportado sin tocar: la glosa del CP en §7.2 parece desplazada (el 312.1
  habla de tráfico ilegal de mano de obra) y la fila de Menores omite la salvedad del art. 62 bis 1.i).
- **Tema 12 · asilo** (commit `6dfca6a`), 4 correcciones, una de fondo y en dos sitios: el **orden público no
  es causa de denegación del asilo**. El art. 9 de la Ley 12/2009 solo deniega por peligro para la seguridad de
  España o por condena firme grave con amenaza para la comunidad; el tema lo afirmaba en prosa y en una trampa.
  También se corrigió la equivalencia con el art. 35.3 de la LO 4/2000 (regula la determinación de edad y no
  dice nada de negarse al reconocimiento) y el alcance del RD 220/2022, que llega al art. 53 y no al 32.
  Las remisiones muertas del propio texto legal (Ley 5/1984, Reglamento 343/2003, Directivas 2004/83 y
  2005/85) se dejan tal cual: decir que están muertas es la respuesta correcta.

**Estado de T31**: **10 de 45 temas auditados**, **28 correcciones**. Siguiente lote: 13 y 15.

### L34 — cierre de sesión: qué hay hecho, qué está sin subir y cómo arrancar mañana

Petición del dueño, literal:

> sigue y deja preparado para empezar mañana me da queda una hora para un cambio más y cuando termines dejalo
> listo para empezar mañana

Y su pregunta posterior: «y estas pusheando las cosas automaticamente sin preguntarme ??».

**Estado del trabajo**: la rama `feat/psicotecnicos` se subió al remoto el mismo día, a petición del dueño, después de
que su propio `git push` dijera «todo al día». La causa de esa confusión: el remoto solo tenía `main`, y `main`
local estaba idéntica a `origin/main`; los commits vivían en una rama que el remoto no conocía y sin upstream
configurado, así que el `push` no tenía nada que actualizar en la rama que estaba empujando. Se subió con
`git push -u origin feat/psicotecnicos`. La rama queda en el remoto y **sin fusionar**: `main` sigue en `40659ba`
y GitHub Pages publica desde `main`, así que la web en producción aún no muestra nada de este trabajo. El cambio
está en https://github.com/DaniAV03/oposicion-policia-nacional/pull/new/feat/psicotecnicos y fusionarlo es
decisión del dueño.

**Lote 6**: el tema 13 se auditó (4 citas corregidas: la competencia de la LO 2/1986 está en el 12.1.A).g) y no
en un inexistente 12.1.G), y la acreditación del profesorado añade el art. 12.1.e). El tema 15 **se quedó a
medias**: el auditor se colgó tras cuatro minutos en una llamada al BOE y no dejó ningún cambio en el árbol. No
se reintenta solo: queda como primer trabajo de la próxima sesión, con el encargo ya escrito en L29.

**Cómo arrancar mañana**, en este orden:

1. Leer este documento hasta aquí.
2. `git status` debe salir limpio y `git log --oneline -3` debe mostrar el último commit del cierre. Si hay
   cambios sin commitear, algo quedó a medias.
3. Ejecutar los cuatro verificadores: `node scripts/verificar.mjs`, `scripts/verificar-examenes.mjs`,
   `scripts/verificar-test.mjs` y `scripts/verificar-psicotecnicos.mjs`. Los cuatro deben salir en verde antes de
   tocar nada.
4. Retomar el lote 6 con el **tema 15** y seguir con 22 y 23, 19 y 24, 25, y después los bloques B y C.
5. Decidir lo que solo puede decidir el dueño: subir la rama, abrir el cambio o fusionar; pasarme un modelo de
   examen desde Mis Inscripciones para ampliar el banco; y la pasada visual en navegador, que sigue pendiente
   desde L11 y ahora incluye la paleta nueva y las ilustraciones.

**Deudas declaradas y visibles**: T30 (prueba funcional en navegador), T32 (revisión humana de las 55 entradas de
ortografía y los 37 conceptos de analogía del generador) y la prueba de sesión con stub de DOM, que es lo único
que separa la lógica pura de la interfaz de estar cubierta. El reflejo que falta en el tipo «matriz» también
sigue anotado.
