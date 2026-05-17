# Portfolio Versions

This repo has gone through several portfolio iterations. To avoid confusion, here is
what is canonical and what is archived.

## Canonical — what actually ships

**Portfolio Cinema v2** — the Obsidian-graph fly-through portfolio. This is THE version.

- Lives at the repo root: `index.html` plus the ES modules `graph-fly.js`, `graph.json`,
  `eggs.js`, `project-demos.js`, `flow-bay.js`, `ux.js`.
- Zero build step — pure HTML/CSS/ES modules.
- Deployed to GitHub Pages by `.github/workflows/deploy.yml` on every push to `main`.

To run locally: `python3 -m http.server 8000`, then open `http://localhost:8000`.

## Archived — kept for reference, not deployed

Everything under `Archives/`:

| Folder / file                  | What it is                                                  |
|---------------------------------|-------------------------------------------------------------|
| `Archives/Portfolio v1/`        | Original data-driven portfolio (legacy root `src/`).        |
| `Archives/Portfolio v2/`        | Vite-based portfolio with Vue/JS components and 3D scene.   |
| `Archives/portfolio-v2.html`    | Single-file compiled snapshot of v2.                        |
| `Archives/Portfolio v3/`        | Abandoned EDA-IDE-themed redesign ("Fusion Compiler" UI).   |

## Notes

- The large 3D source files at the repo root (`Final Chip.fbx`, `Two_Level_Cache*.glb`)
  are **not used by the live site** and are gitignored — they exist on local disk only.
