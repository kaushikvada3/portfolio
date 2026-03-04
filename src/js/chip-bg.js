/**
 * chip-bg.js — Authentic IC routing visualization
 *
 * Dense Manhattan routing modelled on real EDA tool output (Cadence/Synopsys).
 * Layers: M1 (H-blue), M2 (V-fuchsia), M3 (H-cyan buses), PWR (H-orange rails).
 * Extras: via squares, standard-cell outlines, VLSI cell-name labels, net labels,
 *         mouse-reactive signal particles that ripple along grid lines from cursor.
 */
(function () {
  'use strict';

  const canvas = document.getElementById('chip-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let W, H;

  const PITCH = 20;   // routing grid pitch (px)
  const MAX_SIG = 60;   // max simultaneous signal particles

  // EDA-style layer config
  const LAYER = [
    { hex: '#3b82f6', sig: '#93c5fd', lw: 1 }, // M1  – blue,    horizontal
    { hex: '#d946ef', sig: '#f0abfc', lw: 1 }, // M2  – fuchsia, vertical
    { hex: '#22d3ee', sig: '#67e8f9', lw: 1.5 }, // M3  – cyan,    horizontal bus
    { hex: '#f97316', sig: '#fdba74', lw: 1.5 }, // PWR – orange,  power rail
  ];

  const CELL_NAMES = [
    'SDFFASK1_RVT', 'AND2X1_RVT', 'INVX2_RVT', 'NAND2X1_RVT', 'OAI21X1_RVT',
    'DFFHQX1_RVT', 'BUFX4_RVT', 'NOR2X1_RVT', 'CLKBUF1_RVT', 'MX2X1_RVT',
    'SDFF1X1_RVT', 'AO22X1_RVT', 'AOI22X1_RVT', 'NBUFFX2_RVT', 'XOR2X1_RVT',
    'HDFFIX2_RVT', 'EDFFX1_RVT', 'TNBUF1_RVT', 'AOI21X1_RVT', 'DELAY1_RVT',
  ];

  let routes = [];
  let vias = [];
  let cellRects = [];
  let signals = [];
  let mouse = { x: -1, y: -1 };
  let gridSnap = { x: -1, y: -1 };  // nearest grid intersection to cursor
  let scanY = -1, scanElapsed = 0, scanInterval = 11;

  // ── Resize ─────────────────────────────────────────────────────────────────
  function resize() {
    W = canvas.parentElement.offsetWidth;
    H = canvas.parentElement.offsetHeight;
    const dpr = Math.min(devicePixelRatio, 2);
    if (ctx.resetTransform) ctx.resetTransform();
    else ctx.setTransform(1, 0, 0, 1, 0, 0);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.scale(dpr, dpr);
    buildLayout();
  }

  // ── Build IC routing layout ─────────────────────────────────────────────────
  function buildLayout() {
    routes = [];
    vias = [];
    cellRects = [];
    signals = [];

    const R = n => Math.floor(Math.random() * n);
    const cols = Math.floor(W / PITCH);
    const rows = Math.floor(H / PITCH);

    const hasH = new Uint8Array(rows * cols);
    const hasV = new Uint8Array(rows * cols);

    // M1 – dense horizontal
    for (let r = 1; r < rows; r++) {
      const y = r * PITCH;
      let c = R(2);
      while (c < cols - 1) {
        c += 1 + R(2);
        const c2 = Math.min(c + 3 + R(8), cols - 1);
        if (c2 > c) {
          const label = Math.random() < 0.05
            ? CELL_NAMES[R(CELL_NAMES.length)] : null;
          routes.push({ li: 0, y, x1: c * PITCH, x2: c2 * PITCH, label });
          for (let cc = c; cc < c2 && cc < cols; cc++) hasH[r * cols + cc] = 1;
        }
        c = c2;
      }
    }

    // M2 – dense vertical
    for (let c = 1; c < cols; c++) {
      const x = c * PITCH;
      let r = R(2);
      while (r < rows - 1) {
        r += 1 + R(2);
        const r2 = Math.min(r + 3 + R(7), rows - 1);
        if (r2 > r) {
          routes.push({ li: 1, x, y1: r * PITCH, y2: r2 * PITCH });
          for (let rr = r; rr < r2 && rr < rows; rr++) hasV[rr * cols + c] = 1;
        }
        r = r2;
      }
    }

    // M3 – horizontal buses (every ~4 rows)
    for (let r = 4; r < rows; r += 4) {
      const y = r * PITCH;
      const c1 = R(4), c2 = cols - 1 - R(4);
      if (c2 - c1 > 6) {
        routes.push({ li: 2, y, x1: c1 * PITCH, x2: c2 * PITCH });
        for (let cc = c1; cc < c2 && cc < cols; cc++) hasH[r * cols + cc] = 1;
      }
    }

    // Power rails (full width, every 10 rows)
    for (let r = 10; r < rows; r += 10) {
      routes.push({ li: 3, y: r * PITCH, x1: 0, x2: W });
    }

    // Vias at H ∩ V intersections
    for (let r = 1; r < rows - 1; r++) {
      for (let c = 1; c < cols - 1; c++) {
        if (hasH[r * cols + c] && hasV[r * cols + c]) {
          vias.push({ x: c * PITCH, y: r * PITCH });
        }
      }
    }

    // Standard-cell outlines
    for (let r = 1; r * PITCH < H; r++) {
      const y = r * PITCH;
      let x = 0;
      while (x < W) {
        const w = PITCH * (1 + R(3) + (Math.random() > 0.5 ? 1 : 0));
        cellRects.push({ x, y: y - PITCH, w, h: PITCH, name: CELL_NAMES[R(CELL_NAMES.length)] });
        x += w;
      }
    }
  }

  // ── Spawn signal particle on a specific route ──────────────────────────────
  function spawnOnRoute(rt, brightness) {
    if (!rt || rt.li === 3) return;
    const isH = rt.li !== 1;
    const len = isH ? rt.x2 - rt.x1 : rt.y2 - rt.y1;
    if (len < PITCH * 2) return;
    signals.push({
      rt,
      t: 0,
      spd: (0.9 + Math.random() * 1.8) / len,
      clr: LAYER[rt.li].sig,
      trail: 18 + Math.random() * 28,
      brightness: brightness || 1.0,
    });
  }

  // ── Spawn signals radiating outward from the nearest grid node ────────────
  function spawnFromGrid(gx, gy) {
    if (signals.length >= MAX_SIG) return;

    const SNAP_R = PITCH * 1.5;
    const nearby = routes.filter(rt => {
      if (rt.li === 3) return false;
      const isH = rt.li !== 1;
      if (isH) {
        return Math.abs(rt.y - gy) < SNAP_R && rt.x1 <= gx + SNAP_R && rt.x2 >= gx - SNAP_R;
      } else {
        return Math.abs(rt.x - gx) < SNAP_R && rt.y1 <= gy + SNAP_R && rt.y2 >= gy - SNAP_R;
      }
    });

    const toSpawn = Math.min(4, MAX_SIG - signals.length);
    for (let i = 0; i < toSpawn && nearby.length; i++) {
      const rt = nearby[Math.floor(Math.random() * nearby.length)];
      spawnOnRoute(rt, 1.8);
    }
  }

  // ── Ambient spawn (no mouse active) ───────────────────────────────────────
  function spawnAmbient() {
    const rt = routes[Math.floor(Math.random() * routes.length)];
    spawnOnRoute(rt, 0.6);
  }

  // ── Fade: dims the left portion (behind hero text) ─────────────────────────
  function fade(x) {
    const lo = W * 0.12, hi = W * 0.40;
    if (x <= lo) return 0.07;
    if (x >= hi) return 1.00;
    return 0.07 + 0.93 * ((x - lo) / (hi - lo));
  }

  function rgba(hex, a) {
    return `rgba(${parseInt(hex.slice(1, 3), 16)},` +
      `${parseInt(hex.slice(3, 5), 16)},` +
      `${parseInt(hex.slice(5, 7), 16)},` +
      `${Math.max(0, Math.min(1, a))})`;
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  function render() {
    if (document.hidden) { requestAnimationFrame(render); return; }

    ctx.clearRect(0, 0, W, H);

    // Background grid
    ctx.lineWidth = 0.4;
    ctx.strokeStyle = 'rgba(80,120,255,0.04)';
    for (let x = 0; x <= W; x += PITCH) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y <= H; y += PITCH) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Highlight ring + crosshair at the snapped grid node
    if (gridSnap.x >= 0) {
      const gx = gridSnap.x, gy = gridSnap.y;
      ctx.beginPath();
      ctx.arc(gx, gy, 5, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(147,197,253,0.40)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.strokeStyle = 'rgba(147,197,253,0.22)';
      ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(gx - 12, gy); ctx.lineTo(gx + 12, gy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(gx, gy - 12); ctx.lineTo(gx, gy + 12); ctx.stroke();
    }

    // Standard-cell outlines + labels
    ctx.lineWidth = 0.5;
    cellRects.forEach(cr => {
      const fa = fade(cr.x + cr.w * 0.5);
      const ao = fa * 0.09;
      if (ao < 0.003) return;
      ctx.strokeStyle = rgba('#d946ef', ao);
      ctx.strokeRect(cr.x + 0.5, cr.y + 0.5, cr.w - 1, cr.h - 1);
      if (fa > 0.45 && cr.w > PITCH * 2.5) {
        ctx.font = '5.5px "SF Mono", "Courier New", monospace';
        ctx.fillStyle = rgba('#d946ef', fa * 0.22);
        ctx.fillText(`(${cr.name})`, cr.x + 3, cr.y + cr.h - 3);
      }
    });

    // Routing traces
    routes.forEach(rt => {
      const isH = rt.li !== 1;
      const cx = isH ? (rt.x1 + rt.x2) * 0.5 : rt.x;
      const fa = fade(cx);
      const a = fa * (rt.li === 3 ? 0.14 : 0.19);
      if (a < 0.004) return;

      ctx.strokeStyle = rgba(LAYER[rt.li].hex, a);
      ctx.lineWidth = LAYER[rt.li].lw;
      ctx.beginPath();
      if (isH) { ctx.moveTo(rt.x1, rt.y); ctx.lineTo(rt.x2, rt.y); }
      else { ctx.moveTo(rt.x, rt.y1); ctx.lineTo(rt.x, rt.y2); }
      ctx.stroke();

      if (rt.label && rt.li === 0 && fa > 0.55 && (rt.x2 - rt.x1) > PITCH * 5) {
        ctx.font = '6px "SF Mono", "Courier New", monospace';
        ctx.fillStyle = rgba(LAYER[0].hex, fa * 0.42);
        ctx.fillText(`(${rt.label})`, rt.x1 + 4, rt.y - 2);
      }
    });

    // Via squares
    vias.forEach(v => {
      const fa = fade(v.x);
      if (fa < 0.08) return;
      ctx.fillStyle = rgba('#ffffff', fa * 0.45);
      ctx.fillRect(v.x - 1.5, v.y - 1.5, 3, 3);
    });

    // Signal particles
    for (let i = signals.length - 1; i >= 0; i--) {
      const s = signals[i];
      s.t += s.spd;
      if (s.t >= 1) { signals.splice(i, 1); continue; }

      const rt = s.rt;
      const isH = rt.li !== 1;
      const px = isH ? rt.x1 + s.t * (rt.x2 - rt.x1) : rt.x;
      const py = isH ? rt.y : rt.y1 + s.t * (rt.y2 - rt.y1);
      const fa = fade(px);
      if (fa < 0.06) continue;

      const brt = s.brightness || 1.0;
      const tx = isH ? px - s.trail : px;
      const ty = isH ? py : py - s.trail;
      const g = isH
        ? ctx.createLinearGradient(tx, py, px, py)
        : ctx.createLinearGradient(px, ty, px, py);
      g.addColorStop(0, rgba(s.clr, 0));
      g.addColorStop(1, rgba(s.clr, Math.min(1, 0.70 * fa * brt)));

      ctx.strokeStyle = g;
      ctx.lineWidth = isH ? 2 : 1.5;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(px, py);
      ctx.stroke();

      ctx.fillStyle = rgba(s.clr, Math.min(1, 0.95 * fa * brt));
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Spawn logic
    const mouseActive = mouse.x >= 0 && gridSnap.x >= 0;
    if (mouseActive) {
      if (signals.length < MAX_SIG && Math.random() < 0.35) {
        spawnFromGrid(gridSnap.x, gridSnap.y);
      }
    } else {
      if (signals.length < 18 && Math.random() < 0.07) spawnAmbient();
    }

    // Periodic scan line
    scanElapsed += 1 / 60;
    if (scanY < 0 && scanElapsed >= scanInterval) {
      scanY = 0; scanElapsed = 0; scanInterval = 9 + Math.random() * 6;
    }
    if (scanY >= 0) {
      scanY += 2.4;
      if (scanY > H) {
        scanY = -1;
      } else {
        const sg = ctx.createLinearGradient(0, scanY - 5, 0, scanY + 5);
        sg.addColorStop(0, 'rgba(110,210,255,0)');
        sg.addColorStop(0.5, 'rgba(110,210,255,0.15)');
        sg.addColorStop(1, 'rgba(110,210,255,0)');
        ctx.fillStyle = sg;
        ctx.fillRect(0, scanY - 5, W, 10);
      }
    }

    requestAnimationFrame(render);
  }

  // ── Mouse tracking — snap to nearest grid intersection ───────────────────
  const parent = canvas.parentElement;
  parent.addEventListener('mousemove', e => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
    gridSnap.x = Math.round(mouse.x / PITCH) * PITCH;
    gridSnap.y = Math.round(mouse.y / PITCH) * PITCH;
  });
  parent.addEventListener('mouseleave', () => {
    mouse.x = -1; mouse.y = -1;
    gridSnap.x = -1; gridSnap.y = -1;
  });

  // ── Init ────────────────────────────────────────────────────────────────────
  window.addEventListener('resize', resize);
  resize();

  // Seed with a few ambient signals
  for (let i = 0; i < 14; i++) {
    spawnAmbient();
    if (signals.length) signals[signals.length - 1].t = Math.random();
  }

  requestAnimationFrame(render);
})();
