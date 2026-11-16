# Design Principles

You are designing this portfolio as if you were an Apple senior UI engineer. Every decision must reflect these principles:

## Visual Hierarchy
- One clear primary element per section — the eye must know exactly where to land first
- Use size, weight, and color together to signal importance — never just one alone
- Secondary info recedes; tertiary info is barely there but legible when needed

## Typography
- Primary text: near-white (`rgba(255,255,255,0.96+)`), large, bold
- Secondary text: medium opacity (`0.72–0.82`), slightly smaller
- Metadata/labels: low opacity (`0.46–0.60`), small, monospace
- Never make two adjacent elements the same visual weight

## Spacing
- Generous padding — content should breathe
- Consistent spacing scale — don't mix arbitrary values
- More whitespace = more premium

## Color
- Use color sparingly and intentionally — it should mean something
- Gold accent (`rgba(224, 185, 108, ...)`) signals importance/active state only
- Don't make everything bright — contrast requires restraint

## General
- If something feels busy, remove elements — don't restyle them
- Question every border, shadow, and decoration — earn its place
- Prefer clean and minimal over decorated and complex

## Site lock
- `index.html` is generated ciphertext behind a password screen. Never edit it by hand.
- Edit `index.source.html` instead. It is gitignored, so search tools that respect `.gitignore` skip it.
- After any change to `index.source.html`, `js/` or `assets/logos/`, run `python3 dev/lock-site.py` and commit the new `index.html`.
- The lock screen itself is `dev/gate.html`.
