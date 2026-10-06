// ─────────────────────────────────────────────────────────────
// KVChip.Story — the RTL-to-GDS centerpiece of the Keynote page.
//
// One sticky, scroll-choreographed stage in three acts:
//   1. The chip    — a packaged flip-chip floating in darkness. three.js
//                    (lazy, rendered on demand) with a CSS-3D fallback.
//   2. The reveal  — the lid lifts away, the camera settles top-down and
//                    pushes in until the bare die fills the stage, then
//                    hands off, pixel-aligned, to a 2D canvas, where the
//                    finished layout peels back, in reverse, to bare silicon.
//   3. The flow    — the die is rebuilt stage by stage: synthesis,
//                    floorplan, placement, clock tree, route, signoff.
//
// Every frame is a pure function of scroll progress p (smoothed by
// KVChip.scrollProgress), so scrubbing backward un-builds exactly.
// Geometry comes from KVChip.rng, so the die is identical on every load.
// Reduced motion: no scrub — the chip and six stage frames render once,
// in normal flow, with the same captions.
//
//   const story = KVChip.Story.mount(sectionEl, { topInset: 52 });
//   story.destroy();
//
// Options: topInset (px of sticky chrome over the stage top, default 52),
// height / mobileHeight (section height in vh, default 700 / 600),
// mode ('auto' | 'css' to force the CSS chip), pin (debug: fixed p).
// Instance: destroy(), jump(stageIndex), setProgress(p|null) (debug pin),
// progress, mode ('scrub' | 'static'), chip ('webgl' | 'css'), ready
// (Promise → chip kind), stats (per-frame render cost), debug().
//
// Load after spring.js and chip-core.js. Classic script.
// ─────────────────────────────────────────────────────────────
(() => {
  'use strict';

  const K = window.KVChip;
  const F = window.Fluid;
  if (!K || !F) {
    console.warn('KVChip.Story: load spring.js and chip-core.js first.');
    return;
  }

  const { palette: PAL, font: FONT, clamp01, lerp, smoothstep, segment, rng } = K;
  const easeOut = K.easeOut;
  const easeInOut = (t) => {
    t = clamp01(t);
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };
  const bump = (t, a, b, c) => smoothstep(segment(t, a, b)) * (1 - smoothstep(segment(t, b, c)));

  const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
  const NS = 'kvc-story';
  const D2R = Math.PI / 180;

  // ── The script ─────────────────────────────────────────────
  // p ∈ [0, 1] across the sticky section.
  //   0 → chipEnd      the chip holds, lit silver, the light drifting slowly
  //   chipEnd → liftEnd the lid lifts; the strip light peaks on it as it
  //                    rises, then the lid goes dark and leaves
  //   liftEnd → cross  the camera settles top-down over the bare die
  //   cross → unb      the 3D die hands off to the pixel-aligned 2D die
  //   unb → unbEnd     the finished layout peels back to bare silicon
  //   flow → finale    six stages of `len` each; then the finale
  const T = { chipEnd: 0.10, liftEnd: 0.19, cross: 0.274, unb: 0.288, unbEnd: 0.326, flow: 0.33, len: 0.095, finale: 0.90 };
  // Where each stage's subject is fully on stage — the stage buttons land here.
  const HERO = [0.42, 0.62, 0.52, 0.62, 0.48, 0.64];

  const STAGES = [
    { name: 'Synthesis', line: 'RTL becomes gates.',
      sr: 'A few lines of SystemVerilog dissolve into a field of logic gates.' },
    { name: 'Floorplan', line: 'Every block finds its place.',
      sr: 'The I/O ring, power rings and straps, and the hard macros take their positions on the die.' },
    { name: 'Placement', line: 'Cells settle into rows.',
      sr: 'Standard cells move out of the netlist into rows, leaving halos around the macros.' },
    { name: 'Clock tree', line: 'Balanced so every flop ticks together.',
      sr: 'A gold H-tree grows from the center of the die and branches evenly, so the clock reaches every leaf at the same moment.' },
    { name: 'Route', line: 'Metal, layer by layer.',
      sr: 'Metal layers draw in from the lowest to the highest, alternating horizontal and vertical, joined by vias.' },
    { name: 'Signoff', line: 'Every path, checked at every corner.',
      sr: 'Static timing traces paths across the die; the worst path is singled out in gold, and timing is met.' },
  ];

  const BEATS = [
    { a: -1, b: 0.178, eyebrow: 'Physical design', line: 'Lift the lid.' },
    { a: 0.182, b: T.flow, eyebrow: 'Under the lid', line: 'One layout, six steps.' },
    ...STAGES.map((s, i) => ({
      a: T.flow + i * T.len, b: T.flow + (i + 1) * T.len,
      eyebrow: `0${i + 1} · ${s.name}`, line: s.line, sr: s.sr,
    })),
    { a: T.finale - 0.004, b: 2, eyebrow: 'Physical design', line: 'RTL to GDS.', finale: true },
  ];
  const CAP_IN = 0.014, CAP_OUT = 0.012, CAP_SHIFT = 14;

  function beatState(p, bt) {
    const fi = bt.a < 0 ? 1 : smoothstep(segment(p, bt.a, bt.a + CAP_IN));
    const fo = bt.b > 1 ? 1 : 1 - smoothstep(segment(p, bt.b - CAP_OUT, bt.b));
    return { a: Math.min(fi, fo), y: (1 - fi) * CAP_SHIFT - (1 - fo) * CAP_SHIFT };
  }

  // Illustrative SystemVerilog — a multiply-accumulate register.
  const CODE = [
    [['always_ff', 'k'], [' @(', 'p'], ['posedge', 'k'], [' ', 'p'], ['clk', 'i'], [') ', 'p'], ['begin', 'k']],
    [['  ', 'p'], ['if', 'k'], [' (!', 'p'], ['rst_n', 'i'], [') ', 'p'], ['acc', 'i'], [' <= ', 'p'], ["'0", 'i'], [';', 'p']],
    [['  ', 'p'], ['else', 'k'], ['        ', 'p'], ['acc', 'i'], [' <= ', 'p'], ['acc', 'i'], [' + ', 'p'], ['a', 'i'], [' * ', 'p'], ['b', 'i'], [';', 'p']],
    [['end', 'k']],
  ];
  const TONE = { k: 'rgba(255,255,255,0.94)', i: 'rgba(255,255,255,0.68)', p: 'rgba(255,255,255,0.40)' };

  // ── Die geometry (die units; 5:4) ──────────────────────────
  const DIE_W = 1200, DIE_H = 960, ASPECT = DIE_W / DIE_H;
  const CORE = { x0: 104, y0: 104, x1: 1096, y1: 856 };
  const CX = 600, CY = 480;
  // SRAM banks line both flanks and the standard-cell logic sits between
  // them, so the clock tree stays balanced without reaching into a macro.
  const LOGIC = { x0: 316, y0: 108, x1: 884, y1: 852 };
  // One fenced region per block of the netlist, split by thin channels.
  // Each has its own utilization and tone; 'slice' regions are datapaths,
  // whose bit-slices stack into aligned columns.
  // `base` tints the region's rows (sites and fillers), `tone` its cells.
  const REGIONS = [
    { x0: 316, x1: 606, y0: 108, y1: 316, kind: 'slice', dens: 0.9, base: 0.05, tone: 0.115 },
    { x0: 618, x1: 884, y0: 108, y1: 316, kind: 'rand', dens: 0.66, base: 0.028, tone: 0.07 },
    { x0: 316, x1: 494, y0: 328, y1: 852, kind: 'rand', dens: 0.82, base: 0.042, tone: 0.095 },
    { x0: 506, x1: 884, y0: 328, y1: 580, kind: 'slice', dens: 0.86, base: 0.036, tone: 0.085 },
    { x0: 506, x1: 690, y0: 592, y1: 852, kind: 'rand', dens: 0.62, base: 0.022, tone: 0.06 },
    { x0: 702, x1: 884, y0: 592, y1: 852, kind: 'rand', dens: 0.8, base: 0.046, tone: 0.1 },
  ];
  const FLOP_LIFT = 0.025;
  // World units for the 3D package (die matches DIE_W:DIE_H).
  const W3 = { die: 12.5, dieD: 10, dieH: 0.45, lid: 22.4, lidH: 1.5, sub: 30, subH: 1.1, dieLift: 1.3 };

  const mk = (w, h) => {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  };

  const models = {};
  function getModel(coarse) {
    return models[coarse ? 'c' : 'f'] || (models[coarse ? 'c' : 'f'] = buildModel(coarse));
  }

  function buildModel(coarse) {
    const R = rng(coarse ? 0x51ed27 : 0x4b5621);
    const m = { coarse, W: DIE_W, H: DIE_H };

    // I/O pads, clockwise from the top-left.
    const pitch = coarse ? 48 : 36, pw = coarse ? 26 : 20, pd = 30, off = 22;
    const run = (len) => {
      const n = Math.floor((len - 200 - pw) / pitch) + 1;
      const s0 = (len - ((n - 1) * pitch + pw)) / 2;
      return Array.from({ length: n }, (_, i) => s0 + i * pitch);
    };
    const xs = run(DIE_W), ys = run(DIE_H);
    m.pads = [
      ...xs.map((x) => ({ x, y: off, w: pw, h: pd })),
      ...ys.map((y) => ({ x: DIE_W - off - pd, y, w: pd, h: pw })),
      ...xs.slice().reverse().map((x) => ({ x, y: DIE_H - off - pd, w: pw, h: pd })),
      ...ys.slice().reverse().map((y) => ({ x: off, y, w: pd, h: pw })),
    ];
    m.rings = [64, 80];

    // Power straps.
    m.straps = [];
    for (let x = CORE.x0 + 34; x < CORE.x1 - 10; x += 62) m.straps.push({ v: 1, c: x, a: 80, b: DIE_H - 80 });
    for (let y = CORE.y0 + 50; y < CORE.y1 - 10; y += 96) m.straps.push({ v: 0, c: y, a: 80, b: DIE_W - 80 });

    // Hard macros: SRAM banks on both flanks, pins facing the logic.
    m.macros = [
      { x: 128, y: 128, w: 176, h: 330, pin: 'r' },
      { x: 128, y: 500, w: 176, h: 332, pin: 'r' },
      { x: 896, y: 128, w: 176, h: 214, pin: 'l' },
      { x: 896, y: 384, w: 176, h: 214, pin: 'l' },
      { x: 896, y: 640, w: 176, h: 192, pin: 'l' },
    ];
    for (const mc of m.macros) {
      const dx = mc.x + mc.w / 2 - CX, dy = mc.y + mc.h / 2 - CY, L = Math.hypot(dx, dy) || 1;
      mc.ux = dx / L; mc.uy = dy / L;
    }

    // Rows and standard cells, region by region. Abutting cells share an
    // edge, so a full row reads as one quiet band rather than speckle.
    const rh = coarse ? 16 : 12, site = coarse ? 4 : 3;
    m.rh = rh;
    m.regions = REGIONS.map((r) => ({ ...r }));
    const SLICE_W = [3, 4, 4, 6, 6, 8, 10];
    for (const rg of m.regions) {
      if (rg.kind !== 'slice') continue;
      const span = rg.x1 - rg.x0, tpl = [];
      let x = 0;
      while (x < span - site * 2) {
        if (R() < 0.1) { x += site * (1 + Math.floor(R() * 2)); continue; }
        const k = SLICE_W[Math.floor(R() * SLICE_W.length)], w = k * site;
        if (x + w > span) break;
        tpl.push({ dx: x, w, flop: k >= 8 && R() < 0.55 });
        x += w;
      }
      rg.tpl = tpl;
    }
    const WIDTHS = [2, 2, 3, 3, 3, 4, 4, 5, 6, 8];
    const wob = (x, y) => 0.94 + 0.06 * Math.sin(x * 0.021 + 1.3) * Math.sin(y * 0.017 + 0.4);
    m.rows = []; m.cells = [];
    for (let y = LOGIC.y0; y + rh <= LOGIC.y1; y += rh) {
      const spans = [];
      m.regions.forEach((rg, ri) => { if (y >= rg.y0 && y + rh <= rg.y1) spans.push([rg.x0, rg.x1, ri]); });
      if (!spans.length) continue;
      m.rows.push({ y, spans });
      for (const [s0, s1, ri] of spans) {
        const rg = m.regions[ri];
        if (rg.tpl) {
          for (const c of rg.tpl) if (R() < rg.dens) m.cells.push({ x: s0 + c.dx, y, w: c.w, flop: c.flop, reg: ri });
          continue;
        }
        let x = s0 + Math.floor(R() * 3) * site;
        while (x < s1 - site * 2) {
          if (R() > rg.dens * wob(x, y)) { x += site * (1 + Math.floor(R() * 3)); continue; }
          const k = WIDTHS[Math.floor(R() * WIDTHS.length)], w = k * site;
          if (x + w > s1) break;
          m.cells.push({ x, y, w, flop: k >= 6 && R() < 0.45, reg: ri });
          x += w;
        }
      }
    }
    // Each region's rows (sites, and the fillers a finished layout puts in
    // every gap) as one faint band per span, under the cells.
    m.bands = m.regions.map((rg) => ({ style: `rgba(255,255,255,${rg.base})`, rects: [] }));
    for (const row of m.rows) for (const [s0, s1, ri] of row.spans) m.bands[ri].rects.push([s0, row.y, s1 - s0]);
    // One fill per region and kind: sort, then record the runs.
    m.cells.sort((a, b) => a.reg - b.reg || (a.flop ? 1 : 0) - (b.flop ? 1 : 0));
    m.slices = [];
    for (let i = 0; i < m.cells.length;) {
      const c = m.cells[i];
      let j = i + 1;
      while (j < m.cells.length && m.cells[j].reg === c.reg && m.cells[j].flop === c.flop) j++;
      const a = m.regions[c.reg].tone + (c.flop ? FLOP_LIFT : 0);
      m.slices.push({ i0: i, i1: j, style: `rgba(255,255,255,${a.toFixed(3)})` });
      i = j;
    }

    // Netlist: cells clustered into nodes; the unplaced netlist is a
    // contracted, softened copy of the placement (square → disc).
    const NX = coarse ? 8 : 11, NY = coarse ? 10 : 14;
    const LW = LOGIC.x1 - LOGIC.x0, LH = LOGIC.y1 - LOGIC.y0;
    const bw = LW / NX, bh = LH / NY;
    const bins = new Map();
    m.cells.forEach((c, i) => {
      const bx = Math.min(NX - 1, Math.floor((c.x + c.w / 2 - LOGIC.x0) / bw));
      const by = Math.min(NY - 1, Math.floor((c.y + rh / 2 - LOGIC.y0) / bh));
      const key = by * NX + bx;
      if (!bins.has(key)) bins.set(key, []);
      bins.get(key).push(i);
    });
    m.nodes = [];
    const RX = coarse ? 310 : 280, RY = coarse ? 236 : 212;
    for (const list of bins.values()) {
      let sx = 0, sy = 0;
      for (const i of list) { sx += m.cells[i].x + m.cells[i].w / 2; sy += m.cells[i].y + rh / 2; }
      const fx = sx / list.length, fy = sy / list.length;
      const u = (fx - CX) / (LW / 2), v = (fy - CY) / (LH / 2);
      const n = { th: Math.atan2(v, u), r: Math.hypot(u, v), cells: list, type: R() < 0.64 ? 0 : 1 + Math.floor(R() * 3) };
      for (const i of list) m.cells[i].node = m.nodes.length;
      m.nodes.push(n);
    }
    // Even out the cloud: keep each node's direction (so placement still
    // blooms radially), but re-space radii per sector for a round blob.
    const SECT = coarse ? 12 : 18;
    for (let k = 0; k < SECT; k++) {
      const lo = -Math.PI + (k * 2 * Math.PI) / SECT, hi = lo + (2 * Math.PI) / SECT;
      const ns = m.nodes.filter((n) => n.th >= lo && (n.th < hi || (k === SECT - 1 && n.th <= Math.PI)));
      ns.sort((a, b) => a.r - b.r);
      ns.forEach((n, i) => {
        const rr = Math.sqrt((i + 0.5) / ns.length) * (0.9 + R() * 0.12);
        const th = n.th + (R() - 0.5) * 0.12;
        n.x = CX + Math.cos(th) * rr * RX;
        n.y = CY + Math.sin(th) * rr * RY;
      });
    }
    m.edges = [];
    const seen = new Set();
    m.nodes.forEach((a, i) => {
      const near = [];
      m.nodes.forEach((b, j) => { if (j !== i) near.push([j, (b.x - a.x) ** 2 + (b.y - a.y) ** 2]); });
      near.sort((p, q) => p[1] - q[1]);
      for (const [j] of near.slice(0, 2)) {
        const key = Math.min(i, j) * 4096 + Math.max(i, j);
        if (!seen.has(key)) { seen.add(key); m.edges.push([i, j]); }
      }
    });
    for (let k = 0; k < m.nodes.length * 0.06; k++) {
      const i = Math.floor(R() * m.nodes.length), j = Math.floor(R() * m.nodes.length);
      if (i !== j) m.edges.push([i, j]);
    }

    // Placement timing: a bloom from the center outward.
    const maxD = Math.hypot(LOGIC.x1 - CX, LOGIC.y1 - CY);
    for (const c of m.cells) {
      const n = m.nodes[c.node];
      c.sx = n.x + (R() - 0.5) * 10; c.sy = n.y + (R() - 0.5) * 10;
      const r = Math.min(1, Math.hypot(c.x + c.w / 2 - CX, c.y + rh / 2 - CY) / maxD);
      c.delay = 0.08 + 0.52 * r + (R() - 0.5) * 0.08;
      c.drain = 0.66 * (1 - r) + R() * 0.06;      // the rewind empties the rim first
    }
    for (const n of m.nodes) {
      let lo = 1, hi = 0;
      for (const i of n.cells) { lo = Math.min(lo, m.cells[i].delay); hi = Math.max(hi, m.cells[i].delay); }
      n.lo = lo; n.hi = hi;
    }

    // Clock: an H-tree over the logic. Every root→leaf path is the same
    // length, which is the whole point; the SRAMs take one branch each, to
    // the clock pin on the edge that faces the logic.
    const levels = coarse ? 4 : 5;
    m.levels = levels;
    m.tree = Array.from({ length: levels }, () => []);
    m.joints = [];
    let ends = [{ x: CX, y: CY, d: 0 }], lenH = LW / 4, lenV = LH / 4;
    for (let l = 0; l < levels; l++) {
      const horiz = l % 2 === 0, len = horiz ? lenH : lenV, next = [];
      for (const e of ends) {
        for (const sg of [-1, 1]) {
          const x1 = horiz ? e.x + sg * len : e.x, y1 = horiz ? e.y : e.y + sg * len;
          m.tree[l].push({ x0: e.x, y0: e.y, x1, y1, d0: e.d, len });
          next.push({ x: x1, y: y1, d: e.d + len });
        }
        if (l > 0) m.joints.push(e);
      }
      ends = next;
      if (horiz) lenH /= 2; else lenV /= 2;
    }
    m.treeLen = ends[0].d;
    m.leaves = ends;
    const flops = [];
    m.cells.forEach((c, i) => { if (c.flop) flops.push(i); });
    m.stubs = [];
    const taken = new Set();
    for (const lf of m.leaves) {
      const near = [];
      for (const i of flops) {
        if (taken.has(i)) continue;
        const c = m.cells[i];
        const d = Math.abs(c.x + c.w / 2 - lf.x) + Math.abs(c.y + rh / 2 - lf.y);
        if (d < 110) near.push([i, d]);
      }
      near.sort((a, b) => a[1] - b[1]);
      for (const [i, d] of near.slice(0, coarse ? 4 : 6)) {
        taken.add(i);
        const c = m.cells[i];
        m.stubs.push({ x0: lf.x, y0: lf.y, x1: c.x + c.w / 2, y1: c.y + rh / 2, len: d, cell: i });
      }
    }
    m.pins = [];
    for (const mc of m.macros) {
      const ex = mc.pin === 'r' ? mc.x + mc.w : mc.x;
      let best = null, bd = Infinity;
      for (const lf of m.leaves) {
        if (lf.y < mc.y + 24 || lf.y > mc.y + mc.h - 24) continue;
        const d = Math.abs(lf.x - ex) * 2 + Math.abs(lf.y - (mc.y + mc.h / 2));
        if (d < bd) { bd = d; best = lf; }
      }
      if (best) m.pins.push({ x0: best.x, y0: best.y, x1: ex, y1: best.y, len: Math.abs(ex - best.x), side: mc.pin });
    }
    m.stubMax = [...m.stubs, ...m.pins].reduce((a, s) => Math.max(a, s.len), 1);

    // Routing: six layers, alternating direction (M1 horizontal). The lower
    // two are local — short, dense, dim; the upper ones are fewer, longer
    // runs on a regular track grid. `a`/`b` span each wire along its axis.
    const KN = coarse ? 0.55 : 1;
    const LX0 = LOGIC.x0 + 6, LX1 = LOGIC.x1 - 6, LY0 = LOGIC.y0 + 6, LY1 = LOGIC.y1 - 6;
    m.wires = [[], [], [], [], [], []];
    const pushW = (L, x0, y0, x1, y1) => {
      const h = L % 2 === 0;
      m.wires[L].push({ x0, y0, x1, y1, a: h ? x0 : y0, b: h ? x1 : y1 });
    };
    for (const row of m.rows) {
      for (const [s0, s1] of row.spans) {
        let x = s0 + R() * 24;
        while (x < s1 - 14) {
          const x1 = Math.min(s1 - 2, x + 10 + R() * 30);
          if (R() < (coarse ? 0.24 : 0.34)) { const yy = row.y + rh * (0.3 + 0.4 * R()); pushW(0, x, yy, x1, yy); }
          x = x1 + 10 + R() * 40;
        }
      }
    }
    const rand = (a, b) => a + R() * (b - a);
    const add = (L, n, gen) => {
      for (let k = 0, made = 0; k < n * 4 && made < n; k++) {
        const w = gen();
        if (!w || w[0] < LX0 || w[2] > LX1 || w[1] < LY0 || w[3] > LY1) continue;
        if (w[2] - w[0] + w[3] - w[1] < 8) continue;
        pushW(L, w[0], w[1], w[2], w[3]); made++;
      }
    };
    add(1, 200 * KN, () => {
      const r = m.rows[Math.floor(R() * m.rows.length)], sp = r.spans[Math.floor(R() * r.spans.length)];
      const x = Math.round(rand(sp[0] + 4, sp[1] - 4) / 3) * 3, y0 = r.y + rh / 2;
      return [x, y0, x, y0 + rh * (1 + Math.floor(R() * 3))];
    });
    add(2, 110 * KN, () => {
      const y = Math.round(rand(LY0, LY1) / 6) * 6, x0 = rand(LX0, LX1 - 90);
      return [x0, y, Math.min(LX1, x0 + rand(80, 260)), y];
    });
    add(3, 84 * KN, () => {
      const x = Math.round(rand(LX0, LX1) / 8) * 8, y0 = rand(LY0, LY1 - 90);
      return [x, y0, x, Math.min(LY1, y0 + rand(80, 240))];
    });
    const tracks = (n) => {
      const t = Array.from({ length: n }, (_, i) => i);
      for (let i = n - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [t[i], t[j]] = [t[j], t[i]]; }
      return t;
    };
    const t5 = tracks(23), t6 = tracks(14);
    add(4, 18 * KN + 4, () => {
      if (!t5.length) return null;
      const y = LOGIC.y0 + 18 + t5.pop() * 32, x0 = LX0 + Math.round(rand(0, 240) / 16) * 16;
      return [x0, y, Math.min(LX1, x0 + Math.round(rand(240, 540) / 16) * 16), y];
    });
    add(5, 10 * KN + 3, () => {
      if (!t6.length) return null;
      const x = LOGIC.x0 + 20 + t6.pop() * 40, y0 = LY0 + Math.round(rand(0, 280) / 16) * 16;
      return [x, y0, x, Math.min(LY1, y0 + Math.round(rand(240, 620) / 16) * 16)];
    });

    // Timing paths. Path 0 is the worst one, laid out by hand for a clean
    // read: top-left block to bottom-right block, arriving from above.
    const flopNear = (x, y) => {
      let best = null, bd = Infinity;
      for (const i of flops) {
        const c = m.cells[i], d = Math.abs(c.x + c.w / 2 - x) + Math.abs(c.y + rh / 2 - y);
        if (d < bd) { bd = d; best = c; }
      }
      return best ? { x: best.x + best.w / 2, y: best.y + rh / 2 } : { x, y };
    };
    const mkPath = (pts) => {
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.abs(pts[i][0] - pts[i - 1][0]) + Math.abs(pts[i][1] - pts[i - 1][1]));
      return { pts, cum, len: cum[cum.length - 1] };
    };
    const A = flopNear(372, 222), B = flopNear(826, 716);
    m.paths = [mkPath([[A.x, A.y], [A.x, 404], [556, 404], [556, 528], [770, 528], [770, B.y], [B.x, B.y]])];
    for (const [x0, y0, x1, y1] of [[352, 500, 470, 690], [650, 156, 850, 262], [540, 350, 700, 466], [724, 620, 864, 790], [372, 780, 650, 640]]) {
      const a = flopNear(x0, y0), b = flopNear(x1, y1), xm = lerp(a.x, b.x, 0.3 + R() * 0.4);
      m.paths.push(mkPath([[a.x, a.y], [xm, a.y], [xm, b.y], [b.x, b.y]]));
    }
    m.capture = m.paths[0].pts[m.paths[0].pts.length - 1];
    return m;
  }

  // ── 2D die renderer ────────────────────────────────────────
  // Draws in die units through one transform. Static layers live in
  // offscreen canvases; only the animating layer is drawn per frame.
  const EDGE_A = 0.13, DOT_T = 0.18;
  const TREE_W = [3.6, 3.0, 2.5, 2.0, 1.6];
  const METAL_W = [0.8, 0.9, 1.1, 1.4, 2.0, 2.4];
  // Resting tone per layer (× the palette's metal ramp): the local layers
  // stay a texture; the long upper runs carry the structure.
  const ROUTE_K = [0.4, 0.42, 0.44, 0.46, 0.62, 0.66];
  const VIA = [0, 2, 2.2, 2.6, 3.4, 3.8];
  const VIA_A = [0, 0.05, 0.06, 0.08, 0.15, 0.18];
  // Stage 5: each layer sweeps the logic over [RA[L], RA[L] + RD] of local
  // time, H layers left → right and V layers top → bottom, led by a bright
  // band BAND die units long.
  const RA = [0.1, 0.225, 0.35, 0.475, 0.6, 0.725], RD = 0.15, BAND = 110;
  const MET_A = PAL.metal.map((c) => parseFloat(c.split(',')[3]));
  const LIVE_A = [0.3, 0.32, 0.36, 0.4, 0.5, 0.58];
  const DIM_CLOCK = 'rgba(255,255,255,0.32)';
  const BRIGHT = 'rgba(255,244,222,0.95)';

  function createRenderer(m) {
    let k = 1, s = 1, dpr = 1, cw = 0, ch = 0, bw = 0, bh = 0;
    let blankC = null, floorC = null, cellsC = null, finalC = null, scratch = null, macroS = [], code = null, timer = 0;
    const N = m.cells.length;
    const X = new Float32Array(N), Y = new Float32Array(N), Wd = new Float32Array(N), Hd = new Float32Array(N);
    const BK = new Uint8Array(N), EQ = new Uint8Array(m.edges.length);
    const api = { onRebuild: null, model: m };

    const U = (ctx) => ctx.setTransform(k, 0, 0, k, 0, 0);
    const lw = (u, minPx = 0.8) => Math.max(u, minPx / k);

    function setSize(w, h, ratio) {
      cw = w; ch = h; dpr = ratio; s = w / m.W; k = s * dpr;
      if (!finalC) { build(); return; }
      if (Math.round(cw * dpr) === bw && Math.round(ch * dpr) === bh) return;
      clearTimeout(timer);
      timer = setTimeout(() => { build(); api.onRebuild && api.onRebuild(); }, 140);
    }

    let buildMs = 0;
    function build() {
      const t0 = performance.now();
      bw = Math.max(1, Math.round(cw * dpr)); bh = Math.max(1, Math.round(ch * dpr));
      macroS = m.macros.map(macroSprite);
      // Every frame is composed from these layers, so anything that persists
      // across a stage boundary reaches the screen the same way on both sides.
      blankC = mk(bw, bh);
      blank(blankC.getContext('2d'));
      floorC = mk(bw, bh);
      const f = floorC.getContext('2d');
      f.drawImage(blankC, 0, 0); floor(f, 1);
      cellsC = mk(bw, bh);
      const c = cellsC.getContext('2d');
      U(c); cellsAt(c, 1);
      finalC = mk(bw, bh);
      const g = finalC.getContext('2d');
      g.drawImage(floorC, 0, 0); g.drawImage(cellsC, 0, 0);
      U(g); tree(g, Infinity, false, 1); drawRoutes(g, 1);
      code = layoutCode();
      buildMs = performance.now() - t0;
    }

    function blit(ctx, src, a) {
      if (a <= 0.001) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = a;
      ctx.drawImage(src, 0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.globalAlpha = 1;
    }
    const base = (ctx) => { blit(ctx, blankC, 1); U(ctx); };   // clean silicon

    function blank(ctx) {
      U(ctx);
      ctx.fillStyle = PAL.die;
      ctx.fillRect(0, 0, m.W, m.H);
      const e = Math.max(1, dpr) / k;
      ctx.lineWidth = e;
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.strokeRect(e / 2, e / 2, m.W - e, m.H - e);
      ctx.lineWidth = lw(0.6, 0.75);
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.strokeRect(10, 10, m.W - 20, m.H - 20);
    }

    function macroSprite(mc) {
      const W = Math.max(4, Math.round(mc.w * k)), H = Math.max(4, Math.round(mc.h * k));
      const c = mk(W, H), g = c.getContext('2d');
      const one = Math.max(1, Math.round(dpr));
      g.fillStyle = '#17171b';
      g.fillRect(0, 0, W, H);
      const vertPins = mc.pin === 'l' || mc.pin === 'r';
      const per = Math.round((vertPins ? W : H) * 0.15);
      const spine = Math.max(2, Math.round((vertPins ? H : W) * 0.06));
      // Periphery strip on the pin side.
      g.fillStyle = 'rgba(255,255,255,0.05)';
      if (mc.pin === 'b') g.fillRect(0, H - per, W, per);
      else if (mc.pin === 't') g.fillRect(0, 0, W, per);
      else if (mc.pin === 'r') g.fillRect(W - per, 0, per, H);
      else g.fillRect(0, 0, per, H);
      // Bit-cell banks either side of the decoder spine: a fine mesh.
      const ax0 = mc.pin === 'l' ? per : 0, ay0 = mc.pin === 't' ? per : 0;
      const ax1 = mc.pin === 'r' ? W - per : W, ay1 = mc.pin === 'b' ? H - per : H;
      const step = Math.max(3, Math.round(3 * dpr));
      g.fillStyle = 'rgba(255,255,255,0.045)';
      for (let y = ay0 + step; y < ay1 - 1; y += step) g.fillRect(ax0 + one, y, ax1 - ax0 - 2 * one, one);
      g.fillStyle = 'rgba(255,255,255,0.03)';
      for (let x = ax0 + step * 2; x < ax1 - 1; x += step * 2) g.fillRect(x, ay0 + one, one, ay1 - ay0 - 2 * one);
      g.fillStyle = '#1d1d22';
      if (vertPins) g.fillRect(ax0, Math.round((ay0 + ay1 - spine) / 2), ax1 - ax0, spine);
      else g.fillRect(Math.round((ax0 + ax1 - spine) / 2), ay0, spine, ay1 - ay0);
      // Pins along the pin edge.
      g.fillStyle = 'rgba(255,255,255,0.32)';
      const pinStep = Math.max(4 * one, Math.round(9 * k)), pinLen = Math.max(2 * one, Math.round(5 * k));
      if (vertPins) for (let y = pinStep; y < H - pinStep / 2; y += pinStep) g.fillRect(mc.pin === 'r' ? W - pinLen : 0, y, pinLen, one);
      else for (let x = pinStep; x < W - pinStep / 2; x += pinStep) g.fillRect(x, mc.pin === 'b' ? H - pinLen : 0, one, pinLen);
      g.strokeStyle = 'rgba(255,255,255,0.28)';
      g.lineWidth = one;
      g.strokeRect(one / 2, one / 2, W - one, H - one);
      if (W / dpr > 64 && H / dpr > 40) {
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        const lx = mc.pin === 'l' ? per / dpr + 7 : 7, ly = mc.pin === 't' ? per / dpr + 15 : 15;
        K.label(g, 'SRAM', lx, ly, { size: W / dpr > 120 ? 10 : 9, color: 'rgba(255,255,255,0.5)' });
      }
      return c;
    }

    function ringPath(ctx, i, u) {
      const x0 = i, y0 = i, x1 = m.W - i, y1 = m.H - i;
      ctx.beginPath();
      if (u >= 1) { ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.stroke(); return; }
      const pts = [x0, y0, x1, y0, x1, y1, x0, y1, x0, y0];
      let rem = 2 * ((x1 - x0) + (y1 - y0)) * u;
      ctx.moveTo(x0, y0);
      for (let q = 2; q < pts.length && rem > 0; q += 2) {
        const ax = pts[q - 2], ay = pts[q - 1], bx = pts[q], by = pts[q + 1];
        const L = Math.abs(bx - ax) + Math.abs(by - ay), f = Math.min(1, rem / L);
        ctx.lineTo(ax + (bx - ax) * f, ay + (by - ay) * f);
        rem -= L;
      }
      ctx.stroke();
    }

    // Floorplan: pads → rings → straps → macros. t = 1 is the finished frame.
    // Everything is in place by t≈.5, so the finished floorplan holds under
    // its caption for the second half of the stage.
    function floor(ctx, t) {
      U(ctx);
      const n = m.pads.length;
      ctx.lineWidth = lw(1);
      for (let q = 0; q < n; q++) {
        const u = t >= 1 ? 1 : segment(t, 0.03 + 0.14 * q / n, 0.09 + 0.14 * q / n);
        if (u <= 0) continue;
        const pd = m.pads[q], e = easeOut(u), sc = 0.55 + 0.45 * e;
        const w = pd.w * sc, h = pd.h * sc, x = pd.x + (pd.w - w) / 2, y = pd.y + (pd.h - h) / 2;
        ctx.globalAlpha = e;
        ctx.fillStyle = 'rgba(255,255,255,0.075)';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = 'rgba(255,255,255,0.26)';
        ctx.strokeRect(x, y, w, h);
      }
      ctx.globalAlpha = 1;
      for (let r = 0; r < 2; r++) {
        const u = t >= 1 ? 1 : easeInOut(segment(t, 0.10 + r * 0.03, 0.30 + r * 0.03));
        if (u <= 0) continue;
        const i = m.rings[r];
        ctx.lineWidth = 9; ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ringPath(ctx, i, u);
        ctx.lineWidth = lw(0.9); ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ringPath(ctx, i - 4.5, u); ringPath(ctx, i + 4.5, u);
      }
      const nS = m.straps.length;
      for (let j = 0; j < nS; j++) {
        const st = m.straps[j];
        const u = t >= 1 ? 1 : easeOut(segment(t, 0.18 + 0.12 * j / nS, 0.28 + 0.12 * j / nS));
        if (u <= 0) continue;
        ctx.lineWidth = lw(st.v ? 3 : 2);
        ctx.strokeStyle = st.v ? 'rgba(255,255,255,0.075)' : 'rgba(255,255,255,0.055)';
        ctx.beginPath();
        if (st.v) { ctx.moveTo(st.c, st.a); ctx.lineTo(st.c, st.a + (st.b - st.a) * u); }
        else { ctx.moveTo(st.a, st.c); ctx.lineTo(st.a + (st.b - st.a) * u, st.c); }
        ctx.stroke();
      }
      for (let i = 0; i < m.macros.length; i++) {
        const mc = m.macros[i];
        const u = t >= 1 ? 1 : segment(t, 0.20 + 0.04 * i, 0.34 + 0.04 * i);
        if (u <= 0) continue;
        const e = easeOut(u), d = (1 - e) * 80;
        ctx.globalAlpha = smoothstep(Math.min(1, u * 1.8));
        ctx.drawImage(macroS[i], mc.x + mc.ux * d, mc.y + mc.uy * d, mc.w, mc.h);
      }
      ctx.globalAlpha = 1;
    }

    // Settled cells: one fill per region and kind (m.slices), each region in
    // its own tone. Cells abut, so a full row reads as one quiet band.
    function rowsAt(ctx, a) {
      if (a <= 0.002) return;
      const rh = m.rh;
      ctx.globalAlpha = a;
      for (const b of m.bands) {
        ctx.fillStyle = b.style;
        ctx.beginPath();
        for (const r of b.rects) ctx.rect(r[0], r[1] + 1, r[2], rh - 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function cellsAt(ctx, a) {
      const rh = m.rh;
      rowsAt(ctx, a);
      ctx.globalAlpha = a;
      for (const sl of m.slices) {
        ctx.fillStyle = sl.style;
        ctx.beginPath();
        for (let i = sl.i0; i < sl.i1; i++) { const c = m.cells[i]; ctx.rect(c.x, c.y + 1, c.w, rh - 2); }
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Placement: every cell leaves its netlist node and eases into its slot.
    const FLY = 0.30;
    const FLY_A = [0, 0.62, 0.42, 0.26];
    function cellsFlight(ctx, t) {
      const rh = m.rh;
      for (let i = 0; i < N; i++) {
        const c = m.cells[i];
        const u = segment(t, c.delay, c.delay + FLY);
        if (u <= 0) { BK[i] = 0; continue; }
        if (u >= 1) { BK[i] = 4; continue; }
        const e = easeInOut(u);
        const w = lerp(2.6, c.w, e), h = lerp(2.6, rh - 2, e);
        X[i] = lerp(c.sx, c.x + c.w / 2, e) - w / 2;
        Y[i] = lerp(c.sy, c.y + rh / 2, e) - h / 2;
        Wd[i] = w; Hd[i] = h;
        BK[i] = 1 + Math.min(2, Math.floor(e * 3));
      }
      for (const sl of m.slices) {            // settled: the region's own tone
        ctx.fillStyle = sl.style;
        ctx.beginPath();
        let any = false;
        for (let i = sl.i0; i < sl.i1; i++) {
          if (BK[i] !== 4) continue;
          const c = m.cells[i];
          ctx.rect(c.x, c.y + 1, c.w, rh - 2);
          any = true;
        }
        if (any) ctx.fill();
      }
      for (let b = 1; b <= 3; b++) {          // in flight: bright, dimming as they land
        ctx.fillStyle = `rgba(255,255,255,${FLY_A[b]})`;
        ctx.beginPath();
        let any = false;
        for (let i = 0; i < N; i++) {
          if (BK[i] !== b) continue;
          ctx.rect(X[i], Y[i], Wd[i], Hd[i]);
          any = true;
        }
        if (any) ctx.fill();
      }
    }

    // The rewind: cells drain from the rim toward the center, the reverse of
    // the placement bloom. v: 0 = all placed, 1 = none.
    function cellsDrain(ctx, v) {
      const rh = m.rh;
      for (let i = 0; i < N; i++) {
        const k = 1 - smoothstep(segment(v, m.cells[i].drain, m.cells[i].drain + 0.28));
        BK[i] = k >= 0.999 ? 4 : Math.round(k * 3);
      }
      for (const sl of m.slices) {
        ctx.fillStyle = sl.style;
        for (let b = 4; b >= 1; b--) {
          ctx.globalAlpha = b === 4 ? 1 : b / 4;
          ctx.beginPath();
          let any = false;
          for (let i = sl.i0; i < sl.i1; i++) {
            if (BK[i] !== b) continue;
            const c = m.cells[i];
            ctx.rect(c.x, c.y + 1, c.w, rh - 2);
            any = true;
          }
          if (any) ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }

    function gateGlyph(ctx, x, y, type, g) {
      const h = g / 2;
      ctx.beginPath();
      if (type === 1) {            // AND
        ctx.moveTo(x - h, y - h); ctx.lineTo(x, y - h); ctx.arc(x, y, h, -Math.PI / 2, Math.PI / 2); ctx.lineTo(x - h, y + h); ctx.closePath();
      } else if (type === 2) {     // buffer / inverter
        ctx.moveTo(x - h, y - h); ctx.lineTo(x + h * 0.6, y); ctx.lineTo(x - h, y + h); ctx.closePath();
        ctx.moveTo(x + h * 0.6 + h * 0.5, y); ctx.arc(x + h * 0.6 + h * 0.25, y, h * 0.25, 0, Math.PI * 2);
      } else {                     // OR
        ctx.moveTo(x - h, y - h); ctx.quadraticCurveTo(x + h * 0.4, y - h, x + h, y);
        ctx.quadraticCurveTo(x + h * 0.4, y + h, x - h, y + h); ctx.quadraticCurveTo(x - h * 0.4, y, x - h, y - h);
      }
      ctx.stroke();
    }

    // Netlist nodes + nets. mode 1: synthesis (nodes arrive), 2: floorplan
    // (uniform, receding), 3: placement (nodes empty out).
    function net(ctx, mode, t) {
      const nodes = m.nodes, g = m.coarse ? 18 : 13;
      let ea = 0;
      if (mode === 2) ea = EDGE_A * (1 - 0.5 * smoothstep(segment(t, 0, 0.3)));
      if (mode === 3) ea = 0.5 * EDGE_A * (1 - smoothstep(segment(t, 0.04, 0.3)));
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = lw(0.8, 0.7);
      if (mode === 1) {
        for (let i = 0; i < m.edges.length; i++) EQ[i] = Math.round(smoothstep(segment(t, code.edgeT0[i], code.edgeT0[i] + 0.06)) * 4);
        for (let q = 1; q <= 4; q++) {
          ctx.globalAlpha = EDGE_A * q / 4;
          ctx.beginPath();
          for (let i = 0; i < m.edges.length; i++) {
            if (EQ[i] !== q) continue;
            const a = nodes[m.edges[i][0]], b = nodes[m.edges[i][1]];
            ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
          }
          ctx.stroke();
        }
      } else if (ea > 0.002) {
        ctx.globalAlpha = ea;
        ctx.beginPath();
        for (const [ia, ib] of m.edges) { ctx.moveTo(nodes[ia].x, nodes[ia].y); ctx.lineTo(nodes[ib].x, nodes[ib].y); }
        ctx.stroke();
      }
      const base = mode === 2 ? 1 - 0.5 * smoothstep(segment(t, 0, 0.3)) : mode === 3 ? 0.5 : 1;
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.strokeStyle = 'rgba(255,255,255,0.74)';
      ctx.lineWidth = lw(1.1, 0.8);
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        let a = base;
        if (mode === 1) a = smoothstep(segment(t, code.arr[i] - 0.01, code.arr[i] + 0.05));
        else if (mode === 3) a = base * (1 - segment(t, n.lo, n.hi + 0.08));
        if (a <= 0.004) continue;
        ctx.globalAlpha = a;
        if (n.type === 0) ctx.fillRect(n.x - 2.4, n.y - 2.4, 4.8, 4.8);
        else gateGlyph(ctx, n.x, n.y, n.type, g);
      }
      ctx.globalAlpha = 1;
    }

    function layoutCode() {
      const fontPx = Math.min(17, Math.max(10.5, cw * 0.0195));
      const tmp = mk(8, 8).getContext('2d');
      tmp.font = `500 ${fontPx}px ${FONT.mono}`;
      const advPx = tmp.measureText('0').width, lhPx = Math.round(fontPx * 1.7);
      const cols = Math.max(...CODE.map((l) => l.reduce((n, t) => n + t[0].length, 0)));
      const adv = advPx / s, lh = lhPx / s;
      const x0 = CX - (cols * adv) / 2, y0 = CY - (CODE.length * lh) / 2 - lh * 0.25;
      const spr = mk(Math.ceil(cols * advPx * dpr) + 4, Math.ceil(CODE.length * lhPx * dpr) + 4);
      const g = spr.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.font = tmp.font;
      g.textBaseline = 'middle';
      const glyphs = [];
      CODE.forEach((tokens, li) => {
        let col = 0;
        for (const [text, tone] of tokens) {
          g.fillStyle = TONE[tone];
          for (const chr of text) {
            if (chr !== ' ') {
              g.fillText(chr, col * advPx, li * lhPx + lhPx / 2);
              glyphs.push({ li, col, x: x0 + col * adv, y: y0 + li * lh, sx: col * advPx * dpr, sy: li * lhPx * dpr });
            }
            col++;
          }
        }
      });
      // The dissolve sweeps left → right across every line at once, like a
      // compiler pass; glyphs feed the nodes on their side of the netlist.
      for (const gl of glyphs) gl.dep = 0.46 + 0.2 * (gl.col / cols) + 0.012 * gl.li;
      const byX = glyphs.slice().sort((a, b) => a.x - b.x || a.y - b.y);
      const order = m.nodes.map((_, i) => i).sort((a, b) => m.nodes[a].x - m.nodes[b].x);
      const R = rng(0x91);
      const dots = order.map((ni, r) => {
        const gl = byX[Math.min(byX.length - 1, Math.floor((r / order.length) * byX.length))];
        const n = m.nodes[ni];
        const sx = gl.x + adv * (0.2 + 0.6 * R()), sy = gl.y + lh * (0.3 + 0.4 * R());
        const dx = n.x - sx, dy = n.y - sy, L = Math.hypot(dx, dy) || 1;
        const arc = (R() - 0.5) * Math.min(90, L * 0.5);
        return {
          sx, sy, ex: n.x, ey: n.y, node: ni, dep: gl.dep + R() * 0.03,
          cx: (sx + n.x) / 2 - (dy / L) * arc, cy: (sy + n.y) / 2 + (dx / L) * arc,
        };
      });
      const arr = new Float32Array(m.nodes.length).fill(2);
      for (const d of dots) arr[d.node] = Math.min(arr[d.node], d.dep + DOT_T);
      const edgeT0 = m.edges.map(([a, b]) => Math.min(0.92, Math.max(arr[a], arr[b]) + 0.02));
      return { glyphs, spr, sw: advPx * dpr, sh: lhPx * dpr, adv, lh, dots, arr, edgeT0 };
    }

    // Clock tree. D is the growth front (distance from the root); past the
    // tree length it grows the leaf stubs.
    function tree(ctx, D, gold, a) {
      if (a <= 0.002) return;
      ctx.globalAlpha = a;
      ctx.strokeStyle = gold ? PAL.gold : DIM_CLOCK;
      ctx.fillStyle = gold ? PAL.gold : DIM_CLOCK;
      ctx.lineCap = 'butt';
      const sc = m.coarse ? 1.35 : 1;
      for (let l = 0; l < m.levels; l++) {
        ctx.lineWidth = lw(TREE_W[l] * sc, 1);
        ctx.beginPath();
        for (const sg of m.tree[l]) {
          const v = D - sg.d0;
          if (v <= 0) continue;
          const f = Math.min(1, v / sg.len);
          ctx.moveTo(sg.x0, sg.y0);
          ctx.lineTo(sg.x0 + (sg.x1 - sg.x0) * f, sg.y0 + (sg.y1 - sg.y0) * f);
        }
        ctx.stroke();
      }
      // Buffers at the root and at every branch point the front has reached.
      const b0 = 8 * sc;
      if (D > 0) ctx.fillRect(CX - b0 / 2, CY - b0 / 2, b0, b0);
      const bj = 4.6 * sc;
      for (const j of m.joints) if (D >= j.d) ctx.fillRect(j.x - bj / 2, j.y - bj / 2, bj, bj);
      const sd = D - m.treeLen;
      if (sd > 0) {
        const bl = 3.6 * sc;
        for (const lf of m.leaves) ctx.fillRect(lf.x - bl / 2, lf.y - bl / 2, bl, bl);
        // Each SRAM takes one branch, to its clock pin on the facing edge.
        ctx.lineWidth = lw(TREE_W[m.levels - 1] * sc, 1);
        ctx.beginPath();
        for (const pn of m.pins) {
          const f = Math.min(1, sd / pn.len);
          ctx.moveTo(pn.x0, pn.y0);
          ctx.lineTo(pn.x0 + (pn.x1 - pn.x0) * f, pn.y0);
        }
        ctx.stroke();
        const ph = 9 * sc, pw = 3 * sc;
        for (const pn of m.pins) {
          if (sd < pn.len) continue;
          ctx.fillRect(pn.side === 'r' ? pn.x1 : pn.x1 - pw, pn.y1 - ph / 2, pw, ph);
        }
        ctx.globalAlpha = a * 0.62;
        ctx.lineWidth = lw(0.9, 0.8);
        ctx.beginPath();
        for (const st of m.stubs) {
          let rem = Math.min(sd, st.len);
          const hx = st.x1 - st.x0, hl = Math.abs(hx);
          ctx.moveTo(st.x0, st.y0);
          const fx = Math.min(rem, hl);
          ctx.lineTo(st.x0 + Math.sign(hx) * fx, st.y0);
          rem -= fx;
          if (rem > 0) ctx.lineTo(st.x1, st.y0 + Math.sign(st.y1 - st.y0) * Math.min(rem, Math.abs(st.y1 - st.y0)));
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    function treePulse(ctx, head, len) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = BRIGHT;
      for (let l = 0; l < m.levels; l++) {
        ctx.lineWidth = lw(TREE_W[l] * (m.coarse ? 1.35 : 1) + 1.4, 1.2);
        ctx.beginPath();
        for (const sg of m.tree[l]) {
          const a = Math.max(head - len, sg.d0), b = Math.min(head, sg.d0 + sg.len);
          if (b <= a) continue;
          const fa = (a - sg.d0) / sg.len, fb = (b - sg.d0) / sg.len;
          ctx.moveTo(sg.x0 + (sg.x1 - sg.x0) * fa, sg.y0 + (sg.y1 - sg.y0) * fa);
          ctx.lineTo(sg.x0 + (sg.x1 - sg.x0) * fb, sg.y0 + (sg.y1 - sg.y0) * fb);
        }
        if (l === m.levels - 1) {             // the pulse carries on into the SRAM pins
          for (const pn of m.pins) {
            const a = Math.max(head - len, m.treeLen), b = Math.min(head, m.treeLen + pn.len);
            if (b <= a) continue;
            const fa = (a - m.treeLen) / pn.len, fb = (b - m.treeLen) / pn.len;
            ctx.moveTo(pn.x0 + (pn.x1 - pn.x0) * fa, pn.y0);
            ctx.lineTo(pn.x0 + (pn.x1 - pn.x0) * fb, pn.y0);
          }
        }
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    function flopsLit(ctx, a) {
      if (a <= 0.002) return;
      const rh = m.rh;
      ctx.globalAlpha = 1;
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.9, a).toFixed(3)})`;
      ctx.beginPath();
      for (const st of m.stubs) { const c = m.cells[st.cell]; ctx.rect(c.x + 0.5, c.y + 1, c.w - 1, rh - 2); }
      ctx.fill();
    }

    // Metal. t is stage-5 local time (t ≥ 1: the finished stack). Wires run
    // from `a` to `b` along their axis and are drawn up to the layer's front.
    // Live (the route stage) adds a bright head behind the front, steps each
    // finished layer back while the next one draws, and tags the layer being
    // drawn; otherwise wires sit at their resting tone (the finished die, and
    // the rewind, which runs the fronts backward).
    function drawRoutes(ctx, t, o) {
      const live = !!(o && o.live), back = live ? o.back : 1;
      const sc = m.coarse ? 1.4 : 1;
      ctx.lineCap = 'butt';
      let tag = null;
      for (let L = 0; L < 6; L++) {
        const f = t >= 1 ? 1 : easeInOut(segment(t, RA[L], RA[L] + RD));
        if (f <= 0) break;
        const horiz = L % 2 === 0;
        const S0 = horiz ? LOGIC.x0 : LOGIC.y0, S1 = horiz ? LOGIC.x1 : LOGIC.y1;
        const fr = f >= 1 ? Infinity : lerp(S0, S1 + (live ? BAND : 0), f);
        // Live: the layer being drawn is lifted well above its resting tone;
        // once it lands it settles below rest, so the next layer leads.
        const rest = MET_A[L] * ROUTE_K[L];
        const act = 1 - smoothstep(segment(t, RA[L] + RD, RA[L] + RD + 0.06));
        const lit = live ? lerp(lerp(rest * 0.5, LIVE_A[L], act), rest, back) : rest;
        const k = lit / rest;
        const ws = m.wires[L];
        ctx.strokeStyle = '#fff';
        ctx.globalAlpha = lit;
        ctx.lineWidth = lw(METAL_W[L] * sc, 0.7);
        ctx.beginPath();
        for (let i = 0; i < ws.length; i++) {
          const w = ws[i], e = Math.min(w.b, fr);
          if (e <= w.a) continue;
          if (horiz) { ctx.moveTo(w.a, w.y0); ctx.lineTo(e, w.y0); }
          else { ctx.moveTo(w.x0, w.a); ctx.lineTo(w.x0, e); }
        }
        ctx.stroke();
        if (L > 0) {                                   // vias land as the front passes each end
          const v = VIA[L] * sc, hv = v / 2;
          ctx.fillStyle = '#fff';
          ctx.globalAlpha = Math.min(0.6, VIA_A[L] * k);
          ctx.beginPath();
          for (let i = 0; i < ws.length; i++) {
            const w = ws[i];
            if (w.a < fr) ctx.rect(w.x0 - hv, w.y0 - hv, v, v);
            if (w.b < fr) ctx.rect(w.x1 - hv, w.y1 - hv, v, v);
          }
          ctx.fill();
        }
        if (!live || f >= 1) continue;
        // The head: the last BAND units of every wire under the front, bright
        // at the tip and fading back into the layer's resting tone.
        const g = horiz ? ctx.createLinearGradient(fr - BAND, 0, fr, 0) : ctx.createLinearGradient(0, fr - BAND, 0, fr);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(1, 'rgba(255,255,255,0.92)');
        ctx.strokeStyle = g;
        ctx.globalAlpha = 1;
        ctx.lineWidth = lw(METAL_W[L] * sc + 0.4, 1);
        ctx.beginPath();
        for (let i = 0; i < ws.length; i++) {
          const w = ws[i], s0 = Math.max(w.a, fr - BAND), e = Math.min(w.b, fr);
          if (e <= s0) continue;
          if (horiz) { ctx.moveTo(s0, w.y0); ctx.lineTo(e, w.y0); }
          else { ctx.moveTo(w.x0, s0); ctx.lineTo(w.x0, e); }
        }
        ctx.stroke();
        const ta = smoothstep(segment(f, 0, 0.06)) * (1 - smoothstep(segment(f, 0.9, 0.995)));
        if (ta > 0.01) {
          // The leading edge: one hairline across the logic at the front.
          const q = Math.min(fr, S1);
          ctx.globalAlpha = 0.34 * ta;
          ctx.strokeStyle = BRIGHT;
          ctx.lineWidth = lw(0.6, 1);
          ctx.beginPath();
          if (horiz) { ctx.moveTo(q, LOGIC.y0); ctx.lineTo(q, LOGIC.y1); }
          else { ctx.moveTo(LOGIC.x0, q); ctx.lineTo(LOGIC.x1, q); }
          ctx.stroke();
          tag = { L, horiz, fr: q, a: ta };
        }
      }
      ctx.globalAlpha = 1;
      if (tag) layerTag(ctx, tag);
    }

    // The one canvas label in this stage: the layer being drawn, riding just
    // ahead of its front at the edge of the logic.
    function layerTag(ctx, tg) {
      const fs = cw < 560 ? 9 : 10, text = `M${tg.L + 1}`;
      const tw = Math.ceil(text.length * fs * 0.68) + 10, th = fs + 7;
      let x, y;
      if (tg.horiz) {
        x = Math.min(LOGIC.x1 * s - tw - 4, tg.fr * s + 5);
        y = LOGIC.y0 * s + 5;
      } else {
        x = LOGIC.x0 * s + 5;
        y = Math.min(LOGIC.y1 * s - th - 4, tg.fr * s + 5);
      }
      x = Math.round(x); y = Math.round(y);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = tg.a;
      ctx.fillStyle = 'rgba(17,17,20,0.9)';
      K.roundRect(ctx, x, y, tw, th, 4);
      ctx.fill();
      K.label(ctx, text, x + tw / 2, y + th / 2 + 0.5, { size: fs, color: 'rgba(255,255,255,0.8)', align: 'center', baseline: 'middle' });
      ctx.globalAlpha = 1;
      U(ctx);
    }

    function pathPart(ctx, P, d0, d1) {
      d0 = Math.max(0, d0); d1 = Math.min(P.len, d1);
      if (d1 <= d0) return;
      ctx.beginPath();
      let started = false;
      for (let i = 1; i < P.pts.length; i++) {
        const c0 = P.cum[i - 1], c1 = P.cum[i];
        if (c1 < d0) continue;
        if (c0 > d1) break;
        const ax = P.pts[i - 1][0], ay = P.pts[i - 1][1], bx = P.pts[i][0], by = P.pts[i][1];
        const L = c1 - c0 || 1, f0 = Math.max(0, (d0 - c0) / L), f1 = Math.min(1, (d1 - c0) / L);
        if (!started) { ctx.moveTo(ax + (bx - ax) * f0, ay + (by - ay) * f0); started = true; }
        ctx.lineTo(ax + (bx - ax) * f1, ay + (by - ay) * f1);
      }
      ctx.stroke();
    }

    function marker(ctx, x, y, a) {
      if (a <= 0.002) return;
      const r = m.coarse ? 9 : 7;
      ctx.globalAlpha = a;
      ctx.fillStyle = PAL.die;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.strokeStyle = PAL.gold;
      ctx.lineWidth = lw(1.6, 1);
      ctx.strokeRect(x - r, y - r, r * 2, r * 2);
      ctx.globalAlpha = 1;
    }

    function worstPath(ctx, d, a, head) {
      const P = m.paths[0];
      ctx.lineCap = 'butt';
      ctx.lineJoin = 'miter';
      ctx.strokeStyle = PAL.gold;
      ctx.globalAlpha = a;
      ctx.lineWidth = lw(m.coarse ? 3 : 2.3, 1.2);
      pathPart(ctx, P, 0, d);
      if (head) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = BRIGHT;
        ctx.globalAlpha = 1;
        ctx.lineWidth = lw(m.coarse ? 4 : 3.2, 1.6);
        pathPart(ctx, P, d - 80, d);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.globalAlpha = 1;
      marker(ctx, P.pts[0][0], P.pts[0][1], a * smoothstep(Math.min(1, d / 30)));
      marker(ctx, m.capture[0], m.capture[1], a * smoothstep(segment(d, P.len - 20, P.len)));
    }

    // ── Stages (t = local progress 0..1) ──
    function synth(ctx, t) {
      base(ctx);
      const C = code;
      for (let i = 0; i < C.glyphs.length; i++) {
        const g = C.glyphs[i];
        const la = smoothstep(segment(t, 0.10 + g.li * 0.05, 0.22 + g.li * 0.05));
        const a = la * (1 - smoothstep(segment(t, g.dep, g.dep + 0.07)));
        if (a <= 0.003) continue;
        ctx.globalAlpha = a;
        ctx.drawImage(C.spr, g.sx, g.sy, C.sw, C.sh, g.x, g.y + (1 - la) * C.lh * 0.35, C.adv, C.lh);
      }
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      const ds = m.coarse ? 4.6 : 3.4;
      for (const d of C.dots) {
        const u = segment(t, d.dep, d.dep + DOT_T);
        if (u <= 0 || u >= 1) continue;
        const e = easeInOut(u), ie = 1 - e;
        const x = ie * ie * d.sx + 2 * ie * e * d.cx + e * e * d.ex;
        const y = ie * ie * d.sy + 2 * ie * e * d.cy + e * e * d.ey;
        ctx.rect(x - ds / 2, y - ds / 2, ds, ds);
      }
      ctx.fill();
      ctx.globalAlpha = 1;
      net(ctx, 1, t);
    }

    // The live floorplan is drawn through an offscreen scratch canvas — the
    // same raster path as the cached layers placement starts from — and the
    // netlist sits on top in both, so the 0.5 seam is invisible.
    function floorAt(ctx, t) {
      if (t >= 1) { blit(ctx, floorC, 1); return; }
      if (!scratch || scratch.width !== bw || scratch.height !== bh) scratch = mk(bw, bh);
      const sc = scratch.getContext('2d');
      sc.setTransform(1, 0, 0, 1, 0, 0);
      sc.drawImage(blankC, 0, 0);
      floor(sc, t);
      blit(ctx, scratch, 1);
    }

    function floorplan(ctx, t) {
      floorAt(ctx, t);
      U(ctx);
      net(ctx, 2, t);
    }

    // Placement: the regions' rows come up first, then every cell leaves its
    // netlist node and eases into its slot.
    function place(ctx, t) {
      blit(ctx, floorC, 1);
      U(ctx);
      rowsAt(ctx, smoothstep(segment(t, 0, 0.16)));
      cellsFlight(ctx, t);
      net(ctx, 3, t);
    }

    function cts(ctx, t) {
      blit(ctx, floorC, 1);
      blit(ctx, cellsC, 1 - 0.5 * smoothstep(segment(t, 0, 0.14)));
      U(ctx);
      const D = m.treeLen * easeInOut(segment(t, 0.10, 0.60)) + m.stubMax * segment(t, 0.60, 0.70);
      flopsLit(ctx, 0.16 * smoothstep(segment(t, 0.62, 0.72)) + 0.24 * bump(t, 0.888, 0.902, 0.96));
      tree(ctx, D, true, 1);
      const tau = segment(t, 0.74, 0.90);
      if (tau > 0 && tau < 1) treePulse(ctx, tau * (m.treeLen + 60), 70);
    }

    // Route: the cells and the clock step back so the layer being drawn is
    // the brightest thing on the die; at the end everything returns to its
    // resting tone, which is exactly the finished die signoff starts from.
    function route(ctx, t) {
      const back = smoothstep(segment(t, 0.9, 1));
      blit(ctx, floorC, 1);
      blit(ctx, cellsC, lerp(lerp(0.5, 0.2, smoothstep(segment(t, 0, 0.12))), 1, back));
      U(ctx);
      const mix = smoothstep(segment(t, 0, 0.14));
      flopsLit(ctx, 0.16 * (1 - smoothstep(segment(t, 0, 0.15))));
      tree(ctx, Infinity, true, 1 - mix);
      tree(ctx, Infinity, false, mix * lerp(lerp(1, 0.5, smoothstep(segment(t, 0.08, 0.2))), 1, back));
      drawRoutes(ctx, t, { live: true, back });
    }

    // The rewind between the reveal and synthesis: the finished die peels
    // back to bare silicon in reverse build order — metal (top layer first),
    // the clock tree into its root, the cells toward the center, then the
    // floorplan. u: 0 = the finished die, 1 = blank.
    function unbuild(ctx, u) {
      floorAt(ctx, 1 - easeInOut(segment(u, 0.58, 1)));
      const vc = segment(u, 0.28, 0.74);
      if (vc <= 0) blit(ctx, cellsC, 1);
      U(ctx);
      if (vc > 0 && vc < 1) { rowsAt(ctx, 1 - smoothstep(segment(vc, 0.2, 1))); cellsDrain(ctx, vc); }
      tree(ctx, (m.treeLen + m.stubMax) * (1 - easeInOut(segment(u, 0.14, 0.46))), false, 1);
      drawRoutes(ctx, lerp(RA[5] + RD, RA[0], easeInOut(segment(u, 0, 0.34))));
    }

    function signoff(ctx, t) {
      base(ctx);
      blit(ctx, finalC, 1 - 0.55 * smoothstep(segment(t, 0, 0.12)));
      U(ctx);
      ctx.lineCap = 'butt';
      ctx.lineJoin = 'miter';
      ctx.strokeStyle = '#fff';
      const trace = 1 - smoothstep(segment(t, 0.46, 0.6));
      for (let j = 1; j < m.paths.length; j++) {
        const P = m.paths[j], a0 = 0.10 + 0.05 * (j - 1);
        const tau = segment(t, a0, a0 + 0.24);
        if (tau <= 0) continue;
        const d = P.len * easeInOut(tau);
        if (trace > 0.002) { ctx.globalAlpha = 0.26 * trace; ctx.lineWidth = lw(1.4, 1); pathPart(ctx, P, 0, d); }
        if (tau < 1) { ctx.globalAlpha = 0.95; ctx.lineWidth = lw(2.4, 1.4); pathPart(ctx, P, d - 70, d); }
      }
      ctx.globalAlpha = 1;
      const tw = segment(t, 0.40, 0.66);
      if (tw > 0) worstPath(ctx, m.paths[0].len * easeInOut(tw), 1 - 0.28 * smoothstep(segment(t, 0.70, 0.86)), tw < 1);
    }

    function finale(ctx, t) {
      base(ctx);
      blit(ctx, finalC, 0.45 + 0.55 * smoothstep(segment(t, 0, 0.3)));
      U(ctx);
      const ga = 0.72 * (1 - smoothstep(segment(t, 0, 0.22)));
      if (ga > 0.002) worstPath(ctx, m.paths[0].len, ga, false);
      const gt = segment(t, 0.30, 0.82);
      if (gt > 0 && gt < 1) {
        const W = ctx.canvas.width, H = ctx.canvas.height;
        const x = lerp(-0.45, 1.45, easeInOut(gt)) * W;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const grd = ctx.createLinearGradient(x - W * 0.2, -H * 0.1, x + W * 0.2, H * 0.3);
        grd.addColorStop(0, 'rgba(255,255,255,0)');
        grd.addColorStop(0.5, 'rgba(255,255,255,0.075)');
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'source-over';
      }
    }

    const STAGE_FNS = [synth, floorplan, place, cts, route, signoff, finale];
    function draw(ctx, p) {
      if (!finalC) return;
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      if (p < T.unb) { blit(ctx, finalC, 1); return; }
      if (p < T.flow) { unbuild(ctx, segment(p, T.unb, T.unbEnd)); return; }
      const i = Math.min(6, Math.floor((p - T.flow) / T.len));
      STAGE_FNS[i](ctx, clamp01((p - T.flow - i * T.len) / T.len));
    }

    // Reduced-motion key frames. Synthesis gets its own composition — the
    // RTL above, the netlist it becomes below — since a still of the
    // dissolve reads as noise. The rest are stage end states.
    const STILL_T = [0, 1, 1, 1, 1, 0.8];
    function drawStill(ctx, i) {
      if (!finalC) return;
      if (i > 0) { draw(ctx, T.flow + i * T.len + STILL_T[i] * T.len * 0.999); return; }
      base(ctx);
      const C = code;
      ctx.save();
      ctx.translate(0, -150);
      for (const g of C.glyphs) ctx.drawImage(C.spr, g.sx, g.sy, C.sw, C.sh, g.x, g.y, C.adv, C.lh);
      ctx.restore();
      ctx.save();
      ctx.translate(CX, CY + 130);
      ctx.scale(0.68, 0.68);
      ctx.translate(-CX, -CY);
      net(ctx, 2, 0);
      ctx.restore();
    }

    api.setSize = setSize;
    api.draw = draw;
    api.drawStill = drawStill;
    api.debug = () => ({ bw, bh, cw, ch, dpr, k, buildMs: +buildMs.toFixed(1), cells: N, nodes: m.nodes.length, wires: m.wires.map((w) => w.length) });
    api.dispose = () => clearTimeout(timer);
    Object.defineProperty(api, 'finalCanvas', { get: () => finalC });
    return api;
  }

  // ── Shared package artwork (3D textures and the CSS fallback) ──
  function etchMarks(ctx, S, style) {
    ctx.save();
    ctx.fillStyle = style;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const big = Math.round(S * 0.17), small = Math.round(S * 0.029);
    ctx.font = `600 ${big}px ${FONT.sans}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${(-big * 0.02).toFixed(1)}px`;
    ctx.fillText('KV', S / 2, S * 0.548);
    ctx.font = `500 ${small}px ${FONT.sans}`;
    let track = 0;
    if ('letterSpacing' in ctx) { track = small * 0.34; ctx.letterSpacing = `${track.toFixed(1)}px`; }
    ctx.fillText('PHYSICAL DESIGN', S / 2 + track / 2, S * 0.628);
    const m = S * 0.075, t = S * 0.032;    // pin-1 mark
    ctx.beginPath();
    ctx.moveTo(m, S - m); ctx.lineTo(m + t, S - m); ctx.lineTo(m, S - m - t); ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function padGrid(ctx, S, draw) {
    const u = S / W3.sub, pitch = 0.6 * u, keep = 2.3 * u;
    for (const r of [0.55, 1.15, 1.75]) {
      const inset = r * u;
      for (let a = keep; a <= S - keep; a += pitch) {
        draw(a, inset); draw(a, S - inset); draw(inset, a); draw(S - inset, a);
      }
    }
  }

  // ── WebGL chip (three.js, lazy) ────────────────────────────
  let webglOK = null;
  function hasWebGL() {
    if (webglOK !== null) return webglOK;
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      webglOK = !!gl;
      const lose = gl && gl.getExtension('WEBGL_lose_context');
      lose && lose.loseContext();
    } catch (e) { webglOK = false; }
    return webglOK;
  }

  // A machined slab: rounded-rect footprint, 45° chamfer on the top edge,
  // smooth normals around the corners, crisp across the chamfer.
  // Groups: 0 top face, 1 chamfer, 2 sides + bottom.
  function slabGeometry(THREE, { w, d, h, r, c, seg }) {
    const pos = [], nor = [], uv = [], idx = [], groups = [];
    const ax = w / 2 - r, az = d / 2 - r, ring = [];
    const corners = [[ax, az], [-ax, az], [-ax, -az], [ax, -az]];
    for (let q = 0; q < 4; q++) {
      for (let j = 0; j <= seg; j++) {
        const a = (q + j / seg) * Math.PI / 2;
        ring.push([corners[q][0], corners[q][1], Math.cos(a), Math.sin(a)]);
      }
    }
    const N = ring.length;
    let vc = 0;
    const V = (x, y, z, nx, ny, nz, u, v) => { pos.push(x, y, z); nor.push(nx, ny, nz); uv.push(u, v); return vc++; };
    const at = (i, inset, y) => { const q = ring[i], rr = r - inset; return [q[0] + q[2] * rr, y, q[1] + q[3] * rr]; };
    const capUV = (x, z) => [(x + w / 2) / w, 1 - (z + d / 2) / d];
    const group = (fn, mi) => { const s0 = idx.length; fn(); groups.push([s0, idx.length - s0, mi]); };
    const cap = (inset, y, ny) => {
      const ci = V(0, y, 0, 0, ny, 0, ...capUV(0, 0)), first = vc;
      for (let i = 0; i < N; i++) { const p = at(i, inset, y); V(p[0], p[1], p[2], 0, ny, 0, ...capUV(p[0], p[2])); }
      for (let i = 0; i < N; i++) {
        if (ny > 0) idx.push(ci, first + ((i + 1) % N), first + i);
        else idx.push(ci, first + i, first + ((i + 1) % N));
      }
    };
    const band = (i0, y0, n0, i1, y1, n1) => {
      const first = vc;
      for (let i = 0; i < N; i++) {
        const q = ring[i];
        let p = at(i, i0, y0); V(p[0], p[1], p[2], q[2] * n0[0], n0[1], q[3] * n0[0], i / N, 0);
        p = at(i, i1, y1); V(p[0], p[1], p[2], q[2] * n1[0], n1[1], q[3] * n1[0], i / N, 1);
      }
      for (let i = 0; i < N; i++) {
        const a = first + i * 2, b = a + 1, a2 = first + ((i + 1) % N) * 2, b2 = a2 + 1;
        idx.push(a, a2, b, a2, b2, b);
      }
    };
    const s2 = Math.SQRT1_2;
    group(() => cap(c, h, 1), 0);
    group(() => { if (c > 0) band(c, h, [s2, s2], 0, h - c, [s2, s2]); }, 1);
    group(() => { band(0, h - c, [1, 0], 0, 0, [1, 0]); cap(0, 0, -1); }, 2);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    for (const [s0, n, mi] of groups) g.addGroup(s0, n, mi);
    return g;
  }

  // Reveal choreography shared by the WebGL and CSS chips.
  // The lid leaves the frame while the camera is still oblique; only then
  // does the camera swing top-down — so the lid never hangs between the
  // lens and the die.
  // On a phone the lid crosses the chrome sooner, so it fades out sooner.
  function revealState(p, narrow) {
    // sw: how far the strip light has swept, 0 (lit silver) → ~.23 (brightest)
    // → .65 (graphite). It barely drifts while the chip holds, then peaks on
    // the lid as it starts to rise.
    return {
      chipT: segment(p, 0, T.liftEnd),
      sw: 0.09 * segment(p, 0, 0.11) + 0.91 * smoothstep(segment(p, 0.11, 0.21)),
      rot: easeInOut(segment(p, 0.170, 0.270)),
      push: easeInOut(segment(p, 0.175, 0.275)),
      // Accelerates away: the first few units of rise read clearly, then it goes.
      lift: Math.pow(segment(p, T.chipEnd, T.liftEnd), 1.6),
      lidFade: narrow ? smoothstep(segment(p, 0.145, 0.168)) : smoothstep(segment(p, 0.16, 0.182)),
      dieLift: easeInOut(segment(p, 0.150, 0.235)),
      drop: easeInOut(segment(p, 0.160, 0.245)),
      subFade: smoothstep(segment(p, 0.215, 0.255)),
      sheen: 1 - smoothstep(segment(p, 0.205, 0.242)),
    };
  }
  const chipFit = (L) => (L.mobile ? Math.min(L.chip.w * 0.92, L.chip.h * 1.5) : Math.min(L.chip.w * 0.5, L.chip.h * 1.4));

  async function createGLChip(parent, dieCanvas, { still = false, small = false } = {}) {
    const THREE = await import(THREE_URL);
    const canvas = document.createElement('canvas');
    canvas.className = `${NS}-gl`;
    canvas.setAttribute('aria-hidden', 'true');
    const renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: still,
    });
    renderer.setClearColor(0x000000, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    parent.appendChild(canvas);

    const scene = new THREE.Scene();
    const trash = [];
    const keep = (x) => { trash.push(x); return x; };

    // Studio: a few emissive softboxes in the dark, prefiltered once.
    const studio = new THREE.Scene();
    studio.background = new THREE.Color(0x000000);
    const boxGeo = new THREE.PlaneGeometry(1, 1);
    const boxMats = [];
    const softbox = (w, h, I, az, el, dist) => {
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(I, I, I), side: THREE.DoubleSide });
      boxMats.push(mat);
      const ms = new THREE.Mesh(boxGeo, mat);
      const a = az * D2R, e = el * D2R;
      ms.position.set(Math.sin(a) * Math.cos(e) * dist, Math.sin(e) * dist, Math.cos(a) * Math.cos(e) * dist);
      ms.lookAt(0, 0, 0);
      ms.scale.set(w, h, 1);
      studio.add(ms);
    };
    softbox(18, 12, 1.3, 0, 82, 22);      // broad overhead key
    softbox(64, 15, 0.34, 180, 24, 24);   // wide, dim backdrop: the lid always holds a soft gradient
    softbox(2.6, 18, 4.2, 180, 26, 22);   // tall strip behind — the sweep across the lid
    softbox(1.8, 14, 4.5, 105, 12, 22);   // rim, back-left
    softbox(1.8, 14, 3.0, -115, 14, 22);  // rim, back-right
    softbox(16, 6, 0.3, 15, 30, 24);      // faint front fill
    const pm = new THREE.PMREMGenerator(renderer);
    const envRT = pm.fromScene(studio, 0.02, 0.1, 100);
    pm.dispose(); boxGeo.dispose(); boxMats.forEach((mm) => mm.dispose());
    scene.environment = envRT.texture;

    const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    // The lid never exceeds ~900 device px on screen; 1536 is ample.
    const S = small ? 1024 : 1536;
    const tex = (c, srgb) => {
      const t = keep(new THREE.CanvasTexture(c));
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = aniso;
      return t;
    };

    // Lid: machined graphite, softly brushed, etched monogram.
    const lidCol = mk(S, S), lc = lidCol.getContext('2d');
    const lg = lc.createRadialGradient(S * 0.5, S * 0.42, 0, S * 0.5, S * 0.5, S * 0.75);
    lg.addColorStop(0, '#b4b7bc'); lg.addColorStop(1, '#a3a6ab');
    lc.fillStyle = lg; lc.fillRect(0, 0, S, S);
    etchMarks(lc, S, '#86898e');
    const lidDat = mk(S, S), ld = lidDat.getContext('2d');   // R height · G roughness · B metalness
    ld.fillStyle = 'rgb(255,62,255)'; ld.fillRect(0, 0, S, S);
    const RB = rng(0xb2);
    for (let i = 0; i < S * 2.2; i++) {
      const len = S * (0.08 + RB() * 0.6);
      ld.fillStyle = `rgba(${245 + Math.floor(RB() * 10)},${Math.round((0.24 + (RB() - 0.5) * 0.1) * 255)},255,${(0.18 + RB() * 0.32).toFixed(2)})`;
      ld.fillRect(RB() * S * 1.2 - S * 0.1, RB() * S, len, 0.5 + RB() * 1.4);
    }
    etchMarks(ld, S, 'rgb(150,166,255)');
    const lidColT = tex(lidCol, true), lidDatT = tex(lidDat, false);

    // Substrate: dark laminate with a fine grid of contact pads at the edges.
    const SS = 1024;
    const subCol = mk(SS, SS), sc2 = subCol.getContext('2d');
    sc2.fillStyle = '#0c0d0f'; sc2.fillRect(0, 0, SS, SS);
    const subDat = mk(SS, SS), sd2 = subDat.getContext('2d');
    sd2.fillStyle = 'rgb(255,150,0)'; sd2.fillRect(0, 0, SS, SS);
    const pad = 0.34 * SS / W3.sub;
    padGrid(sc2, SS, (x, y) => { sc2.fillStyle = '#7f8287'; sc2.fillRect(x - pad / 2, y - pad / 2, pad, pad); });
    padGrid(sd2, SS, (x, y) => { sd2.fillStyle = 'rgb(255,118,255)'; sd2.fillRect(x - pad / 2, y - pad / 2, pad, pad); });
    const subColT = tex(subCol, true), subDatT = tex(subDat, false);

    // Contact shadow under the lid; fades as the lid lifts.
    const shC = mk(256, 256), shx = shC.getContext('2d'), plane = W3.lid + 4, kk = 256 / plane, lw = W3.lid * kk;
    shx.shadowColor = 'rgba(0,0,0,0.95)'; shx.shadowBlur = 1.1 * kk * 2; shx.shadowOffsetX = 2048;
    shx.fillStyle = '#000'; shx.fillRect((256 - lw) / 2 - 2048, (256 - lw) / 2, lw, lw);
    const shT = tex(shC, false);

    // Die: the finished layout from the 2D renderer, shown exactly as drawn
    // (no tone mapping) so the handoff to the 2D canvas is seamless.
    const dieT = tex(dieCanvas || mk(4, 4), true);

    const M = THREE.MeshPhysicalMaterial;
    const lidTop = keep(new M({
      color: 0xffffff, map: lidColT, metalness: 1, roughness: 1, metalnessMap: lidDatT, roughnessMap: lidDatT,
      bumpMap: lidDatT, bumpScale: 0.6, anisotropy: 0.35, clearcoat: 0.12, clearcoatRoughness: 0.35, transparent: true,
    }));
    const lidCham = keep(new M({ color: 0xc8cbd0, metalness: 1, roughness: 0.13, transparent: true }));
    const lidSide = keep(new M({ color: 0xa1a4a9, metalness: 1, roughness: 0.3, anisotropy: 0.3, transparent: true }));
    const lidMats = [lidTop, lidCham, lidSide];
    const subTop = keep(new M({
      color: 0xffffff, map: subColT, metalness: 1, roughness: 1, metalnessMap: subDatT, roughnessMap: subDatT, transparent: true,
    }));
    const subEdge = keep(new M({ color: 0x141518, metalness: 0, roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.3, transparent: true }));
    const subMats = [subTop, subEdge];
    const dieSide = keep(new M({ color: 0x24262b, metalness: 0.3, roughness: 0.32 }));
    const dieTop = keep(new THREE.MeshBasicMaterial({ map: dieT, toneMapped: false }));
    const sheenMat = keep(new M({
      color: 0x000000, metalness: 0, roughness: 0.2, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    const shadowMat = keep(new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: shT, transparent: true, depthWrite: false }));

    const chip = new THREE.Group();
    scene.add(chip);
    const subG = new THREE.Group(), dieG = new THREE.Group();
    chip.add(subG, dieG);
    const subMesh = new THREE.Mesh(keep(slabGeometry(THREE, { w: W3.sub, d: W3.sub, h: W3.subH, r: 0.6, c: 0.1, seg: 6 })), [subTop, subEdge, subEdge]);
    subMesh.position.y = -W3.subH;
    const shadow = new THREE.Mesh(keep(new THREE.PlaneGeometry(plane, plane)), shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.004;
    subG.add(subMesh, shadow);
    const dieMesh = new THREE.Mesh(keep(new THREE.BoxGeometry(W3.die, W3.dieH, W3.dieD)), [dieSide, dieSide, dieTop, dieSide, dieSide, dieSide]);
    dieMesh.position.y = W3.dieH / 2;
    const sheen = new THREE.Mesh(keep(new THREE.PlaneGeometry(W3.die, W3.dieD)), sheenMat);
    sheen.rotation.x = -Math.PI / 2;
    sheen.position.y = W3.dieH + 0.002;
    dieG.add(dieMesh, sheen);
    const lid = new THREE.Mesh(keep(slabGeometry(THREE, { w: W3.lid, d: W3.lid, h: W3.lidH, r: 1.5, c: 0.34, seg: 12 })), lidMats);
    chip.add(lid);

    const FOV = 22, TANF = Math.tan((FOV * D2R) / 2);
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 2000);
    const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
    const vR = new THREE.Vector3(), vB = new THREE.Vector3(), v3 = new THREE.Vector3(), eu = new THREE.Euler();
    let W = 1, H = 1;

    function resize(L) {
      W = L.W; H = L.H;
      let pr = Math.min(1.5, window.devicePixelRatio || 1);
      while (pr > 1 && W * H * pr * pr > 3.6e6) pr -= 0.125;
      renderer.setPixelRatio(pr);
      renderer.setSize(W, H, false);
      camera.aspect = W / H;
    }

    function render(p, tx, ty, L) {
      const r = revealState(p, L.mobile);
      lid.position.y = r.lift * 34;
      lid.visible = r.lidFade < 0.999;
      for (const mt of lidMats) mt.opacity = 1 - r.lidFade;
      dieG.position.y = r.dieLift * W3.dieLift;
      subG.position.y = -r.drop * 1.1;
      subG.visible = r.subFade < 0.999 && p < T.cross;
      for (const mt of subMats) mt.opacity = 1 - r.subFade;
      shadowMat.opacity = 0.9 * (1 - smoothstep(segment(p, T.chipEnd, 0.15)));
      sheenMat.envMapIntensity = 2.6 * r.sheen;
      sheen.visible = r.sheen > 0.002;

      const az = (36 - 8 * r.chipT) * (1 - r.rot) * D2R, el = lerp(26, 90, r.rot) * D2R;
      // The strip light sweeps across the lid with scroll; the pointer nudges it.
      scene.environmentRotation.set(0, lerp(-0.64, 0.75, r.sw) + 0.5 * r.rot + tx * 0.05 * (1 - r.rot), 0);

      // Pointer tilt: a few degrees toward the pointer, in camera space.
      // (A reflection moves twice the tilt, so 3° is plenty.)
      const kt = 3 * D2R * (1 - r.rot);
      vR.set(Math.cos(az), 0, -Math.sin(az));
      vB.set(Math.sin(az), 0, Math.cos(az));
      qa.setFromAxisAngle(vR, ty * kt);
      qb.setFromAxisAngle(vB, -tx * kt);
      chip.quaternion.copy(qa).multiply(qb);

      // Camera: 3/4 hero → top-down, pushing in until the die face lands
      // exactly on L.die (the 2D canvas rect). Lens shift keeps framing.
      const fpx = L.H / 2 / TANF;
      const D1 = (42 * fpx) / chipFit(L), D2 = (W3.die * fpx) / L.die.w;
      const dist = Math.exp(lerp(Math.log(D1), Math.log(D2), r.push));
      const ty0 = lerp(0.2, W3.dieH + W3.dieLift * r.dieLift, r.push);
      const sx = lerp(L.chip.x + L.chip.w / 2, L.die.x + L.die.w / 2, r.push) - L.W / 2;
      const sy = lerp(L.chip.y + L.chip.h / 2, L.die.y + L.die.h / 2, r.push) - L.H / 2;
      eu.set(-el, az, 0, 'YXZ');
      camera.quaternion.setFromEuler(eu);
      v3.set(0, 0, dist).applyQuaternion(camera.quaternion);
      camera.position.set(v3.x, v3.y + ty0, v3.z);
      camera.setViewOffset(L.W, L.H, -sx, -sy, L.W, L.H);
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    }

    // Warm up while the section is still offscreen: compile every program
    // and upload every texture now, so the first visible frame doesn't hitch.
    camera.position.set(0, 24, 60);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    try { await renderer.compileAsync(scene, camera); } catch (e) { /* falls back to compiling on first render */ }
    for (const t of [lidColT, lidDatT, subColT, subDatT, shT, dieT]) renderer.initTexture(t);

    const api = {
      el: canvas, kind: 'webgl', resize, render, onLost: null,
      setDie(c) { if (c && dieT.image !== c) { dieT.image = c; dieT.needsUpdate = true; } },
      dispose() {
        trash.forEach((x) => x.dispose && x.dispose());
        envRT.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
        canvas.remove();
      },
    };
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); api.onLost && api.onLost(); });
    return api;
  }

  // ── CSS-3D chip (no WebGL, or while three.js loads) ────────
  function createCSSChip(parent) {
    const B = 600, lidPx = B * W3.lid / W3.sub, diePx = [B * W3.die / W3.sub, B * W3.dieD / W3.sub];
    const subT = B * W3.subH / W3.sub, lidT = B * W3.lidH / W3.sub, P = 1800;
    const root = document.createElement('div');
    root.className = `${NS}-css`;
    root.setAttribute('aria-hidden', 'true');
    const sides = (cls) => ['n', 'e', 's', 'w'].map((d) => `<i class="${NS}-css-side is-${d} ${cls}"></i>`).join('');
    root.innerHTML = `
      <div class="${NS}-css-pkg" style="width:${B}px;height:${B}px">
        <div class="${NS}-css-sub" style="--t:${subT}px">${sides('is-sub')}</div>
        <canvas class="${NS}-css-die" width="2" height="2" style="width:${diePx[0]}px;height:${diePx[1]}px"></canvas>
        <div class="${NS}-css-lid" style="width:${lidPx}px;height:${lidPx}px;--t:${lidT}px">
          ${sides('is-lid')}<div class="${NS}-css-top"><b class="${NS}-css-shade"></b><b class="${NS}-css-sheen"></b></div>
        </div>
      </div>`;
    parent.appendChild(root);
    const pkg = root.firstElementChild;
    const sub = pkg.querySelector(`.${NS}-css-sub`);
    const dieC = pkg.querySelector(`.${NS}-css-die`);
    const lidEl = pkg.querySelector(`.${NS}-css-lid`);
    const top = lidEl.querySelector(`.${NS}-css-top`);
    const shadeEl = top.firstElementChild, sheenEl = shadeEl.nextElementSibling;
    const lidFaces = [top, ...lidEl.querySelectorAll('.is-lid')];

    // Faces painted once.
    const LS = 896, lidC = mk(LS, LS), g = lidC.getContext('2d'), R = rng(0x7a);
    const gr = g.createLinearGradient(0, 0, LS, LS);
    gr.addColorStop(0, '#8e9196'); gr.addColorStop(0.42, '#b1b4b9'); gr.addColorStop(1, '#5f6267');
    g.fillStyle = gr; g.fillRect(0, 0, LS, LS);
    for (let i = 0; i < LS * 1.4; i++) {
      g.fillStyle = `rgba(${R() < 0.5 ? '255,255,255' : '0,0,0'},${(0.012 + R() * 0.03).toFixed(3)})`;
      g.fillRect(R() * LS - LS * 0.2, R() * LS, LS * (0.2 + R() * 0.8), 1);
    }
    const chm = LS * 0.014;
    g.fillStyle = 'rgba(255,255,255,0.34)'; g.fillRect(0, 0, LS, chm); g.fillRect(0, 0, chm, LS);
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(0, LS - chm, LS, chm); g.fillRect(LS - chm, 0, chm, LS);
    g.save(); g.translate(0, 1.5); etchMarks(g, LS, 'rgba(255,255,255,0.16)'); g.restore();
    etchMarks(g, LS, 'rgba(20,21,24,0.42)');
    lidC.className = `${NS}-css-face`;
    top.insertBefore(lidC, shadeEl);
    const SC = 1200, subC = mk(SC, SC), sg = subC.getContext('2d');
    sg.fillStyle = '#0d0e10'; sg.fillRect(0, 0, SC, SC);
    const pad = 0.34 * SC / W3.sub;
    padGrid(sg, SC, (x, y) => { sg.fillStyle = '#6f7277'; sg.fillRect(x - pad / 2, y - pad / 2, pad, pad); });
    subC.className = `${NS}-css-face`;
    sub.insertBefore(subC, sub.firstChild);

    let L = null;
    return {
      el: root, kind: 'css',
      resize(l) { L = l; },
      setDie(c) {
        if (!c) return;
        dieC.width = c.width; dieC.height = c.height;
        dieC.getContext('2d').drawImage(c, 0, 0);
      },
      render(p, tx, ty, l) {
        L = l || L;
        if (!L) return;
        const r = revealState(p, L.mobile);
        const rx = (1 - r.rot) * 64, rz = -(36 - 8 * r.chipT) * (1 - r.rot);
        const S1 = chipFit(L) / (B * 1.38), S2 = L.die.w / diePx[0];
        const S = Math.exp(lerp(Math.log(S1), Math.log(S2), r.push));
        const ox = lerp(L.chip.x + L.chip.w / 2, L.die.x + L.die.w / 2, r.push);
        const oy = lerp(L.chip.y + L.chip.h / 2, L.die.y + L.die.h / 2, r.push);
        const kt = 3 * (1 - r.rot);
        root.style.perspectiveOrigin = `${ox.toFixed(1)}px ${oy.toFixed(1)}px`;
        pkg.style.transform = `translate3d(${(ox - B / 2).toFixed(2)}px,${(oy - B / 2).toFixed(2)}px,0) rotateY(${(tx * kt).toFixed(2)}deg) rotateX(${(-ty * kt).toFixed(2)}deg) scale(${S.toFixed(4)}) rotateX(${rx.toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg)`;
        lidEl.style.transform = `translate(-50%,-50%) translateZ(${(r.lift * 680).toFixed(1)}px)`;
        const lo = (1 - r.lidFade).toFixed(3);
        for (const f of lidFaces) f.style.opacity = lo;
        lidEl.style.visibility = r.lidFade > 0.999 ? 'hidden' : '';
        sub.style.transform = `translateZ(${(-r.drop * 22).toFixed(1)}px)`;
        sub.style.opacity = (1 - r.subFade).toFixed(3);
        dieC.style.transform = `translate(-50%,-50%) translateZ(${(1 - r.push).toFixed(2)}px)`;
        // Track the WebGL lid's exposure: lit at rest, brightest as the strip
        // passes, then graphite as it moves off — so a late swap reads as one lid.
        const c = r.sw;
        const shade = 0.2 * (1 - smoothstep(segment(c, 0, 0.135))) + 0.64 * smoothstep(segment(c, 0.135, 0.648)) + 0.12 * smoothstep(segment(c, 0.648, 1));
        shadeEl.style.opacity = shade.toFixed(3);
        sheenEl.style.transform = `translateX(${(lerp(-10, 240, r.sw) + tx * 12).toFixed(1)}%) skewX(-16deg)`;
      },
      dispose() { root.remove(); },
    };
  }

  // ── Styles ─────────────────────────────────────────────────
  const CSS = `
.${NS}{position:relative;height:var(--kvc-story-h,700vh)}
@media (max-width:47.99rem){.${NS}{height:var(--kvc-story-hm,600vh)}}
.${NS}.${NS}-static{height:auto}
.${NS}-stage{position:sticky;top:0;height:100vh;height:100svh;overflow:hidden;background:#000;color:rgba(255,255,255,.96);font-family:${FONT.sans};-webkit-font-smoothing:antialiased;--kvc-g:max(1rem,5vw)}
.${NS}-viz{position:absolute;inset:0}
.${NS}-diebox{position:absolute;left:0;top:0;visibility:hidden}
.${NS}-gl{position:absolute;inset:0;width:100%;height:100%;display:block}
.${NS}-caps{position:absolute;left:0;right:0;top:0;display:grid;justify-items:center;margin:0;padding:0 var(--kvc-g);list-style:none;text-align:center;pointer-events:none}
.${NS}-cap{grid-area:1/1;max-width:40rem;opacity:0;will-change:opacity,transform}
.${NS}-eyebrow{margin:0;font:400 .8125rem/1.45 ${FONT.mono};letter-spacing:.02em;color:rgba(255,255,255,.54)}
.${NS}-line{margin:.5rem 0 0;font-size:clamp(1.5rem,2.6vw,2.5rem);font-weight:600;line-height:1.1;letter-spacing:-.022em;color:rgba(255,255,255,.96);text-wrap:balance}
.${NS}-cap.is-finale .${NS}-line{font-size:clamp(2.25rem,4.6vw,4rem);font-weight:700;line-height:1;letter-spacing:-.04em}
.${NS}-sr{position:absolute!important;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.${NS}-nav{position:absolute;left:50%;top:0;transform:translateX(-50%);opacity:0}
.${NS}-nav.is-off{pointer-events:none}
.${NS}-nav:has(:focus-visible){opacity:1!important;pointer-events:auto}
.${NS}-steps{display:flex;gap:.25rem;margin:0;padding:0;list-style:none}
.${NS}-step{position:relative;display:flex;flex-direction:column;align-items:stretch;gap:.5rem;width:7rem;min-height:2.75rem;padding:.875rem .375rem .375rem;margin:0;border:0;background:none;color:inherit;font:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}
.${NS}-bar{position:relative;display:block;height:2px;border-radius:1px;background:rgba(255,255,255,.16);overflow:hidden}
.${NS}-fill{position:absolute;inset:0;background:rgba(255,255,255,.96);transform-origin:0 50%;transform:scaleX(0)}
.${NS}-step.is-done .${NS}-fill{opacity:.42}
.${NS}-name{display:block;font:400 .6875rem/1.2 ${FONT.mono};letter-spacing:.04em;color:rgba(255,255,255,.46);text-align:left;white-space:nowrap;transition:color .2s ease}
.${NS}-step:hover .${NS}-name{color:rgba(255,255,255,.8)}
.${NS}-step[aria-current="step"] .${NS}-name{color:rgba(255,255,255,.96)}
.${NS}-step:focus-visible{outline:2px solid rgba(255,255,255,.92);outline-offset:-2px;border-radius:.625rem}
.${NS}-step:focus:not(:focus-visible){outline:none}
.${NS}-note{position:absolute;left:0;top:0;margin:0;font:400 .6875rem/1.4 ${FONT.mono};letter-spacing:.04em;color:rgba(255,255,255,.46);white-space:nowrap;opacity:0;pointer-events:none}
.${NS}-readout{position:absolute;left:0;top:0;display:flex;align-items:center;gap:.5rem;margin:0;padding:.4375rem .75rem;border-radius:980px;background:rgba(0,0,0,.78);box-shadow:inset 0 0 0 1px rgba(255,255,255,.1);font:500 .75rem/1 ${FONT.mono};letter-spacing:.02em;color:rgba(255,255,255,.86);white-space:nowrap;opacity:0;pointer-events:none}
.${NS}-readout i{width:.375rem;height:.375rem;border-radius:50%;background:rgb(224,185,108);flex:none}
.${NS}-css{position:absolute;inset:0;perspective:1800px;overflow:hidden}
.${NS}-css-pkg{position:absolute;left:0;top:0;transform-style:preserve-3d;transform-origin:50% 50%}
.${NS}-css-sub{position:absolute;inset:0;transform-style:preserve-3d;border-radius:1.2%}
.${NS}-css-face{position:absolute;inset:0;width:100%;height:100%;display:block;border-radius:inherit}
.${NS}-css-die{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%)}
.${NS}-css-lid{position:absolute;left:50%;top:50%;transform-style:preserve-3d;transform:translate(-50%,-50%)}
.${NS}-css-top{position:absolute;inset:0;overflow:hidden;border-radius:6.7%;transform:translateZ(var(--t));box-shadow:0 0 0 1px rgba(255,255,255,.08)}
.${NS}-css-shade{position:absolute;inset:0;background:#000;opacity:.2}
.${NS}-css-sheen{position:absolute;top:-25%;left:0;width:34%;height:150%;background:linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,.2),rgba(255,255,255,0))}
.${NS}-css-side{position:absolute;display:block;backface-visibility:hidden}
.${NS}-css-side.is-sub{background:linear-gradient(#17181b,#060607)}
.${NS}-css-side.is-lid{background:linear-gradient(#8e9196,#3e4146)}
.${NS}-css-side.is-n{left:0;bottom:100%;width:100%;height:var(--t);transform-origin:50% 100%;transform:rotateX(90deg)}
.${NS}-css-side.is-s{left:0;top:100%;width:100%;height:var(--t);transform-origin:50% 0;transform:rotateX(-90deg)}
.${NS}-css-side.is-w{top:0;right:100%;width:var(--t);height:100%;transform-origin:100% 50%;transform:rotateY(-90deg)}
.${NS}-css-side.is-e{top:0;left:100%;width:var(--t);height:100%;transform-origin:0 50%;transform:rotateY(90deg)}
.${NS}-css-lid .${NS}-css-side{transform-style:flat}
.${NS}-css-lid .${NS}-css-side.is-n{bottom:auto;top:calc(-1 * var(--t));transform:translateZ(var(--t)) rotateX(90deg)}
.${NS}-css-lid .${NS}-css-side.is-s{transform:translateZ(var(--t)) rotateX(-90deg)}
.${NS}-css-lid .${NS}-css-side.is-w{transform:translateZ(var(--t)) rotateY(-90deg)}
.${NS}-css-lid .${NS}-css-side.is-e{transform:translateZ(var(--t)) rotateY(90deg)}
.${NS}-rm{width:min(75rem,100% - 2 * max(1rem,5vw));margin-inline:auto;padding-block:1rem 2rem;color:rgba(255,255,255,.96);font-family:${FONT.sans}}
.${NS}-rm-hero{margin:0;text-align:center}
.${NS}-rm-chip{position:relative;height:clamp(16rem,40vw,30rem)}
.${NS}-rm-chip>canvas{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}
.${NS}-rm-cap{margin-top:1.5rem}
.${NS}-rm-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:3.5rem 1.5rem;margin:5rem 0 0;padding:0;list-style:none}
.${NS}-rm-frame{position:relative;aspect-ratio:5/4}
.${NS}-rm-item .${NS}-eyebrow{margin-top:1.25rem}
.${NS}-rm-item .${NS}-line{font-size:clamp(1.25rem,1.9vw,1.625rem);letter-spacing:-.016em}
.${NS}-readout.is-static{opacity:1;transform:translate(calc(-100% + 6px),16px)}
.${NS}-rm-finale{margin-top:6rem;text-align:center}
.${NS}-rm-finale .${NS}-line{font-size:clamp(2.25rem,4.6vw,4rem);font-weight:700;line-height:1;letter-spacing:-.04em}
.${NS}-note.is-static{position:static;margin-top:2rem;opacity:1;white-space:normal;text-align:left;transform:none}
@media (max-width:63.99rem){.${NS}-rm-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:47.99rem){
.${NS}-step{width:2.75rem}
.${NS}-name{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.${NS}-rm-grid{grid-template-columns:minmax(0,1fr);gap:3rem}
}
@media (prefers-contrast:more){
.${NS}-eyebrow{color:rgba(255,255,255,.8)}
.${NS}-name{color:rgba(255,255,255,.7)}
.${NS}-bar{background:rgba(255,255,255,.4)}
.${NS}-note{color:rgba(255,255,255,.75)}
.${NS}-readout{background:#000;box-shadow:inset 0 0 0 1px rgba(255,255,255,.6);color:#fff}
}
@media (prefers-reduced-transparency:reduce){.${NS}-readout{background:#000}}
`;

  function injectStyle() {
    if (document.getElementById(`${NS}-style`)) return;
    const st = document.createElement('style');
    st.id = `${NS}-style`;
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  const VIZ_LABEL = 'Illustration: a packaged chip floats in darkness; its lid lifts away to reveal the die, '
    + 'which is then rebuilt through synthesis, floorplanning, placement, clock tree synthesis, routing, and signoff. '
    + 'Not an actual layout.';

  // ── Layout (resize only) ───────────────────────────────────
  function computeLayout(W, H, capH, o) {
    const mobile = W < 768;
    const g = mobile ? 16 : Math.max(16, Math.round(W * 0.05));
    const top = o.topInset + (mobile ? 16 : 48);
    const navH = 44, bottom = mobile ? 12 : 24;
    const gapCap = mobile ? 36 : 40, gapNav = mobile ? 16 : 24;
    const avail = H - bottom - top;
    const maxW = Math.min(W - 2 * g, 1200);
    const maxH = Math.max(120, avail - navH - gapNav - capH - gapCap);
    let dw = maxW, dh = dw / ASPECT;
    if (dh > maxH) { dh = maxH; dw = dh * ASPECT; }
    dw = Math.max(80, Math.round(dw / 5) * 5);
    dh = dw / ASPECT;
    // Die, caption and progress travel as one centered cluster: on a
    // phone the die is width-bound, so the slack goes above and below.
    const cluster = dh + gapCap + capH + gapNav + navH;
    const y0 = Math.round(top + Math.max(0, (avail - cluster) / 2));
    const die = { x: Math.round((W - dw) / 2), y: y0, w: dw, h: dh };
    const capTop = Math.round(die.y + dh + gapCap);
    const navTop = Math.round(capTop + capH + gapNav);
    return {
      W, H, mobile, g, die, capTop, navTop, top,
      chip: { x: 0, y: top, w: W, h: Math.max(100, capTop - gapCap - top) },
    };
  }

  // ── Scrubbed view ──────────────────────────────────────────
  function scrubView(section, o, getP) {
    section.classList.remove(`${NS}-static`);
    const stage = document.createElement('div');
    stage.className = `${NS}-stage`;
    stage.innerHTML = `
      <div class="${NS}-viz" role="img" aria-label="${VIZ_LABEL}"><div class="${NS}-diebox"></div></div>
      <ol class="${NS}-caps">${BEATS.map((b) => `
        <li class="${NS}-cap${b.finale ? ' is-finale' : ''}"><p class="${NS}-eyebrow">${b.eyebrow}</p><p class="${NS}-line">${b.line}</p>${b.sr ? `<p class="${NS}-sr">${b.sr}</p>` : ''}</li>`).join('')}
      </ol>
      <p class="${NS}-readout" aria-hidden="true"><i></i>Worst path · timing met</p>
      <nav class="${NS}-nav" aria-label="RTL-to-GDS stages">
        <ol class="${NS}-steps">${STAGES.map((s, i) => `
          <li><button type="button" class="${NS}-step" aria-label="Stage ${i + 1} of 6: ${s.name}"><span class="${NS}-bar"><span class="${NS}-fill"></span></span><span class="${NS}-name" aria-hidden="true">${s.name}</span></button></li>`).join('')}
        </ol>
      </nav>
      <p class="${NS}-note" aria-hidden="true">Illustration</p>`;
    section.appendChild(stage);

    const viz = stage.querySelector(`.${NS}-viz`);
    const dieBox = stage.querySelector(`.${NS}-diebox`);
    const capsBox = stage.querySelector(`.${NS}-caps`);
    const caps = Array.from(stage.querySelectorAll(`.${NS}-cap`));
    const nav = stage.querySelector(`.${NS}-nav`);
    const steps = Array.from(stage.querySelectorAll(`.${NS}-step`));
    const fills = steps.map((b) => b.querySelector(`.${NS}-fill`));
    const readout = stage.querySelector(`.${NS}-readout`);
    const note = stage.querySelector(`.${NS}-note`);

    let alive = true, visible = false, warmed = false, L = null, model = null, rend = null, die = null;
    let chip = null, lastP = -1, dirty = true, raf = 0, navOff = null, enter = 1, exit = 0, noteA = -1;
    const capMemo = caps.map(() => ({ a: -1, y: NaN }));
    const stepMemo = steps.map(() => ({ f: -1, done: null, cur: null }));
    const vis = new Map();
    const setVis = (el, on) => { if (vis.get(el) !== on) { vis.set(el, on); el.style.visibility = on ? 'visible' : 'hidden'; } };
    const stats = { frames: 0, total: 0, max: 0, get avg() { return this.frames ? this.total / this.frames : 0; }, reset() { this.frames = 0; this.total = 0; this.max = 0; } };
    let ready, resolveReady;
    ready = new Promise((r) => { resolveReady = r; });

    const tilt = new F.Spring2D(0, 0, { dampingRatio: 1, response: 0.7, precision: 0.0005, onUpdate: () => invalidate() });
    const swap = new F.Spring(1, { dampingRatio: 1, response: 0.45, precision: 0.002, onUpdate: () => invalidate() });
    let fading = null;

    function invalidate() {
      if (raf || !alive) return;
      raf = requestAnimationFrame(() => { raf = 0; dirty = true; frame(getP()); });
    }

    function frame(p, force) {
      if (!alive) return;
      if (!force && !dirty && p === lastP) return;
      lastP = p;
      if (!visible || !L) return;
      dirty = false;
      const t0 = performance.now();

      const chipOn = p < T.unb + 0.0005;
      const cross = 1 - smoothstep(segment(p, T.cross, T.unb));
      if (chip) {
        setVis(chip.el, chipOn);
        if (chipOn) {
          chip.render(p, tilt.x.value, tilt.y.value, L);
          chip.el.style.opacity = (cross * (fading ? swap.value : 1)).toFixed(3);
        }
      }
      if (fading) {
        setVis(fading.el, chipOn);
        if (chipOn) { fading.render(p, tilt.x.value, tilt.y.value, L); fading.el.style.opacity = (cross * (1 - swap.value)).toFixed(3); }
      }
      const dieOn = p >= T.cross - 0.004 && !!rend;
      setVis(dieBox, dieOn);
      if (dieOn && die) rend.draw(die.ctx, p);

      // On the way out, the finale lifts and fades before the next
      // section's headline arrives, so the view never holds two.
      const ex = smoothstep(exit);
      for (let i = 0; i < BEATS.length; i++) {
        const s = beatState(p, BEATS[i]);
        const fin = BEATS[i].finale ? ex : 0;
        const a = Math.round(s.a * (1 - fin) * 1000) / 1000, y = Math.round((s.y - fin * 20) * 10) / 10;
        const mm = capMemo[i];
        if (a !== mm.a) { mm.a = a; caps[i].style.opacity = a; }
        if (y !== mm.y) { mm.y = y; caps[i].style.transform = y ? `translate3d(0,${y}px,0)` : ''; }
      }

      // The stage bar arrives with stage 1 and steps aside for the finale,
      // so the die and the last line are all that's left.
      const na = smoothstep(segment(p, T.flow - 0.004, T.flow + 0.014)) * (1 - smoothstep(segment(p, T.finale + 0.004, T.finale + 0.026)));
      // Opacity only: the steps stay focusable from anywhere on the page, and
      // keyboard focus brings the bar back (see :has(:focus-visible)).
      nav.style.opacity = na.toFixed(3);
      const off = na < 0.5;
      if (off !== navOff) { navOff = off; nav.classList.toggle('is-off', off); }
      // Signoff stays lit until the bar has gone.
      const si = p < T.flow ? -1 : Math.min(5, Math.floor((p - T.flow) / T.len));
      const local = clamp01((p - T.flow - si * T.len) / T.len);
      for (let j = 0; j < steps.length; j++) {
        const f = j < si ? 1 : j === si ? Math.round(local * 500) / 500 : 0;
        const mm = stepMemo[j];
        if (f !== mm.f) { mm.f = f; fills[j].style.transform = `scaleX(${f})`; }
        const done = j < si, cur = j === si;
        if (done !== mm.done) { mm.done = done; steps[j].classList.toggle('is-done', done); }
        if (cur !== mm.cur) { mm.cur = cur; cur ? steps[j].setAttribute('aria-current', 'step') : steps[j].removeAttribute('aria-current'); }
      }

      const sA = T.flow + 5 * T.len;
      const ra = p < sA ? 0 : p < T.finale ? smoothstep(segment(p, sA + 0.66 * T.len, sA + 0.74 * T.len)) : 1 - smoothstep(segment(p, T.finale, T.finale + 0.012));
      readout.style.opacity = ra.toFixed(3);
      setVis(readout, ra > 0.001);

      const nA = Math.round(smoothstep(enter) * (1 - ex) * 1000) / 1000;
      if (nA !== noteA) { noteA = nA; note.style.opacity = nA; }

      const dt = performance.now() - t0;
      stats.frames++; stats.total += dt; stats.max = Math.max(stats.max, dt);
    }

    function placeReadout() {
      if (!L || !model) return;
      const s = L.die.w / DIE_W;
      const rw = readout.offsetWidth || 180, rh = readout.offsetHeight || 26;
      let x = L.die.x + model.capture[0] * s - rw + 6, y = L.die.y + model.capture[1] * s + 16;
      x = Math.max(L.die.x + 8, Math.min(L.die.x + L.die.w - rw - 8, x));
      y = Math.max(L.die.y + 8, Math.min(L.die.y + L.die.h - rh - 8, y));
      readout.style.transform = `translate3d(${Math.round(x)}px,${Math.round(y)}px,0)`;
    }

    function ensureRenderer() {
      const coarse = L.die.w < 560;
      if (model && model.coarse === coarse && rend) return;
      model = getModel(coarse);
      if (rend) rend.dispose();
      rend = createRenderer(model);
      rend.onRebuild = () => { chip && chip.setDie(rend.finalCanvas); fading && fading.setDie(rend.finalCanvas); dirty = true; frame(lastP, true); };
      if (die) { rend.setSize(die.w, die.h, die.dpr); rend.onRebuild(); }
    }

    function layout() {
      const W = stage.clientWidth, H = stage.clientHeight;
      if (!W || !H) return;
      const capH = Math.max(...caps.map((c) => c.offsetHeight));
      L = computeLayout(W, H, capH, o);
      dieBox.style.cssText = `left:${L.die.x}px;top:${L.die.y}px;width:${L.die.w}px;height:${L.die.h}px;visibility:${vis.get(dieBox) ? 'visible' : 'hidden'}`;
      capsBox.style.top = `${L.capTop}px`;
      nav.style.top = `${L.navTop}px`;
      note.style.transform = `translate3d(${L.die.x}px,${L.die.y + L.die.h + 12}px,0)`;
      if (warmed) ensureRenderer();
      if (chip) { chip.resize(L); if (rend && rend.finalCanvas) chip.setDie(rend.finalCanvas); }
      fading && fading.resize(L);
      placeReadout();
      dirty = true;
      frame(getP(), true);
    }

    function setChip(next) {
      const prev = chip;
      chip = next;
      chip.resize(L);
      if (rend && rend.finalCanvas) chip.setDie(rend.finalCanvas);
      if (prev) {
        const seen = visible && lastP < T.unb + 0.0005 && !K.reducedMotion;
        if (seen) {
          if (fading) fading.dispose();
          fading = prev;
          swap.set(0);
          swap.onRest = () => { if (fading) { fading.dispose(); fading = null; } };
          swap.to(1);
        } else prev.dispose();
      }
      dirty = true;
      frame(getP(), true);
    }

    function warm() {
      if (warmed || !alive) return;
      warmed = true;
      ensureRenderer();
      placeReadout();
      die = K.canvas(dieBox, {
        maxDpr: 2,
        onResize: (c) => { rend.setSize(c.w, c.h, c.dpr); dirty = true; frame(lastP < 0 ? getP() : lastP, true); },
      });
      chip && chip.setDie(rend.finalCanvas);
      if (!chip) setChip(createCSSChip(viz));
      if (o.mode === 'css' || !hasWebGL()) { resolveReady('css'); return; }
      createGLChip(viz, rend.finalCanvas, { small: L.mobile }).then((gl) => {
        if (!alive) { gl.dispose(); return; }
        gl.onLost = () => {
          if (chip !== gl) return;
          setChip(createCSSChip(viz));
        };
        setChip(gl);
        resolveReady('webgl');
      }).catch((err) => {
        console.info('KVChip.Story: using the CSS chip —', (err && err.message) || err);
        resolveReady('css');
      });
    }

    const onMove = (e) => {
      if (e.pointerType !== 'mouse' || K.reducedMotion || !L || lastP > 0.2) return;
      const top = stage.getBoundingClientRect().top;
      const nx = (e.clientX - L.W / 2) / (L.W / 2);
      const ny = (e.clientY - top - (L.chip.y + L.chip.h / 2)) / (L.H / 2);
      tilt.to(Math.max(-1, Math.min(1, nx)), Math.max(-1, Math.min(1, ny)));
    };
    const onLeave = () => tilt.to(0, 0);
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerleave', onLeave);

    function jump(i) {
      const r = section.getBoundingClientRect();
      const span = r.height - window.innerHeight;
      window.scrollTo({ top: window.scrollY + r.top + (T.flow + (i + HERO[i]) * T.len) * span, behavior: 'smooth' });
    }
    steps.forEach((b, i) => b.addEventListener('click', () => jump(i)));

    const io = new IntersectionObserver((es) => {
      for (const e of es) {
        if (e.target !== section) continue;
        visible = e.isIntersecting;
        if (visible) { dirty = true; frame(getP(), true); }
      }
    });
    io.observe(section);
    const ioNear = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) warm(); }, { rootMargin: '150% 0px 150% 0px' });
    ioNear.observe(section);
    const ro = new ResizeObserver(() => layout());
    ro.observe(stage);
    layout();

    return {
      mode: 'scrub', stats, ready,
      get chipKind() { return chip ? chip.kind : 'none'; },
      debug: () => ({ layout: L, canvas: die && { w: die.canvas.width, h: die.canvas.height }, renderer: rend && rend.debug() }),
      onProgress: (p, force) => frame(p, force),
      onEdge(a, b) { enter = a; exit = b; if (visible) frame(lastP < 0 ? getP() : lastP, true); },
      jump,
      destroy() {
        alive = false;
        cancelAnimationFrame(raf);
        tilt.stop(); swap.stop();
        io.disconnect(); ioNear.disconnect(); ro.disconnect();
        stage.removeEventListener('pointermove', onMove);
        stage.removeEventListener('pointerleave', onLeave);
        chip && chip.dispose(); fading && fading.dispose();
        rend && rend.dispose();
        stage.remove();
      },
    };
  }

  // ── Reduced motion: the same story, still ──────────────────
  const STILL_P = 0.055;   // the chip with the light band mid-lid

  function staticView(section, o) {
    section.classList.add(`${NS}-static`);
    const root = document.createElement('div');
    root.className = `${NS}-rm`;
    root.innerHTML = `
      <figure class="${NS}-rm-hero">
        <div class="${NS}-rm-chip" role="img" aria-label="Illustration: a packaged chip with a machined metal lid, etched KV and Physical Design."></div>
        <figcaption class="${NS}-rm-cap"><p class="${NS}-eyebrow">Physical design</p><p class="${NS}-line">One layout, six steps.</p></figcaption>
      </figure>
      <ol class="${NS}-rm-grid">${STAGES.map((s, i) => `
        <li class="${NS}-rm-item">
          <div class="${NS}-rm-frame" role="img" aria-label="Illustration, stage ${i + 1}: ${s.sr}">${i === 5 ? `<p class="${NS}-readout is-static" aria-hidden="true"><i></i>Timing met</p>` : ''}</div>
          <p class="${NS}-eyebrow">0${i + 1} · ${s.name}</p><p class="${NS}-line">${s.line}</p>
        </li>`).join('')}
      </ol>
      <p class="${NS}-note is-static">Illustration · not an actual layout</p>
      <div class="${NS}-rm-finale"><p class="${NS}-eyebrow">Physical design</p><p class="${NS}-line">RTL to GDS.</p></div>`;
    section.appendChild(root);

    let alive = true, rend = null, model = null;
    const frames = Array.from(root.querySelectorAll(`.${NS}-rm-frame`));
    const cvs = [];
    const paint = (i) => {
      const c = cvs[i];
      if (!c || !rend) return;
      rend.drawStill(c.ctx, i);
      if (i === 5) {
        const tag = frames[5].querySelector(`.${NS}-readout`);
        tag.style.left = `${(model.capture[0] / DIE_W) * 100}%`;
        tag.style.top = `${(model.capture[1] / DIE_H) * 100}%`;
      }
    };
    frames.forEach((fr, i) => {
      cvs[i] = K.canvas(fr, {
        maxDpr: 2,
        onResize: (c) => {
          cvs[i] = c;
          const coarse = c.w < 300;
          if (!model || model.coarse !== coarse) {
            model = getModel(coarse);
            if (rend) rend.dispose();
            rend = createRenderer(model);
            rend.onRebuild = () => { if (alive) cvs.forEach((_, j) => paint(j)); };
          }
          rend.setSize(c.w, c.h, c.dpr);
          paint(i);
        },
      });
    });
    // The S6 readout sits in front of its canvas.
    frames[5].appendChild(frames[5].querySelector(`.${NS}-readout`));

    // Chip still: one WebGL frame copied to 2D, or the CSS chip.
    const host = root.querySelector(`.${NS}-rm-chip`);
    const still = () => {
      const W = host.clientWidth, H = host.clientHeight;
      return { W, H, mobile: W < 768, chip: { x: 0, y: 0, w: W, h: H }, die: { x: 0, y: 0, w: W * 0.4, h: W * 0.32 } };
    };
    let css = null;
    const done = (async () => {
      if (o.mode !== 'css' && hasWebGL()) {
        try {
          const L0 = still();
          const gl = await createGLChip(host, null, { still: true, small: L0.W < 600 });
          if (!alive) { gl.dispose(); return 'none'; }
          gl.resize(L0);
          gl.render(STILL_P, 0, 0, L0);
          const copy = mk(gl.el.width, gl.el.height);
          copy.getContext('2d').drawImage(gl.el, 0, 0);
          copy.setAttribute('aria-hidden', 'true');
          host.appendChild(copy);
          gl.dispose();
          return 'webgl';
        } catch (e) { /* fall through to CSS */ }
      }
      if (!alive) return 'none';
      css = createCSSChip(host);
      const L0 = still();
      css.resize(L0);
      css.render(STILL_P, 0, 0, L0);
      return 'css';
    })();
    const ro = new ResizeObserver(() => { if (css) { const L0 = still(); css.resize(L0); css.render(STILL_P, 0, 0, L0); } });
    ro.observe(host);

    return {
      mode: 'static', ready: done, stats: null,
      destroy() { alive = false; ro.disconnect(); css && css.dispose(); rend && rend.dispose(); root.remove(); section.classList.remove(`${NS}-static`); },
    };
  }

  // ── Scroll progress ────────────────────────────────────────
  // KVChip.scrollProgress, but asleep while the section is far offscreen
  // (no spring work per scroll event) and disposable on destroy().
  // onEdge(enter, exit): enter rises to 1 as the stage pins; exit rises from
  // 0 over the first 30% of a viewport after it unpins. Both track the
  // scroll directly (no spring), since the stage itself moves with it.
  function scrollProgress(section, onProgress, response, onEdge) {
    let ein = -1, eout = -1, onscreen = true;
    const raw = () => {
      const r = section.getBoundingClientRect();
      const vh = window.innerHeight, span = r.height - vh;
      onscreen = r.bottom > 0 && r.top < vh;
      const a = Math.round(clamp01(1 - r.top / (0.25 * vh)) * 1000) / 1000;
      const b = span <= 0 ? 0 : Math.round(clamp01((-r.top - span) / (0.3 * vh)) * 1000) / 1000;
      if (a !== ein || b !== eout) { ein = a; eout = b; onEdge && onEdge(a, b); }
      return span <= 0 ? (r.top <= 0 ? 1 : 0) : clamp01(-r.top / span);
    };
    const spring = new F.Spring(raw(), { dampingRatio: 1, response, precision: 0.0005, onUpdate: (v) => onProgress(v) });
    let near = true, target = NaN;
    const update = () => {
      if (!near) return;
      const v = raw();
      if (v === target) return;          // clamped at 0 or 1: nothing to do
      target = v;
      // Off screen (e.g. after a cut past the story) there's nothing to ease.
      if (K.reducedMotion || !onscreen) spring.set(v); else spring.to(v);
    };
    const io = new IntersectionObserver((es) => {
      near = es[es.length - 1].isIntersecting;
      update();
    }, { rootMargin: '50% 0px 50% 0px' });
    io.observe(section);
    addEventListener('scroll', update, { passive: true });
    addEventListener('resize', update);
    onProgress(spring.value);
    return {
      get value() { return spring.value; },
      get edge() { return [ein, eout]; },
      dispose() {
        removeEventListener('scroll', update);
        removeEventListener('resize', update);
        io.disconnect();
        spring.stop();
      },
    };
  }

  // ── Mount ──────────────────────────────────────────────────
  function mount(section, opts = {}) {
    if (!section) throw new Error('KVChip.Story.mount: a section element is required');
    injectStyle();
    const o = { topInset: 52, height: 700, mobileHeight: 600, pin: null, mode: 'auto', ...opts };
    section.classList.add(NS);
    section.style.setProperty('--kvc-story-h', `${o.height}vh`);
    section.style.setProperty('--kvc-story-hm', `${o.mobileHeight}vh`);
    const pinOf = (v) => (v == null || v === '' || Number.isNaN(+v) ? null : clamp01(+v));
    let pin = pinOf(o.pin), view = null, alive = true;
    const rmq = matchMedia('(prefers-reduced-motion: reduce)');
    const sp = scrollProgress(section, (v) => {
      if (alive && view && view.onProgress && pin === null) view.onProgress(v);
    }, 0.26, (a, b) => { if (alive && view && view.onEdge) view.onEdge(a, b); });
    const cur = () => (pin === null ? sp.value : pin);
    const build = () => {
      if (view) view.destroy();
      view = rmq.matches ? staticView(section, o) : scrubView(section, o, cur);
      if (view.onEdge) view.onEdge(...sp.edge);
    };
    build();
    const onRM = () => { if (alive) build(); };
    rmq.addEventListener('change', onRM);

    return {
      get mode() { return view ? view.mode : 'destroyed'; },
      get chip() { return view && view.chipKind; },
      get progress() { return cur(); },
      get stats() { return view && view.stats; },
      get ready() { return view ? view.ready : Promise.resolve('none'); },
      debug() { return view && view.debug ? view.debug() : null; },
      setProgress(p) { pin = pinOf(p); if (view && view.onProgress) view.onProgress(cur(), true); },
      jump(i) { view && view.jump && view.jump(i); },
      destroy() {
        alive = false;
        sp.dispose();
        rmq.removeEventListener('change', onRM);
        if (view) view.destroy();
        view = null;
        section.classList.remove(NS, `${NS}-static`);
        section.style.removeProperty('--kvc-story-h');
        section.style.removeProperty('--kvc-story-hm');
      },
    };
  }

  K.Story = { mount, version: '1.0.0' };
})();
