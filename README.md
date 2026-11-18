# Oposición a Policía Nacional · Escala Básica

Temario teórico y banco de test para preparar la oposición a Policía Nacional (Escala
Básica). Web estática, sin servidor y sin coste de hosting.

## Qué hay dentro

- **Estudiar** — los 45 temas del programa oficial, escritos desde la fuente legal
  (BOE, EUR-Lex), con diagramas SVG, tablas comparativas, trampas típicas del examen y
  autoevaluación.
- **Test** — preguntas de exámenes oficiales de convocatorias anteriores, aleatorizadas,
  con modo examen y repaso de fallos.

## Por qué no hay PHP

GitHub Pages sólo sirve ficheros estáticos: no ejecuta código de servidor. En lugar de
pagar un hosting con PHP y una base de datos, el motor de test corre en el navegador y el
contenido vive en JSON versionados en este repositorio. Consecuencias:

- Coste cero y sin base de datos que mantener.
- El progreso se guarda en `localStorage`, con exportar/importar JSON. No hay datos
  personales en ningún servidor.
- Funciona offline (PWA) y el historial de git es el historial del contenido.

## Uso local

No hace falta instalar nada ni compilar. Sirve la carpeta con cualquier servidor estático:

```bash
npx serve .
# o
python -m http.server 8000
```

Abre `http://localhost:8000`. Abrir `index.html` con doble clic no funciona: los módulos
ES y `fetch` necesitan un servidor.

Regenerar el índice de temas a partir del texto oficial:

```bash
node scripts/build-programa.mjs
```

Comprobar que el programa está completo y que todo recurso referenciado existe:

```bash
node scripts/verificar.mjs
```

Comprobar que la paleta mantiene el contraste AA en los dos modos:

```bash
node scripts/verificar-contraste.mjs
```

## Seguridad

El sitio no tiene servidor, así que la superficie que se puede endurecer es el documento.
Lo que está aplicado:

- **CSP estricta** en cada página mediante `<meta http-equiv="Content-Security-Policy">`:
  `default-src 'self'`, `script-src 'self'`, `style-src 'self'`, `font-src 'self'`,
  `img-src 'self' data:`, `connect-src 'self'`, `object-src 'none'`, `base-uri 'none'` y
  `form-action 'none'`. Sin `'unsafe-inline'` ni `'unsafe-eval'`.
- **Cero código y cero estilos incrustados**: los puntos de entrada son
  `assets/js/portada.js` y `assets/js/tema-inicio.js`, y todo el estilo vive en
  `assets/css/style.css`. Sin esa limpieza la CSP no sería real.
- **Cero peticiones a terceros**: tipografía, estilos, scripts y SVG se sirven desde este
  mismo origen. Sin analítica, sin CDN, sin cookies.
- `<meta name="referrer" content="no-referrer">` y `rel="noopener noreferrer"` en todo
  enlace saliente, incluido el contenido de los temas, que se normaliza al pintarse.
- `.nojekyll` en la raíz y `security.txt` conforme al RFC 9116.

Un alojamiento estático no permite fijar cabeceras de respuesta: `frame-ancestors`,
`X-Frame-Options`, `X-Content-Type-Options` y HSTS **no están aplicadas**, y no se pueden
imponer desde GitHub Pages. `SECURITY.md` explica qué cubre realmente la CSP en `<meta>` y
qué queda fuera, sin adornos.

## Licencias y aviso legal

- **Código**: MIT. Ver `LICENSE`.
- **Contenido del temario y ejercicios**: CC BY-SA 4.0. Ver `ATRIBUCIONES.md`.
- **Aviso legal completo**: `legal.html`, enlazado desde el pie de todas las páginas:
  titularidad, licencias, atribución de las fuentes oficiales, tipografía y ausencia de
  cookies y de datos personales.

Este proyecto **no es oficial**: no pertenece ni está respaldado por el Ministerio del
Interior ni por la Dirección General de la Policía, y no sustituye a las bases publicadas en
el BOE. El aviso se muestra también en la portada.

Las preguntas de exámenes oficiales proceden de documentos del sector público y se
reutilizan con atribución conforme a la Ley 37/2007 y al RD 1495/2011. No se incluye
material de academias ni de editoriales.
