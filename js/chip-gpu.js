// ─────────────────────────────────────────────────────────────
// KVChip.GPU — a live MiniGPU-2 die for the Keynote project section.
//
// Two clock domains meet at a gold CDC boundary. On the left the
// vertex stage transforms triangles on its clock; each finished
// triangle is written into a dual-clock async FIFO. The write and
// read pointers advance on their own clocks and cross the boundary
// through Gray-coded pointer synchronizers — one bit flips per
// step, and that bit is marked in gold (filled if it rose to 1, ringed
// if it fell to 0). Once per cycle a burst fills the FIFO to full and
// the vertex stage holds — back-pressure — until a read frees a slot. On the right the rasterizer pops
// a triangle and fills it pixel by pixel in scanline order.
//
// Everything is a deterministic simulation (same frames every load),
// so a pinned time renders the exact same picture. Static geometry is
// pre-rendered once per size; the loop only paints what moves.
//
// Usage:  const gpu = KVChip.GPU.mount(host, { time?: seconds })
//         gpu.pause(); gpu.play(); gpu.state(); gpu.destroy();
// Needs spring.js (window.Fluid) and chip-core.js (window.KVChip).
// Illustration only — not the actual layout.
// ─────────────────────────────────────────────────────────────
(() => {
  const KV = window.KVChip, Fl = window.Fluid;
  if (!KV || !Fl) { console.warn('KVChip.GPU: load spring.js and chip-core.js first'); return; }

  const P = KV.palette;
  const { clamp01, lerp, smoothstep, easeOut, segment } = KV;
  const TAU = Math.PI * 2;
  const W1 = P.whiteA;

  // ── Timing (seconds). Vertex clock : raster clock = 3 : 2 ─────
  const TW = 0.5;            // write (vertex) clock period
  const TR = 0.75;           // read (raster) clock period
  const RPH = 0.21;          // read-clock phase, so edges never coincide
  const FLASH = 0.55;        // gold mark on the Gray bit that flipped
  const HOLD = 0.3;          // finished raster triangle rests before next
  const FADE = 0.42;         // old raster triangle fades as the next arrives
  const LOOK = 4;            // simulate this far ahead of the display
  const KEEP = 16;           // history kept for rendering
  const INTRO = 2.1;         // first-reveal duration
  const START_T = 41;        // live view opens mid-burst; the FIFO fills to full ~7 s later
  const STATIC_T = 84.05;    // reduced-motion frame: a packet on the ring road, a fill mid-way, wptr 0111 → 0101

  // Packet flight time depends only on how far round the ring the slot
  // sits from its port (the same in both layouts), so the simulation
  // never depends on the viewport. Write port = ring base, read port
  // opposite it; slot k is centred (k + .5) eighths clockwise of base.
  const wSteps = (k) => Math.min(k + 0.5, 7.5 - k);       // 0.5 … 3.5
  const rSteps = (k) => Math.abs(k + 0.5 - 4);             // 0.5 … 3.5
  const wFly = (k) => 0.62 + 0.12 * wSteps(k);
  const rFly = (k) => 0.5 + 0.1 * rSteps(k);

  const GC = 16, GR = 12;    // raster grid
  const AX = 4 / 3;          // viewport aspect (u ∈ ±AX, v ∈ ±1)
  const PIX_PER_CLK = 14;
  // Vertex schedule over a 16-triangle cycle: a burst of 11 quick
  // triangles (2 write clocks each) fills the FIFO to full once, then a
  // lull of 5 slow ones (10–12 clocks) lets it drain to empty.
  const KP = 16, KB = 11, KB0 = 2, KBP = 0, KL0 = 10, KLR = 3;

  const gray = (b) => (b ^ (b >> 1)) & 15;
  const bitIndex = (x) => (x & 8 ? 3 : x & 4 ? 2 : x & 2 ? 1 : 0);
  const nextR = (t) => RPH + (Math.floor((t - RPH) / TR + 1e-6) + 1) * TR;
  const nextW = (t) => (Math.floor(t / TW + 1e-6) + 1) * TW;
  const easeInOut = (t) => { t = clamp01(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

  // ── Triangles: deterministic per index ─────────────────────
  function xform(m, rot, sc, tx, ty, out) {
    const c = Math.cos(rot) * sc, s = Math.sin(rot) * sc;
    for (let k = 0; k < 3; k++) {
      const x = m[2 * k], y = m[2 * k + 1];
      out[2 * k] = x * c - y * s + tx;
      out[2 * k + 1] = x * s + y * c + ty;
    }
    return out;
  }

  const triCache = new Map();
  function makeTri(n) {
    let T = triCache.get(n);
    if (T) return T;
    const r = KV.rng(0x51ed + n * 7919);
    const m = new Float32Array(6);
    const rad = 0.4 + r() * 0.16, a0 = r() * TAU;
    let cx = 0, cy = 0;
    for (let k = 0; k < 3; k++) {
      const a = a0 + (k * TAU) / 3 + (r() - 0.5) * 0.8;
      const rr = rad * (0.82 + r() * 0.3);
      m[2 * k] = Math.cos(a) * rr; m[2 * k + 1] = Math.sin(a) * rr;
      cx += m[2 * k] / 3; cy += m[2 * k + 1] / 3;
    }
    for (let k = 0; k < 3; k++) { m[2 * k] -= cx; m[2 * k + 1] -= cy; }
    const rot = (r() < 0.5 ? -1 : 1) * (0.6 + r() * 1.0);
    // One triangle per cycle is large: the rasterizer stays busy on it
    // long enough for the FIFO behind it to fill.
    const BIG = n % KP === 1;
    let sc = BIG ? 4 : 1.75 + r() * 0.6;
    let tx = (r() - 0.5) * 0.9, ty = (r() - 0.5) * 0.5;
    const f = new Float32Array(6);
    const bbox = () => {
      let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
      for (let k = 0; k < 3; k++) {
        x0 = Math.min(x0, f[2 * k]); x1 = Math.max(x1, f[2 * k]);
        y0 = Math.min(y0, f[2 * k + 1]); y1 = Math.max(y1, f[2 * k + 1]);
      }
      return [x0, x1, y0, y1];
    };
    xform(m, rot, sc, tx, ty, f);
    let [x0, x1, y0, y1] = bbox();
    const fit = Math.min(1, 1.66 / (y1 - y0), 2.3 / (x1 - x0));
    if (fit < 1) { sc *= fit; tx *= fit; ty *= fit; xform(m, rot, sc, tx, ty, f); [x0, x1, y0, y1] = bbox(); }
    const mx = AX - 0.16, my = 0.86;
    tx += Math.max(0, -mx - x0) - Math.max(0, x1 - mx);
    ty += Math.max(0, -my - y0) - Math.max(0, y1 - my);
    xform(m, rot, sc, tx, ty, f);

    // Coverage by edge functions, in scanline order.
    const cover = [];
    const area = (f[2] - f[0]) * (f[5] - f[1]) - (f[3] - f[1]) * (f[4] - f[0]);
    const sgn = area < 0 ? -1 : 1;
    const edge = (ax, ay, bx, by, px, py) => ((bx - ax) * (py - ay) - (by - ay) * (px - ax)) * sgn;
    for (let j = 0; j < GR; j++) {
      const v = -1 + (j + 0.5) * (2 / GR);
      for (let i = 0; i < GC; i++) {
        const u = -AX + (i + 0.5) * ((2 * AX) / GC);
        if (edge(f[0], f[1], f[2], f[3], u, v) >= 0 &&
            edge(f[2], f[3], f[4], f[5], u, v) >= 0 &&
            edge(f[4], f[5], f[0], f[1], u, v) >= 0) cover.push(j * GC + i);
      }
    }
    // Packet glyph: the same shape, unit-sized around its centroid.
    const gx = (f[0] + f[2] + f[4]) / 3, gy = (f[1] + f[3] + f[5]) / 3;
    let gr = 0;
    for (let k = 0; k < 3; k++) gr = Math.max(gr, Math.hypot(f[2 * k] - gx, f[2 * k + 1] - gy));
    const g = new Float32Array(6);
    for (let k = 0; k < 3; k++) { g[2 * k] = (f[2 * k] - gx) / gr; g[2 * k + 1] = (f[2 * k + 1] - gy) / gr; }

    // Work per triangle: the vertex stage alternates bursts and lulls,
    // so the FIFO visibly fills (once per cycle, to full) and drains.
    const ph = n % KP;
    const K = ph < KB ? KB0 + (r() < KBP ? 1 : 0) : KL0 + Math.floor(r() * KLR);
    const M = Math.max(2, Math.ceil(cover.length / PIX_PER_CLK));
    T = { n, m, f, g, rot, sc, tx, ty, cover: Int16Array.from(cover), K, M };
    triCache.set(n, T);
    if (triCache.size > 64) triCache.delete(triCache.keys().next().value);
    return T;
  }

  // ── The FIFO, cycle by cycle ───────────────────────────────
  // 8 slots, 4-bit pointers (3 address bits + wrap bit). Full and
  // empty are judged against the *synchronized* Gray pointers, the
  // way the real circuit has to.
  //
  // A finished triangle departs the vertex stage on a write-clock edge
  // (tD), travels to its slot, and is written on the first write edge
  // after it arrives (tW) — one write per edge, so the pointer only
  // ever steps by one. A read on a read edge (tR) sends it on to the
  // rasterizer, which stays busy for M read cycles.
  function Sim() {
    const s = {
      kw: 1, kr: 0,
      w: 0, r: 0, wq1: 0, wq2: 0, rq1: 0, rq2: 0,
      vn: 0, vTri: makeTri(0), vStart: 0, vCycles: 0, lastW: 0,
      pend: [], rBusy: 0, mem: new Array(8).fill(null),
      recs: [], wLog: [], rLog: [], fLog: [], eLog: [], fNow: false, eNow: true, horizon: 0,
    };
    function writeEdge(te) {
      if (s.pend.length && s.pend[0].tW <= te + 1e-6) {
        const rec = s.pend.shift();
        s.mem[rec.slot] = rec;
        s.w = (s.w + 1) & 15;
        s.wLog.push({ t: te, v: s.w });
      }
      const wNext = (s.w + s.pend.length) & 15;
      const full = gray(wNext) === (s.rq2 ^ 12);
      if (full !== s.fNow) { s.fNow = full; s.fLog.push({ t: te, v: full ? 1 : 0 }); }
      s.rq2 = s.rq1; s.rq1 = gray(s.r);
      s.vCycles++;
      if (s.vCycles >= s.vTri.K && !full) {
        const slot = wNext & 7;
        const tW = Math.max(nextW(te + wFly(slot) - 1e-6), s.lastW + TW);
        s.lastW = tW;
        const rec = { tri: s.vTri, slot, tD: te, tW, tR: Infinity, rDur: rFly(slot), tStart: s.vStart, ready: s.vStart + s.vTri.K * TW };
        s.pend.push(rec);
        s.recs.push(rec);
        s.vn++; s.vTri = makeTri(s.vn); s.vStart = te; s.vCycles = 0;
      }
    }
    function readEdge(te) {
      const empty = gray(s.r) === s.wq2;
      if (empty !== s.eNow) { s.eNow = empty; s.eLog.push({ t: te, v: empty ? 1 : 0 }); }
      s.wq2 = s.wq1; s.wq1 = gray(s.w);
      if (s.rBusy > 0) s.rBusy--;
      if (s.rBusy === 0 && !empty) {
        const rec = s.mem[s.r & 7];
        rec.tR = te;
        s.r = (s.r + 1) & 15;
        s.rLog.push({ t: te, v: s.r });
        s.rBusy = rec.tri.M;
      }
    }
    s.advance = (tEnd) => {
      for (;;) {
        const tw = s.kw * TW, tr = RPH + s.kr * TR;
        const t = Math.min(tw, tr);
        if (t > tEnd) break;
        if (tw < tr) { writeEdge(tw); s.kw++; } else { readEdge(tr); s.kr++; }
      }
      s.horizon = tEnd;
    };
    const trim = (log, cut) => { while (log.length > 2 && log[1].t < cut) log.shift(); };
    s.prune = (cut) => {
      trim(s.wLog, cut); trim(s.rLog, cut); trim(s.fLog, cut); trim(s.eLog, cut);
      while (s.recs.length > 4 && s.recs[1].tR < cut) s.recs.shift();
    };
    return s;
  }

  // last log entry at or before t → {v, t} (pointer 0 at time 0)
  const ptrAt = (log, t, out) => {
    out.v = 0; out.t = -1e9;
    for (let i = log.length - 1; i >= 0; i--) if (log[i].t <= t) { out.v = log[i].v; out.t = log[i].t; return out; }
    return out;
  };
  const ptrPrevChange = (log, t) => {
    let seen = 0;
    for (let i = log.length - 1; i >= 0; i--) if (log[i].t <= t && ++seen === 2) return log[i].t;
    return -1e9;
  };

  // ── Layouts (logical units) ────────────────────────────────
  // Landscape: domains left | right, boundary vertical.
  // Portrait: domains top / bottom, boundary horizontal.
  // The crossing — FIFO ring, Gray pointers, synchronizers — is the
  // hero; vertex and raster are supporting stages either side of it.
  const LAYOUTS = {
    land: {
      W: 1600, H: 1000, portrait: false, labelPx: 10, ptPx: 10,
      die: { x: 16, y: 16, w: 1568, h: 968, r: 14 }, padStep: 36, rings: [60, 74],
      core: { x: 104, y: 104, w: 1392, h: 792 },
      rowsY: [188, 884],
      vtx: { x: 136, y: 236, w: 420, h: 368 }, vp: { x: 154, y: 278, w: 384, h: 288 },
      ras: { x: 1044, y: 236, w: 420, h: 368 }, grid: { x: 1062, y: 278, w: 384, h: 288 },
      fifo: { x: 604, y: 224, w: 392, h: 392 },
      ring: { cx: 800, cy: 420, r: 122, th: 32, base: Math.PI, track: 13, gT: 12, gS: 8.5, caret: 7, wc: [30, 48], rc: [12, 28] },
      inStart: [556, 420], outEnd: [1044, 420],
      wBlk: { x: 548, y: 660, w: 184, h: 76 }, rBlk: { x: 868, y: 660, w: 184, h: 76 },
      cell: 32, cellGap: 8,
      wLink: [640, 660, 640, 616], rLink: [960, 660, 960, 616],
      laneA: [732, 684, 868, 684], flopsA: [[823, 684], [853, 684]],
      laneB: [868, 712, 732, 712], flopsB: [[777, 712], [747, 712]],
      flop: 26,
      cdc: [[800, 182, 800, 884]],
      labels: [
        { id: 'vertex', text: 'Vertex stage', x: 154, y: 264 },
        { id: 'raster', text: 'Rasterizer', x: 1062, y: 264 },
        { id: 'fifo', text: 'Async FIFO', x: 624, y: 256, hero: true },
        { id: 'sync', text: 'Wptr', x: 548, y: 766 },
        { id: 'sync', text: 'Rptr', x: 1052, y: 766, align: 'right' },
        { text: 'Vertex domain', x: 136, y: 166, clock: 'w' },
        { text: 'Raster domain', x: 1464, y: 166, align: 'right', clock: 'r' },
        { text: 'CDC boundary', x: 800, y: 166, align: 'center', cdc: true },
      ],
      clockW: 78, clockH: 11,
      keepouts: [[532, 640, 536, 146]],
      hits: [
        { id: 'vertex', x: 136, y: 236, w: 420, h: 368 },
        { id: 'fifo', x: 604, y: 224, w: 392, h: 392 },
        { id: 'sync', x: 536, y: 648, w: 528, h: 132 },
        { id: 'raster', x: 1044, y: 236, w: 420, h: 368 },
        { id: 'floor', x: 112, y: 796, w: 1376, h: 88 },
      ],
    },
    port: {
      W: 800, H: 1000, portrait: true, labelPx: 9, ptPx: 9,
      die: { x: 12, y: 12, w: 776, h: 976, r: 12 }, padStep: 32, rings: [44, 56],
      core: { x: 76, y: 76, w: 648, h: 848 },
      rowsY: [88, 916],
      vtx: { x: 250, y: 88, w: 300, h: 242 }, vp: { x: 268, y: 120, w: 264, h: 198 },
      ras: { x: 250, y: 682, w: 300, h: 238 }, grid: { x: 272, y: 714, w: 256, h: 192 },
      fifo: { x: 276, y: 350, w: 248, h: 316 },
      ring: { cx: 400, cy: 508, r: 76, th: 22, base: -Math.PI / 2, track: 10, gT: 9, gS: 6.5, caret: 5.5, wc: [23, 37], rc: [9, 21] },
      inStart: [400, 330], outEnd: [400, 682],
      wBlk: { x: 104, y: 396, w: 140, h: 52 }, rBlk: { x: 104, y: 568, w: 140, h: 52 },
      cell: 24, cellGap: 6,
      wLink: [244, 422, 276, 422], rLink: [244, 594, 276, 594],
      laneA: [150, 448, 150, 568], flopsA: [[150, 530], [150, 554]],
      laneB: [206, 568, 206, 448], flopsB: [[206, 486], [206, 462]],
      flop: 20,
      cdc: [[84, 508, 716, 508]],
      labels: [
        { id: 'vertex', text: 'Vertex stage', x: 268, y: 110 },
        { id: 'raster', text: 'Rasterizer', x: 272, y: 704 },
        { id: 'fifo', text: 'Async FIFO', x: 540, y: 392, hero: true },
        { id: 'sync', text: 'Wptr', x: 104, y: 384 },
        { id: 'sync', text: 'Rptr', x: 104, y: 646 },
        { text: 'Vertex domain', x: 540, y: 452, clock: 'w', below: true },
        { text: 'CDC boundary', x: 540, y: 498, cdc: true },
        { text: 'Raster domain', x: 540, y: 556, clock: 'r', below: true },
      ],
      clockW: 72, clockH: 10,
      keepouts: [[96, 340, 620, 336]],
      hits: [
        { id: 'vertex', x: 250, y: 88, w: 300, h: 242 },
        { id: 'fifo', x: 276, y: 350, w: 248, h: 316 },
        { id: 'sync', x: 96, y: 372, w: 164, h: 288 },
        { id: 'raster', x: 250, y: 682, w: 300, h: 238 },
      ],
    },
  };

  // Polylines with arc-length lookup.
  function poly(pts) {
    const n = pts.length / 2, cum = new Float32Array(n);
    for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(pts[2 * i] - pts[2 * i - 2], pts[2 * i + 1] - pts[2 * i - 1]);
    return { pts, cum, len: cum[n - 1] };
  }
  function at(pl, d, out) {
    const { pts, cum } = pl, n = cum.length;
    d = Math.max(0, Math.min(pl.len, d));
    let i = 1;
    while (i < n - 1 && cum[i] < d) i++;
    const k = (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
    out[0] = lerp(pts[2 * i - 2], pts[2 * i], k);
    out[1] = lerp(pts[2 * i - 1], pts[2 * i + 1], k);
    return out;
  }
  const distTo = (pl, x, y) => {
    // arc length of the vertex-nearest point on a straight lane
    return Math.hypot(x - pl.pts[0], y - pl.pts[1]);
  };

  // Block copy (DOM — real text). Every line is drawn from the résumé.
  const BLOCKS = {
    vertex: { name: 'Vertex stage', body: 'Vertex transformation — the front of a SystemVerilog graphics pipeline taken from RTL to gates with a team in Synopsys Design Compiler and Cadence Genus.' },
    fifo: { name: 'Async FIFO', body: 'Dual-clock asynchronous FIFOs with Gray-coded pointer synchronizers, carrying data across clock domains.' },
    sync: { name: 'Pointer synchronizers', body: 'Gray-coded pointer synchronizers: each pointer crosses the boundary in Gray code, so only one bit changes per step.' },
    raster: { name: 'Rasterizer', body: 'Rasterization — the back of the same SystemVerilog graphics pipeline, synthesized RTL-to-gate with a team.' },
    floor: { name: 'Floorplan & P&R', body: 'Floorplanning and place-and-route in Cadence Innovus on a SAED 32nm checkpoint, iterating on timing and congestion.' },
  };

  // ── Scoped styles ─────────────────────────────────────────
  const CSS = `
.kvc-gpu{position:relative;width:100%;margin-inline:auto;font-family:${KV.font.sans};color:rgba(255,255,255,.96);-webkit-font-smoothing:antialiased}
.kvc-gpu-stage{position:relative;width:100%;aspect-ratio:16/10}
@media (max-width:47.99rem){.kvc-gpu-stage{aspect-ratio:4/5}}
.kvc-gpu-canvas{position:absolute;inset:0}
.kvc-gpu-hits{position:absolute;inset:0}
.kvc-gpu-hit{position:absolute;appearance:none;-webkit-appearance:none;background:transparent;border:0;margin:0;padding:0;border-radius:8px;color:inherit;font:inherit;cursor:default;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.kvc-gpu-hit:focus{outline:none}
.kvc-gpu-hit:focus-visible{outline:2px solid rgba(255,255,255,.9);outline-offset:3px}
.kvc-gpu-tip{position:absolute;left:0;top:0;z-index:2;width:max-content;max-width:min(18rem,calc(100% - 1rem));padding:.75rem .9375rem .8125rem;border-radius:14px;
  background:rgba(28,28,30,.78);-webkit-backdrop-filter:blur(20px) saturate(160%);backdrop-filter:blur(20px) saturate(160%);
  box-shadow:0 0 0 1px rgba(255,255,255,.1),0 12px 32px rgba(0,0,0,.5);text-align:left;pointer-events:none;
  opacity:0;transform:translateY(4px) scale(.97);transition:opacity .18s ease,transform .24s cubic-bezier(.2,.8,.2,1)}
.kvc-gpu-tip.is-on{opacity:1;transform:none}
.kvc-gpu-tip-t{font-size:.875rem;font-weight:600;line-height:1.3;letter-spacing:-.005em;color:rgba(255,255,255,.96)}
.kvc-gpu-tip-b{margin-top:.25rem;font-size:.8125rem;line-height:1.42;color:rgba(255,255,255,.76)}
.kvc-gpu-play{position:absolute;right:0;top:calc(100% + .75rem + .48rem - 1.125rem);z-index:1;width:2.25rem;height:2.25rem;border-radius:50%;border:0;padding:0;display:grid;place-items:center;
  color:rgba(255,255,255,.96);background:rgba(255,255,255,.12);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);cursor:pointer;
  -webkit-tap-highlight-color:transparent;transition:background-color .2s ease,transform .1s ease-out}
.kvc-gpu-play::before{content:"";position:absolute;inset:-.25rem;border-radius:50%}
.kvc-gpu-play:hover{background:rgba(255,255,255,.18)}
.kvc-gpu-play:active{transform:scale(.94)}
.kvc-gpu-play:focus{outline:none}
.kvc-gpu-play:focus-visible{outline:2px solid rgba(255,255,255,.9);outline-offset:3px}
.kvc-gpu-play svg{width:.875rem;height:.875rem;display:block}
.kvc-gpu-play[hidden]{display:none}
.kvc-gpu-cap.kvc-gpu-cap{margin-top:1.5rem;text-align:center;font-family:${KV.font.sans};color:rgba(255,255,255,.96);-webkit-font-smoothing:antialiased}
.kvc-gpu-cap p{margin-bottom:0}
.kvc-gpu-flow{margin:0 auto;max-width:40rem;font-size:clamp(1rem,1.1vw,1.0625rem);font-weight:500;line-height:1.45;letter-spacing:-.005em;color:rgba(255,255,255,.8);text-wrap:balance}
.kvc-gpu-flow .kvc-gpu-arw{color:rgba(255,255,255,.46);padding-inline:.35em}
.kvc-gpu-flow .kvc-gpu-aside{color:rgba(255,255,255,.56);font-weight:400}
.kvc-gpu-step{white-space:nowrap}
.kvc-gpu-still{margin:.75rem auto 0;max-width:34rem;font-size:.875rem;line-height:1.45;color:rgba(255,255,255,.72);text-wrap:balance}
.kvc-gpu-still[hidden]{display:none}
.kvc-gpu-still b{font-family:${KV.font.mono};font-weight:500;font-size:.8125rem;color:rgba(255,255,255,.78)}
.kvc-gpu-still i{font-style:normal;font-weight:600;color:rgba(255,255,255,.98);text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:.22em}
.kvc-gpu-note{margin:.75rem 0 0;padding-right:3rem;text-align:left;font-family:${KV.font.mono};font-size:.6875rem;line-height:1.4;letter-spacing:.04em;color:rgba(255,255,255,.46)}
@media (max-width:47.99rem){.kvc-gpu-aside,.kvc-gpu-step{display:block}.kvc-gpu-flow .kvc-gpu-step + .kvc-gpu-aside + .kvc-gpu-step .kvc-gpu-arw{padding-left:0}.kvc-gpu-sep{display:none}.kvc-gpu-node{display:block}}
.kvc-gpu-meta{margin:.625rem auto 0;font-family:${KV.font.mono};font-size:.8125rem;line-height:1.45;letter-spacing:.02em;color:rgba(255,255,255,.54);text-wrap:balance}
.kvc-gpu-nw{white-space:nowrap}
@media (max-width:22rem){.kvc-gpu-nw,.kvc-gpu-step{white-space:normal}}
.kvc-gpu-sr{position:absolute!important;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
@media (prefers-reduced-motion:reduce){.kvc-gpu-tip{transition:opacity .15s ease;transform:none}.kvc-gpu-play{display:none}}
@media (prefers-reduced-transparency:reduce){.kvc-gpu-tip{background:#1c1c1e;-webkit-backdrop-filter:none;backdrop-filter:none}.kvc-gpu-play{background:#2c2c2e;-webkit-backdrop-filter:none;backdrop-filter:none}}
@media (prefers-contrast:more){.kvc-gpu-tip{background:#1c1c1e;box-shadow:0 0 0 1px rgba(255,255,255,.5)}.kvc-gpu-tip-b,.kvc-gpu-flow{color:rgba(255,255,255,.92)}.kvc-gpu-meta,.kvc-gpu-note{color:rgba(255,255,255,.75)}}
`;
  let styled = false;
  function injectStyle() {
    if (styled) return;
    styled = true;
    const st = document.createElement('style');
    st.dataset.kvc = 'gpu';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  const ICON_PAUSE = '<svg viewBox="0 0 14 14" aria-hidden="true"><rect x="2.5" y="1.5" width="3" height="11" rx="1" fill="currentColor"/><rect x="8.5" y="1.5" width="3" height="11" rx="1" fill="currentColor"/></svg>';
  const ICON_PLAY = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3.5 2.1v9.8c0 .6.6.9 1.1.6l7.6-4.9c.5-.3.5-.9 0-1.2L4.6 1.5c-.5-.3-1.1 0-1.1.6z" fill="currentColor"/></svg>';

  const DESC = 'Illustrative MiniGPU-2 die, not the actual layout. Left, the vertex clock domain: a vertex stage transforms a triangle and writes it into an asynchronous FIFO that straddles the gold clock-domain-crossing boundary. The write and read pointers advance on their own clocks and cross the boundary through Gray-coded pointer synchronizers, so exactly one bit changes per step. Right, the raster clock domain: the rasterizer reads each triangle and fills its pixels in scanline order.';

  let uid = 0;

  // ─────────────────────────────────────────────────────────
  function mount(host, opts = {}) {
    injectStyle();
    const id = `kvc-gpu-${++uid}`;
    const reducedMQ = matchMedia('(prefers-reduced-motion: reduce)');
    const contrastMQ = matchMedia('(prefers-contrast: more)');
    const pinned = typeof opts.time === 'number' && isFinite(opts.time);
    const isFigure = host.tagName === 'FIGURE';

    // DOM
    // A figcaption has to be a direct child of its figure, so on a
    // <figure> host the caption is the figure's last child, beside the
    // stage wrapper rather than inside it.
    const root = document.createElement('div');
    root.className = 'kvc-gpu';
    root.innerHTML = `
      <div class="kvc-gpu-stage">
        <div class="kvc-gpu-canvas" role="img" aria-label="${DESC}"></div>
        <div class="kvc-gpu-hits" role="group" aria-label="Die blocks"></div>
        <div class="kvc-gpu-tip" aria-hidden="true"><p class="kvc-gpu-tip-t"></p><p class="kvc-gpu-tip-b"></p></div>
        <button class="kvc-gpu-play" type="button" aria-label="Pause animation">${ICON_PAUSE}</button>
      </div>
      <p class="kvc-gpu-note">Illustration · not to scale, not the actual layout</p>`;
    const cap = document.createElement(isFigure ? 'figcaption' : 'div');
    cap.className = 'kvc-gpu-cap';
    cap.innerHTML = `
        <p class="kvc-gpu-flow"><span class="kvc-gpu-step">Vertex transform<span class="kvc-gpu-arw" aria-hidden="true">→</span><span class="kvc-gpu-sr">, then </span>async FIFO</span> <span class="kvc-gpu-aside">(Gray-coded pointer synchronizers)</span><span class="kvc-gpu-step"><span class="kvc-gpu-arw" aria-hidden="true">→</span><span class="kvc-gpu-sr">, then </span>rasterization</span></p>
        <p class="kvc-gpu-meta"><span class="kvc-gpu-nw">Floorplan &amp; P&amp;R in Cadence Innovus</span><span class="kvc-gpu-sep"> · </span><span class="kvc-gpu-nw kvc-gpu-node">SAED 32nm</span></p>
        <p class="kvc-gpu-still" hidden></p>`;
    host.appendChild(root);
    (isFigure ? host : root).appendChild(cap);
    const stage = root.querySelector('.kvc-gpu-stage');
    const cvHost = root.querySelector('.kvc-gpu-canvas');
    const hitsEl = root.querySelector('.kvc-gpu-hits');
    const tip = root.querySelector('.kvc-gpu-tip');
    const tipT = tip.querySelector('.kvc-gpu-tip-t');
    const tipB = tip.querySelector('.kvc-gpu-tip-b');
    const playBtn = root.querySelector('.kvc-gpu-play');
    const stillEl = cap.querySelector('.kvc-gpu-still');

    // Hit buttons (built for the union of both layouts; hidden per layout)
    const hitBtns = {};
    for (const key of Object.keys(BLOCKS)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'kvc-gpu-hit';
      b.dataset.id = key;
      b.setAttribute('aria-label', BLOCKS[key].name);
      const d = document.createElement('span');
      d.className = 'kvc-gpu-sr';
      d.id = `${id}-${key}`;
      d.textContent = BLOCKS[key].body;
      b.setAttribute('aria-describedby', d.id);
      b.appendChild(d);
      hitsEl.appendChild(b);
      hitBtns[key] = b;
    }

    // State
    let L = LAYOUTS.land;
    let G = null;              // derived geometry for L
    let s = 1;                 // logical → css
    let staticCv = null;       // flattened static layer
    let introLayers = null;    // [base, cells, blocks, cdc] during the reveal
    let simT = pinned ? opts.time : (reducedMQ.matches ? STATIC_T : START_T);
    let sim = Sim();
    let paused = pinned;
    let dead = false;
    let introQ = (pinned || reducedMQ.matches || opts.intro === false) ? 1 : 0;
    let introArmed = introQ >= 1;
    let active = null;         // hovered / focused block id
    const hl = {};
    const pt = { v: 0, t: 0 }, pt2 = { v: 0, t: 0 };
    const tmp = [0, 0], tmp2 = [0, 0];
    const vtxScratch = new Float32Array(6);

    let hc = contrastMQ.matches;
    let booted = false;         // the canvas sizes itself before the loop exists
    let viaPointer = false;     // focus that came from a tap/click, not the keyboard

    // Canvas
    // KV.canvas sizes synchronously, so take the handle from the callback.
    let cv = null, ctx = null;


    function deriveGeometry() {
      const lanesA = poly(L.laneA), lanesB = poly(L.laneB);
      const R = L.ring, ro = R.r + R.th / 2;
      const wa = R.base, ra = R.base + Math.PI;
      G = {
        inTrace: [L.inStart[0], L.inStart[1], R.cx + Math.cos(wa) * ro, R.cy + Math.sin(wa) * ro],
        outTrace: [R.cx + Math.cos(ra) * ro, R.cy + Math.sin(ra) * ro, L.outEnd[0], L.outEnd[1]],
        wPath: [], rPath: [],
        laneA: lanesA, laneB: lanesB,
        dA: L.flopsA.map(([x, y]) => distTo(lanesA, x, y)),
        dB: L.flopsB.map(([x, y]) => distTo(lanesB, x, y)),
        cells: buildCells(),
        clocks: [],
      };
      for (let k = 0; k < 8; k++) {
        G.wPath[k] = ringPath(L.inStart, wa, slotAngle(k), false);
        G.rPath[k] = ringPath(L.outEnd, ra, slotAngle(k), true);
      }
    }

    // A packet's road: along the trace to the ring's port, onto the
    // track just outside the slots, round to its slot, then in. Corners
    // are rounded so the motion never kinks. Reads run the same road
    // backwards from the slot to the opposite port.
    function ringPath(start, portA, slotA, reverse) {
      const R = L.ring, rt = R.r + R.th / 2 + R.track, f = R.track;
      const P = (a, rad) => [R.cx + Math.cos(a) * rad, R.cy + Math.sin(a) * rad];
      let delta = slotA - portA;
      while (delta > Math.PI) delta -= TAU;
      while (delta <= -Math.PI) delta += TAU;
      const dir = delta < 0 ? -1 : 1, fa = f / rt;
      const pts = [start[0], start[1]];
      const quad = (a, c, b) => {
        for (let i = 1; i <= 6; i++) {
          const u = i / 6, v = 1 - u;
          pts.push(v * v * a[0] + 2 * v * u * c[0] + u * u * b[0], v * v * a[1] + 2 * v * u * c[1] + u * u * b[1]);
        }
      };
      const port = P(portA, rt);
      const ux = port[0] - start[0], uy = port[1] - start[1], ul = Math.hypot(ux, uy);
      const a1 = [port[0] - (ux / ul) * f, port[1] - (uy / ul) * f];
      pts.push(a1[0], a1[1]);
      const split = Math.hypot(a1[0] - start[0], a1[1] - start[1]);
      const arc0 = portA + dir * fa, arc1 = portA + delta - dir * fa;
      quad(a1, port, P(arc0, rt));
      const n = Math.max(2, Math.ceil(Math.abs(arc1 - arc0) / 0.06));
      for (let i = 1; i <= n; i++) { const q = P(lerp(arc0, arc1, i / n), rt); pts.push(q[0], q[1]); }
      quad(P(arc1, rt), P(slotA, rt), P(slotA, rt - f));
      const end = P(slotA, R.r);
      pts.push(end[0], end[1]);
      if (!reverse) { const pl = poly(pts); pl.split = split; return pl; }
      const rev = [];
      for (let i = pts.length - 2; i >= 0; i -= 2) rev.push(pts[i], pts[i + 1]);
      const pl = poly(rev); pl.split = pl.len - split; return pl;
    }

    // Standard-cell rows: deterministic per layout.
    function buildCells() {
      const r = KV.rng(L.portrait ? 23 : 7);
      const out = [];
      const pad = 14;
      const blocks = [L.vtx, L.ras, L.fifo].map((b) => [b.x - pad, b.y - pad, b.w + 2 * pad, b.h + 2 * pad]).concat(L.keepouts);
      const x0 = L.core.x + 10, x1 = L.core.x + L.core.w - 10;
      const rowH = L.portrait ? 12 : 11;
      const widths = [4, 6, 6, 8, 8, 10, 12, 14, 18, 22];
      for (let y = L.rowsY[0]; y + rowH - 2 <= L.rowsY[1]; y += rowH) {
        let x = x0 + r() * 6;
        while (x < x1) {
          const w = widths[Math.floor(r() * widths.length)];
          const gap = r() < 0.12 ? 6 + r() * 14 : 1.5;
          const cx1 = Math.min(x + w, x1);
          let blocked = false;
          for (const [bx, by, bw, bh] of blocks) {
            if (cx1 > bx && x < bx + bw && y + rowH - 2 > by && y < by + bh) { blocked = true; break; }
          }
          if (!blocked && cx1 - x > 2) out.push(x, y, cx1 - x, r() < 0.07 ? 3 : Math.floor(r() * 3));
          x = cx1 + gap;
        }
      }
      return { data: Float32Array.from(out), rowH };
    }

    // ── Static layers ─────────────────────────────────────
    function newLayer() {
      const c = document.createElement('canvas');
      c.width = cv.canvas.width; c.height = cv.canvas.height;
      return c;
    }
    const logical = (c) => c.setTransform(cv.dpr * s, 0, 0, cv.dpr * s, 0, 0);
    const cssSpace = (c) => c.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0);
    const px = (cssPx) => cssPx / s; // css px → logical

    function rr(c, b, r) { KV.roundRect(c, b.x, b.y, b.w, b.h, r); }

    function drawBase(c) {
      logical(c);
      const d = L.die;
      // Die: graphite body, a soft rim light on the top edge.
      const g = c.createLinearGradient(0, d.y, 0, d.y + d.h);
      g.addColorStop(0, '#131316');
      g.addColorStop(1, '#0b0b0d');
      KV.roundRect(c, d.x, d.y, d.w, d.h, d.r);
      c.fillStyle = g; c.fill();
      c.lineWidth = px(1); c.strokeStyle = W1(hc ? 0.4 : 0.18); c.stroke();
      const rim = c.createLinearGradient(d.x, 0, d.x + d.w, 0);
      rim.addColorStop(0, W1(0)); rim.addColorStop(0.5, W1(0.22)); rim.addColorStop(1, W1(0));
      c.beginPath(); c.moveTo(d.x + d.r, d.y + px(0.75)); c.lineTo(d.x + d.w - d.r, d.y + px(0.75));
      c.strokeStyle = rim; c.stroke();

      // I/O pad ring
      const band = L.rings[0] - (d.x - 0) - 6;
      const pw = 20, ph = Math.min(13, band * 0.5);
      c.lineWidth = px(1);
      const padRow = (horizontal, fixed) => {
        const a0 = horizontal ? d.x + 60 : d.y + 60, a1 = horizontal ? d.x + d.w - 60 : d.y + d.h - 60;
        const n = Math.floor((a1 - a0) / L.padStep);
        const off = a0 + ((a1 - a0) - n * L.padStep) / 2;
        for (let i = 0; i <= n; i++) {
          const a = off + i * L.padStep - pw / 2;
          const x = horizontal ? a : fixed, y = horizontal ? fixed : a;
          const w = horizontal ? pw : ph, h = horizontal ? ph : pw;
          c.fillStyle = W1(0.045); c.fillRect(x, y, w, h);
          c.strokeStyle = W1(0.13); c.strokeRect(x, y, w, h);
          c.fillStyle = W1(0.09); c.fillRect(x + w / 2 - 2.5, y + h / 2 - 2.5, 5, 5);
        }
      };
      const po = 12;
      padRow(true, d.y + po); padRow(true, d.y + d.h - po - ph);
      padRow(false, d.x + po); padRow(false, d.x + d.w - po - ph);

      // Core power ring (two rails with a faint band between)
      const [i0, i1] = L.rings;
      c.fillStyle = W1(0.025);
      c.beginPath();
      c.rect(i0, i0, L.W - 2 * i0, L.H - 2 * i0);
      c.rect(i1, i1, L.W - 2 * i1, L.H - 2 * i1);
      c.fill('evenodd');
      c.strokeStyle = W1(hc ? 0.3 : 0.16); c.lineWidth = px(1);
      c.strokeRect(i0, i0, L.W - 2 * i0, L.H - 2 * i0);
      c.strokeRect(i1, i1, L.W - 2 * i1, L.H - 2 * i1);
    }

    function drawCells(c) {
      logical(c);
      const { data, rowH } = G.cells;
      const alphas = hc ? [0.03, 0.04, 0.05, 0.075] : [0.015, 0.02, 0.026, 0.038];
      for (let b = 0; b < 4; b++) {
        c.beginPath();
        for (let i = 0; i < data.length; i += 4) if (data[i + 3] === b) c.rect(data[i], data[i + 1], data[i + 2], rowH - 2);
        c.fillStyle = W1(alphas[b]); c.fill();
      }
      // Vertical power straps
      c.fillStyle = W1(0.022);
      const step = L.portrait ? 92 : 104;
      for (let x = L.core.x + step / 2; x < L.core.x + L.core.w; x += step) c.fillRect(x - 1.5, L.rowsY[0], 3, L.rowsY[1] - L.rowsY[0]);
    }

    // Supporting macros sit a step back; the FIFO is the lit block.
    function macro(c, b, hero) {
      rr(c, b, 5);
      if (hero) {
        const R = L.ring, g = c.createRadialGradient(R.cx, R.cy, 0, R.cx, R.cy, Math.max(b.w, b.h) * 0.62);
        g.addColorStop(0, '#16161a'); g.addColorStop(1, '#0e0e11');
        c.fillStyle = g;
      } else c.fillStyle = '#0b0b0d';
      c.fill();
      c.lineWidth = px(1); c.strokeStyle = W1(hc ? (hero ? 0.75 : 0.5) : (hero ? 0.44 : 0.22)); c.stroke();
      if (hero) {
        // rim light along the top edge
        const rim = c.createLinearGradient(b.x, 0, b.x + b.w, 0);
        rim.addColorStop(0, W1(0)); rim.addColorStop(0.5, W1(0.34)); rim.addColorStop(1, W1(0));
        c.beginPath(); c.moveTo(b.x + 6, b.y + px(0.5)); c.lineTo(b.x + b.w - 6, b.y + px(0.5));
        c.strokeStyle = rim; c.stroke();
      } else {
        c.beginPath();
        for (let x = b.x + 12; x < b.x + b.w - 8; x += 14) { c.moveTo(x, b.y + b.h - 1); c.lineTo(x, b.y + b.h - 7); }
        c.strokeStyle = W1(0.12); c.stroke();
      }
    }

    function drawBlocks(c) {
      logical(c);
      // Light pooled around the crossing — the one place the eye lands.
      const R = L.ring;
      const glow = c.createRadialGradient(R.cx, R.cy, 0, R.cx, R.cy, L.portrait ? 380 : 520);
      glow.addColorStop(0, W1(0.05)); glow.addColorStop(0.55, W1(0.018)); glow.addColorStop(1, W1(0));
      c.fillStyle = glow;
      KV.roundRect(c, L.core.x, L.core.y, L.core.w, L.core.h, 4); c.fill();

      // Macros
      macro(c, L.vtx, false); macro(c, L.ras, false); macro(c, L.fifo, true);

      // Vertex viewport: a quiet coordinate frame
      const vp = L.vp;
      rr(c, vp, 4); c.fillStyle = '#08080a'; c.fill();
      c.lineWidth = px(1); c.strokeStyle = W1(0.1); c.stroke();
      c.beginPath();
      for (let i = 1; i < 8; i++) { const x = vp.x + (vp.w * i) / 8; c.moveTo(x, vp.y + 4); c.lineTo(x, vp.y + vp.h - 4); }
      for (let j = 1; j < 6; j++) { const y = vp.y + (vp.h * j) / 6; c.moveTo(vp.x + 4, y); c.lineTo(vp.x + vp.w - 4, y); }
      c.strokeStyle = W1(0.035); c.stroke();
      c.beginPath();
      c.moveTo(vp.x + vp.w / 2, vp.y + 4); c.lineTo(vp.x + vp.w / 2, vp.y + vp.h - 4);
      c.moveTo(vp.x + 4, vp.y + vp.h / 2); c.lineTo(vp.x + vp.w - 4, vp.y + vp.h / 2);
      c.strokeStyle = W1(0.08); c.stroke();

      // Raster grid: empty pixels
      const gr = L.grid, cs = gr.w / GC, gp = Math.max(1.4, cs * 0.09);
      c.beginPath();
      for (let j = 0; j < GR; j++) for (let i = 0; i < GC; i++) c.rect(gr.x + i * cs + gp / 2, gr.y + j * cs + gp / 2, cs - gp, cs - gp);
      c.fillStyle = W1(0.028); c.fill();

      // FIFO ring: 8 slots, and the track packets ride just outside it
      c.lineWidth = px(1);
      for (let k = 0; k < 8; k++) {
        slotPath(c, k);
        c.fillStyle = W1(0.03); c.fill();
        c.strokeStyle = W1(hc ? 0.5 : 0.3); c.stroke();
      }
      c.beginPath(); c.arc(R.cx, R.cy, R.r + R.th / 2 + R.track, 0, TAU);
      c.strokeStyle = W1(hc ? 0.18 : 0.07); c.stroke();

      // Traces + pins
      c.lineWidth = px(1.25); c.strokeStyle = W1(0.22); c.lineCap = 'round';
      for (const t of [G.inTrace, G.outTrace, L.wLink, L.rLink, L.laneA, L.laneB]) {
        c.beginPath(); c.moveTo(t[0], t[1]); for (let i = 2; i < t.length; i += 2) c.lineTo(t[i], t[i + 1]); c.stroke();
      }
      c.fillStyle = W1(0.34);
      for (const [x, y] of [L.inStart, L.outEnd]) c.fillRect(x - 3.5, y - 3.5, 7, 7);

      // Pointer logic blocks + Gray bit cells
      for (const b of [L.wBlk, L.rBlk]) {
        rr(c, b, 5); c.fillStyle = '#0e0e11'; c.fill();
        c.lineWidth = px(1); c.strokeStyle = W1(hc ? 0.6 : 0.36); c.stroke();
        for (let i = 0; i < 4; i++) {
          const [x, y] = cellXY(b, i);
          rr(c, { x: x + 0.5, y: y + 0.5, w: L.cell - 1, h: L.cell - 1 }, 3);
          c.strokeStyle = W1(hc ? 0.5 : 0.26); c.stroke();
        }
      }

      // Synchronizer flops (D flip-flop with a clock notch)
      for (const [x, y] of L.flopsA.concat(L.flopsB)) {
        const f = L.flop, n = f * 0.2;
        rr(c, { x: x - f / 2, y: y - f / 2, w: f, h: f }, 3);
        c.fillStyle = '#0e0e11'; c.fill();
        c.lineWidth = px(1); c.strokeStyle = W1(hc ? 0.7 : 0.46); c.stroke();
        c.beginPath();
        if (L.portrait) { c.moveTo(x + f / 2, y - n); c.lineTo(x + f / 2 - n * 1.2, y); c.lineTo(x + f / 2, y + n); }
        else { c.moveTo(x - n, y + f / 2); c.lineTo(x, y + f / 2 - n * 1.2); c.lineTo(x + n, y + f / 2); }
        c.strokeStyle = W1(0.46); c.stroke();
      }

      // Labels (css space) + clock positions
      cssSpace(c);
      G.clocks.length = 0;
      for (const lb of L.labels) {
        if (lb.cdc) continue;
        const color = hc ? P.ink2 : lb.hero ? P.ink2 : W1(0.46);
        KV.label(c, lb.text, lb.x * s, lb.y * s, { size: L.labelPx, color, align: lb.align || 'left' });
        if (lb.clock) {
          c.save();
          c.font = `500 ${L.labelPx}px ${KV.font.mono}`;
          if ('letterSpacing' in c) c.letterSpacing = `${(L.labelPx * 0.08).toFixed(2)}px`;
          const wpx = c.measureText(lb.text.toUpperCase()).width / s;
          c.restore();
          const cw = L.clockW, ch = L.clockH;
          let x, y;
          if (lb.below) { x = lb.x; y = lb.y + 10; }
          else if (lb.align === 'right') { x = lb.x - wpx - 16 - cw; y = lb.y - ch + 0.5; }
          else { x = lb.x + wpx + 16; y = lb.y - ch + 0.5; }
          G.clocks.push({ x, y, w: cw, h: ch, T: lb.clock === 'w' ? TW : TR, ph: lb.clock === 'w' ? 0 : RPH });
        }
      }
    }

    function drawCdc(c) {
      logical(c);
      c.lineCap = 'butt';
      // Full strength across the die; quieter where it runs through the
      // FIFO, which straddles it — the ring stays the brightest thing.
      const f = L.fifo;
      for (const inside of [false, true]) {
        c.save();
        c.beginPath();
        if (!inside) c.rect(0, 0, L.W, L.H);
        c.rect(f.x + 1, f.y + 1, f.w - 2, f.h - 2);
        c.clip(inside ? 'nonzero' : 'evenodd');
        const k = inside ? 0.42 : 1;
        for (const [x0, y0, x1, y1] of L.cdc) {
          c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1);
          c.strokeStyle = P.goldA(0.07 * k); c.lineWidth = px(7); c.setLineDash([]); c.stroke();
          c.strokeStyle = P.goldA(0.9 * k); c.lineWidth = px(1.5); c.setLineDash([px(6), px(5)]); c.stroke();
        }
        c.restore();
      }
      c.setLineDash([]);
      // The boundary is the gold element; its name stays in label ink.
      cssSpace(c);
      for (const lb of L.labels) {
        if (!lb.cdc) continue;
        KV.label(c, lb.text, lb.x * s, lb.y * s, { size: L.labelPx, color: hc ? P.ink2 : P.ink3, align: lb.align || 'left' });
      }
    }

    function buildStatic() {
      if (introQ < 1) {
        introLayers = [drawBase, drawCells, drawBlocks, drawCdc].map((fn) => {
          const l = newLayer(); fn(l.getContext('2d')); return l;
        });
        staticCv = null;
      } else {
        introLayers = null;
        staticCv = newLayer();
        const c = staticCv.getContext('2d');
        drawBase(c); drawCells(c); drawBlocks(c); drawCdc(c);
      }
    }

    function flatten() {
      if (!introLayers) return;
      staticCv = newLayer();
      const c = staticCv.getContext('2d');
      for (const l of introLayers) c.drawImage(l, 0, 0);
      introLayers = null;
    }

    // Geometry helpers
    function slotAngle(k) { return L.ring.base + ((k + 0.5) * TAU) / 8; }
    function slotPath(c, k) {
      const R = L.ring, a = slotAngle(k), half = TAU / 16 - 0.05;
      const r0 = R.r - R.th / 2, r1 = R.r + R.th / 2;
      c.beginPath();
      c.arc(R.cx, R.cy, r1, a - half, a + half);
      c.arc(R.cx, R.cy, r0, a + half, a - half, true);
      c.closePath();
    }
    function cellXY(b, i) {
      const total = 4 * L.cell + 3 * L.cellGap;
      return [b.x + (b.w - total) / 2 + i * (L.cell + L.cellGap), b.y + (b.h - L.cell) / 2];
    }
    const vpX = (u) => L.vp.x + ((u + AX) / (2 * AX)) * L.vp.w;
    const vpY = (v) => L.vp.y + ((v + 1) / 2) * L.vp.h;

    // ── Dynamic drawing ───────────────────────────────────
    function drawClocks(t) {
      ctx.lineWidth = px(1); ctx.lineJoin = 'miter';
      for (const k of G.clocks) {
        const span = 3 * TW; // shared timebase → 3 vertex periods, 2 raster periods
        const t0 = t - span;
        ctx.beginPath();
        const level = (tt) => { const q = ((tt - k.ph) / k.T) % 1; return (q < 0 ? q + 1 : q) < 0.5; };
        let hi = level(t0);
        ctx.moveTo(k.x, hi ? k.y : k.y + k.h);
        // walk edges inside the window
        let e = Math.floor((t0 - k.ph) / (k.T / 2)) + 1;
        for (;;) {
          const te = k.ph + (e * k.T) / 2;
          if (te > t) break;
          const x = k.x + ((te - t0) / span) * k.w;
          ctx.lineTo(x, hi ? k.y : k.y + k.h);
          hi = !hi;
          ctx.lineTo(x, hi ? k.y : k.y + k.h);
          e++;
        }
        ctx.lineTo(k.x + k.w, hi ? k.y : k.y + k.h);
        ctx.strokeStyle = W1(hc ? 0.7 : 0.42); ctx.stroke();
        // the newest rising edge glints
        const sinceRise = ((t - k.ph) % k.T + k.T) % k.T;
        const g = Math.exp(-sinceRise / 0.12);
        ctx.fillStyle = W1(0.25 + 0.6 * g);
        ctx.beginPath(); ctx.arc(k.x + k.w + px(5), k.y + k.h / 2, px(1.6), 0, TAU); ctx.fill();
      }
    }

    function triPath(c, f, ox, oy, scale) {
      c.beginPath();
      c.moveTo(ox + f[0] * scale, oy + f[1] * scale);
      c.lineTo(ox + f[2] * scale, oy + f[3] * scale);
      c.lineTo(ox + f[4] * scale, oy + f[5] * scale);
      c.closePath();
    }

    function vertexStage(t, out) {
      // The triangle in the vertex stage: the first one not yet departed.
      let tri = null, tStart = 0, tD = Infinity;
      for (const rec of sim.recs) if (t < rec.tD + 0.05) { tri = rec.tri; tStart = rec.tStart; tD = rec.tD; break; }
      if (!tri) { tri = sim.vTri; tStart = sim.vStart; }
      out.tri = tri; out.tStart = tStart; out.tD = tD;
      return out;
    }
    const vs = { tri: null, tStart: 0, tD: 0 };

    function drawVertex(t) {
      const { tri, tStart, tD } = vertexStage(t, vs);
      const ready = tStart + tri.K * TW;
      const pEnd = Math.min(ready, tD) - 0.2;
      let p = smoothstep((t - tStart - 0.15) / Math.max(0.3, pEnd - tStart - 0.15));
      let aIn = segment(t, tStart + 0.05, tStart + 0.35);
      // The still frame shows the transform mid-way, ghost and result apart.
      if (stillFrame()) { p = 0.62; aIn = 1; }
      const leave = segment(t, tD - 0.18, tD + 0.05);
      const alpha = aIn * (1 - leave);
      if (alpha <= 0.001) return;
      const m = tri.m;
      const sc = lerp(1, tri.sc, p);
      xform(m, tri.rot * p, sc, tri.tx * p, tri.ty * p, vtxScratch);
      // collapse toward the centroid as it leaves
      if (leave > 0) {
        const gx = (vtxScratch[0] + vtxScratch[2] + vtxScratch[4]) / 3, gy = (vtxScratch[1] + vtxScratch[3] + vtxScratch[5]) / 3;
        const k = 1 - easeOut(leave) * 0.8;
        for (let i = 0; i < 3; i++) { vtxScratch[2 * i] = lerp(gx, vtxScratch[2 * i], k); vtxScratch[2 * i + 1] = lerp(gy, vtxScratch[2 * i + 1], k); }
      }
      const hu = L.vp.w / (2 * AX), hv = L.vp.h / 2, ox = L.vp.x + L.vp.w / 2, oy = L.vp.y + L.vp.h / 2;
      ctx.save();
      KV.roundRect(ctx, L.vp.x, L.vp.y, L.vp.w, L.vp.h, 4); ctx.clip();
      // model-space ghost
      ctx.globalAlpha = aIn * (1 - leave) * (0.9 - 0.4 * p);
      triPath(ctx, m, ox, oy, hu);
      ctx.setLineDash([px(3), px(4)]); ctx.lineWidth = px(1); ctx.strokeStyle = W1(0.28); ctx.stroke();
      ctx.setLineDash([]);
      // transformed triangle
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(ox + vtxScratch[0] * hu, oy + vtxScratch[1] * hv);
      ctx.lineTo(ox + vtxScratch[2] * hu, oy + vtxScratch[3] * hv);
      ctx.lineTo(ox + vtxScratch[4] * hu, oy + vtxScratch[5] * hv);
      ctx.closePath();
      ctx.fillStyle = W1(0.045); ctx.fill();
      ctx.lineWidth = px(1.25); ctx.lineJoin = 'round'; ctx.strokeStyle = W1(0.74); ctx.stroke();
      ctx.fillStyle = W1(0.88);
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.arc(ox + vtxScratch[2 * i] * hu, oy + vtxScratch[2 * i + 1] * hv, px(2.4), 0, TAU); ctx.fill();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
      // Back-pressure: finished but the FIFO is full.
      if (t > ready + 0.15 && t < tD - 0.18) {
        const a = segment(t, ready + 0.15, ready + 0.45);
        ctxLabel('Hold · FIFO full', L.vp.x + L.vp.w - 10, L.vp.y + L.vp.h - 10, { align: 'right', alpha: a });
      }
    }

    const stillFrame = () => reducedMQ.matches && !pinned;

    function ctxLabel(text, x, y, { align = 'left', alpha = 1, color, size } = {}) {
      ctx.save();
      cssSpace(ctx);
      ctx.globalAlpha *= alpha;
      KV.label(ctx, text, x * s, y * s, { size: size || L.ptPx, color: color || (hc ? P.ink2 : P.ink3), align });
      ctx.restore();
    }

    function glyph(tri, x, y, r, a) {
      const g = tri.g;
      ctx.beginPath();
      ctx.moveTo(x + g[0] * r, y + g[1] * r);
      ctx.lineTo(x + g[2] * r, y + g[3] * r);
      ctx.lineTo(x + g[4] * r, y + g[5] * r);
      ctx.closePath();
      ctx.fillStyle = W1(0.14 * a); ctx.fill();
      ctx.lineWidth = px(1.1); ctx.lineJoin = 'round'; ctx.strokeStyle = W1(0.92 * a); ctx.stroke();
    }

    function streak(pl, d, len, a) {
      // light running along a trace, brightest at the head
      const N = 6;
      ctx.lineWidth = px(1.6); ctx.lineCap = 'round';
      for (let i = 0; i < N; i++) {
        const d0 = d - (len * (i + 1)) / N, d1 = d - (len * i) / N;
        if (d1 <= 0) break;
        at(pl, Math.max(0, d0), tmp); at(pl, d1, tmp2);
        ctx.beginPath(); ctx.moveTo(tmp[0], tmp[1]); ctx.lineTo(tmp2[0], tmp2[1]);
        ctx.strokeStyle = W1(a * 0.7 * (1 - i / N)); ctx.stroke();
      }
    }

    function dot(x, y, a) {
      ctx.fillStyle = W1(0.12 * a);
      ctx.beginPath(); ctx.arc(x, y, px(6), 0, TAU); ctx.fill();
      ctx.fillStyle = W1(0.95 * a);
      ctx.beginPath(); ctx.arc(x, y, px(2.2), 0, TAU); ctx.fill();
    }

    function drawPackets(t) {
      const R = L.ring;
      // slots first, so a packet in flight always rides above them
      for (const rec of sim.recs) {
        if (t < rec.tW - 0.06 || t >= rec.tR + 0.25) continue;
        const a = Math.min(segment(t, rec.tW - 0.06, rec.tW + 0.1), 1 - segment(t, rec.tR, rec.tR + 0.25));
        const fresh = Math.exp(-Math.max(0, t - rec.tW) / 0.35);
        slotPath(ctx, rec.slot);
        ctx.fillStyle = W1((0.1 + 0.16 * fresh) * a); ctx.fill();
        ctx.lineWidth = px(1); ctx.strokeStyle = W1((0.44 + 0.4 * fresh) * a); ctx.stroke();
        if (t >= rec.tW && t < rec.tR) {
          const ang = slotAngle(rec.slot);
          glyph(rec.tri, R.cx + Math.cos(ang) * R.r, R.cy + Math.sin(ang) * R.r, R.gS, 1);
        }
      }
      for (const rec of sim.recs) {
        // write: vertex stage → trace → round the track → into its slot
        if (t >= rec.tD && t < rec.tW) {
          const pl = G.wPath[rec.slot];
          const d = easeInOut((t - rec.tD) / (rec.tW - rec.tD)) * pl.len;
          const a = segment(t, rec.tD, rec.tD + 0.08);
          at(pl, d, tmp);
          streak(pl, d, 64, a);
          glyph(rec.tri, tmp[0], tmp[1], lerp(R.gT, R.gS, smoothstep((d - pl.split) / (pl.len - pl.split))), a);
        }
        // read: out of its slot → round the track → trace → rasterizer
        if (t >= rec.tR && t < rec.tR + rec.rDur + 0.06) {
          const pl = G.rPath[rec.slot];
          const d = easeInOut((t - rec.tR) / rec.rDur) * pl.len;
          const a = 1 - segment(t, rec.tR + rec.rDur - 0.06, rec.tR + rec.rDur + 0.06);
          at(pl, d, tmp);
          streak(pl, d, 64, a);
          glyph(rec.tri, tmp[0], tmp[1], lerp(R.gS, R.gT, smoothstep(d / pl.split)), a);
        }
      }
    }

    function caret(angle, rad, inward, a) {
      const R = L.ring, cx = R.cx + Math.cos(angle) * rad, cy = R.cy + Math.sin(angle) * rad;
      const ux = Math.cos(angle) * (inward ? -1 : 1), uy = Math.sin(angle) * (inward ? -1 : 1);
      const sz = R.caret;
      ctx.beginPath();
      ctx.moveTo(cx + ux * sz, cy + uy * sz);
      ctx.lineTo(cx - ux * sz - uy * sz, cy - uy * sz + ux * sz);
      ctx.lineTo(cx - ux * sz + uy * sz, cy - uy * sz - ux * sz);
      ctx.closePath();
      ctx.fillStyle = W1(a); ctx.fill();
    }

    function ptrAngle(log, t) {
      ptrAt(log, t, pt);
      const k = easeOut((t - pt.t) / 0.32);
      const a1 = slotAngle(pt.v & 7), a0 = a1 - TAU / 8;
      return lerp(a0, a1, k);
    }

    function flag(text, log, readSide, t) {
      let v = readSide ? 1 : 0, tc = -1e9;
      for (let i = log.length - 1; i >= 0; i--) if (log[i].t <= t) { v = log[i].v; tc = log[i].t; break; }
      const a = v ? segment(t, tc, tc + 0.2) : 1 - segment(t, tc, tc + 0.2);
      if (a <= 0.001) return;
      const R = L.ring, g = px(10);
      if (L.portrait) ctxLabel(text, R.cx, readSide ? R.cy + g + px(L.ptPx * 0.72) : R.cy - g, { align: 'center', alpha: a, color: P.ink2 });
      else ctxLabel(text, readSide ? R.cx + g : R.cx - g, R.cy + px(L.ptPx * 0.36), { align: readSide ? 'left' : 'right', alpha: a, color: P.ink2 });
    }

    function ptrLabel(text, ang, rad, color) {
      const R = L.ring, f = L.fifo, m = 12;
      const x = Math.max(f.x + m, Math.min(f.x + f.w - m, R.cx + Math.cos(ang) * rad));
      const y = Math.max(f.y + m, Math.min(f.y + f.h - m, R.cy + Math.sin(ang) * rad));
      ctxLabel(text, x, y + px(L.ptPx * 0.36), { align: 'center', color, size: L.ptPx });
    }

    function drawPointers(t) {
      const R = L.ring;
      const outer = R.r + R.th / 2, inner = R.r - R.th / 2;
      const aw = ptrAngle(sim.wLog, t), ar = ptrAngle(sim.rLog, t);
      caret(aw, outer + R.wc[0], true, 0.95);
      caret(ar, inner - R.rc[0], false, 0.72);
      ptrLabel('W', aw, outer + R.wc[1], P.ink2);
      ptrLabel('R', ar, inner - R.rc[1], P.ink3);

      // The flags the circuit actually raises, each in its own domain and
      // each judged from a synchronized pointer — so they lag what the
      // ring shows by a couple of clocks, as the real ones do.
      flag('Full', sim.fLog, false, t);
      flag('Empty', sim.eLog, true, t);

      // Gray-coded pointer cells — one bit flips per step and is marked
      // in gold. Only the newest flip holds the gold: when the other
      // pointer steps, the older mark hands off at once.
      const tw = ptrAt(sim.wLog, t, pt).t, tr = ptrAt(sim.rLog, t, pt2).t;
      const wNewer = tw >= tr;
      let kW = wNewer ? 1 : 1 - segment(t, tr, tr + 0.12);
      let kR = wNewer ? 1 - segment(t, tw, tw + 0.12) : 1;
      const still = stillFrame();
      if (still) { kW = wNewer ? 1 : 0; kR = wNewer ? 0 : 1; }
      grayCells(L.wBlk, sim.wLog, t, kW, still);
      grayCells(L.rBlk, sim.rLog, t, kR, still);
    }

    // The new value is always what the cell shows: a 1 is filled, a 0
    // is empty. The flip is marked on top — gold fill for a bit that
    // rose, a gold ring for a bit that fell — and the mark fades back to
    // the cell's resting state, never through a muddy half-fill.
    function grayCells(b, log, t, k, hold) {
      ptrAt(log, t, pt);
      const g = gray(pt.v), fb = bitIndex(g ^ gray((pt.v - 1) & 15));
      const since = t - pt.t;
      let fl = since < FLASH ? 1 - smoothstep((since - 0.15) / (FLASH - 0.15)) : 0;
      if (hold) fl = 1;
      if (pt.t < 0) fl = 0;
      fl *= k;
      const c = L.cell, ins = Math.max(2.5, c * 0.1);
      for (let i = 0; i < 4; i++) {
        const bit = 3 - i;
        const [x, y] = cellXY(b, i);
        const on = (g >> bit) & 1, mark = bit === fb ? fl : 0;
        if (on) {
          rr(ctx, { x: x + ins, y: y + ins, w: c - 2 * ins, h: c - 2 * ins }, 2);
          ctx.fillStyle = W1(0.84); ctx.fill();
          if (mark > 0) { ctx.fillStyle = P.goldA(0.96 * mark); ctx.fill(); }
        } else if (mark > 0) {
          rr(ctx, { x: x + 0.5, y: y + 0.5, w: c - 1, h: c - 1 }, 3);
          ctx.lineWidth = Math.max(px(1.5), c * 0.07); ctx.strokeStyle = P.goldA(0.96 * mark); ctx.stroke();
        }
      }
    }

    // A pointer change travels the lane, latched by flop 1 then flop 2
    // on the *destination* clock — light running along the trace.
    function lane(pl, dF, log, t, nextEdge, T) {
      // the two most recent source changes may both be in flight
      for (let n = 0; n < 2; n++) {
        const tc = n === 0 ? ptrAt(log, t, pt2).t : ptrPrevChange(log, t);
        if (tc < 0) continue;
        const t1 = nextEdge(tc), t2 = t1 + T, t3 = t2 + 0.35;
        if (t > t3 + 0.2) continue;
        let d;
        if (t < t1) d = easeInOut((t - tc) / (t1 - tc)) * dF[0];
        else if (t < t2) d = dF[0] + easeInOut((t - t1) / Math.min(T, 0.4)) * (dF[1] - dF[0]);
        else d = dF[1] + easeInOut((t - t2) / 0.35) * (pl.len - dF[1]);
        const a = 1 - segment(t, t3, t3 + 0.2);
        at(pl, d, tmp);
        streak(pl, d, 26, a * 0.8);
        dot(tmp[0], tmp[1], a);
        // flop latch flash
        flopFlash(pl, dF[0], t - t1);
        flopFlash(pl, dF[1], t - t2);
      }
    }
    function flopFlash(pl, d, since) {
      if (since < 0 || since > 0.6) return;
      const a = 1 - easeOut(since / 0.6);
      at(pl, d, tmp);
      const f = L.flop;
      ctx.fillStyle = W1(0.55 * a); ctx.fillRect(tmp[0] - f / 2 + 2, tmp[1] - f / 2 + 2, f - 4, f - 4);
    }

    function drawLanes(t) {
      lane(G.laneA, G.dA, sim.wLog, t, nextR, TR);
      lane(G.laneB, G.dB, sim.rLog, t, nextW, TW);
    }

    function drawRaster(t) {
      let cur = null, prev = null;
      for (const rec of sim.recs) if (rec.tR <= t) { prev = cur; cur = rec; }
      if (!cur) return;
      const gr = L.grid, cs = gr.w / GC, gp = Math.max(1.4, cs * 0.09);
      if (prev && t < cur.tR + FADE) pixels(prev, Infinity, 1 - easeOut((t - cur.tR) / FADE), gr, cs, gp);
      const fs = cur.tR + cur.rDur, fe = cur.tR + cur.tri.M * TR - HOLD;
      if (t >= fs - 0.12) pixels(cur, t, 1, gr, cs, gp, fs, fe);
    }

    function pixels(rec, t, alpha, gr, cs, gp, fs, fe) {
      const cov = rec.tri.cover, N = cov.length;
      const f = rec.tri.f;
      const hu = gr.w / (2 * AX), hv = gr.h / 2, ox = gr.x + gr.w / 2, oy = gr.y + gr.h / 2;
      const live = t !== Infinity;
      // the edge functions, drawn as the triangle's outline
      const oa = live ? segment(t, fs - 0.12, fs + 0.1) : 1;
      ctx.beginPath();
      ctx.moveTo(ox + f[0] * hu, oy + f[1] * hv); ctx.lineTo(ox + f[2] * hu, oy + f[3] * hv); ctx.lineTo(ox + f[4] * hu, oy + f[5] * hv); ctx.closePath();
      ctx.lineWidth = px(1); ctx.lineJoin = 'round'; ctx.strokeStyle = W1(0.45 * oa * alpha); ctx.stroke();
      if (live && t < fs) return;
      const span = live ? Math.max(0.2, fe - fs) : 1;
      let headRow = -1;
      for (let i = 0; i < N; i++) {
        const ti = live ? fs + (i / N) * span : -Infinity;
        if (t < ti) break;
        const c = cov[i], gi = c % GC, gj = (c / GC) | 0;
        const boost = live ? Math.exp(-(t - ti) / 0.22) : 0;
        ctx.fillStyle = W1((0.42 + 0.42 * boost) * alpha);
        ctx.fillRect(gr.x + gi * cs + gp / 2, gr.y + gj * cs + gp / 2, cs - gp, cs - gp);
        headRow = gj;
      }
      // scanline: the row being filled
      if (live && headRow >= 0 && t < fe) {
        ctx.fillStyle = W1(0.045);
        ctx.fillRect(gr.x, gr.y + headRow * cs, gr.w, cs);
      }
    }

    function drawHighlight() {
      let best = null, h = 0;
      for (const k in hl) if (hl[k].value > h) { h = hl[k].value; best = k; }
      if (!best || h < 0.002) return;
      const b = L.hits.find((x) => x.id === best);
      if (!b) return;
      // dim everything but the block (KV.roundRect begins its own path,
      // so the hole is traced by hand)
      const x0 = b.x - 6, y0 = b.y - 6, x1 = b.x + b.w + 6, y1 = b.y + b.h + 6, r = 9;
      ctx.beginPath();
      ctx.rect(0, 0, L.W, L.H);
      ctx.moveTo(x0 + r, y0);
      ctx.arcTo(x1, y0, x1, y1, r); ctx.arcTo(x1, y1, x0, y1, r);
      ctx.arcTo(x0, y1, x0, y0, r); ctx.arcTo(x0, y0, x1, y0, r);
      ctx.closePath();
      ctx.fillStyle = `rgba(0,0,0,${0.5 * h})`; ctx.fill('evenodd');
      KV.roundRect(ctx, b.x - 6, b.y - 6, b.w + 12, b.h + 12, 9);
      ctx.lineWidth = px(1); ctx.strokeStyle = W1(0.32 * h); ctx.stroke();
      for (const lb of L.labels) if (lb.id === best) {
        ctxLabel(lb.text, lb.x, lb.y, { align: lb.align || 'left', color: W1(0.52 + 0.44 * h), size: L.labelPx });
      }
    }

    function render(t) {
      if (dead || !cv.w) return;
      const W = cv.canvas.width, H = cv.canvas.height;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const q = introQ;
      if (q < 1 && introLayers) {
        const [base, cells, blocks, cdc] = introLayers;
        // the die is already there, dim, when it scrolls in
        ctx.globalAlpha = lerp(0.35, 1, easeOut(segment(q, 0, 0.3)));
        ctx.drawImage(base, 0, 0);
        if (q <= 0) { ctx.globalAlpha = 1; return; }
        const sweep = easeOut(segment(q, 0.12, 0.62));
        if (sweep > 0) {
          ctx.save();
          ctx.globalAlpha = 1;
          const xw = L.portrait ? W : W * sweep, yh = L.portrait ? H * sweep : H;
          ctx.beginPath(); ctx.rect(0, 0, xw, yh); ctx.clip();
          ctx.drawImage(cells, 0, 0);
          ctx.restore();
        }
        ctx.globalAlpha = easeOut(segment(q, 0.34, 0.7));
        ctx.drawImage(blocks, 0, 0);
        const draw = easeOut(segment(q, 0.58, 0.88));
        if (draw > 0) {
          ctx.save(); ctx.globalAlpha = 1;
          ctx.beginPath();
          if (L.portrait) ctx.rect(0, 0, W * draw, H); else ctx.rect(0, 0, W, H * draw);
          ctx.clip(); ctx.drawImage(cdc, 0, 0); ctx.restore();
        }
        ctx.globalAlpha = 1;
      } else if (staticCv) {
        ctx.drawImage(staticCv, 0, 0);
      }
      const live = q < 1 ? easeOut(segment(q, 0.72, 1)) : 1;
      logical(ctx);
      if (live > 0) {
        ctx.globalAlpha = live;
        drawClocks(t);
        drawRaster(t);
        drawVertex(t);
        drawPackets(t);
        drawPointers(t);
        drawLanes(t);
        ctx.globalAlpha = 1;
      }
      // one specular pass across the die during the reveal
      if (q > 0.35 && q < 1) {
        const k = segment(q, 0.35, 1);
        const x = lerp(-0.3, 1.3, easeInOut(k)) * L.W;
        const g = ctx.createLinearGradient(x - 110, 0, x + 110, L.H * 0.18);
        const sp = Math.sin(Math.PI * k);
        g.addColorStop(0, W1(0)); g.addColorStop(0.42, W1(0.05 * sp)); g.addColorStop(0.5, W1(0.15 * sp));
        g.addColorStop(0.58, W1(0.05 * sp)); g.addColorStop(1, W1(0));
        ctx.save();
        KV.roundRect(ctx, L.die.x, L.die.y, L.die.w, L.die.h, L.die.r); ctx.clip();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = g; ctx.fillRect(0, 0, L.W, L.H);
        ctx.restore();
      }
      drawHighlight();
    }

    // ── Sizing ─────────────────────────────────────────────
    function resize(o) {
      if (dead) return;
      const next = o.h > o.w ? LAYOUTS.port : LAYOUTS.land;
      const changed = next !== L || !G;
      L = next;
      s = o.w / L.W;
      if (changed) deriveGeometry();
      buildStatic();
      placeHits();
      if (active) showTip(active);
      paintNow();
    }

    function placeHits() {
      for (const key in hitBtns) {
        const h = L.hits.find((x) => x.id === key);
        const b = hitBtns[key];
        if (!h) { b.hidden = true; continue; }
        b.hidden = false;
        b.style.left = `${(h.x / L.W) * 100}%`;
        b.style.top = `${(h.y / L.H) * 100}%`;
        b.style.width = `${(h.w / L.W) * 100}%`;
        b.style.height = `${(h.h / L.H) * 100}%`;
      }
    }

    // ── Loop ───────────────────────────────────────────────
    // KVChip.loop re-arms its rAF right after calling us, so a stop
    // from inside a tick has to land after the tick returns.
    const halt = () => queueMicrotask(() => loopCtl.stop());
    function step(t, dt) {
      if (dead) return halt();
      if (introQ < 1) {
        if (!introArmed) return halt();
        introQ = Math.min(1, introQ + dt / INTRO);
        if (introQ >= 1) flatten();
      } else if (paused) { halt(); render(simT); return; }
      else simT += dt;
      sim.advance(simT + LOOK);
      sim.prune(simT - KEEP);
      render(simT);
    }
    const loopCtl = KV.loop(stage, step);

    let pend = 0;
    function paintNow() {
      if (pend || !booted) return;
      if (loopCtl.running) return;
      pend = requestAnimationFrame(() => {
        pend = 0;
        sim.advance(simT + LOOK);
        render(simT);
      });
    }

    // First reveal when the die is meaningfully in view.
    let introIO = null;
    if (!introArmed) {
      introIO = new IntersectionObserver((es) => {
        if (es.some((e) => e.isIntersecting)) {
          introArmed = true;
          introIO.disconnect(); introIO = null;
          loopCtl.start();
        }
      }, { threshold: 0.35 });
      introIO.observe(stage);
    }

    // ── Reduced motion ─────────────────────────────────────
    function applyMotionPref() {
      const rm = reducedMQ.matches;
      playBtn.hidden = rm || pinned;
      if (rm) {
        introQ = 1; introArmed = true; flatten();
        if (!staticCv && cv.w) buildStatic();
        simT = pinned ? opts.time : STATIC_T;
        sim = Sim();
        sim.advance(simT + LOOK);
        describeStill();
        paintNow();
      } else if (!paused) loopCtl.start();
      stillEl.hidden = !rm;
    }

    // Under reduced motion the frame holds still, so say in words what
    // just happened: which pointer stepped and the one bit that changed.
    function describeStill() {
      ptrAt(sim.wLog, simT, pt);
      ptrAt(sim.rLog, simT, pt2);
      const useW = pt.t >= pt2.t, v = useW ? pt.v : pt2.v;
      const a = gray((v - 1) & 15), b = gray(v), flip = a ^ b;
      const bits = (x, hiBit) => [3, 2, 1, 0].map((k) => (k === hiBit ? `<i>${(x >> k) & 1}</i>` : String((x >> k) & 1))).join('');
      const hb = bitIndex(flip), rose = (b >> hb) & 1;
      stillEl.innerHTML = `Still frame — the ${useW ? 'write' : 'read'} pointer just stepped from <b>${bits(a, hb)}</b> to <b>${bits(b, hb)}</b> in Gray code. Only one bit changes; on the die it is ${rose ? 'filled' : 'ringed'} in gold.`;
    }
    const onRM = () => applyMotionPref();
    reducedMQ.addEventListener('change', onRM);
    const onHC = () => { hc = contrastMQ.matches; if (cv.w) { buildStatic(); paintNow(); } };
    contrastMQ.addEventListener('change', onHC);

    // ── Pause / play ───────────────────────────────────────
    function setPaused(v) {
      paused = v;
      playBtn.innerHTML = v ? ICON_PLAY : ICON_PAUSE;
      playBtn.setAttribute('aria-label', v ? 'Play animation' : 'Pause animation');
      if (v) { loopCtl.stop(); paintNow(); } else loopCtl.start();
    }
    playBtn.addEventListener('click', () => setPaused(!paused));

    // ── Hover / focus → highlight + tooltip ────────────────
    for (const key of Object.keys(BLOCKS)) {
      hl[key] = new Fl.Spring(0, { dampingRatio: 1, response: 0.28, precision: 0.002, onUpdate: () => { if (!loopCtl.running) paintNowSync(); } });
    }
    let syncPend = 0;
    function paintNowSync() {
      if (syncPend) return;
      syncPend = requestAnimationFrame(() => { syncPend = 0; render(simT); });
    }

    function setActive(key) {
      if (active === key) return;
      active = key;
      for (const k in hl) {
        const target = k === key ? 1 : 0;
        if (reducedMQ.matches) hl[k].set(target); else hl[k].to(target);
      }
      if (key) showTip(key); else hideTip();
      if (reducedMQ.matches || !loopCtl.running) paintNowSync();
    }

    function showTip(key) {
      const blk = BLOCKS[key], h = L.hits.find((x) => x.id === key);
      if (!blk || !h) return hideTip();
      tipT.textContent = blk.name;
      tipB.textContent = blk.body;
      const sw = stage.clientWidth, sh = stage.clientHeight;
      const tw = tip.offsetWidth, th = tip.offsetHeight;
      const bx = (h.x / L.W) * sw, by = (h.y / L.H) * sh, bw = (h.w / L.W) * sw, bh = (h.h / L.H) * sh;
      const gap = 12;
      let top;
      if (by + bh + gap + th <= sh - 8) top = by + bh + gap;          // below, inside the stage
      else if (by - gap - th >= 8) top = by - gap - th;                // above, inside the stage
      else top = Math.min(sh - th - 8, by + bh * 0.5 - th / 2);         // over the block's lower half
      let left = bx + bw / 2 - tw / 2;
      left = Math.max(8, Math.min(sw - tw - 8, left));
      tip.style.transformOrigin = `${bx + bw / 2 - left}px ${top > by ? 0 : th}px`;
      tip.style.left = `${Math.round(left)}px`;
      tip.style.top = `${Math.round(top)}px`;
      tip.classList.add('is-on');
    }
    function hideTip() { tip.classList.remove('is-on'); }

    // Mouse: hover shows, leaving hides. Keyboard: focus shows.
    // Touch: a tap toggles; a tap anywhere else dismisses.
    let lastType = 'mouse';
    const onDown = (e) => { lastType = e.pointerType || 'mouse'; viaPointer = true; };
    const onEnter = (e) => { if (e.pointerType === 'mouse') setActive(e.currentTarget.dataset.id); };
    // Escape hides the tip but keeps focus; it stays hidden until focus moves.
    let dismissed = null;
    const onLeave = (e) => {
      if (e.pointerType !== 'mouse') return;
      const f = hitsEl.querySelector('.kvc-gpu-hit:focus-visible');
      setActive(f && f.dataset.id !== dismissed ? f.dataset.id : null);
    };
    const onFocus = (e) => { dismissed = null; if (!viaPointer) setActive(e.currentTarget.dataset.id); };
    const onBlur = () => { dismissed = null; setActive(null); };
    const onClick = (e) => {
      const k = e.currentTarget.dataset.id;
      const touch = e.detail !== 0 && lastType !== 'mouse';
      viaPointer = false;
      if (!touch) { setActive(k); return; }
      setActive(active === k ? null : k);
    };
    for (const k in hitBtns) {
      const b = hitBtns[k];
      b.addEventListener('pointerdown', onDown);
      b.addEventListener('pointerenter', onEnter);
      b.addEventListener('pointerleave', onLeave);
      b.addEventListener('focus', onFocus);
      b.addEventListener('blur', onBlur);
      b.addEventListener('click', onClick);
    }
    const onKey = (e) => {
      viaPointer = false;
      if (e.key !== 'Escape' || !active) return;
      const el = document.activeElement;
      if (el && hitsEl.contains(el)) dismissed = el.dataset.id;
      setActive(null);
    };
    const onDocDown = (e) => { if (active && !hitsEl.contains(e.target)) setActive(null); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDocDown);

    // Initial state — the canvas sizes itself (and builds layers) here,
    // after every helper above exists.
    KV.canvas(cvHost, { maxDpr: 2, onResize: (o) => { cv = o; ctx = o.ctx; resize(o); } });
    booted = true;
    applyMotionPref();
    if (pinned) { paused = true; playBtn.hidden = true; }
    sim.advance(simT + LOOK);
    paintNow();

    function state() {
      ptrAt(sim.wLog, simT, pt); const w = pt.v;
      ptrAt(sim.rLog, simT, pt); const r = pt.v;
      let occ = 0;
      for (const rec of sim.recs) if (rec.tW <= simT && rec.tR > simT) occ++;
      return { t: simT, wptr: w, rptr: r, wGray: gray(w), rGray: gray(r), occupancy: occ, paused, running: loopCtl.running, intro: introQ, layout: L.portrait ? 'portrait' : 'landscape' };
    }

    return {
      pause: () => setPaused(true),
      play: () => setPaused(false),
      get paused() { return paused; },
      state,
      _sim: () => sim,
      setTime(t) { simT = t; sim = Sim(); sim.advance(simT + LOOK); paintNow(); },
      destroy() {
        dead = true;
        loopCtl.stop();
        introIO && introIO.disconnect();
        reducedMQ.removeEventListener('change', onRM);
        contrastMQ.removeEventListener('change', onHC);
        document.removeEventListener('pointerdown', onDocDown);
        document.removeEventListener('keydown', onKey);
        for (const k in hl) hl[k].stop();
        root.remove();
        cap.remove();
      },
    };
  }

  KV.GPU = { mount, _gray: gray, _Sim: Sim };
})();
