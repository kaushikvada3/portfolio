// ─────────────────────────────────────────────────────────────
// KVChip.Arm — the Arm chapter visual.
//
// A placed-and-routed SoC block seen from above (memory macros,
// dense standard-cell rows, power straps) with a relative-activity
// heatmap laid over it. Three FSDB activity profiles morph the map;
// Baseline ↔ Optimized cools the hotspots and lets the cells settle
// slightly tighter (two-pass placement, illustrated — not measured).
//
// The heat field is a coarse grid of tiles, each driven by its own
// critically damped spring and released with a small spatial delay
// so changes spread like heat diffusing. Tiles are rasterised into a
// tiny image, scaled up with bilinear filtering and masked by the
// cell geometry. Everything retargets from the live value, so any
// control can be pressed mid-transition.
//
// Load after spring.js and chip-core.js.
//   const arm = KVChip.Arm.mount(host, { autoplay: true, figures: 'primary' });
//   arm.setProfile(1); arm.setOptimized(true); arm.destroy();
//
// figures: 'primary' (default) shows only the toggle-driven power
// figure — the page around it already carries the others. 'all' adds
// the two-pass placement pair as a quiet second column.
// ─────────────────────────────────────────────────────────────
(() => {
  const K = window.KVChip, F = window.Fluid;
  if (!K || !F) { console.error('KVChip.Arm needs spring.js and chip-core.js'); return; }
  const { palette, font, clamp01, smoothstep, rng } = K;

  const GX = 24, GY = 14;       // heat tiles
  const PX = GX + 2, PY = GY + 2; // tile image with a replicated 1px border
  const TAU = Math.PI * 2;
  const STEP = 1 / 240;
  const COOL = 0.32;            // how much the hottest tiles cool when optimized

  // ── Floorplan (normalised block coordinates, deterministic) ──
  const MACROS = [
    { x: 0.030, y: 0.060, w: 0.200, h: 0.300, name: 'SRAM' },
    { x: 0.030, y: 0.400, w: 0.125, h: 0.215, name: 'SRAM' },
    { x: 0.720, y: 0.060, w: 0.250, h: 0.205, name: 'SRAM' },
    { x: 0.805, y: 0.585, w: 0.165, h: 0.355, name: 'SRAM' },
    { x: 0.370, y: 0.765, w: 0.190, h: 0.175, name: 'ROM' },
  ];
  const CORE = { x0: 0.020, y0: 0.032, x1: 0.980, y1: 0.968 };

  // Row count and cell pitch follow the block's on-screen size so the
  // texture stays fine but never turns to moiré on a phone. Cells are
  // placed in long abutted runs with only small gaps, which reads as
  // placed silicon rather than lines of text.
  function buildCells(ROWS, unit) {
    const r = rng(7741);
    const rows = [];
    const rh = (CORE.y1 - CORE.y0) / ROWS;
    const halo = 0.010;
    for (let j = 0; j < ROWS; j++) {
      const y = CORE.y0 + j * rh;
      let spans = [[CORE.x0 + 0.004, CORE.x1 - 0.004]];
      for (const m of MACROS) {
        if (y + rh <= m.y - halo || y >= m.y + m.h + halo) continue;
        const a = m.x - halo, b = m.x + m.w + halo, next = [];
        for (const [s, e] of spans) {
          if (b <= s || a >= e) { next.push([s, e]); continue; }
          if (a > s) next.push([s, a]);
          if (b < e) next.push([b, e]);
        }
        spans = next;
      }
      const cells = [];
      for (const [s, e] of spans) {
        if (e - s < unit * 4) continue;
        let x = s + r() * unit * 0.5;
        let cluster = [];
        let left = 16 + Math.floor(r() * 44);
        const flush = () => {
          if (!cluster.length) return;
          const a = cluster[0].x, b = cluster[cluster.length - 1].x + cluster[cluster.length - 1].w;
          const cx = (a + b) / 2;
          for (const c of cluster) c.cx = cx;
          cells.push(...cluster);
          cluster = [];
        };
        while (x < e - unit) {
          const k = r();
          const w = unit * (k < 0.3 ? 1 : k < 0.6 ? 2 : k < 0.82 ? 3 : k < 0.94 ? 4 : 6);
          if (x + w > e) break;
          cluster.push({ x, w, cx: 0 });
          x += w + (r() < 0.07 ? unit * 0.7 : unit * 0.16);
          if (--left <= 0) {
            flush();
            x += unit * (0.4 + r() * 0.9);
            left = 16 + Math.floor(r() * 44);
          }
        }
        flush();
      }
      rows.push({ y, h: rh, cells });
    }
    return rows;
  }

  // ── Activity profiles (relative, qualitative) ──────────────
  // Each profile is a set of Gaussian hotspots over a quiet ambient
  // field. Values are only "relative activity" — not real data.
  function profileSpots(i) {
    if (i === 0) return [
      [0.48, 0.45, 0.100, 0.86], [0.61, 0.30, 0.066, 0.50], [0.31, 0.70, 0.072, 0.42],
    ];
    if (i === 1) return [
      [0.63, 0.47, 0.115, 0.70], [0.41, 0.23, 0.066, 0.46], [0.55, 0.63, 0.058, 0.48], [0.73, 0.33, 0.052, 0.40],
    ];
    const r = rng(303), out = [];
    const anchors = [[0.30, 0.22], [0.46, 0.56], [0.66, 0.40], [0.24, 0.80], [0.55, 0.20], [0.70, 0.70], [0.38, 0.40]];
    for (const [x, y] of anchors) out.push([x + (r() - 0.5) * 0.04, y + (r() - 0.5) * 0.04, 0.040 + r() * 0.026, 0.42 + r() * 0.34]);
    return out;
  }

  function ambient(u, v) {
    return 0.14 + 0.05 * Math.sin(u * 7.1 + 1.3) * Math.cos(v * 5.3 - 0.4) + 0.03 * Math.sin((u + v) * 13.7);
  }

  function field(spots, optimized, aspect) {
    const out = new Float32Array(GX * GY);
    for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) {
      const u = (i + 0.5) / GX, v = (j + 0.5) / GY;
      let t = ambient(u, v);
      for (const [x, y, s, a] of spots) {
        const dx = (u - x) * aspect, dy = v - y;
        t += a * Math.exp(-(dx * dx + dy * dy) / (2 * s * s * aspect));
      }
      t = clamp01(t);
      // Activity-driven optimization: hotspots cool most, cold areas barely
      // move, and the hottest cells stay warm gold rather than going dull.
      if (optimized) t *= 1 - COOL * smoothstep((t - 0.2) / 0.8);
      out[j * GX + i] = t;
    }
    return out;
  }

  // ── Heat LUT ──────────────────────────────────────────────
  // Neutral luminance for activity; gold only where the block runs hottest,
  // so gold marks one thing in this view.
  const HEAT = [
    [0.00, [24, 24, 28]],
    [0.55, [112, 112, 116]],
    [0.78, [192, 190, 186]],
    [0.92, [224, 185, 108]],
    [1.00, [240, 212, 156]],
  ];
  const LUT = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let k = 0;
    while (k < HEAT.length - 2 && t > HEAT[k + 1][0]) k++;
    const [t0, c0] = HEAT[k], [t1, c1] = HEAT[k + 1], u = (t - t0) / (t1 - t0);
    for (let j = 0; j < 3; j++) LUT[i * 3 + j] = Math.round(c0[j] + (c1[j] - c0[j]) * u);
  }

  // ── Styles (scoped) ───────────────────────────────────────
  const CSS = `
.kvc-arm { --kvc-arm-ink1: rgba(255,255,255,.96); --kvc-arm-ink2: rgba(255,255,255,.78); --kvc-arm-ink3: rgba(255,255,255,.54);
  --kvc-arm-gold: rgba(224,185,108,1); font-family: ${font.sans}; color: var(--kvc-arm-ink1); -webkit-font-smoothing: antialiased; }
.kvc-arm *, .kvc-arm *::before, .kvc-arm *::after { box-sizing: border-box; margin: 0; padding: 0; }
.kvc-arm-stage { position: relative; border-radius: 1.75rem; overflow: hidden; isolation: isolate;
  background: radial-gradient(120% 90% at 50% 0%, #151518 0%, #0b0b0d 62%); }
.kvc-arm-area { position: relative; aspect-ratio: 2.25 / 1; touch-action: pan-y; -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none; }
.kvc-arm-area.is-probing { cursor: none; }
.kvc-arm-area canvas { position: absolute; inset: 0; }
.kvc-arm-ghost { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; opacity: 0; transition: opacity .32s ease; }
.kvc-arm-tip { position: absolute; left: 0; top: 0; pointer-events: none; white-space: nowrap; opacity: 0;
  font-family: ${font.mono}; font-size: .6875rem; line-height: 1; letter-spacing: .06em; text-transform: uppercase;
  padding: .5rem .625rem; border-radius: .5rem; background: rgba(16,16,18,.9); color: var(--kvc-arm-ink3);
  box-shadow: 0 6px 20px rgba(0,0,0,.45), inset 0 0 0 .5px rgba(255,255,255,.08); will-change: transform, opacity; }
.kvc-arm-tip i { font-style: normal; margin: 0 .45em; opacity: .7; }
.kvc-arm-tip b { font-weight: 500; color: var(--kvc-arm-ink1); }
.kvc-arm-foot { display: flex; justify-content: flex-end; align-items: center; gap: 1rem; padding: 0 1.75rem 1.25rem;
  font-family: ${font.mono}; font-size: .75rem; line-height: 1.4; letter-spacing: .02em; color: rgba(255,255,255,.5); }
.kvc-arm-legend { display: flex; align-items: center; gap: .625rem; }
.kvc-arm-ramp { width: 4.5rem; height: .25rem; border-radius: 1rem; opacity: .55;
  background: linear-gradient(90deg, rgb(24,24,28), rgb(112,112,116) 55%, rgb(192,190,186) 78%, rgb(224,185,108) 92%, rgb(240,212,156)); box-shadow: inset 0 0 0 .5px rgba(255,255,255,.12); }

.kvc-arm-controls { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 1.5rem 3rem; margin-top: 1.75rem; }
.kvc-arm-group { display: flex; flex-direction: column; gap: .625rem; min-width: 0; }
.kvc-arm-glabel { font-family: ${font.mono}; font-size: .75rem; line-height: 1.4; letter-spacing: .02em; color: rgba(255,255,255,.54); }
.kvc-arm-seg { position: relative; display: inline-flex; padding: 3px; border-radius: 980px; background: rgba(255,255,255,.08); }
.kvc-arm-pill { position: absolute; left: 0; top: 3px; bottom: 3px; width: 0; border-radius: 980px; background: rgba(255,255,255,.2);
  box-shadow: 0 1px 3px rgba(0,0,0,.4), inset 0 .5px 0 rgba(255,255,255,.14); pointer-events: none; will-change: transform, width; }
.kvc-arm-seg button { position: relative; z-index: 1; font: inherit; font-size: .9375rem; font-weight: 500; letter-spacing: -.01em; line-height: 1;
  min-height: 2.5rem; padding: 0 1.125rem; border: 0; border-radius: 980px; background: none; color: rgba(255,255,255,.6); cursor: pointer;
  white-space: nowrap; -webkit-tap-highlight-color: transparent; transition: color .2s ease, transform .1s ease-out; }
.kvc-arm-seg button:hover { color: rgba(255,255,255,.82); }
.kvc-arm-seg button[aria-checked="true"] { color: var(--kvc-arm-ink1); }
.kvc-arm-seg button:active { transform: scale(.97); }
.kvc-arm-seg button:focus { outline: none; }
.kvc-arm-seg button:focus-visible { outline: 2px solid rgba(255,255,255,.92); outline-offset: 1px; }

.kvc-arm-readouts { display: grid; grid-template-columns: minmax(0, 1fr); gap: 2rem 4.5rem; margin-top: 3rem; }
.kvc-arm-readouts.is-all { grid-template-columns: minmax(0, auto) minmax(0, auto); justify-content: start; align-items: start; }
.kvc-arm-ro { min-width: 0; }
.kvc-arm-note { margin-top: .75rem; font-family: ${font.mono}; font-size: .6875rem; line-height: 1.4; letter-spacing: .04em; color: rgba(255,255,255,.46); }
.kvc-arm-num { display: grid; font-size: clamp(1.5rem, 2.4vw, 2rem); font-weight: 600; line-height: 1.1; letter-spacing: -.022em; }
.kvc-arm-num > span { grid-area: 1 / 1; transition: opacity .4s ease, transform .55s cubic-bezier(.2,.8,.2,1); }
.kvc-arm-rest { color: rgba(255,255,255,.72); }
.kvc-arm-val { color: var(--kvc-arm-ink1); opacity: 0; transform: translateY(8px); }
.kvc-arm-ro.is-on .kvc-arm-val { opacity: 1; transform: none; }
.kvc-arm-ro.is-on .kvc-arm-rest { opacity: 0; transform: translateY(-8px); }
.kvc-arm-ctx { margin-top: .5rem; max-width: 30em; font-family: ${font.mono}; font-size: .75rem; line-height: 1.5; letter-spacing: .01em; color: rgba(255,255,255,.5); }
.kvc-arm-pair { list-style: none; display: grid; gap: .875rem; padding-top: .375rem; }
.kvc-arm-pair li { display: flex; align-items: baseline; gap: .625rem; font-size: 1rem; font-weight: 500; line-height: 1.2; color: rgba(255,255,255,.5); transition: color .4s ease; }
.kvc-arm-pair b { min-width: 4.1em; font-size: 1.5rem; font-weight: 600; letter-spacing: -.02em; font-variant-numeric: tabular-nums; color: rgba(255,255,255,.3); transition: color .4s ease; }
.kvc-arm-ro.is-on .kvc-arm-pair li { color: rgba(255,255,255,.72); }
.kvc-arm-ro.is-on .kvc-arm-pair b { color: rgba(255,255,255,.78); }
.kvc-arm-pair + .kvc-arm-ctx { margin-top: .875rem; }
.kvc-arm-sr { position: absolute !important; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

@media (max-width: 47.99rem) {
  .kvc-arm-stage { border-radius: 1.25rem; }
  .kvc-arm-area { aspect-ratio: 1.45 / 1; }
  .kvc-arm-long { display: none; }
  .kvc-arm-foot { padding: 0 1rem .875rem; font-size: .6875rem; }
  .kvc-arm-ramp { width: 3rem; }
  .kvc-arm-controls { flex-direction: column; align-items: stretch; gap: 1.25rem; margin-top: 1.25rem; }
  .kvc-arm-seg { display: flex; }
  .kvc-arm-seg button { flex: 1 1 0; padding: 0 .5rem; min-height: 2.75rem; font-size: .9375rem; }
  .kvc-arm-readouts, .kvc-arm-readouts.is-all { grid-template-columns: minmax(0, 1fr); gap: 2rem; margin-top: 2rem; }
}
@media (pointer: coarse) { .kvc-arm-seg button { min-height: 2.75rem; } }
@media (prefers-reduced-transparency: reduce) { .kvc-arm-tip { background: #18181b; } }
@media (prefers-contrast: more) {
  .kvc-arm-seg { background: rgba(255,255,255,.14); }
  .kvc-arm-pill { background: rgba(255,255,255,.34); }
  .kvc-arm-seg button, .kvc-arm-glabel, .kvc-arm-foot, .kvc-arm-ctx, .kvc-arm-note { color: rgba(255,255,255,.82); }
  .kvc-arm-rest { color: rgba(255,255,255,.86); }
  .kvc-arm-pair b { color: rgba(255,255,255,.55); }
  .kvc-arm-pair li { color: rgba(255,255,255,.72); }
  .kvc-arm-tip { background: #000; box-shadow: inset 0 0 0 1px rgba(255,255,255,.5); }
}
@media (prefers-reduced-motion: reduce) {
  .kvc-arm-seg button { transition: none; }
  .kvc-arm-seg button:active { transform: none; }
  .kvc-arm-num > span { transform: none !important; }
}`;

  function injectStyle() {
    if (document.getElementById('kvc-arm-style')) return;
    const s = document.createElement('style');
    s.id = 'kvc-arm-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  let uidN = 0;
  const h = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };

  // ── Segmented control (radiogroup, roving tabindex, spring pill) ──
  function Segmented(parent, { label, options, index, onSelect, isVisible }) {
    const id = `kvc-arm-g${++uidN}`;
    const group = h('div', 'kvc-arm-group');
    const lab = h('span', 'kvc-arm-glabel', label);
    lab.id = id;
    const track = h('div', 'kvc-arm-seg');
    track.setAttribute('role', 'radiogroup');
    track.setAttribute('aria-labelledby', id);
    const pill = h('span', 'kvc-arm-pill');
    pill.setAttribute('aria-hidden', 'true');
    track.appendChild(pill);
    const buttons = options.map((o, i) => {
      const b = h('button', '', o);
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.addEventListener('click', () => select(i, true));
      track.appendChild(b);
      return b;
    });
    group.append(lab, track);
    parent.appendChild(group);

    const opts = { dampingRatio: 1, response: 0.34, precision: 0.05 };
    const sx = new F.Spring(0, { ...opts, onUpdate: paint });
    const sw = new F.Spring(0, { ...opts, onUpdate: paint });
    function paint() {
      pill.style.transform = `translate3d(${sx.value.toFixed(2)}px,0,0)`;
      pill.style.width = `${sw.value.toFixed(2)}px`;
    }
    let cur = -1, placed = false;
    function place(instant) {
      const b = buttons[cur];
      if (!b || !b.offsetWidth) return;
      if (instant || !placed || F.reducedMotion || !isVisible()) { sx.set(b.offsetLeft); sw.set(b.offsetWidth); placed = true; }
      else { sx.to(b.offsetLeft); sw.to(b.offsetWidth); }
    }
    function select(i, user, focus) {
      i = Math.max(0, Math.min(buttons.length - 1, i));
      const changed = i !== cur;
      cur = i;
      buttons.forEach((b, k) => {
        b.setAttribute('aria-checked', String(k === i));
        b.tabIndex = k === i ? 0 : -1;
      });
      if (focus) buttons[i].focus();
      place(false);
      if (changed && user) onSelect(i);
    }
    track.addEventListener('keydown', (e) => {
      let n = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (cur + 1) % buttons.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (cur - 1 + buttons.length) % buttons.length;
      else if (e.key === 'Home') n = 0;
      else if (e.key === 'End') n = buttons.length - 1;
      if (n === null) return;
      e.preventDefault();
      select(n, true, true);
    });
    const ro = new ResizeObserver(() => place(true));
    ro.observe(track);
    select(index, false);
    return {
      set(i) { select(i, false); },
      destroy() { ro.disconnect(); sx.stop(); sw.stop(); },
    };
  }

  // ── Primary readout ───────────────────────────────────────
  // Words, not a figure: the number itself lives in the chapter's notes and
  // in "By the numbers", so the visual never shows an in-between value.
  // Baseline → Optimized is a crossfade with a short rise.
  function Readout(parent, { before, after, ctx }) {
    const el = h('div', 'kvc-arm-ro is-primary');
    const num = h('p', 'kvc-arm-num');
    const rest = h('span', 'kvc-arm-rest', before);
    const val = h('span', 'kvc-arm-val', after);
    num.append(rest, val);
    el.append(num, h('p', 'kvc-arm-ctx', ctx));
    parent.appendChild(el);
    let on = null;
    return {
      el,
      setOn(v) {
        if (v === on) return;
        on = v;
        el.classList.toggle('is-on', v);
        rest.setAttribute('aria-hidden', v ? 'true' : 'false');
        val.setAttribute('aria-hidden', v ? 'false' : 'true');
      },
      destroy() {},
    };
  }

  // Quiet second column (figures: 'all' only) — two numbers, each with its own label.
  function PairReadout(parent) {
    const el = h('div', 'kvc-arm-ro is-second');
    const ul = h('ul', 'kvc-arm-pair');
    for (const [n, l] of [['−5.86%', 'estimated power'], ['−2.45%', 'cell area']]) {
      const li = h('li');
      li.append(h('b', '', n), document.createTextNode(l));
      ul.appendChild(li);
    }
    el.append(ul, h('p', 'kvc-arm-ctx', 'Two-pass placement, co-developed with Cadence engineers'));
    parent.appendChild(el);
    return { setOn(v) { el.classList.toggle('is-on', v); }, destroy() {} };
  }

  // ── Mount ─────────────────────────────────────────────────
  function mount(host, opts = {}) {
    injectStyle();
    const reduced = () => F.reducedMotion;
    const state = {
      profile: Math.max(0, Math.min(2, (opts.profile ?? 1) - 1)),
      optimized: opts.optimized ?? null,     // null → decided by autoplay / reduced motion
    };
    const autoplay = opts.autoplay !== false && state.optimized === null;
    if (state.optimized === null) state.optimized = reduced();
    let destroyed = false, visible = false;

    // DOM
    const root = h('div', 'kvc-arm');
    const stage = h('figure', 'kvc-arm-stage');
    const area = h('div', 'kvc-arm-area');
    area.setAttribute('role', 'img');
    const tip = h('div', 'kvc-arm-tip');
    tip.setAttribute('aria-hidden', 'true');
    const tipVal = h('b', '', 'Low');
    tip.append(document.createTextNode('Relative activity'), h('i', '', '·'), tipVal);
    const foot = h('figcaption', 'kvc-arm-foot');
    const note = h('p', 'kvc-arm-note', 'Illustration');
    note.append(h('span', 'kvc-arm-long', ' · relative activity, not measured data'));
    const legend = h('span', 'kvc-arm-legend');
    legend.setAttribute('aria-hidden', 'true');
    legend.append(h('span', '', 'Low'), h('span', 'kvc-arm-ramp'), h('span', '', 'High'));
    foot.append(legend);
    stage.append(area, foot);

    const controls = h('div', 'kvc-arm-controls');
    const readouts = h('div', 'kvc-arm-readouts');
    root.append(stage, note, controls, readouts);
    host.appendChild(root);

    let ready = false;
    const cv = K.canvas(area, { maxDpr: 2, onResize: () => { if (ready && !destroyed) { relayout(); invalidate(); } } });
    const ghost = h('canvas', 'kvc-arm-ghost');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.width = ghost.height = 0;
    area.append(ghost, tip);

    // Floorplan + layers: a static plate (die, straps, macros), the cell
    // mask (redrawn only while the cells move), and a scratch layer where
    // the heat is clipped to the cells each frame.
    let rows = [], rowsKey = '', aspect = 2.2;
    const L = { bx: 0, by: 0, bw: 0, bh: 0 };
    const base = document.createElement('canvas');
    const mask = document.createElement('canvas');
    const tmp = document.createElement('canvas');
    const heatC = document.createElement('canvas'); heatC.width = PX; heatC.height = PY;
    const glowC = document.createElement('canvas'); glowC.width = PX; glowC.height = PY;
    const hctx = heatC.getContext('2d'), gctx = glowC.getContext('2d');
    const heatImg = hctx.createImageData(PX, PY), glowImg = gctx.createImageData(PX, PY);
    let maskDirty = true;

    function relayout() {
      const { w, h: hh, dpr } = cv;
      const pad = Math.max(12, Math.min(w, hh) * 0.06);
      const aw = w - pad * 2, ah = hh - pad * 2;
      // The block takes the stage's own proportions (within reason) so it
      // fills the card instead of floating in side bands.
      const nextAspect = Math.max(1.4, Math.min(2.45, aw / ah));
      const bw = Math.min(aw, ah * nextAspect), bh = bw / nextAspect;
      L.bx = Math.round((w - bw) / 2); L.by = Math.round((hh - bh) / 2);
      L.bw = Math.round(bw); L.bh = Math.round(bh);
      const nRows = Math.max(34, Math.min(92, Math.round(L.bh / (L.bw < 560 ? 4.3 : 5.2))));
      const unit = Math.max(0.0028, 2.3 / L.bw);
      const key = `${nRows}:${unit.toFixed(5)}`;
      if (key !== rowsKey) { rows = buildCells(nRows, unit); rowsKey = key; }
      for (const c of [base, mask, tmp]) { c.width = Math.round(w * dpr); c.height = Math.round(hh * dpr); }
      drawBase();
      maskDirty = true;
      if (Math.abs(nextAspect - aspect) > 1e-3) {
        aspect = nextAspect;
        if (bloomed) retarget(true);
      }
    }

    const X = (u) => L.bx + u * L.bw, Y = (v) => L.by + v * L.bh;

    function drawBase() {
      const c = base.getContext('2d'), { dpr } = cv;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, cv.w, cv.h);
      const { bx, by, bw, bh } = L;
      // Contact shadow so the block sits on the stage.
      c.save();
      c.shadowColor = 'rgba(0,0,0,0.7)'; c.shadowBlur = 36; c.shadowOffsetY = 14;
      c.fillStyle = palette.die; c.fillRect(bx, by, bw, bh);
      c.restore();
      // Top light: a faint falloff from the upper edge gives the die material.
      const g = c.createLinearGradient(0, by, 0, by + bh);
      g.addColorStop(0, 'rgba(255,255,255,0.045)'); g.addColorStop(0.45, 'rgba(255,255,255,0.008)'); g.addColorStop(1, 'rgba(0,0,0,0.12)');
      c.fillStyle = g; c.fillRect(bx, by, bw, bh);
      // Core ring (two rails).
      c.strokeStyle = 'rgba(255,255,255,0.06)'; c.lineWidth = 1;
      const r1 = 0.008, r2 = 0.015;
      for (const r of [r1, r2]) {
        const ix = Math.round(bw * r), iy = Math.round(bw * r);
        c.strokeRect(bx + ix + 0.5, by + iy + 0.5, bw - ix * 2 - 1, bh - iy * 2 - 1);
      }
      // Block edge + hairline bevel: lit top edge, shaded bottom edge.
      c.strokeStyle = palette.dieEdge;
      c.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
      const rim = c.createLinearGradient(bx, 0, bx + bw, 0);
      rim.addColorStop(0, 'rgba(255,255,255,0.10)'); rim.addColorStop(0.5, 'rgba(255,255,255,0.42)'); rim.addColorStop(1, 'rgba(255,255,255,0.10)');
      c.fillStyle = rim; c.fillRect(bx + 1, by, bw - 2, 1);
      c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(bx + 1, by + 1, bw - 2, 1);
      c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(bx + 1, by + bh - 1, bw - 2, 1);
      // Pins along top and bottom edges.
      c.fillStyle = 'rgba(255,255,255,0.2)';
      const pr = rng(91);
      const step = Math.max(5, bw / 140);
      for (let x = bx + step * 3; x < bx + bw - step * 3; x += step) {
        if (pr() < 0.55) c.fillRect(Math.round(x), by - 3, 1, 3);
        if (pr() < 0.40) c.fillRect(Math.round(x), by + bh, 1, 3);
      }
      drawMacros(c);
    }

    // Straps and macros live on the plate too: cells never overlap the
    // macros, and the glow is clipped around them.
    function drawMacros(c) {
      // Vertical power straps (show between cells).
      c.fillStyle = 'rgba(255,255,255,0.04)';
      const n = Math.round(L.bw / 70);
      for (let k = 1; k < n; k++) {
        const x = Math.round(X(CORE.x0 + (k / n) * (CORE.x1 - CORE.x0)));
        c.fillRect(x, Y(CORE.y0), 1, L.bh * (CORE.y1 - CORE.y0));
      }
      // Macros. Labels on all of them or none, so the block reads evenly.
      const labelAll = MACROS.every((m) => m.w * L.bw > 56 && m.h * L.bh > 30);
      for (const m of MACROS) {
        const x = Math.round(X(m.x)) + 0.5, y = Math.round(Y(m.y)) + 0.5;
        const w = Math.round(m.w * L.bw), hh = Math.round(m.h * L.bh);
        c.fillStyle = 'rgba(14,14,17,0.9)';
        c.fillRect(x, y, w, hh);
        c.fillStyle = 'rgba(255,255,255,0.028)';
        const pitch = Math.max(2.5, L.bh / 170);
        for (let yy = y + pitch * 3; yy < y + hh - pitch * 2; yy += pitch) c.fillRect(x + 4, Math.round(yy), w - 8, 1);
        const facesRight = m.x < 0.5, pw = Math.max(5, w * 0.11);
        c.fillStyle = 'rgba(255,255,255,0.045)';
        c.fillRect(facesRight ? x + w - pw : x, y, pw, hh);
        c.strokeStyle = palette.macroEdge; c.lineWidth = 1;
        c.strokeRect(x, y, w, hh);
        c.fillStyle = 'rgba(255,255,255,0.08)';
        c.fillRect(x + 1, y, w - 1, 1);
        if (labelAll) K.label(c, m.name, x + 8, y + 8, { size: L.bw > 600 ? 10 : 8, baseline: 'top', color: 'rgba(255,255,255,0.46)' });
      }
    }

    function drawMask(k) {
      const c = mask.getContext('2d'), { dpr } = cv;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, cv.w, cv.h);
      c.fillStyle = '#fff';
      const sq = 1 - 0.025 * k;         // pull toward cluster centres
      const sw = 1 - 0.0245 * k;         // cells a touch smaller
      const { bx, bw } = L;
      for (const row of rows) {
        const y = Y(row.y) + row.h * L.bh * 0.13;
        const hh = Math.max(1, row.h * L.bh * 0.74);
        for (const cell of row.cells) {
          const cx = cell.cx + (cell.x + cell.w / 2 - cell.cx) * sq;
          const w = cell.w * sw;
          c.fillRect(bx + (cx - w / 2) * bw, y, Math.max(0.6, w * bw - 0.55), hh);
        }
      }
    }

    // ── Heat tiles (springs) ──
    const N = GX * GY;
    const val = new Float32Array(N), vel = new Float32Array(N), tgt = new Float32Array(N);
    const pend = new Float32Array(N), pendAt = new Float64Array(N).fill(-1), resp = new Float32Array(N);
    {
      const r = rng(4242);
      for (let i = 0; i < N; i++) resp[i] = 0.62 + r() * 0.2;
    }
    const jitter = (() => { const r = rng(17); const a = new Float32Array(N); for (let i = 0; i < N; i++) a[i] = r() * 0.05; return a; })();
    const compact = new F.Spring(state.optimized ? 1 : 0, {
      dampingRatio: 1, response: 0.95, precision: 0.0005,
      onUpdate: () => { maskDirty = true; wake(); },
    });
    let bloomed = false;

    function retarget(instant) {
      const spots = profileSpots(state.profile);
      const f = field(spots, state.optimized, aspect);
      const now = performance.now() / 1000;
      for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) {
        const k = j * GX + i;
        if (instant) { val[k] = tgt[k] = f[k]; vel[k] = 0; pendAt[k] = -1; continue; }
        // Delay grows with distance from the nearest hotspot: change starts
        // at the sources and spreads outward.
        const u = (i + 0.5) / GX, v = (j + 0.5) / GY;
        let d = 9;
        for (const [x, y] of spots) d = Math.min(d, Math.hypot((u - x) * aspect, v - y));
        pend[k] = f[k];
        pendAt[k] = now + 0.02 + Math.min(0.6, d * 0.42) + jitter[k];
      }
    }

    function stepTiles(dt) {
      const now = performance.now() / 1000;
      let moving = false;
      const steps = Math.max(1, Math.ceil(dt / STEP)), hstep = dt / steps;
      for (let k = 0; k < N; k++) {
        if (pendAt[k] >= 0) {
          if (now >= pendAt[k]) { tgt[k] = pend[k]; pendAt[k] = -1; }
          else moving = true;
        }
        let x = val[k], v = vel[k];
        const t = tgt[k];
        if (Math.abs(x - t) < 0.0008 && Math.abs(v) < 0.008) { val[k] = t; vel[k] = 0; continue; }
        moving = true;
        const r = resp[k], kk = (TAU / r) ** 2, c = (4 * Math.PI) / r;
        for (let s = 0; s < steps; s++) { v += (-kk * (x - t) - c * v) * hstep; x += v * hstep; }
        val[k] = x; vel[k] = v;
      }
      return moving;
    }

    // Tile values → padded RGBA images (border replicated so bilinear
    // filtering never fades at the block edge).
    function writeHeat() {
      const hd = heatImg.data, gd = glowImg.data;
      for (let j = 0; j < PY; j++) {
        const sj = Math.max(0, Math.min(GY - 1, j - 1));
        for (let i = 0; i < PX; i++) {
          const si = Math.max(0, Math.min(GX - 1, i - 1));
          const t = clamp01(val[sj * GX + si]);
          const li = Math.round(t * 255) * 3, p = (j * PX + i) * 4;
          hd[p] = gd[p] = LUT[li]; hd[p + 1] = gd[p + 1] = LUT[li + 1]; hd[p + 2] = gd[p + 2] = LUT[li + 2];
          hd[p + 3] = Math.round(255 * (0.25 + 0.75 * smoothstep((t - 0.08) / 0.6)));
          gd[p + 3] = Math.round(255 * smoothstep((t - 0.2) / 0.8));
        }
      }
      hctx.putImageData(heatImg, 0, 0);
      gctx.putImageData(glowImg, 0, 0);
    }

    // Bilinear sample of the live field at normalised (u, v).
    function sample(u, v) {
      const fx = clamp01(u) * GX - 0.5, fy = clamp01(v) * GY - 0.5;
      const x0 = Math.max(0, Math.min(GX - 1, Math.floor(fx))), y0 = Math.max(0, Math.min(GY - 1, Math.floor(fy)));
      const x1 = Math.min(GX - 1, x0 + 1), y1 = Math.min(GY - 1, y0 + 1);
      const tx = clamp01(fx - x0), ty = clamp01(fy - y0);
      const a = val[y0 * GX + x0] * (1 - tx) + val[y0 * GX + x1] * tx;
      const b = val[y1 * GX + x0] * (1 - tx) + val[y1 * GX + x1] * tx;
      return a * (1 - ty) + b * ty;
    }

    // ── Probe ──
    const probe = new F.Spring2D(0, 0, { dampingRatio: 1, response: 0.16, precision: 0.2, onUpdate: () => wake() });
    const probeA = new F.Spring(0, { dampingRatio: 1, response: 0.22, precision: 0.004, onUpdate: () => wake() });
    let probeOn = false, tipText = '', tipW = 0, tipH = 0, touchPinned = false;

    function showProbe(x, y, jump) {
      if (jump || !probeOn || reduced()) probe.set(x, y); else probe.to(x, y);
      if (!probeOn) { probeOn = true; reduced() ? probeA.set(1) : probeA.to(1); }
      area.classList.add('is-probing');
      if (reduced()) render();
    }
    function hideProbe() {
      if (!probeOn) return;
      probeOn = false; touchPinned = false;
      area.classList.remove('is-probing');
      reduced() ? probeA.set(0) : probeA.to(0);
      if (reduced()) render();
    }
    const local = (e) => { const r = area.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const inBlock = (x, y) => x >= L.bx && x <= L.bx + L.bw && y >= L.by && y <= L.by + L.bh;
    let touchDown = null;
    function onMove(e) {
      const [x, y] = local(e);
      if (e.pointerType === 'touch') {
        if (!touchDown) return;
        if (inBlock(x, y)) showProbe(x, y, false);
        return;
      }
      inBlock(x, y) ? showProbe(x, y, false) : hideProbe();
    }
    function onDown(e) {
      if (e.pointerType !== 'touch') return;
      const [x, y] = local(e);
      touchDown = { x, y };
      if (inBlock(x, y)) { showProbe(x, y, !probeOn); touchPinned = true; }
    }
    const onUp = () => { touchDown = null; };
    const onLeave = (e) => { if (e.pointerType !== 'touch') hideProbe(); };
    const onDocDown = (e) => { if (touchPinned && !area.contains(e.target)) hideProbe(); };
    area.addEventListener('pointermove', onMove);
    area.addEventListener('pointerdown', onDown);
    area.addEventListener('pointerup', onUp);
    area.addEventListener('pointercancel', onUp);
    area.addEventListener('pointerleave', onLeave);
    document.addEventListener('pointerdown', onDocDown, true);

    // Up-right of the crosshair by default, flipped left when it doesn't
    // fit; when neither side fits (phones) it centres above or below.
    // Always clamped inside the stage.
    function placeTip(px, py, a) {
      const t = sample((px - L.bx) / L.bw, (py - L.by) / L.bh);
      const word = t > 0.6 ? 'High' : t > 0.36 ? 'Medium' : 'Low';
      if (word !== tipText) {
        tipText = word; tipVal.textContent = word;
        tipW = tip.offsetWidth; tipH = tip.offsetHeight;   // only on text change
      }
      const W = cv.w, H = cv.h, M = 8, G = 16;
      let tx, ty;
      if (px + G + tipW <= W - M) { tx = px + G; ty = py - tipH - G; }
      else if (px - G - tipW >= M) { tx = px - G - tipW; ty = py - tipH - G; }
      else { tx = px - tipW / 2; ty = py - tipH - 22; }
      if (ty < M) ty = tx === px - tipW / 2 ? py + 22 : py + G;
      tx = Math.max(M, Math.min(W - tipW - M, tx));
      ty = Math.max(M, Math.min(H - tipH - M, ty));
      tip.style.transform = `translate3d(${tx.toFixed(1)}px,${ty.toFixed(1)}px,0)`;
      tip.style.opacity = a.toFixed(3);
    }

    // ── Render ──
    function render() {
      if (destroyed) return;
      const { ctx, w, h: hh, dpr } = cv;
      if (!L.bw) return;
      if (maskDirty) { drawMask(compact.value); maskDirty = false; }
      writeHeat();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, w * dpr, hh * dpr);
      ctx.drawImage(base, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const { bx, by, bw, bh } = L;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      // Soft glow under the cells (not over the macros).
      ctx.save();
      ctx.beginPath(); ctx.rect(bx + 1, by + 1, bw - 2, bh - 2);
      for (const m of MACROS) ctx.rect(Math.round(X(m.x)), Math.round(Y(m.y)), Math.round(m.w * bw) + 1, Math.round(m.h * bh) + 1);
      ctx.clip('evenodd');
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.2;
      ctx.drawImage(glowC, 1, 1, GX, GY, bx, by, bw, bh);
      ctx.restore();
      // Unlit cells.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 0.065;
      ctx.drawImage(mask, 0, 0);
      // Cells lit by activity: heat image masked by cell geometry.
      const t = tmp.getContext('2d');
      t.setTransform(1, 0, 0, 1, 0, 0);
      t.globalCompositeOperation = 'source-over';
      t.clearRect(0, 0, tmp.width, tmp.height);
      t.imageSmoothingEnabled = true; t.imageSmoothingQuality = 'high';
      t.drawImage(heatC, 1, 1, GX, GY, bx * dpr, by * dpr, bw * dpr, bh * dpr);
      t.globalCompositeOperation = 'destination-in';
      t.drawImage(mask, 0, 0);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.92;
      ctx.drawImage(tmp, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Probe.
      const a = probeA.value;
      if (a > 0.002) {
        const px = Math.max(bx, Math.min(bx + bw, probe.x.value));
        const py = Math.max(by, Math.min(by + bh, probe.y.value));
        ctx.save();
        ctx.beginPath(); ctx.rect(bx, by, bw, bh); ctx.clip();
        ctx.globalAlpha = a;
        ctx.fillStyle = 'rgba(255,255,255,0.14)';
        ctx.fillRect(bx, Math.round(py), bw, 1);
        ctx.fillRect(Math.round(px), by, 1, bh);
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = a;
        ctx.strokeStyle = 'rgba(255,255,255,0.95)';
        ctx.lineWidth = 1.25;
        ctx.beginPath(); ctx.arc(px, py, 7, 0, TAU); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(px - 15, py); ctx.lineTo(px - 10, py);
        ctx.moveTo(px + 10, py); ctx.lineTo(px + 15, py);
        ctx.moveTo(px, py - 15); ctx.lineTo(px, py - 10);
        ctx.moveTo(px, py + 10); ctx.lineTo(px, py + 15);
        ctx.stroke();
        ctx.restore();
        placeTip(px, py, a);
      } else if (tip.style.opacity !== '0') {
        tip.style.opacity = '0';
      }
    }

    // ── Loop ──
    let frames = 0;
    const loop = K.loop(area, (t, dt) => {
      if (destroyed) { loop.stop(); return; }
      frames++;
      const moving = stepTiles(dt);
      render();
      if (!moving && !compact.animating && !probe.animating && !probeA.animating) queueMicrotask(() => loop.stop());
    });
    function invalidate() {
      if (reduced()) render(); else wake();
    }
    function wake() { if (!destroyed && !reduced()) loop.start(); }

    // Reduced motion: snapshot the current frame and fade it out over the
    // new one. The snapshot canvas only exists for the length of the fade.
    let ghostTimer = 0;
    function crossfade(change) {
      if (cv.canvas.width) {
        ghost.width = cv.canvas.width; ghost.height = cv.canvas.height;
        const g = ghost.getContext('2d');
        g.drawImage(cv.canvas, 0, 0);
        ghost.style.transition = 'none';
        ghost.style.opacity = '1';
        void ghost.offsetWidth;
        ghost.style.transition = '';
      }
      change();
      render();
      requestAnimationFrame(() => { ghost.style.opacity = '0'; });
      clearTimeout(ghostTimer);
      ghostTimer = setTimeout(() => { ghost.width = ghost.height = 0; }, 450);
    }

    // ── Readouts ──
    const figuresAll = opts.figures === 'all';
    if (figuresAll) readouts.classList.add('is-all');
    const roPower = Readout(readouts, {
      before: 'Before optimization',
      after: 'Lower reported power',
      ctx: 'Activity-driven power optimization vs baselines, matched workloads',
    });
    const roPair = figuresAll ? PairReadout(readouts) : null;

    // ── Controls ──
    let userTouched = false;
    const segProfile = Segmented(controls, {
      label: 'Activity profile', options: ['Profile 1', 'Profile 2', 'Profile 3'], index: state.profile,
      onSelect: (i) => { userTouched = true; setProfile(i); }, isVisible: () => visible,
    });
    const segImpl = Segmented(controls, {
      label: 'Implementation', options: ['Baseline', 'Optimized'], index: state.optimized ? 1 : 0,
      onSelect: (i) => { userTouched = true; setOptimized(i === 1); }, isVisible: () => visible,
    });

    const PROFILE_DESC = [
      'one dominant hotspot near the centre of the logic',
      'activity spread toward the right of the block',
      'many small, scattered hotspots',
    ];
    function describe() {
      area.setAttribute('aria-label',
        'Illustration, not measured data: a placed-and-routed SoC block seen from above, with memory macros and dense standard-cell rows, ' +
        `overlaid with a relative-activity heatmap. Profile ${state.profile + 1}, ${PROFILE_DESC[state.profile]}. ` +
        (state.optimized
          ? 'Optimized: activity-driven power optimization cools the hotspots, and two-pass placement settles the cells slightly tighter.'
          : 'Baseline: before activity-driven power optimization and two-pass placement.'));
    }

    function applyReadouts() {
      roPower.setOn(state.optimized);
      roPair && roPair.setOn(state.optimized);
    }

    // Offscreen (programmatic) changes land instantly: no springs run
    // out of view, and the next visible frame is already the final one.
    function applyOffscreen() {
      if (bloomed) retarget(true);
      compact.set(state.optimized ? 1 : 0);     // marks the path dirty; loop draws on return
    }

    function setProfile(i) {
      i = Math.max(0, Math.min(2, i));
      if (i === state.profile && bloomed) return;
      state.profile = i;
      segProfile.set(i);
      describe();
      if (reduced()) { crossfade(() => retarget(true)); return; }
      if (!visible) { applyOffscreen(); return; }
      bloomed = true;
      retarget(false);
      wake();
    }
    function setOptimized(on) {
      on = !!on;
      if (on === state.optimized && bloomed) return;
      state.optimized = on;
      segImpl.set(on ? 1 : 0);
      describe();
      applyReadouts();
      if (reduced()) {
        crossfade(() => { retarget(true); compact.set(on ? 1 : 0); maskDirty = true; });
        return;
      }
      if (!visible) { applyOffscreen(); return; }
      bloomed = true;
      retarget(false);
      compact.to(on ? 1 : 0);
      wake();
    }

    // ── First view: heat blooms in, then Baseline → Optimized once ──
    describe();
    applyReadouts();
    if (reduced()) { retarget(true); bloomed = true; }

    let seen = false, autoTimer = 0;
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (!visible || destroyed || e.intersectionRatio < 0.45) return;
      if (!seen) {
        seen = true;
        if (!reduced()) {
          if (!bloomed) { bloomed = true; retarget(false); wake(); }
          if (autoplay) autoTimer = setTimeout(runAuto, 1500);
        }
      } else if (autoTimer === -1) {
        autoTimer = setTimeout(runAuto, 700);
      }
    }, { threshold: [0, 0.45] });
    io.observe(area);
    function runAuto() {
      if (destroyed || userTouched || state.optimized) { autoTimer = 0; return; }
      if (!visible) { autoTimer = -1; return; }       // wait until it's back in view
      autoTimer = 0;
      setOptimized(true);
    }

    const onRM = () => {
      if (destroyed || !reduced()) return;
      retarget(true); bloomed = true;
      compact.set(state.optimized ? 1 : 0); maskDirty = true;
      render();
    };
    F.onReducedMotionChange(onRM);

    // Debug: pin the probe at normalised block coordinates (lab only).
    if (opts.probe) {
      const [u, v] = opts.probe;
      requestAnimationFrame(() => showProbe(L.bx + u * L.bw, L.by + v * L.bh, true));
    }
    ready = true;
    relayout();
    if (reduced()) render(); else wake();

    return {
      setProfile: (n) => { userTouched = true; setProfile(n - 1); },
      setOptimized: (on) => { userTouched = true; setOptimized(on); },
      get state() { return { profile: state.profile + 1, optimized: state.optimized }; },
      get frames() { return frames; },
      get field() { return val; },        // live tile values (read-only; for tests)
      destroy() {
        if (destroyed) return;
        destroyed = true;
        clearTimeout(autoTimer); clearTimeout(ghostTimer);
        loop.stop(); io.disconnect();
        probe.stop(); probeA.stop(); compact.stop();
        segProfile.destroy(); segImpl.destroy();
        roPower.destroy(); roPair && roPair.destroy();
        document.removeEventListener('pointerdown', onDocDown, true);
        // Release backing stores now rather than waiting for GC.
        for (const c of [cv.canvas, base, mask, tmp, ghost]) { c.width = c.height = 0; }
        root.remove();
      },
    };
  }

  K.Arm = { mount };
})();
