// ─────────────────────────────────────────────────────────────
// KVChip core — the shared visual + runtime language for every chip
// animation on the Keynote page. Load after spring.js.
//
// One palette, one label style, one way to size canvases, pause
// offscreen, follow scroll, and degrade for reduced motion — so the
// hero chip, the RTL-to-GDS story, and the chapter visuals read as a
// single system rather than four demos.
//
// Exposed as window.KVChip (classic script — works over file://).
// ─────────────────────────────────────────────────────────────
(() => {
  const Fluid = window.Fluid;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  // ── Palette ────────────────────────────────────────────────
  // Monochrome graphite silicon. Gold (CLAUDE.md accent) means one
  // thing per view: the clock, the critical path, the active block.
  const palette = {
    bg:        '#000000',
    substrate: '#0a0a0c',
    die:       '#111114',
    dieEdge:   'rgba(255,255,255,0.16)',
    cell:      'rgba(255,255,255,0.075)',
    cellHi:    'rgba(255,255,255,0.16)',
    macro:     'rgba(255,255,255,0.045)',
    macroEdge: 'rgba(255,255,255,0.22)',
    strap:     'rgba(255,255,255,0.10)',
    metal: [                       // M1 → M6, dim → bright
      'rgba(255,255,255,0.10)',
      'rgba(255,255,255,0.14)',
      'rgba(255,255,255,0.18)',
      'rgba(255,255,255,0.22)',
      'rgba(255,255,255,0.28)',
      'rgba(255,255,255,0.34)',
    ],
    ink:       'rgba(255,255,255,0.96)',
    ink2:      'rgba(255,255,255,0.76)',
    ink3:      'rgba(255,255,255,0.52)',
    gold:      'rgba(224,185,108,1)',
    goldA: (a) => `rgba(224,185,108,${a})`,
    whiteA: (a) => `rgba(255,255,255,${a})`,
    // Heat ramp for power / activity: graphite → gold → near-white.
    heat(t) {
      t = Math.min(1, Math.max(0, t));
      const stops = [
        [0.00, [24, 24, 28]],
        [0.55, [150, 118, 62]],
        [0.80, [224, 185, 108]],
        [1.00, [255, 244, 222]],
      ];
      let i = 0;
      while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
      const [t0, c0] = stops[i], [t1, c1] = stops[i + 1];
      const k = (t - t0) / (t1 - t0);
      const c = c0.map((v, j) => Math.round(v + (c1[j] - v) * k));
      return `rgb(${c[0]},${c[1]},${c[2]})`;
    },
  };

  const font = {
    sans: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, "Helvetica Neue", Arial, sans-serif',
    mono: 'ui-monospace, "SF Mono", Menlo, monospace',
  };

  // ── Math ──────────────────────────────────────────────────
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
  // Ease-out that matches a critically damped spring's shape closely
  // enough for scroll-mapped (non-interactive) progress.
  const easeOut = (t) => 1 - Math.pow(1 - clamp01(t), 3);
  // Local progress of `p` inside [a, b] → 0..1.
  const segment = (p, a, b) => clamp01((p - a) / (b - a));

  // Deterministic PRNG so every floorplan is identical on every load.
  function rng(seed = 1) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ── Canvas ────────────────────────────────────────────────
  // HiDPI canvas that fills `host`, re-sized by ResizeObserver.
  // Returns { canvas, ctx, w, h, dpr } (live — read after onResize).
  function canvas(host, { maxDpr = 2, onResize } = {}) {
    const el = document.createElement('canvas');
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = 'display:block;width:100%;height:100%';
    host.appendChild(el);
    const out = { canvas: el, ctx: el.getContext('2d'), w: 0, h: 0, dpr: 1 };
    const fit = () => {
      const r = host.getBoundingClientRect();
      const dpr = Math.min(maxDpr, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
      if (w === out.w && h === out.h && dpr === out.dpr) return;
      out.w = w; out.h = h; out.dpr = dpr;
      el.width = Math.round(w * dpr);
      el.height = Math.round(h * dpr);
      out.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      onResize && onResize(out);
    };
    new ResizeObserver(fit).observe(host);
    fit();
    return out;
  }

  // ── Visibility-gated animation loop ───────────────────────
  // Runs fn(t, dt) only while `host` is near the viewport and the tab
  // is visible. Under reduced motion it never loops — call
  // loop.draw() yourself to paint a single static frame.
  function loop(host, fn, { rootMargin = '200px' } = {}) {
    let raf = 0, last = 0, visible = false, t = 0;
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now; t += dt;
      fn(t, dt);
      raf = requestAnimationFrame(tick);
    };
    const start = () => {
      if (raf || reduced.matches || !visible || document.hidden) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };
    const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      visible ? start() : stop();
    }, { rootMargin }).observe(host);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    reduced.addEventListener('change', () => (reduced.matches ? stop() : start()));
    return {
      start, stop,
      get running() { return raf !== 0; },
      draw() { fn(t, 0); },
    };
  }

  // ── Scroll progress for a tall sticky section ─────────────
  // 0 when the section's top reaches the viewport top, 1 when its
  // bottom reaches the viewport bottom. Smoothed by a critically
  // damped spring that *follows* scroll — retargeted every scroll
  // event from its live value, so it's continuous and interruptible.
  // Under reduced motion the raw value is used directly.
  function scrollProgress(section, onProgress, { response = 0.22 } = {}) {
    const raw = () => {
      const r = section.getBoundingClientRect();
      const span = r.height - window.innerHeight;
      return span <= 0 ? (r.top <= 0 ? 1 : 0) : clamp01(-r.top / span);
    };
    const spring = new Fluid.Spring(raw(), {
      dampingRatio: 1, response, precision: 0.0005,
      onUpdate: (v) => onProgress(v),
    });
    const update = () => {
      const v = raw();
      if (reduced.matches) spring.set(v);
      else spring.to(v);
    };
    addEventListener('scroll', update, { passive: true });
    addEventListener('resize', update);
    onProgress(spring.value);
    return { get value() { return spring.value; }, get raw() { return raw(); }, update };
  }

  // ── Labels ────────────────────────────────────────────────
  // The one label style: small caps monospace, metadata opacity.
  function label(ctx, text, x, y, { size = 10, color = palette.ink3, align = 'left', baseline = 'alphabetic', tracking = 0.08 } = {}) {
    ctx.save();
    ctx.font = `500 ${size}px ${font.mono}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${(size * tracking).toFixed(2)}px`;
    ctx.fillText(text.toUpperCase(), x, y);
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  window.KVChip = {
    palette, font,
    clamp01, lerp, smoothstep, easeOut, segment, rng,
    canvas, loop, scrollProgress, label, roundRect,
    get reducedMotion() { return reduced.matches; },
  };
})();
