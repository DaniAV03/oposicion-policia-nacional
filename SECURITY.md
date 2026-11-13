# Seguridad

Este documento describe el modelo de seguridad del sitio, lo que se aplica de verdad y lo
que un alojamiento estático no permite imponer. No promete más de lo que hay.

## Cómo informar de un problema

Abre una incidencia en
<https://github.com/DaniAV03/oposicion-policia-nacional/issues>. Si el problema es
sensible (por ejemplo, una inyección de contenido en una página publicada), describe el
impacto sin publicar una prueba de concepto explotable contra el sitio en producción.

El canal también está declarado en `security.txt`, conforme al RFC 9116, con
fecha de caducidad y lenguas preferentes.

## Qué es este sitio

Un conjunto de ficheros estáticos servidos por GitHub Pages desde el repositorio público.
No hay código de servidor, ni base de datos, ni sesiones, ni formularios, ni subida de
ficheros, ni contenido generado por usuarios.

- Todo el contenido se sirve desde el mismo origen: `daniav03.github.io`.
- No hay cookies, ni analítica, ni peticiones a terceros: la tipografía, los estilos, el
  JavaScript y las imágenes están autoalojados.
- El progreso de estudio vive en el `localStorage` del navegador de cada visitante, no en
  ningún servidor.
- La superficie de ataque realista no es la del servidor, que no existe, sino la del
  documento: dependencias del navegador, enlaces salientes y configuración del despliegue.

## Controles que sí están aplicados

Todos ellos viven en el propio documento HTML o en el código servido, porque son los
únicos canales disponibles sin acceso a la configuración del servidor.

### Política de seguridad de contenido (CSP)

Cada página declara la política mediante `<meta http-equiv="Content-Security-Policy">`:

```text
default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self';
img-src 'self' data:; connect-src 'self'; object-src 'none';
base-uri 'none'; form-action 'none'
```

Consecuencias efectivas: no se ejecuta JavaScript ni se aplican estilos que no provengan de
un fichero del propio origen, no se carga ningún recurso de terceros, no se pueden
incrustar objetos ni marcos (`object-src 'none'`), no se puede reescribir la base de las
URL relativas (`base-uri 'none'`) y ningún formulario puede enviar datos
(`form-action 'none'`). No se usa `'unsafe-inline'` ni `'unsafe-eval'` en ninguna directiva.

### Ausencia total de código y estilos incrustados

La política anterior sólo es real si el documento no necesita excepciones. Por eso:

- No queda ningún `<script>` sin `src`: los puntos de entrada son
  `assets/js/portada.js` y `assets/js/tema-inicio.js`, cargados como módulos ES.
- No queda ningún atributo `style="..."` ni ningún manejador `on*=`: el estilo está
  íntegramente en `assets/css/style.css`.
- El contenido de los temas se pinta desde `data/temas/*.html` con `innerHTML`; ese
  contenido es propio y versionado, no proviene de la red ni de la URL.

### Enlaces salientes

Todo enlace a otro origen lleva `rel="noopener noreferrer"`: sin acceso a `window.opener` y
sin enviar la URL de procedencia en la cabecera `Referer`. La garantía se aplica tanto en el
HTML escrito a mano como al pintar el contenido de los temas, de modo que no depende de que
cada fichero de contenido repita el atributo.

### Referrer y transporte

`<meta name="referrer" content="no-referrer">` en todas las páginas evita que la URL de
origen viaje a cualquier destino al que se enlace. GitHub Pages sirve el sitio por HTTPS y
la opción «Enforce HTTPS» del repositorio redirige las peticiones HTTP; el certificado lo
gestiona GitHub, no este proyecto.

### Ficheros de control

- `.nojekyll` en la raíz: impide que el procesado de Jekyll oculte directorios que empiezan
  por guion bajo o punto, y evita que el contenido se transforme antes de publicarse.
- `security.txt`: contacto, caducidad y lenguas para el reporte de
  vulnerabilidades.

## Lo que un alojamiento estático no puede imponer

Estas protecciones son cabeceras de respuesta HTTP. GitHub Pages no permite configurar
cabeceras propias, así que **no están aplicadas**, y no conviene leer este sitio como si lo
estuvieran:

| Protección | Estado | Qué implica |
| --- | --- | --- |
| `frame-ancestors` / `X-Frame-Options` | No aplicable | Nada impide que un tercero incruste estas páginas en un marco. `frame-ancestors` no está permitido dentro de `<meta>`: se ignora, no se degrada. |
| `X-Content-Type-Options: nosniff` | No aplicable | El tipo MIME lo decide el servidor de GitHub según la extensión. Este proyecto no puede forzarlo ni añadirlo. |
| `Strict-Transport-Security` (HSTS) | No aplicable | La política HSTS sólo se puede emitir como cabecera. La redirección a HTTPS depende del ajuste del repositorio, no de este código. |
| `Permissions-Policy`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy` | No aplicable | Sin cabeceras propias no hay forma de restringir APIs del navegador ni de aislar el origen a ese nivel. |

Riesgo residual asociado, dicho sin adornos: el sitio se puede incrustar en un marco ajeno
(clickjacking) y un intermediario que consiga degradar el transporte no recibirá una orden
HSTS emitida por este sitio. Ninguna de las dos cosas filtra datos, porque no hay datos que
filtrar: no hay sesiones, ni credenciales, ni formularios, ni datos personales en servidor.

## Lo que la CSP en `<meta>` no cubre

- `frame-ancestors`, `sandbox` y `report-uri`/`report-to`: no son válidas en `<meta>` o
  requieren cabecera. La política se aplica a lo que carga el documento, no a quién lo
  incrusta.
- No hay informes de violación: sin `report-to` no se reciben avisos de incumplimiento.
- No protege frente a un compromiso del repositorio, de la cuenta de GitHub o del propio
  GitHub Pages. Si el origen se compromete, la política no distingue el contenido legítimo
  del inyectado.
- No protege frente a fallos del navegador ni frente a extensiones instaladas por el
  visitante, que actúan por encima de la página.
- Al ser una `<meta>`, la política sólo está activa desde el punto del documento en el que
  aparece: por eso se coloca inmediatamente después de la declaración de juego de
  caracteres, antes de cualquier recurso.

## Dependencias y actualizaciones

Cero dependencias de ejecución y cero de compilación en el sitio publicado. Los únicos
paquetes que se ejecutan son los de la acción de GitHub Actions que publica el sitio, y los
scripts de `scripts/` con Node.js para regenerar datos. No hay `npm install` en el
despliegue del sitio.

## Alcance

Se consideran problemas de seguridad de este proyecto:

- Ejecución de script o aplicación de estilo que la CSP debería bloquear.
- Inyección de contenido en una página publicada a través de datos del repositorio.
- Enlaces salientes sin `rel="noopener noreferrer"` o recursos de terceros no declarados.
- Divulgación de datos personales que el sitio afirma no tratar.

No se consideran problemas de seguridad de este proyecto: la falta de cabeceras que GitHub
Pages no permite configurar (documentada arriba), la exactitud del contenido normativo
(para eso está el seguimiento de incidencias) y los ataques que requieran comprometer la
cuenta o el repositorio.

## Licencia

Este documento se publica bajo CC BY-SA 4.0, igual que el resto del contenido. El código
del sitio, bajo MIT.

## Ubicación real del canal de reporte

GitHub Pages no publica directorios ocultos: al empaquetar el artefacto descarta
`.well-known/`. Comprobado en producción: `/.well-known/security.txt` devolvía 404 y
`/security.txt` devuelve 200. Por eso el fichero se sirve desde la raíz y su campo
`Canonical` apunta ahí.

`.nojekyll` se conserva en el repositorio pero no tiene efecto en este modo de
despliegue: GitHub Actions publica el artefacto empaquetado sin pasar por Jekyll, y el
fichero tampoco llega al sitio servido.
