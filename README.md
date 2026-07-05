# Notes

A vector-ink note-taking PWA for iPad, built with Next.js.

## Features

- Notebooks with per-note text and hand-drawn pages
- Vector-based ink (via [perfect-freehand](https://github.com/steveruizok/perfect-freehand)) — strokes stay crisp at any zoom, unlike raster canvases
- Apple Pencil pressure support with palm rejection — the Pencil takes priority, so resting your hand or a stray finger won't leave stray marks
- Pen, eraser, undo, and clear tools; dotted / grid / ruled / blank page backgrounds
- Notes are stored on-device in IndexedDB (nothing leaves your iPad)
- Works fully offline — a service worker caches the app shell, so it launches and runs with no connection
- Installable to the iPad home screen as a standalone app
- Search across all notes by title and text

### Offline

A hand-written service worker ([`public/sw.js`](public/sw.js)) caches the app shell (HTML, JS, CSS, icons) so the app launches with no network after its first online visit. Page loads are network-first (a fresh Vercel deploy is picked up when you're online) and fall back to the cache when offline; static assets are served cache-first. It only registers in production builds, so it never interferes with `npm run dev`.

To force every device to refresh the cached shell after a big change, bump the `CACHE` version string in `public/sw.js` (e.g. `notes-shell-v1` → `notes-shell-v2`).

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy

Push to `main` and connect the repo in [Vercel](https://vercel.com/new) — it auto-detects Next.js, no config needed.

To install on iPad: open the deployed URL in Safari, tap Share → **Add to Home Screen**.
