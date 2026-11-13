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

### L6 — fuente autoritativa del programa

El índice de una academia usado en el primer intento tenía la columna de numeración
corrupta: los temas 27-37 aparecían desplazados. Localizada la fuente oficial citada en
las bases: BOE-A-2026-15055, de 10 de julio de 2026, Anexo I, con PDF descargable
(`https://www.boe.es/boe/dias/2026/07/10/pdfs/BOE-A-2026-15055.pdf`). Extracción limpia:
45 temas, numeración 1-45 sin huecos, tres bloques correctos.
