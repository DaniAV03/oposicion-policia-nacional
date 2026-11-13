# Oposición a Policía Nacional · Escala Básica

Temario teórico y banco de test para preparar la oposición a Policía Nacional (Escala
Básica). Web estática, sin servidor y sin coste de hosting.

## Qué hay dentro

- **Estudiar** — los 45 temas del programa oficial, escritos desde la fuente legal
  (BOE, EUR-Lex), con diagramas SVG, tablas comparativas, trampas típicas del examen y
  autoevaluación.
- **Test** — preguntas de exámenes oficiales de convocatorias anteriores, aleatorizadas,
  con modo examen y repaso de fallos.
- **Psicotécnicos** — generados por algoritmo, con dificultad creciente. No se copia
  material de terceros.

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

## Licencias

- **Código**: MIT. Ver `LICENSE`.
- **Contenido del temario y ejercicios**: CC BY-SA 4.0. Ver `ATRIBUCIONES.md`.

Las preguntas de exámenes oficiales proceden de documentos del sector público y se
reutilizan con atribución conforme a la Ley 37/2007 y al RD 1495/2011. No se incluye
material de academias ni de editoriales.
