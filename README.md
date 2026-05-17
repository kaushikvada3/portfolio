# Kaushik Vada · Portfolio

Personal portfolio site — an Obsidian-style knowledge-graph fly-through that doubles as
a resume. Education, experience, projects, and skills are nodes you navigate.

## Stack & Highlights

- Pure HTML/CSS/JS (ES modules) — zero build step, hosted as static files.
- Obsidian graph fly-through (`graph-fly.js` + `graph.json`) as the landing experience.
- Live project demos, a command palette, and a handful of easter eggs.
- Anime.js for motion, Lenis for smooth scrolling, Feather icons for glyphs.
- Responsive layout with keyboard-friendly navigation.

## Getting Started

Open `index.html` directly, or serve it:

```
python3 -m http.server 8000
```

then visit `http://localhost:8000`.

## Project Layout

- `index.html` + `graph-fly.js`, `graph.json`, `eggs.js`, `project-demos.js`,
  `flow-bay.js`, `ux.js` — the live site (Portfolio Cinema v2).
- `Archives/` — earlier portfolio versions, kept for reference. See `VERSIONS.md`.
- `.github/workflows/deploy.yml` — deploys the site to GitHub Pages on push to `main`.

See `VERSIONS.md` for the full history of versions and what is canonical.
