// ─────────────────────────────────────────────────────────────
// Obsidian-vault graph as IMMERSIVE 3D fly-through.
// Nodes laid out in a long tube spanning the page's scroll
// length. Camera Z is driven by window.scrollY — scrolling
// flies you forward through the network. Perspective projection,
// depth fog, mouse parallax sway.
// ─────────────────────────────────────────────────────────────
(async () => {
  const canvas = document.getElementById('graph-bg');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0, H = 0;
  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  const groupColor = {
    0: '#9B7BFF', 1: '#FFC75A', 2: '#7AB8FF',
    3: '#9B7BFF', 4: '#5AD3FF', 5: '#FF6B9D',
    6: '#FF7A7A', 7: '#FFC75A', 8: '#7AFFA8',
  };
  const colorOf = (g) => groupColor[g] || '#FFC75A';

  // Pre-baked halo sprites — one radial-gradient canvas per node color.
  // The render loop drawImage's these instead of allocating a fresh
  // gradient for every node on every frame (hundreds of allocs/frame).
  const HALO_PX = 64;
  const haloSprites = new Map();
  function haloSprite(color) {
    let s = haloSprites.get(color);
    if (s) return s;
    s = document.createElement('canvas');
    s.width = s.height = HALO_PX;
    const sctx = s.getContext('2d');
    const c = HALO_PX / 2;
    const g = sctx.createRadialGradient(c, c, 0, c, c, c);
    g.addColorStop(0,   color + '6e'); // 110/255 — matches old stop-0 alpha
    g.addColorStop(0.6, color + '1e'); // 30/255  — matches old stop-0.6 alpha
    g.addColorStop(1,   color + '00');
    sctx.fillStyle = g;
    sctx.fillRect(0, 0, HALO_PX, HALO_PX);
    haloSprites.set(color, s);
    return s;
  }

  let raw;
  try { raw = await fetch('graph.json').then(r => r.json()); }
  catch (e) { console.warn('graph.json failed', e); return; }

  const FOCAL = 600;
  const NEAR = 140;
  const FAR = 3600;
  const NODE_COUNT = raw.nodes.length;

  function pageDepth() {
    const docH = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    return Math.max(docH * 1.6, 7000);
  }
  let TUBE_DEPTH = pageDepth();

  // ─── Cluster layout: randomised every page-load so each visit
  //     takes a different path through the graph. ───
  // Evenly-spaced Z fracs, then Fisher-Yates shuffle so depth
  // order changes — different clusters lead each session.
  const zfracs = [0.07, 0.18, 0.28, 0.38, 0.48, 0.58, 0.68, 0.78, 0.88];
  for (let i = zfracs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [zfracs[i], zfracs[j]] = [zfracs[j], zfracs[i]];
  }

  const rand = (lo, hi) => lo + Math.random() * (hi - lo);
  const GROUP_CENTERS = Array.from({ length: 9 }, (_, i) => ({
    x: rand(-800, 800),
    y: rand(-600, 600),
    zf: zfracs[i],
  }));

  // Camera follows a random arc through each cluster, offset so it
  // looks across the cluster rather than flying straight into it.
  const CAM_PATH = GROUP_CENTERS.map(c => ({
    x: c.x * 0.20 + rand(-120, 120),
    y: c.y * 0.20 + rand(-80, 80),
    zf: c.zf,
  }));
  // Sort both by zf so waypoints progress forward along Z
  const sortByZ = arr => arr.sort((a, b) => a.zf - b.zf);
  sortByZ(GROUP_CENTERS);
  sortByZ(CAM_PATH);

  const sorted = [...raw.nodes].sort((a, b) => b.deg - a.deg);
  const idToIdx = new Map();
  const nodes = sorted.map((n, i) => {
    idToIdx.set(n.id, i);
    const gc = GROUP_CENTERS[Math.min(n.group, GROUP_CENTERS.length - 1)];
    const jitterZ = (Math.random() - 0.5) * 0.10;
    const zf = Math.max(0.01, Math.min(0.97, gc.zf + jitterZ));
    const spread = 300 + Math.random() * 420;
    const ang = Math.random() * Math.PI * 2;
    return {
      id: n.id, label: n.label, group: n.group, deg: n.deg,
      x: gc.x + Math.cos(ang) * spread,
      y: gc.y + Math.sin(ang) * spread,
      z: zf * TUBE_DEPTH,
      zf,
      r3d: 1.5 + Math.sqrt(n.deg / 75) * 11, // 0-to-75 deg → ~3-to-12.5px world radius
      color: colorOf(n.group),
      phase: Math.random() * Math.PI * 2,
    };
  });

  const links = [];
  for (const [s, t] of raw.links) {
    const a = idToIdx.get(s), b = idToIdx.get(t);
    if (a == null || b == null || a === b) continue;
    // Drop links that span huge Z gaps — they'd streak across the whole
    // tube and become spaghetti. Tighter cap with uniform Z.
    if (Math.abs(nodes[a].z - nodes[b].z) > TUBE_DEPTH * 0.08) continue;
    links.push([a, b]);
  }

  // ─── Die layout (used by tapeout easter egg) ──────────────────
  // Sort by group → degree so same-group cells are adjacent and
  // hubs sit at the start of each group's row block.
  const dieOrder = [...nodes].sort((a, b) =>
    a.group !== b.group ? a.group - b.group : b.deg - a.deg
  );
  const COLS = 16;
  dieOrder.forEach((n, i) => { n.gridCol = i % COLS; n.gridRow = Math.floor(i / COLS); });
  const NUM_ROWS = Math.ceil(nodes.length / COLS);

  // Mouse parallax — gentle camera tilt as the cursor moves
  const mouse = { nx: 0, ny: 0 };
  window.addEventListener('mousemove', (e) => {
    mouse.nx = (e.clientX / W - 0.5) * 2;
    mouse.ny = (e.clientY / H - 0.5) * 2;
  });

  let cameraZ = 0;
  let targetCamX = 0, targetCamY = 0;
  let camX = 0, camY = 0;

  // Tapeout state machine — driven by the `tapeout` / `pnr` palette
  // commands and the typed-key egg. Idle at page load.
  let tapeoutPhase = 0, tapeoutCollapse = 0, tapeoutT0 = 0;
  const TAPEOUT_IN = 1500, TAPEOUT_HOLD = 2200, TAPEOUT_OUT = 1400;

  // ─── INTRO: cleaner big-bang on page load ───────────────────
  // One linear state machine: HOLD die → BANG (flash) → EXPAND.
  // Independent from the tapeout command above so the two never tangle.
  // Hidden CSS class `.kv-booted` on body switches hero/nav from hidden
  // to fade-in animated; the page loads with hero invisible, the die
  // sits centered for a beat, flash fires + body class flips, cells
  // expand outward, hero fades in over the top.
  const INTRO_HOLD_MS = 900;
  const INTRO_EXPAND_MS = 2400;
  let introPhase = 'done';  // 'hold' | 'expand' | 'done' — intro big-bang disabled; graph boots settled
  let introT0 = performance.now();
  let bangAt = 0;
  // Easter egg state
  let rtlProgress = 0, rtlTarget = 0;

  let keyBuf = '';
  window.addEventListener('keydown', e => {
    if (['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)) return;
    keyBuf = (keyBuf + e.key).slice(-8).toLowerCase();
    if (keyBuf.endsWith('rtl')) {
      rtlTarget = 1;
      clearTimeout(window._rtlTimer);
      window._rtlTimer = setTimeout(() => { rtlTarget = 0; }, 2600);
    }
    if (keyBuf.endsWith('tapeout') && tapeoutPhase === 0) {
      tapeoutPhase = 1;
      tapeoutT0 = performance.now();
    }
  });

  // Programmatic triggers (used by tests and for fun in dev console)
  window.__triggerTapeout = () => {
    if (tapeoutPhase === 0) { tapeoutPhase = 1; tapeoutT0 = performance.now(); }
  };
  window.__triggerRTL = (ms = 2600) => {
    rtlTarget = 1;
    setTimeout(() => { rtlTarget = 0; }, ms);
  };
  window.__getEggState = () => ({
    tapeoutPhase, tapeoutCollapse, rtlProgress, rtlTarget,
    nodes: nodes.length, COLS, NUM_ROWS,
    sample0: nodes[0] ? { x: nodes[0].x, y: nodes[0].y, gridCol: nodes[0].gridCol, gridRow: nodes[0].gridRow } : null,
  });

  function project(x, y, z) {
    const rz = z - cameraZ;
    if (rz <= NEAR) return null;
    const k = FOCAL / rz;
    return {
      sx: W / 2 + (x - camX) * k,
      sy: H / 2 + (y - camY) * k,
      scale: k,
      depth: rz,
    };
  }

  function fogAlpha(rz) {
    // Wider visibility window — louder graph, more of the tube on-screen at once.
    const nearFade = Math.min(1, (rz - NEAR) / 100);
    const farFade = Math.min(1, Math.max(0, (FAR - rz) / 1800));
    return Math.max(0, Math.min(1, nearFade * farFade));
  }

  function render(t) {
    // During the intro expand, paint a translucent backdrop instead of
    // clearing — cells leave motion trails as they streak from die-grid
    // positions to their final graph positions. Looks like the standard
    // cells exploding outward and constructing the network in mid-air.
    if (introPhase === 'expand') {
      ctx.fillStyle = 'rgba(8, 8, 11, 0.16)';
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.clearRect(0, 0, W, H);
    }

    // ── Intro: deterministic, one pass ─────────────────────
    if (introPhase !== 'done') {
      const dt = t - introT0;
      if (introPhase === 'hold') {
        tapeoutCollapse = 1;
        if (dt > INTRO_HOLD_MS) {
          introPhase = 'expand';
          introT0 = t;
          bangAt = t;
          try { window.dispatchEvent(new CustomEvent('kv-bang')); } catch (_) {}
        }
      } else if (introPhase === 'expand') {
        const k = Math.min(1, (t - introT0) / INTRO_EXPAND_MS);
        // ease-out cubic — fast at start, settles at end
        const eased = 1 - Math.pow(1 - k, 3);
        tapeoutCollapse = 1 - eased;
        if (k >= 1) { introPhase = 'done'; tapeoutCollapse = 0; }
      }
    }

    // ── Easter egg tick ───────────────────────────────────────
    rtlProgress += (rtlTarget - rtlProgress) * 0.07;

    if (tapeoutPhase > 0) {
      const elapsed = t - tapeoutT0;
      if (tapeoutPhase === 1) {
        tapeoutCollapse = Math.min(1, elapsed / TAPEOUT_IN);
        if (tapeoutCollapse >= 1) { tapeoutPhase = 2; tapeoutT0 = t; }
      } else if (tapeoutPhase === 2) {
        tapeoutCollapse = 1;
        if (elapsed > TAPEOUT_HOLD) { tapeoutPhase = 3; tapeoutT0 = t; }
      } else if (tapeoutPhase === 3) {
        tapeoutCollapse = 1 - Math.min(1, elapsed / TAPEOUT_OUT);
        if (tapeoutCollapse <= 0) { tapeoutPhase = 0; tapeoutCollapse = 0; }
      }
    }

    // Smooth camera position from scroll & mouse
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    const scrollFrac = docH > 0 ? Math.min(1, Math.max(0, window.scrollY / docH)) : 0;
    const targetZ = scrollFrac * (TUBE_DEPTH - FAR);
    cameraZ += (targetZ - cameraZ) * 0.12;

    // Camera follows waypoints through each cluster region
    const pathT = scrollFrac * (CAM_PATH.length - 1);
    const wi = Math.floor(pathT);
    const wj = Math.min(wi + 1, CAM_PATH.length - 1);
    const wt = pathT - wi;
    const ws = wt * wt * (3 - 2 * wt); // smoothstep
    const railX = CAM_PATH[wi].x + (CAM_PATH[wj].x - CAM_PATH[wi].x) * ws;
    const railY = CAM_PATH[wi].y + (CAM_PATH[wj].y - CAM_PATH[wi].y) * ws;
    targetCamX = railX + mouse.nx * 70;
    targetCamY = railY + mouse.ny * 50;
    camX += (targetCamX - camX) * 0.04;
    camY += (targetCamY - camY) * 0.04;

    // ── Die grid geometry (used during tapeout) ─────────────
    const dieW = Math.min(W * 0.62, 760);
    const dieH = Math.min(H * 0.66, 520);
    const dieX = (W - dieW) / 2;
    const dieY = (H - dieH) / 2;
    const innerPad = 0.085;
    const innerLeft = dieX + dieW * innerPad;
    const innerTop  = dieY + dieH * innerPad;
    const cellW = (dieW * (1 - 2 * innerPad)) / COLS;
    const cellH = (dieH * (1 - 2 * innerPad)) / NUM_ROWS;

    // Pre-project all nodes; during tapeout, lerp toward die cell.
    const c = tapeoutCollapse;
    const wobScale = 1 - c;
    const proj = new Array(nodes.length);
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const wob = 8 * wobScale;
      const xx = n.x + Math.cos(t * 0.0004 + n.phase) * wob;
      const yy = n.y + Math.sin(t * 0.0005 + n.phase * 1.3) * wob;
      let p = project(xx, yy, n.z);
      if (c > 0) {
        const tx = innerLeft + n.gridCol * cellW + cellW * 0.5;
        const ty = innerTop  + n.gridRow * cellH + cellH * 0.5;
        // Stagger arrival per node so cells "drop in" rather than warp uniformly
        const stagger = 0.0008 * ((n.gridRow * COLS + n.gridCol) - 120);
        const cn = Math.max(0, Math.min(1, c + stagger));
        if (!p) p = { sx: tx, sy: ty, scale: 0.6, depth: 1500 };
        const ease = cn * cn * (3 - 2 * cn);
        p.sx = p.sx * (1 - ease) + tx * ease;
        p.sy = p.sy * (1 - ease) + ty * ease;
        p.cellEase = ease;
      } else {
        if (p) p.cellEase = 0;
      }

      proj[i] = p;
    }

    // ── Draw edges (back to front would be ideal; for ambient
    // we just sort by avg depth descending so far-back drawn first) ──
    const drawableLinks = [];
    for (const [i, j] of links) {
      const pa = proj[i], pb = proj[j];
      if (!pa || !pb) continue;
      const d = (pa.depth + pb.depth) * 0.5;
      drawableLinks.push({ i, j, pa, pb, d });
    }
    drawableLinks.sort((a, b) => b.d - a.d);

    // ── Pre-cells: draw silicon substrate inside the die so cells contrast ──
    if (c > 0.05) {
      const oa = Math.min(1, (c - 0.05) / 0.4);
      ctx.fillStyle = `rgba(20,18,14,${oa * 0.6})`;
      ctx.fillRect(dieX, dieY, dieW, dieH);
    }

    // Tapeout also forces Manhattan routing once cells have settled
    const tapeManhattan = c < 0.4 ? 0 : Math.min(1, (c - 0.4) / 0.5);
    const manhattan = Math.max(rtlProgress, tapeManhattan);
    // Edges are hidden while cells are still in / near the die layout,
    // then fade in during the last stretch of the expand so the graph
    // visibly "constructs" itself once the cells have arrived.
    // Tapeout (manual egg) keeps its old behaviour — edges stay as faint
    // routing — by using the manhattan term as a floor.
    const constructFade = c > 0.55 ? 0 : Math.pow(1 - c / 0.55, 1.35);
    const edgeFade = Math.max(constructFade, manhattan * 0.4);

    for (const e of drawableLinks) {
      const fa = Math.max(fogAlpha(e.pa.depth), (e.pa.cellEase || 0) * 0.85);
      const fb = Math.max(fogAlpha(e.pb.depth), (e.pb.cellEase || 0) * 0.85);
      const a = Math.min(fa, fb) * 0.55 * edgeFade;
      if (a < 0.01) continue;
      const edgeR = Math.round(180 + manhattan * 55);
      const edgeG = Math.round(170 - manhattan * 100);
      const edgeB = Math.round(230 - manhattan * 170);
      ctx.strokeStyle = `rgba(${edgeR},${edgeG},${edgeB},${a})`;
      ctx.lineWidth = Math.max(0.6, 1.4 * Math.min(e.pa.scale, e.pb.scale));
      ctx.beginPath();
      ctx.moveTo(e.pa.sx, e.pa.sy);
      if (manhattan > 0.01) {
        const mx = (e.pa.sx + e.pb.sx) * 0.5;
        const my = (e.pa.sy + e.pb.sy) * 0.5;
        const cx = mx + (e.pb.sx - mx) * manhattan;
        const cy = my + (e.pa.sy - my) * manhattan;
        ctx.lineTo(cx, cy);
      }
      ctx.lineTo(e.pb.sx, e.pb.sy);
      ctx.stroke();
    }

    // ── Draw nodes back-to-front ──
    const order = [];
    for (let i = 0; i < nodes.length; i++) if (proj[i]) order.push(i);
    order.sort((a, b) => proj[b].depth - proj[a].depth);

    for (const i of order) {
      const n = nodes[i];
      const p = proj[i];
      const ce = p.cellEase || 0;
      // During tapeout, every cell must be visible regardless of 3D fog
      const a = Math.max(fogAlpha(p.depth), ce * 0.95);
      if (a < 0.02) continue;
      const r = Math.max(0.4, n.r3d * Math.max(p.scale, ce * 0.6));

      // Halo fades out as cells settle into the die grid
      const haloMult = (1 - ce);
      if (haloMult > 0.04) {
        const halo = r * (3.2 + 2.0 * a);
        const haloA = a * haloMult;
        ctx.globalAlpha = Math.min(1, haloA);
        ctx.drawImage(haloSprite(n.color), p.sx - halo, p.sy - halo, halo * 2, halo * 2);
        ctx.globalAlpha = 1;
      }

      // Core: lerp circle → filled standard-cell rect
      const coreA = ce > 0.6 ? Math.min(1, a * 1.2) : a;
      ctx.fillStyle = n.color + Math.round(coreA * 235).toString(16).padStart(2, '0');
      if (ce < 0.55) {
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Scale from circle silhouette to crisp cell rect
        const t01 = (ce - 0.55) / 0.45;
        const targetW = cellW * 0.86;
        const targetH = cellH * 0.78;
        const rectW = (r * 1.6) * (1 - t01) + targetW * t01;
        const rectH = (r * 1.6) * (1 - t01) + targetH * t01;
        ctx.fillRect(p.sx - rectW / 2, p.sy - rectH / 2, rectW, rectH);
        // Crisp cell border (brighter at full collapse)
        if (t01 > 0.4) {
          ctx.strokeStyle = `rgba(255,255,255,${(t01 - 0.4) * 0.55})`;
          ctx.lineWidth = 0.75;
          ctx.strokeRect(p.sx - rectW / 2, p.sy - rectH / 2, rectW, rectH);
        }
      }

      // Label — only off-die. Hide during tapeout.
      if (r > 2.5 && a > 0.18 && ce < 0.3) {
        const labelAlpha = Math.min(1, (r - 2.5) / 6) * a * 0.85 * (1 - ce / 0.3);
        const fontSize = Math.max(9, Math.min(13, r * 1.1));
        ctx.font = `300 ${fontSize}px "JetBrains Mono", monospace`;
        ctx.fillStyle = `rgba(245, 242, 235, ${labelAlpha})`;
        ctx.fillText(n.label, p.sx + r + 5, p.sy + fontSize * 0.35);
      }
    }

    // ── Tapeout: draw silicon die frame + IO + labels (on top) ──
    if (c > 0.05) {
      const oa = Math.min(1, (c - 0.05) / 0.4);
      const gold = `rgba(255,199,90,${oa})`;
      const goldDim = `rgba(255,199,90,${oa * 0.45})`;

      // Die outline
      ctx.strokeStyle = gold;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(dieX, dieY, dieW, dieH);

      // Corner alignment marks (extending outward)
      const m = 14;
      const corners = [
        [dieX,        dieY,        1,  1],
        [dieX + dieW, dieY,       -1,  1],
        [dieX,        dieY + dieH, 1, -1],
        [dieX + dieW, dieY + dieH,-1, -1],
      ];
      for (const [cx2, cy2, dx, dy] of corners) {
        ctx.beginPath();
        ctx.moveTo(cx2 - dx * m * 0.6, cy2);
        ctx.lineTo(cx2 + dx * m * 0.4, cy2);
        ctx.moveTo(cx2, cy2 - dy * m * 0.6);
        ctx.lineTo(cx2, cy2 + dy * m * 0.4);
        ctx.stroke();
      }

      // IO pad ring (small dim ticks around perimeter)
      ctx.fillStyle = goldDim;
      const padStep = 14;
      for (let x = dieX + 22; x < dieX + dieW - 22; x += padStep) {
        ctx.fillRect(x, dieY - 5, 3, 3);
        ctx.fillRect(x, dieY + dieH + 2, 3, 3);
      }
      for (let y = dieY + 22; y < dieY + dieH - 22; y += padStep) {
        ctx.fillRect(dieX - 5, y, 3, 3);
        ctx.fillRect(dieX + dieW + 2, y, 3, 3);
      }

      // Header / footer labels
      ctx.font = '500 11px "JetBrains Mono", monospace';
      ctx.fillStyle = gold;
      ctx.textAlign = 'center';
      ctx.fillText('TAPEOUT COMPLETE · KAUSHIK_VADA · DIE 1.0', dieX + dieW / 2, dieY - 24);
      ctx.font = '400 10px "JetBrains Mono", monospace';
      ctx.fillStyle = `rgba(255,199,90,${oa * 0.75})`;
      ctx.fillText(`DRC: CLEAN · LVS: CLEAN · ${nodes.length} CELLS · ${COLS}×${NUM_ROWS} GRID`, dieX + dieW / 2, dieY + dieH + 30);
      ctx.textAlign = 'left';
    }

    // ── Bang flash + shockwave (intro only, deterministic) ───
    if (bangAt > 0) {
      const sb = t - bangAt;
      if (sb < 1400) {
        const cx = W / 2, cy = H / 2;

        // 1) Initial near-white flash — short, sharp
        const flashA = Math.max(0, 1 - sb / 280);
        if (flashA > 0.01) {
          ctx.fillStyle = `rgba(255,250,235,${flashA * 0.6})`;
          ctx.fillRect(0, 0, W, H);
        }

        // 2) Gold radial bloom — longer, softer fade
        const bloomT = Math.min(1, sb / 900);
        if (bloomT < 1) {
          const bA = Math.pow(1 - bloomT, 1.4) * 0.55;
          const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(W, H));
          grad.addColorStop(0, `rgba(255,225,160,${bA})`);
          grad.addColorStop(0.4, `rgba(255,199,90,${bA * 0.5})`);
          grad.addColorStop(1, 'rgba(255,199,90,0)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, W, H);
        }

        // 3) Two shockwave rings — outer (white, leading), inner (gold, trailing)
        const ringT = Math.min(1, sb / 1200);
        if (ringT < 1) {
          const maxR = Math.hypot(W, H) * 0.75;
          const ringR = ringT * maxR;
          const fade = Math.pow(1 - ringT, 1.6);
          ctx.strokeStyle = `rgba(255,255,255,${fade * 0.9})`;
          ctx.lineWidth = 4 + (1 - ringT) * 7;
          ctx.beginPath();
          ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = `rgba(255,199,90,${fade * 0.7})`;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(cx, cy, ringR * 0.68, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
  }

  // Recompute tube depth on resize / dom changes
  let lastDocH = 0;
  function maybeUpdateTube() {
    const docH = document.documentElement.scrollHeight;
    if (Math.abs(docH - lastDocH) > 50) {
      lastDocH = docH;
      const newTube = pageDepth();
      const ratio = newTube / TUBE_DEPTH;
      if (ratio !== 1) {
        for (const n of nodes) n.z = n.zf * newTube;
        TUBE_DEPTH = newTube;
      }
    }
  }
  setInterval(maybeUpdateTube, 1500);

  let raf;
  let timer;
  let frameCount = 0;
  function loop(t) {
    frameCount++;
    window.__frameCount = frameCount;
    window.__lastT = t;
    try { render(t); } catch (e) { console.error('graph-fly render failed', e); return; }
    raf = requestAnimationFrame(loop);
  }
  // Render the first frame immediately so the canvas isn't blank before
  // the first RAF tick (esp. in background tabs / on initial paint).
  render(performance.now());
  raf = requestAnimationFrame(loop);

  // Fallback: if the tab is in the background RAF throttles aggressively;
  // a low-rate setInterval keeps SOMETHING drawn so when the user comes
  // back the canvas isn't empty for a frame.
  function backgroundTick() {
    if (document.hidden) {
      try { render(performance.now()); } catch (e) {}
    }
  }
  timer = setInterval(backgroundTick, 500);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else raf = requestAnimationFrame(loop);
  });
})();
