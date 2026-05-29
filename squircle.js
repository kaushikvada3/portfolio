// ─────────────────────────────────────────────────────────────
// Squircle: replaces the abrupt G1 corner of `border-radius` with
// a G2-continuous superellipse outline. Applied to every element
// carrying [data-squircle].
//
// Two paths are generated per element:
//   • the outer squircle      → clips the element (style.clipPath)
//   • an even-odd ring path   → exposed as the --sq-ring custom
//     property; CSS clips a ::after pseudo to it to draw the 1px
//     hairline edge. A plain inset box-shadow can't be used here:
//     clip-path also clips an element's own box-shadow, and an
//     inset shadow traces the circular border-radius, not the
//     squircle — so it would detach from the corners.
//
// The `sq` class is added to <html> only once paths are ready, so
// the ring never flashes before JS runs. If clip-path path() is
// unsupported the script bails and the cards keep their plain
// rounded-rect `.glass` border — a clean fallback.
//
// Runs on load, again after fonts settle, and on debounced
// resize. Never bound to scroll — the geometry is static.
// ─────────────────────────────────────────────────────────────
(() => {
  if (!window.CSS || !CSS.supports || !CSS.supports('clip-path', 'path("M0 0")')) return;

  const els = [...document.querySelectorAll('[data-squircle]')];
  if (!els.length) return;

  const N = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--squircle-n')
  ) || 4;
  const STEPS = 14;        // samples per corner arc
  const EXP = 2 / N;       // superellipse parametric exponent
  const RING = 1.5;        // hairline edge thickness, px

  // One quarter superellipse arc as a run of `L x y` segments.
  function arc(cx, cy, r, dirX, dirY, reverse) {
    let out = '';
    for (let i = 0; i <= STEPS; i++) {
      const k = reverse ? STEPS - i : i;
      const t = (k / STEPS) * (Math.PI / 2);
      const x = cx + dirX * r * Math.pow(Math.cos(t), EXP);
      const y = cy + dirY * r * Math.pow(Math.sin(t), EXP);
      out += `L${x.toFixed(2)} ${y.toFixed(2)}`;
    }
    return out;
  }

  // Closed superellipse-cornered rectangle inside (x0,y0,w,h).
  function squircleD(x0, y0, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    const x1 = x0 + w, y1 = y0 + h;
    if (w <= 0 || h <= 0) return '';
    if (r === 0) return `M${x0} ${y0}L${x1} ${y0}L${x1} ${y1}L${x0} ${y1}Z`;
    let d = `M${(x0 + r).toFixed(2)} ${y0.toFixed(2)}`;
    d += `L${(x1 - r).toFixed(2)} ${y0.toFixed(2)}`;
    d += arc(x1 - r, y0 + r, r, 1, -1, true);     // top-right
    d += `L${x1.toFixed(2)} ${(y1 - r).toFixed(2)}`;
    d += arc(x1 - r, y1 - r, r, 1, 1, false);     // bottom-right
    d += `L${(x0 + r).toFixed(2)} ${y1.toFixed(2)}`;
    d += arc(x0 + r, y1 - r, r, -1, 1, true);     // bottom-left
    d += `L${x0.toFixed(2)} ${(y0 + r).toFixed(2)}`;
    d += arc(x0 + r, y0 + r, r, -1, -1, false);   // top-left
    return d + 'Z';
  }

  function apply() {
    for (const el of els) {
      const rect = el.getBoundingClientRect();
      const w = rect.width, h = rect.height;
      if (!w || !h) continue;
      const r = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
      const outer = squircleD(0, 0, w, h, r);
      const inner = squircleD(RING, RING, w - 2 * RING, h - 2 * RING, r - RING);
      el.style.clipPath = `path("${outer}")`;
      el.style.setProperty('--sq-ring', `path(evenodd,"${outer} ${inner}")`);
    }
    document.documentElement.classList.add('sq');
  }

  let raf;
  function schedule() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(apply);
  }

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(schedule, 120);
  });

  apply();
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(apply);
  }
})();
