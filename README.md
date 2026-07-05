# Notes

A vector-ink note-taking PWA for iPad, built with Next.js.

## Features

- Notebooks with per-note text and hand-drawn pages
- Vector-based ink (via [perfect-freehand](https://github.com/steveruizok/perfect-freehand)) — strokes stay crisp at any zoom, unlike raster canvases
- Apple Pencil pressure support, pen/eraser/undo/clear tools
- Local-first storage in IndexedDB — works offline
- Installable to the iPad home screen as a standalone app
- Search across all notes by title and text

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy

Push to `main` and connect the repo in [Vercel](https://vercel.com/new) — it auto-detects Next.js, no config needed.

To install on iPad: open the deployed URL in Safari, tap Share → **Add to Home Screen**.
