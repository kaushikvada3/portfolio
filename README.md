# Kaushik Vada · Portfolio

Personal portfolio built like an Apple product-launch page. A packaged chip
lifts its lid and builds itself from RTL to GDS as you scroll, and each role
gets a live, interactive silicon visual.

## Stack & Highlights

- Pure HTML/CSS/JS (classic scripts), hosted as static files. The one build
  step is the lock: the page ships encrypted behind a password screen.
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

`http://localhost:8000` is the locked page, as visitors get it. The page you
edit is `http://localhost:8000/index.source.html`. Component test pages live
in `dev/lab/`.

## The Lock

`index.html` is generated. It is a password screen (`dev/gate.html`) holding
the real page as AES-256-GCM ciphertext, with the chip scripts and logos
folded in, and the visitor's browser decrypts it with the password. The real
page is `index.source.html`, which stays local (gitignored), the same way
`resume.source.pdf` does.

After editing `index.source.html`, `js/` or `assets/logos/`, or to change the
password:

```
python3 dev/lock-site.py
```

then commit the new `index.html`. `python3 dev/lock-site.py --unlock` prints
the decrypted page, which is how to recover the source from a locked copy.
The deploy refuses to publish an `index.html` that isn't locked.

## Project Layout

- `index.html`, `resume.pdf` — the live site, both locked.
- `index.source.html`, `js/`, `assets/logos/` — what `index.html` is built from.
- `dev/gate.html`, `dev/lock-site.py`, `dev/lock-resume.py` — the lock screen and the two lock scripts.
- `dev/lab/` — standalone harnesses for each chip component (not deployed).
- `Archives/` — earlier portfolio versions, kept for reference. See `VERSIONS.md`.
- `.github/workflows/deploy.yml` — deploys the site to GitHub Pages on push to `main`.

Company logos in `assets/logos/` are third-party trademarks — see
`assets/logos/NOTICE.md`.
