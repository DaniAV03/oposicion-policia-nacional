# Web solo teórica: fuera psicotécnicos y banco de test nuevo

La web deja de cubrir los psicotécnicos y queda como temario teórico más banco de test
teórico, con tres recorridos: por tema (preguntas propias), oficiales (cuadernillos
completos por año y mezcla) y no oficiales (banco propio, difícil y docente).

Stack sin cambios: HTML + CSS + módulos ES nativos, sin build, en GitHub Pages.

## Specs

- **S1.** "los 45 temas no lo borres , la app va a ser los 45 temas ya subidos": los 45
  temas se quedan tal como están. Esta función no toca el temario; el temario es el
  producto.
- **S2.** "borratodo lo que lleve psicotecnicos y vamos a centrarnos en el examen teorico
  solo en la web": se elimina la sección psicotécnica entera —página, módulos, guía,
  verificador, entradas de navegación, textos legales y paso de CI— y no queda ninguna
  referencia viva a ella. Las menciones a «psicotrópicos» y «psicoticismo» del temario son
  contenido normativo y **no** se tocan.
- **S3.** "haz test por tema generados por ti para que la gente se aprenda el tema ese
  vale ?? osea tipo test por tema para que la gente aprenda ese tema de memoria gracias a
  esos tipo test": cada uno de los 45 temas tiene su propio test de preguntas escritas por
  el agente, docentes: toda pregunta lleva explicación y referencia a la sección del tema.
- **S4.** "al darle al apartado test , tiene que haber dos ventanas , botones como en los
  temas una para oficiales y otra para no oficales que cada una te lleve a su respectiva
  página": el apartado Test es una portada con dos accesos, uno a la página de oficiales y
  otro a la de no oficiales, con el mismo patrón visual que la rejilla de temas.
- **S5.** "en los oficiales podran hacer tipo test por de las preguntas oficiales por año ,
  y examenes mezclados de todos los años con las preguntas": los oficiales se ofrecen por
  convocatoria completa (2021/p38 y 2022/p39) y como mezcla de todos los años. Los
  cuadernillos oficiales **no** se clasifican por tema.
- **S6.** "los no oficiales , no los hagas por años genera tu las preguntas que las
  preguntas toquen todo porfavor en los no oficiales para aprender y que sean dificiles con
  algunas trampa pero para aprender y examinar de forma docente": banco propio sin año,
  que cubre todo el programa, con dificultad declarada y trampas deliberadas, escrito aparte
  del banco por tema y con preguntas que cruzan dos temas. Una sola respuesta defendible
  por pregunta.
- **S7.** "hacer una automatización que te diga que tema llevas mal segun los test que
  falles y si falla varias veces la misma pregunta hacer alerta de siempre fallas en esta
  pregunta estudiar esta parte y esta parte": panel de puntos débiles en `localStorage`, con
  alerta por pregunta quemada y por tema flojo, mostrando siempre el recuento junto al
  porcentaje.
- **S8.** "en el podcast haz la opcion A": lectura del tema en voz alta con
  `SpeechSynthesis` del navegador. Sin ficheros de audio y sin servicio externo.
- **S9.** "decorarla con colores más vivos , un azul maás claro pero mate o pastel pero no
  tan claro ni tan oscuro": paleta azul pastel mate, redefinida en los tokens de
  `assets/css/style.css`, con contraste verificado.
- **S10.** Sigue vigente la regla de autoría del proyecto: nada se copia de temarios ni de
  bancos de academias. Toda pregunta nueva se escribe desde la fuente legal (BOE, EUR-Lex)
  y desde la sección correspondiente del temario.

## Tasks

- T1 · S2 · inline · Quitar psicotécnicos: cinco ficheros, navegación de cuatro páginas,
  verificador, CI y textos de atribución. Hecho en `4964c02`.
- T2 · S9 · inline · Paleta azul pastel mate en los tokens de `style.css`, con contraste
  verificado. Hecho en `e2c078e`: base fría, ilustraciones remapeadas, cuatro tokens
  `--sobre-*` y `scripts/verificar-contraste.mjs` como cuarta puerta del build.
- T3 · S3,S5,S6 · inline · Esquema del banco, manifiesto y `scripts/verificar-banco.mjs`. Hecho
  en `869e6ff`: esquema en `data/banco/ESQUEMA.md`, manifiesto vacío y verificador con
  autoprueba de 18 casos, ya como quinta puerta del build.

Nota de esquema: los temas no tienen anclas por sección (solo dos figuras llevan `id`), así
que `referencia.apartado` cita el **texto exacto de un `<h2>` o `<h3>`** del tema y el
verificador comprueba que existe. Añadir anclas a los 45 temas queda para cuando T9
necesite enlazar a un apartado concreto.
- T4 · S3 · inline · Piloto de contenido: 3 temas (uno por bloque) × 12 preguntas, a
  revisión del dueño antes de seguir. Hecho en `cdc068d`: temas 1, 27 y 38, 36 preguntas.
  Reparto 4-4-4 de opción correcta y 4-4-4 de dificultad en cada tema. **La revisión del
  dueño es la puerta de T6**: no se escriben las 42 tandas restantes hasta que apruebe el
  patrón.
- T5 · S4 · inline · Portada de Test con dos accesos y las páginas de oficiales y no
  oficiales. Hecho en `59a76e0`. Decisiones tomadas: un solo motor parametrizado por
  `data-coleccion` en el `<body>`; las tarjetas son enlaces que aplican filtro, no arrancan el
  test; el banco propio se desglosa por tema porque `test-core.js` no se toca; enlaces
  profundos `?convocatoria=2021`, `?tema=1` y `?tema=mezcla`; la `explicacion` se muestra en la
  corrección y en el repaso cuando la pregunta la trae. `tema.html` recibió el `aria-current`
  que le faltaba.
- T6 · S3 · worker · Resto de temas en tandas. Hecho en seis confirmaciones: `cad6ee6` (2-7),
  `5b9eb49` (8-15), `1855ecb` (16-23), `cb6e7c4` (24-32), `03cbffb` (33-41) y `eff0726`
  (42-45). Los 45 temas tienen sus 12 preguntas: 540 en total, todas con apartado existente,
  reparto 4-4-4 y explicación docente. Sin revisión humana por tanda (L5).
- T7 · S6 · worker · Banco no oficial mezclado, cruzando temas. Hecho en `0c19847`: 120
  preguntas en `data/banco/mezcladas/mezcla.json`, cada una cruzando dos temas, ninguna de
  dificultad baja, y reparto de los 45 temas entre los cruces.
- T8 · S7 · inline · Panel de puntos débiles y alertas. Hecho en `8b56f88`: campo aditivo
  `porPregunta` en el almacén de siempre, `assets/js/diagnostico.js` sin DOM, umbrales
  exportados y panel en `no-oficiales.html`. `verificar-test.mjs` pasa de 98 a 128
  comprobaciones.
- T9 · S8 · inline · Lectura en voz alta del tema. Hecho en `3128a3f`: `assets/js/tema-lectura.js`
  con `SpeechSynthesis`, por frases, sin audio ni servicio, con posición recordada por tema.

Corrección encontrada por el contenido: `b35d28e` arregla el verificador del banco, que al
pasar las opciones a minúsculas marcaba como duplicadas dos opciones de una pregunta de
ortografía que sólo se diferenciaban en la mayúscula.

## Entrega

La rama `feat/psicotecnicos` se fusionó en `main` con *squash*, a petición del dueño, y después
se borró en local y en el remoto. El historial de `main` no contiene ninguna confirmación de
la sección psicotécnica: el alta y la baja se cancelaron en el diff neto, así que lo que
`main` ganó es el temario con las citas corregidas, el repintado y la mejora del motor de
test. Solo queda `main`.

`main` publica en GitHub Pages. El envío de los commits posteriores a la fusión queda a
decisión del dueño.

## Log

### L1 — encargo inicial: solo teórico, y cuatro ideas

> no hagas nada de momento quiero dejar la web esta solo y plenamente solo para test , me
> voy a centrar en la teoria solo , nada de psico tecnicos asique borratodo lo que lleve
> psicotecnicos y vamos a centrarnos en el examen teorico solo en la web vale : ideas para
> seguir : decorarla con colores más vivos , un azul maás claro pero mate o pastel pero no
> tan claro ni tan oscuro y estas ideas : Quitar psicotecnicos, meter examenes por temas ,
> hacer una automatización que te diga que tema llevas mal segun los test que falles y si
> falla varias veces la misma pregunta hacer alerta de siempre fallas en esta pregunta
> estudiar esta parte y esta parte , y mirar si se pueden hacer podcast de cada tema para
> que lo puedan poner de escuchar con una voz de ia

Decisión tomada en la respuesta: el temario no se toca; «solo teórico» significa fuera
psicotécnicos, no fuera temario. El dueño lo confirma en L2.

### L2 — el temario se queda, y los test se parten en tres

> claro los 45 temas no lo borres , la app va a ser los 45 temas ya subidos , y los tipo
> test de los temas tanto generados por ti , tanto los oficiales que podamos sacar , haz
> test por tema generados por ti para que la gente se aprenda el tema ese vale ?? osea tipo
> test por tema para que la gente aprenda ese tema de memoria gracias a esos tipo test ,
> vale ?? los generales vamosa poner dos opciones (test oficales , y no oficiales ) en los
> oficiales podran hacer tipo test por de las preguntas oficiales por año , y examenes
> mezclados de todos los años con las preguntas, y los no oficiales , no los hagas por años
> genera tu las preguntas que las preguntas toquen todo porfavor en los no oficiales para
> aprender y que sean dificiles con algunas trampa pero para aprender y examinar de forma
> docente en el podcast haz la opcion A ahora propon de nuevo sabiendo esto

Decisión tomada: los test por tema son de autoría propia, no oficiales. El podcast va por
la opción A (voz del navegador), que no produce ficheros de audio.

### L3 — sin oficiales por tema, y el orden se invierte

> vale pues no hagas oficiales por tema , hazlas no oficiales con afan docente pero hazlas
> tu y el orden esta mal cambia el dos por el uno osea primero quita psicotecnicos que te
> parece dime que te parece el orden y te digo si emepezar

Decisión tomada: se cae la clasificación de los cuadernillos oficiales por tema. Eso
elimina la tarea de criterio jurídico más lenta del plan y deja los ficheros oficiales sin
tocar. Coste aceptado: los exámenes oficiales no alimentan las estadísticas por tema.

### L4 — autorización de arranque y la portada de Test

> vale si empeza por los sicotecnicos y recuerda al darle al apartado test , tiene que
> haber dos ventanas , botones como en los temas una para oficiales y otra para no oficales
> que cada una te lleve a su respectiva página , empieza por el 1

Autoriza T1. Añade S4: la portada de Test lleva dos accesos, como la rejilla de temas.

### L5 — la revisión se difiere al final

> de momento no vamos acomprobar nada porque no soy opositor cuando este lista la web con
> todos los pasos se la daré a mi amigo para que lo pruebe

Decisión tomada: el dueño no revisa el piloto y no habrá revisión humana por tanda. La
prueba de la web entera la hará un tercero cuando esté terminada. Consecuencia: la puerta
que bloqueaba T6 se levanta y las 42 tandas se escriben seguidas. El riesgo de contenido
(ningún test automático detecta una pregunta jurídicamente falsa) queda **asumido y
diferido**, no eliminado: lo que protege mientras tanto es el verificador —forma, apartado
existente, enunciado no copiado del oficial— y el repintado de apartados de este documento.

### L6 — cerrada la función: todo el plan implementado

Estado al cerrar: 45 temas con 12 preguntas cada uno, 120 mezcladas cruzando temas, portada de
Test con dos accesos, paleta nueva con contraste verificado, diagnóstico de puntos débiles y
lectura en voz alta. Cinco puertas de build en verde: estructura, exámenes oficiales (200),
motor de test (128 comprobaciones), banco propio (660 preguntas) y contraste.

Pendiente y fuera de esta función: la revisión humana del contenido jurídico, que el dueño ha
diferido a la prueba final con un tercero (L5), y publicar en `main`, que decide el dueño.
