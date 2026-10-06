# Kaushik Vada · Portfolio

Personal portfolio built like an Apple product-launch page. A packaged chip
lifts its lid and builds itself from RTL to GDS as you scroll, and each role
gets a live, interactive silicon visual.

## Stack & Highlights

- Pure HTML/CSS/JS (classic scripts) — zero build step, hosted as static files.
- `js/spring.js` — spring physics (damping ratio + response), interruptible and
  velocity-aware; `js/chip-core.js` — the shared palette, canvas, and scroll helpers.
- `js/chip-story.js` — the scroll-choreographed chip reveal and six-stage
  RTL-to-GDS build (three.js from jsDelivr, with a CSS fallback).
- `js/chip-tenstorrent.js`, `js/chip-arm.js`, `js/chip-gpu.js` — the chapter
  visuals: die-to-die timing and PVT corners, power heatmap, and the live
  MiniGPU-2 die.
- Respects reduced motion, reduced transparency, and increased contrast.

## Getting Started

Serve the repo root:

```
python3 -m http.server 8000
```

then visit `http://localhost:8000`. Component test pages live in `dev/lab/`.

## Project Layout

- `index.html`, `js/`, `assets/logos/`, `resume.pdf`, `og-image.png` — the live site.
- `dev/lab/` — standalone harnesses for each chip component (not deployed).
- `Archives/` — earlier portfolio versions, kept for reference. See `VERSIONS.md`.
- `.github/workflows/deploy.yml` — deploys the site to GitHub Pages on push to `main`.

Company logos in `assets/logos/` are third-party trademarks — see
`assets/logos/NOTICE.md`.
