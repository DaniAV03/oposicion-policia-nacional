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
