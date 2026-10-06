// ─────────────────────────────────────────────────────────────
// MiniGPU-2 — a live sketch of what the chip does, drawn into the
// project card's stage.
//
// One loop of a tiny graphics pipeline:
//   1. VERTEX   three vertices transform (rotate / scale / move) to a
//               new pose — the wireframe glides there.
//   2. FIFO     the transformed vertices cross from the vertex clock
//               domain to the raster clock domain through a 4-deep
//               async FIFO; write/read pointers shown in Gray code.
//   3. RASTER   the triangle is scan-converted onto a coarse pixel
//               grid with edge functions, row by row; covered cells
//               take barycentric-interpolated vertex colours.
//   4. HOLD     the finished frame rests, then the next pose begins.
//
// Cheap by construction: the empty grid is cached to an offscreen
// layer, coverage is computed once per pass, the loop pauses when the
// card is off screen or the tab is hidden, and reduced-motion readers
// get one static, fully rasterised frame.
// ─────────────────────────────────────────────────────────────
(() => {
  const card = document.querySelector('.proj[data-project="minigpu"]');
  const stage = card && card.querySelector('.proj-stage');
  if (!stage) return;

  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MONO = '"JetBrains Mono", monospace';

  // Label tiers follow the page's text tokens: active stage = secondary
  // (0.86), idle = metadata (0.54) — never below the 0.46 floor.
  // Increased contrast brightens both.
  const contrastQuery = matchMedia('(prefers-contrast: more)');
  const ink = (active) => contrastQuery.matches
    ? (active ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.78)')
    : (active ? 'rgba(255,255,255,0.86)' : 'rgba(255,255,255,0.54)');

  // Vertex colours — the site's ambient purple / pink plus a cool blue.
  const VCOL = [[150, 132, 255], [255, 128, 170], [122, 190, 255]];
  const FIFO_DEPTH = 4;

  const T_VERTEX = 1100, T_FIFO = 950, T_RASTER = 1750, T_HOLD = 1100;
  const CYCLE = T_VERTEX + T_FIFO + T_RASTER + T_HOLD;
  const CLK_A = 110, CLK_B = 170;          // two unrelated clock periods (ms)

  const canvas = document.createElement('canvas');
  canvas.className = 'proj-canvas';
  stage.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  let W = 0, H = 0, L = null;              // stage size + layout
  let gridLayer = null;                    // cached empty grid
  let clock = 0;                           // ms of animation time (pauses offscreen)
  let cycle = -1;
  let poseA = null, poseB = null;
  let cover = null, prevCover = null;      // per-cell colour or null
  let bbox = null;
  let wptr = 0, rptr = 0;                  // binary pointers (3-bit, wrap)

  // Deterministic pseudo-random so the sequence of poses is stable.
  let seed = 7;
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  // Critically damped step response, normalised to settle at u = 1.
  const crit = (u) => {
    const x = clamp(u, 0, 1) * 7.5;
    return u >= 1 ? 1 : 1 - (1 + x) * Math.exp(-x);
  };
  const gray = (n) => ((n ^ (n >> 1)) & 7).toString(2).padStart(3, '0');

  // ─── geometry ────────────────────────────────────────────────
  function nextPose(prev) {
    return {
      theta: (prev ? prev.theta : -Math.PI / 2) + Math.PI * (0.42 + rand() * 0.3),
      scale: 0.8 + rand() * 0.2,
      ox: (rand() - 0.5) * 0.22,
      oy: (rand() - 0.5) * 0.16,
    };
  }

  function vertsFor(p) {
    const { cols, rows } = L;
    const R = Math.min(cols, rows) * 0.46 * p.scale;
    const stretch = clamp(cols / rows, 1, 1.5);
    const radii = [1, 0.84, 0.94];
    const cx = cols / 2 + p.ox * cols;
    const cy = rows / 2 + p.oy * rows;
    return radii.map((k, i) => {
      const a = p.theta + (i * 2 * Math.PI) / 3;
      return [
        clamp(cx + Math.cos(a) * R * k * stretch, 0.6, cols - 0.6),
        clamp(cy + Math.sin(a) * R * k, 0.6, rows - 0.6),
      ];
    });
  }

  function lerpVerts(a, b, t) {
    return a.map((v, i) => [v[0] + (b[i][0] - v[0]) * t, v[1] + (b[i][1] - v[1]) * t]);
  }

  // Edge-function scan conversion: a cell is covered when its centre
  // is on the inside of all three edges; weights → vertex colours.
  function rasterize(v) {
    const { cols, rows } = L;
    const out = new Array(cols * rows).fill(null);
    const edge = (a, b, x, y) => (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
    const area = edge(v[0], v[1], v[2][0], v[2][1]);
    if (Math.abs(area) < 1e-6) return { out, box: null };
    const minX = Math.max(0, Math.floor(Math.min(v[0][0], v[1][0], v[2][0])));
    const maxX = Math.min(cols - 1, Math.ceil(Math.max(v[0][0], v[1][0], v[2][0])));
    const minY = Math.max(0, Math.floor(Math.min(v[0][1], v[1][1], v[2][1])));
    const maxY = Math.min(rows - 1, Math.ceil(Math.max(v[0][1], v[1][1], v[2][1])));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5, py = y + 0.5;
        const w0 = edge(v[1], v[2], px, py) / area;
        const w1 = edge(v[2], v[0], px, py) / area;
        const w2 = edge(v[0], v[1], px, py) / area;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        out[y * cols + x] = [0, 1, 2].map((c) =>
          Math.round(w0 * VCOL[0][c] + w1 * VCOL[1][c] + w2 * VCOL[2][c]));
      }
    }
    return { out, box: { minX, maxX, minY, maxY } };
  }

  // ─── layout ──────────────────────────────────────────────────
  function fit() {
    const r = stage.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    W = r.width; H = r.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const compact = W < 480;
    const strip = compact ? 40 : 50;
    const gap = compact ? 12 : 20;
    const cell = compact ? 11 : 16;
    const cols = Math.max(8, Math.floor(W / cell));
    const rows = Math.max(6, Math.floor((H - strip - gap) / cell));
    const gw = cols * cell, gh = rows * cell;
    L = { compact, strip, cell, cols, rows, gw, gh, gx: (W - gw) / 2, gy: strip + gap };

    // Cache the empty grid — 800-odd squares drawn once, not per frame.
    gridLayer = document.createElement('canvas');
    gridLayer.width = canvas.width;
    gridLayer.height = canvas.height;
    const g = gridLayer.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = 'rgba(255,255,255,0.035)';
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        g.fillRect(L.gx + x * cell + 1, L.gy + y * cell + 1, cell - 2, cell - 2);
      }
    }

    // Geometry depends on the grid — rebuild the current pass.
    if (poseB) {
      const r1 = rasterize(vertsFor(poseB));
      cover = r1.out; bbox = r1.box;
      prevCover = poseA ? rasterize(vertsFor(poseA)).out : null;
    }
    return true;
  }

  function beginCycle(n) {
    cycle = n;
    poseA = poseB;
    poseB = nextPose(poseA);
    prevCover = cover;
    const r = rasterize(vertsFor(poseB));
    cover = r.out; bbox = r.box;
    if (n > 0) { wptr = (wptr + 3) & 7; rptr = (rptr + 3) & 7; }
  }

  // ─── drawing ─────────────────────────────────────────────────
  function label(text, x, y, active, align = 'left') {
    ctx.font = `500 ${L.compact ? 10 : 10.5}px ${MONO}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = ink(active);
    ctx.fillText(text, x, y);
  }

  function drawStrip(phase, t) {
    const { gx, gw, strip, compact } = L;
    const y = strip / 2 - 6;
    const slot = compact ? 9 : 11;
    const sgap = 4;
    const fw = FIFO_DEPTH * slot + (FIFO_DEPTH - 1) * sgap;
    const fx = gx + gw / 2 - fw / 2;

    label(compact ? 'VERTEX' : 'VERTEX · clk_a', gx, y, phase === 0);
    label(compact ? 'RASTER' : 'RASTER · clk_b', gx + gw, y, phase === 2, 'right');

    // Connectors into and out of the FIFO.
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const leftEnd = gx + (compact ? 50 : 104);
    const rightStart = gx + gw - (compact ? 50 : 104);
    ctx.moveTo(leftEnd, y); ctx.lineTo(fx - 8, y);
    ctx.moveTo(fx + fw + 8, y); ctx.lineTo(rightStart, y);
    ctx.stroke();

    // FIFO occupancy during the crossing.
    let written = 0, read = 0;
    if (phase === 1) {
      written = Math.min(3, Math.floor(t / CLK_A) + 1);
      // Reads wait two raster-clock edges for the synchronised write pointer.
      read = clamp(Math.floor((t - 2 * CLK_B) / CLK_B) + 1, 0, written);
    } else if (phase >= 2) {
      written = read = 3;
    }
    const w = (wptr + written) & 7;
    const r = (rptr + read) & 7;

    for (let i = 0; i < FIFO_DEPTH; i++) {
      const sx = fx + i * (slot + sgap);
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.strokeRect(sx + 0.5, y - slot / 2 + 0.5, slot - 1, slot - 1);
    }
    for (let k = read; k < written; k++) {
      const idx = (rptr + k) % FIFO_DEPTH;
      const c = VCOL[k];
      ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},0.9)`;
      ctx.fillRect(fx + idx * (slot + sgap) + 2, y - slot / 2 + 2, slot - 4, slot - 4);
    }

    ctx.font = `400 ${compact ? 9.5 : 10}px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = phase === 1 ? ink(true) : ink(false);
    ctx.fillText(compact ? `fifo · w ${gray(w)} · r ${gray(r)}` : `async fifo · w ${gray(w)} · r ${gray(r)}`,
      gx + gw / 2, y + slot / 2 + (compact ? 11 : 13));
  }

  function drawCells(cells, alpha) {
    if (!cells || alpha <= 0) return;
    const { cols, cell, gx, gy } = L;
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      if (!c) continue;
      const x = i % cols, y = (i / cols) | 0;
      ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
      ctx.fillRect(gx + x * cell + 1, gy + y * cell + 1, cell - 2, cell - 2);
    }
  }

  function drawRasterProgress(k) {
    // Cells before scan index k (in bbox raster order) are lit.
    const { cols, cell, gx, gy } = L;
    const bw = bbox.maxX - bbox.minX + 1;
    for (let j = 0; j < k; j++) {
      const x = bbox.minX + (j % bw);
      const y = bbox.minY + ((j / bw) | 0);
      const c = cover[y * cols + x];
      if (!c) continue;
      ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},0.6)`;
      ctx.fillRect(gx + x * cell + 1, gy + y * cell + 1, cell - 2, cell - 2);
    }
    // The scanline and the edge-function probe.
    const total = bw * (bbox.maxY - bbox.minY + 1);
    if (k < total) {
      const px = bbox.minX + (k % bw);
      const py = bbox.minY + ((k / bw) | 0);
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(gx + bbox.minX * cell, gy + py * cell, bw * cell, cell);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1;
      ctx.strokeRect(gx + px * cell + 0.5, gy + py * cell + 0.5, cell - 1, cell - 1);
    }
  }

  function drawWire(v, alpha) {
    const { cell, gx, gy } = L;
    const P = v.map(([x, y]) => [gx + x * cell, gy + y * cell]);
    ctx.strokeStyle = `rgba(255,255,255,${0.5 * alpha})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(P[0][0], P[0][1]);
    ctx.lineTo(P[1][0], P[1][1]);
    ctx.lineTo(P[2][0], P[2][1]);
    ctx.closePath();
    ctx.stroke();
    P.forEach(([x, y], i) => {
      const c = VCOL[i];
      ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, L.compact ? 2.5 : 3.2, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function frame() {
    const t = clock % CYCLE;
    const n = Math.floor(clock / CYCLE);
    if (n !== cycle) beginCycle(n);

    let phase, pt;
    if (t < T_VERTEX) { phase = 0; pt = t; }
    else if (t < T_VERTEX + T_FIFO) { phase = 1; pt = t - T_VERTEX; }
    else if (t < T_VERTEX + T_FIFO + T_RASTER) { phase = 2; pt = t - T_VERTEX - T_FIFO; }
    else { phase = 3; pt = t - T_VERTEX - T_FIFO - T_RASTER; }

    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(gridLayer, 0, 0, W, H);
    drawStrip(phase, pt);

    const vB = vertsFor(poseB);
    if (phase === 0) {
      // Last frame's pixels fade while the vertices move to the new pose.
      drawCells(prevCover, 0.6 * (1 - clamp(pt / 450, 0, 1)));
      const vA = poseA ? vertsFor(poseA) : vB;
      drawWire(lerpVerts(vA, vB, crit(pt / T_VERTEX)), 1);
    } else if (phase === 1) {
      drawWire(vB, 1);
    } else if (phase === 2) {
      if (bbox) {
        const total = (bbox.maxX - bbox.minX + 1) * (bbox.maxY - bbox.minY + 1);
        drawRasterProgress(Math.floor((pt / T_RASTER) * total));
      }
      drawWire(vB, 0.75);
    } else {
      drawCells(cover, 0.6);
      drawWire(vB, 0.55);
    }
  }

  // Reduced motion: one representative, finished frame.
  function staticFrame() {
    if (!poseB) { poseB = nextPose(null); }
    const r = rasterize(vertsFor(poseB));
    cover = r.out; bbox = r.box;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(gridLayer, 0, 0, W, H);
    drawStrip(3, 0);
    drawCells(cover, 0.6);
    drawWire(vertsFor(poseB), 0.6);
  }

  // ─── lifecycle ───────────────────────────────────────────────
  if (!fit()) return;

  if (REDUCED) {
    staticFrame();
    // The one frame must not keep a fallback face for its labels.
    document.fonts?.ready.then(() => { if (fit()) staticFrame(); });
    new ResizeObserver(() => { if (fit()) staticFrame(); }).observe(stage);
    contrastQuery.addEventListener?.('change', () => { if (fit()) staticFrame(); });
    return;
  }

  let raf = 0, last = 0, onScreen = false;
  function loop(now) {
    raf = 0;
    if (!onScreen || document.hidden) return;
    clock += Math.min(now - (last || now), 50);   // a dropped frame never skips a phase
    last = now;
    frame();
    raf = requestAnimationFrame(loop);
  }
  function wake() {
    if (raf || !onScreen || document.hidden) return;
    last = 0;
    raf = requestAnimationFrame(loop);
  }

  new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    wake();
  }, { threshold: 0.05 }).observe(card);
  document.addEventListener('visibilitychange', wake);

  let fitTimer = 0;
  new ResizeObserver(() => {
    clearTimeout(fitTimer);
    fitTimer = setTimeout(() => { if (fit() && !raf) frame(); }, 80);
  }).observe(stage);

  frame();   // paint something before the first visibility callback
  document.fonts?.ready.then(() => { if (!raf) frame(); });
})();
