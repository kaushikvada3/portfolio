// ─────────────────────────────────────────────────────────────
// KVChip.Tenstorrent — the visual for the Tenstorrent chapter.
//
// Two views behind a segmented control:
//   Die-to-die  · a timing path crosses level shifters from a
//                 dynamic-voltage SoC domain into a fixed-voltage PHY,
//                 then over a D2D lane to the other die. A voltage
//                 slider slows the SoC side only.
//   PVT corners · ≈46 corners as a P × V × T lattice you can turn;
//                 representative selection collapses them toward 10
//                 (a target under investigation, not a result).
//
// Everything here is an illustration: the timing model is a
// qualitative alpha-power curve and no value is ever printed.
//
// Usage: KVChip.Tenstorrent.mount(host) → { destroy, setView,
//        setVoltage, select }. Needs spring.js + chip-core.js.
// ─────────────────────────────────────────────────────────────
(() => {
  const K = window.KVChip, F = window.Fluid;
  if (!K || !F) return;
  const P = K.palette;
  const { clamp01, lerp, smoothstep, segment } = K;
  const contrastMQ = matchMedia('(prefers-contrast: more)');

  // Qualitative timing model: alpha-power gate delay against supply.
  const V_LO = 0.6, V_HI = 1.0, V_T = 0.34, ALPHA = 1.3;
  const gate = (V) => V / Math.pow(V - V_T, ALPHA);
  const dynFactor = (v) => gate(lerp(V_LO, V_HI, clamp01(v))) / gate(V_HI);
  const T_DYN = 1.1;       // s through the SoC domain at the top of the range
  const T_FIX = 0.7;       // s through the PHY + lane, never changes
  const T_REST = 1.0;      // s pause at the capture flop
  const CYCLES = 3;        // pulses per play, then the path rests lit
  const TRAIL = 0.85;      // s a trail sample stays visible
  const INTRO = 2.2;       // s light-scan reveal of the dies
  const MAX_DELAY = T_DYN * dynFactor(0) + T_FIX;

  const GOLD = Array.from({ length: 101 }, (_, i) => P.goldA(i / 100));
  const WHITE = Array.from({ length: 101 }, (_, i) => P.whiteA(i / 100));
  const gold = (a) => GOLD[Math.round(clamp01(a) * 100)];
  const white = (a) => WHITE[Math.round(clamp01(a) * 100)];
  const easeInOut = (t) => (t = clamp01(t), t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  const CSS = `
.kvc-tt{container-type:inline-size;position:relative;color:rgba(255,255,255,.96);font-family:${K.font.sans};-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
.kvc-tt *,.kvc-tt *::before,.kvc-tt *::after{box-sizing:border-box}
.kvc-tt :where(p){margin:0}
.kvc-tt :where(button){font:inherit;color:inherit;background:none;border:0;margin:0;padding:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
.kvc-tt :focus-visible{outline:2px solid rgba(255,255,255,.92);outline-offset:3px}
.kvc-tt :focus:not(:focus-visible){outline:none}
.kvc-tt-sr{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}

.kvc-tt-seg{position:relative;display:grid;grid-template-columns:1fr 1fr;width:min(100%,19rem);margin:0 auto;padding:2px;border-radius:980px;background:rgba(255,255,255,.08)}
.kvc-tt-seg-pill{position:absolute;top:2px;bottom:2px;left:2px;width:calc(50% - 2px);border-radius:980px;background:rgba(255,255,255,.2);box-shadow:0 1px 3px rgba(0,0,0,.45);will-change:transform;pointer-events:none}
.kvc-tt-tab{position:relative;z-index:1;min-height:2rem;padding:0 .75rem;border-radius:980px;font-size:.8125rem;font-weight:600;letter-spacing:-.003em;line-height:1;color:rgba(255,255,255,.62);white-space:nowrap;transition:color .2s ease}
.kvc-tt-tab::before{content:"";position:absolute;inset:-.375rem 0}
.kvc-tt-tab:hover{color:rgba(255,255,255,.86)}
.kvc-tt-tab[aria-selected="true"]{color:rgba(255,255,255,.96)}
.kvc-tt-tab>span{display:inline-block;transition:opacity .15s ease}
.kvc-tt-tab:active>span{opacity:.5;transition:none}
.kvc-tt .kvc-tt-tab:focus-visible{outline-offset:-2px;border-radius:980px}

.kvc-tt-stage{display:grid;margin-top:clamp(1.5rem,3vw,2rem)}
.kvc-tt-panel{grid-area:1/1;min-width:0;display:flex;flex-direction:column}
.kvc-tt-view{position:relative;aspect-ratio:16/9;touch-action:pan-y;-webkit-user-select:none;user-select:none}
@container (max-width:37.49rem){.kvc-tt-view{aspect-ratio:4/5}}
.kvc-tt-b .kvc-tt-view{cursor:grab}
.kvc-tt-b .kvc-tt-view.is-dragging{cursor:grabbing}

.kvc-tt-row{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:flex-start;gap:1.5rem 4rem;margin-top:1.5rem}
.kvc-tt-field{flex:0 1 20rem;min-width:0}
.kvc-tt-flabel{display:block;font-size:.875rem;font-weight:600;letter-spacing:-.006em;line-height:1.3;color:rgba(255,255,255,.8)}
.kvc-tt-meta{font-family:${K.font.mono};font-size:.6875rem;letter-spacing:.04em;line-height:1.4;color:rgba(255,255,255,.52)}
.kvc-tt-ends{display:flex;justify-content:space-between;gap:1rem}

.kvc-tt-slider{position:relative;height:2.75rem;margin-inline:.75rem;cursor:pointer;touch-action:pan-y;outline:none}
.kvc-tt-rail{position:absolute;left:0;right:0;top:50%;height:4px;margin-top:-2px;border-radius:2px;background:rgba(255,255,255,.16);overflow:hidden}
.kvc-tt-fill{position:absolute;inset:0;background:rgba(255,255,255,.82);transform-origin:0 50%;will-change:transform}
.kvc-tt-knob{position:absolute;left:-.75rem;top:50%;width:1.5rem;height:1.5rem;margin-top:-.75rem;border-radius:50%;background:#f5f5f7;box-shadow:0 1px 4px rgba(0,0,0,.5),0 0 0 .5px rgba(0,0,0,.2);will-change:transform;transition:box-shadow .15s ease}
.kvc-tt-knob::after{content:"";position:absolute;inset:0;border-radius:50%;transition:transform .2s ease}
.kvc-tt-slider.is-active .kvc-tt-knob{box-shadow:0 2px 8px rgba(0,0,0,.6),0 0 0 .5px rgba(0,0,0,.2)}
.kvc-tt .kvc-tt-slider:focus-visible{outline:none}
.kvc-tt-slider:focus-visible .kvc-tt-knob{outline:2px solid rgba(255,255,255,.92);outline-offset:3px}
.kvc-tt-ends.kvc-tt-meta{margin-top:-.125rem}

.kvc-tt-bar{position:relative;height:2.75rem}
.kvc-tt-bar-in{position:absolute;left:0;right:0;top:50%;height:6px;margin-top:-3px}
.kvc-tt-bar-in::before{content:"";position:absolute;inset:0;border-radius:1.5px;background:rgba(255,255,255,.06)}
.kvc-tt-bar-dyn,.kvc-tt-bar-fix{position:absolute;top:0;bottom:0;left:0;border-radius:1.5px;transform-origin:0 50%;will-change:transform}
.kvc-tt-bar-dyn{width:100%;background:rgba(255,255,255,.82)}
.kvc-tt-bar-fix{width:0;background:rgba(255,255,255,.3)}
.kvc-tt-legend{display:flex;flex-wrap:wrap;gap:.25rem 1rem;margin-top:-.125rem}
.kvc-tt-legend i{display:inline-block;width:.5rem;height:.375rem;margin-right:.4rem;border-radius:1px;vertical-align:.05em}
.kvc-tt-legend .d{background:rgba(255,255,255,.82)}
.kvc-tt-legend .f{background:rgba(255,255,255,.3)}

.kvc-tt-ro{align-items:center;justify-content:space-between}
.kvc-tt-ro-text{flex:1 1 20rem;min-width:0}
.kvc-tt-ro-big{display:grid;font-size:clamp(1.3125rem,2.2vw,1.75rem);font-weight:700;letter-spacing:-.022em;line-height:1.15;color:rgba(255,255,255,.96)}
.kvc-tt-ro-big>span{grid-area:1/1}
.kvc-tt-ro-dim{color:rgba(255,255,255,.74);font-weight:600}
.kvc-tt-ro-ctx{margin-top:.5rem;max-width:34em;font-size:.9375rem;line-height:1.45;color:rgba(255,255,255,.74)}
.kvc-tt-btn{position:relative;display:inline-grid;align-items:center;justify-items:center;min-height:2.75rem;padding:0 1.25rem;border-radius:980px;background:rgba(255,255,255,.1);font-size:.875rem;font-weight:600;letter-spacing:-.006em;color:rgba(255,255,255,.96);transition:background-color .2s ease,transform .12s ease}
.kvc-tt-btn:hover{background:rgba(255,255,255,.16)}
.kvc-tt-btn:active{transform:scale(.97);transition:transform .08s ease}
.kvc-tt-btn>span{grid-area:1/1;white-space:nowrap}
.kvc-tt-btn>span[aria-hidden="true"]{visibility:hidden}

.kvc-tt-cap{margin-top:1.5rem;max-width:40em;font-size:.9375rem;line-height:1.5;color:rgba(255,255,255,.74)}
.kvc-tt-note.kvc-tt-meta{margin-top:.75rem;color:rgba(255,255,255,.46)}

@container (max-width:37.49rem){
  .kvc-tt-row{gap:1.25rem}
  .kvc-tt-field{flex:1 1 100%}
  .kvc-tt-btn{width:100%}
}
@media (prefers-reduced-motion:reduce){
  .kvc-tt-panel{transition:opacity .2s ease}
  .kvc-tt-btn:active{transform:none}
}
@media (prefers-contrast:more){
  .kvc-tt-seg{background:#000;box-shadow:inset 0 0 0 1px rgba(255,255,255,.5)}
  .kvc-tt-seg-pill{background:rgba(255,255,255,.32)}
  .kvc-tt-tab{color:rgba(255,255,255,.86)}
  .kvc-tt-meta,.kvc-tt-note.kvc-tt-meta{color:rgba(255,255,255,.8)}
  .kvc-tt-flabel,.kvc-tt-cap,.kvc-tt-ro-ctx,.kvc-tt-ro-dim{color:rgba(255,255,255,.94)}
  .kvc-tt-rail{background:rgba(255,255,255,.4)}
  .kvc-tt-btn{background:#000;box-shadow:inset 0 0 0 1px rgba(255,255,255,.6)}
}`;

  function injectStyle() {
    if (document.getElementById('kvc-tt-style')) return;
    const s = document.createElement('style');
    s.id = 'kvc-tt-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  const template = (id) => `
<div class="kvc-tt-seg" role="tablist" aria-label="Tenstorrent illustrations">
  <span class="kvc-tt-seg-pill" aria-hidden="true"></span>
  <button class="kvc-tt-tab" type="button" role="tab" id="${id}-ta" aria-controls="${id}-pa"><span>Die-to-die</span></button>
  <button class="kvc-tt-tab" type="button" role="tab" id="${id}-tb" aria-controls="${id}-pb"><span>PVT corners</span></button>
</div>
<div class="kvc-tt-stage">
  <div class="kvc-tt-panel kvc-tt-a" role="tabpanel" id="${id}-pa" aria-labelledby="${id}-ta">
    <div class="kvc-tt-view" role="img" aria-label="Illustration: two chiplets side by side, joined across a narrow gap by die-to-die lanes. In the left die, a dynamic-voltage SoC region of core tiles meets a fixed-voltage PHY strip at a row of level shifters. A timing pulse travels from a launch flop through logic and a level shifter, through the PHY and across a lane, to a capture flop on the other die."></div>
    <p class="kvc-tt-note kvc-tt-meta">Illustration</p>
    <div class="kvc-tt-row">
      <div class="kvc-tt-field">
        <span class="kvc-tt-flabel" id="${id}-vl">SoC voltage</span>
        <div class="kvc-tt-slider" role="slider" tabindex="0" aria-labelledby="${id}-vl" aria-orientation="horizontal" aria-valuemin="0" aria-valuemax="100">
          <span class="kvc-tt-rail"><span class="kvc-tt-fill"></span></span>
          <span class="kvc-tt-knob"></span>
        </div>
        <div class="kvc-tt-ends kvc-tt-meta" aria-hidden="true"><span>Lower</span><span>Higher</span></div>
      </div>
      <div class="kvc-tt-field">
        <span class="kvc-tt-flabel" id="${id}-dl">Path delay</span>
        <div class="kvc-tt-bar" role="img" aria-labelledby="${id}-dl ${id}-dd"><span class="kvc-tt-bar-in"><span class="kvc-tt-bar-dyn"></span><span class="kvc-tt-bar-fix"></span></span></div>
        <span class="kvc-tt-sr" id="${id}-dd"></span>
        <div class="kvc-tt-legend kvc-tt-meta" aria-hidden="true"><span><i class="d"></i>SoC side</span><span><i class="f"></i>PHY + D2D · fixed</span></div>
      </div>
    </div>
    <p class="kvc-tt-cap">A timing path crosses level shifters from a dynamic-voltage SoC domain into a fixed-voltage PHY, then over a die-to-die lane. Lower the voltage and only the SoC side slows.</p>
  </div>
  <div class="kvc-tt-panel kvc-tt-b" role="tabpanel" id="${id}-pb" aria-labelledby="${id}-tb">
    <div class="kvc-tt-view" role="img" aria-label="Illustration: approximately 46 process, voltage and temperature corners arranged as a three-dimensional lattice with axes P, V and T. Selecting representative corners highlights 10 of them, one marked as the dominant corner, and gathers every other corner into its nearest representative."></div>
    <p class="kvc-tt-note kvc-tt-meta">Illustration · reduction is a target under investigation</p>
    <div class="kvc-tt-row kvc-tt-ro">
      <div class="kvc-tt-ro-text">
        <p class="kvc-tt-ro-big"><span class="kvc-tt-ro-a">≈46 PVT corners</span><span class="kvc-tt-ro-b" aria-hidden="true">≈46 → 10 corners <span class="kvc-tt-ro-dim">· targeted</span></span></p>
        <p class="kvc-tt-ro-ctx">Investigating AI/ML-based corner selection while preserving timing coverage.</p>
      </div>
      <button class="kvc-tt-btn" type="button"><span>Select representative corners</span><span aria-hidden="true">Show all corners</span></button>
    </div>
    <p class="kvc-tt-cap">Process, voltage and temperature corners as a lattice. Drag to turn it.</p>
    <p class="kvc-tt-sr" aria-live="polite"></p>
  </div>
</div>`;

  let uid = 0;

  function mount(host, opts = {}) {
    injectStyle();
    const dbg = opts.debug || {};
    const reduced = () => K.reducedMotion;
    const id = 'kvc-tt-' + (++uid);
    const root = document.createElement('div');
    root.className = 'kvc-tt';
    root.innerHTML = template(id);
    host.appendChild(root);
    const $ = (s) => root.querySelector(s);

    const tabs = [...root.querySelectorAll('[role="tab"]')];
    const panels = [$('.kvc-tt-a'), $('.kvc-tt-b')];
    const viewA = panels[0].querySelector('.kvc-tt-view');
    const viewB = panels[1].querySelector('.kvc-tt-view');
    const pill = $('.kvc-tt-seg-pill');
    const slider = $('.kvc-tt-slider'), knob = $('.kvc-tt-knob'), fill = $('.kvc-tt-fill');
    const barDyn = $('.kvc-tt-bar-dyn'), barFix = $('.kvc-tt-bar-fix'), barDesc = root.querySelector(`#${id}-dd`);
    const roA = $('.kvc-tt-ro-a'), roB = $('.kvc-tt-ro-b');
    const btn = $('.kvc-tt-btn'), btnLabels = btn.querySelectorAll('span');
    const live = panels[1].querySelector('[aria-live]');

    let destroyed = false;
    const cleanup = [];
    const listen = (el, ev, fn, o) => { el.addEventListener(ev, fn, o); cleanup.push(() => el.removeEventListener(ev, fn, o)); };

    const st = {
      view: dbg.view === 'pvt' ? 1 : 0,
      v: dbg.v !== undefined ? clamp01(+dbg.v) : 0.72,
      intro: reduced() ? 1 : 0,
      introOn: reduced(),
      clock: 0,
      frozen: false,
      selOn: false,
      autoplayed: false,
      bInView: false,
      bSeen: false,
      dirtyB: true,
      restA: 0,
      rootIn: false,
    };
    const pulse = { s: 0, run: true, rest: 0, cycles: 0, final: false };
    const TRN = 96;
    const trailS = new Float32Array(TRN), trailT = new Float32Array(TRN);
    let trailHead = 0, trailCount = 0;

    // ── Loop: one visibility-gated rAF for both views ─────────
    let pendingDraw = 0;
    const loop = K.loop(root, frame);
    function wake() {
      if (destroyed) return;
      if (reduced()) {
        if (!pendingDraw) pendingDraw = requestAnimationFrame(() => { pendingDraw = 0; drawAll(); });
      } else loop.start();
    }
    // View A plays a few cycles, then rests on the lit path.
    const aSettled = () => st.intro >= 1 && pulse.final && !pulse.run && pulse.rest >= T_REST && st.restA >= 1;
    function busy() {
      const aLive = mix.value < 0.999 && st.introOn && !st.frozen && !aSettled();
      return aLive || segS.animating || mix.animating || rot.animating || sel.animating || knobS.animating || (st.dirtyB && mix.value > 0.001);
    }
    function frame(t, dt) {
      if (destroyed) return;
      if (dt > 0 && mix.value < 0.999 && !st.frozen) stepA(dt);
      drawAll();
      if (dt > 0 && !busy()) queueMicrotask(() => { if (!busy()) loop.stop(); });
    }
    function drawAll() {
      if (destroyed) return;
      if (A && mix.value < 0.999) drawA();
      if (B && mix.value > 0.001 && st.dirtyB) { drawB(); st.dirtyB = false; }
    }

    // ── Segmented control + interruptible view transition ─────
    const segS = new F.Spring(st.view, {
      dampingRatio: 1, response: 0.32, precision: 0.001,
      onUpdate: (x) => { pill.style.transform = `translate3d(${(x * 100).toFixed(3)}%,0,0)`; },
    });
    const mix = new F.Spring(st.view, { dampingRatio: 1, response: 0.5, precision: 0.001, onUpdate: applyMix });
    function stylePanel(el, o, x) {
      el.style.opacity = o.toFixed(4);
      el.style.transform = x ? `translate3d(${x.toFixed(2)}px,0,0)` : '';
      el.style.visibility = o < 0.002 ? 'hidden' : '';
    }
    function applyMix(m) {
      const rm = reduced();
      const a = rm ? 1 - Math.round(m) : 1 - smoothstep(m / 0.6);
      const b = rm ? Math.round(m) : smoothstep((m - 0.4) / 0.6);
      stylePanel(panels[0], a, rm ? 0 : -m * 28);
      stylePanel(panels[1], b, rm ? 0 : (1 - m) * 28);
      if (b > 0.001) st.dirtyB = true;
      wake();
    }
    function setView(i, focus) {
      i = i ? 1 : 0;
      if (focus) tabs[i].focus();
      tabs.forEach((t, j) => { t.setAttribute('aria-selected', String(j === i)); t.tabIndex = j === i ? 0 : -1; });
      panels.forEach((p, j) => { p.inert = j !== i; });
      if (st.view === i && !mix.animating && mix.value === i) return;
      st.view = i;
      const instant = reduced();
      segS.to(i, { instant });
      mix.to(i, { instant });
      if (i === 1) { firstSeeB(); maybeAutoplay(); } else kick();
    }
    tabs.forEach((t, j) => {
      listen(t, 'click', () => setView(j));
      listen(t, 'keydown', (e) => {
        let n = null;
        if (e.key === 'ArrowRight') n = (j + 1) % tabs.length;
        else if (e.key === 'ArrowLeft') n = (j - 1 + tabs.length) % tabs.length;
        else if (e.key === 'Home') n = 0;
        else if (e.key === 'End') n = tabs.length - 1;
        if (n === null) return;
        e.preventDefault();
        setView(n, true);
      });
    });

    // ══════════════════ View A · Die-to-die ══════════════════
    let A = null;       // canvas record
    let G = null;       // geometry + layers

    function layer(w, h, dpr) {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w * dpr));
      c.height = Math.max(1, Math.round(h * dpr));
      const ctx = c.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { c, ctx };
    }

    function buildA() {
      const W = A.w, H = A.h, dpr = A.dpr;
      const portrait = H > W * 1.02;
      const AL = portrait ? H : W, CL = portrait ? W : H;
      const map = portrait ? (a, c) => [c, a] : (a, c) => [a, c];
      const rect = (a0, c0, a1, c1) => {
        const [x0, y0] = map(a0, c0), [x1, y1] = map(a1, c1);
        return { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
      };
      const fr = portrait
        ? { a0: 0.05, Ld: 0.5, G: 0.065, Lr: 0.31, c0: 0.05, c1: 0.71, phy: 0.2, pad: 10, tile: 66, n: 7 }
        : { a0: 0.075, Ld: 0.47, G: 0.05, Lr: 0.33, c0: 0.15, c1: 0.81, phy: 0.15, pad: 16, tile: 86, n: 10 };
      const s = Math.min(1.15, Math.max(0.7, (portrait ? W : H) / (portrait ? 360 : 640)));
      const a0 = fr.a0 * AL, a1 = a0 + fr.Ld * AL;
      const b0 = a1 + fr.G * AL, b1 = b0 + fr.Lr * AL;
      const c0 = fr.c0 * CL, c1 = fr.c1 * CL, Cd = c1 - c0;
      const Lp = Math.max(30, fr.phy * (a1 - a0));
      const aPhy0 = a1 - Lp, aB = aPhy0 - 11 * s, bPhy1 = b0 + Lp;
      const n = fr.n;
      const laneC = (i) => lerp(c0 + Cd * 0.13, c1 - Cd * 0.13, i / (n - 1));
      const pkgM = 16 * s;

      // Tiles: the dynamic-voltage SoC region (left) and its mirror on die 1.
      const tiles = (ta0, ta1, tc0, tc1) => {
        const nA = Math.max(2, Math.round((ta1 - ta0) / (fr.tile * s)));
        const nC = Math.max(2, Math.round((tc1 - tc0) / (fr.tile * s)));
        const gap = 6 * s, out = [];
        const wa = (ta1 - ta0 - gap * (nA - 1)) / nA, wc = (tc1 - tc0 - gap * (nC - 1)) / nC;
        for (let i = 0; i < nA; i++) for (let j = 0; j < nC; j++) {
          const ta = ta0 + i * (wa + gap), tc = tc0 + j * (wc + gap);
          out.push({ a0: ta, c0: tc, a1: ta + wa, c1: tc + wc, i, j, nA, nC });
        }
        return out;
      };
      const pad = fr.pad * s;
      const tilesL = tiles(a0 + pad, aB - 11 * s, c0 + pad, c1 - pad);
      const tilesR = tiles(bPhy1 + 11 * s, b1 - pad, c0 + pad, c1 - pad);

      // Timing path, authored along (a, c): launch flop → logic → LS → PHY → lane → capture flop.
      const t0 = tilesL[0];
      const k = Math.round((n - 1) * (portrait ? 0.64 : 0.66));
      const cK = laneC(k);
      const aStart = lerp(t0.a0, t0.a1, 0.42);
      const cF = lerp(t0.c0, t0.c1, 0.5);
      const span = aB - aStart;
      const cJ = lerp(cF, cK, 0.52);
      const ac = [
        [aStart, cF],
        [aStart + span * 0.3, cF],
        [aStart + span * 0.3, cJ],
        [aStart + span * 0.66, cJ],
        [aStart + span * 0.66, cK],
        [aB, cK],
        [aPhy0 + Lp * 0.45, cK],
        [a1, cK],
        [b0, cK],
        [b0 + Lp * 0.55, cK],
      ];
      const pts = ac.map(([a, c]) => map(a, c));
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      const len = cum[cum.length - 1];
      const sLS = cum[5];
      const at = (i, f) => [lerp(pts[i][0], pts[i + 1][0], f), lerp(pts[i][1], pts[i + 1][1], f)];
      const mk = (p, sAt, size, kind) => ({ x: p[0], y: p[1], s: sAt, size, kind, t: -9 });
      const markers = [
        mk(pts[0], 0, 7 * s, 'ff'),
        mk(at(0, 0.5), cum[0] + (cum[1] - cum[0]) * 0.5, 5 * s, 'g'),
        mk(at(2, 0.5), cum[2] + (cum[3] - cum[2]) * 0.5, 5 * s, 'g'),
        mk(at(4, 0.5), cum[4] + (cum[5] - cum[4]) * 0.5, 5 * s, 'g'),
        mk(pts[5], sLS, 0, 'ls'),
        mk(pts[6], cum[6], 0, 'tx'),
        mk(pts[9], len, 7 * s, 'ff'),
      ];
      const lsH = Math.min(14 * s, (Cd / n) * 0.52);
      const lsRect = (i) => rect(aB - 4 * s, laneC(i) - lsH / 2, aB + 4 * s, laneC(i) + lsH / 2);
      const txRect = (i) => rect(aPhy0 + Lp * 0.3, laneC(i) - 3 * s, aPhy0 + Lp * 0.6, laneC(i) + 3 * s);
      markers[4].r = lsRect(k);
      markers[5].r = txRect(k);

      G = {
        W, H, portrait, map, rect, s, a0, a1, b0, b1, c0, c1, aB, aPhy0, bPhy1, Lp, n, laneC, k,
        pts, cum, len, sLS, markers,
        dies: [rect(a0, c0, a1, c1), rect(b0, c0, b1, c1)],
        aMin: a0 - pkgM, aMax: b1 + pkgM,
      };

      // ── Static layers (pre-rendered once per size) ──
      const base = layer(W, H, dpr), hi = layer(W, H, dpr);
      const ctx = base.ctx;
      const fillR = (c, r, f) => { c.fillStyle = f; c.fillRect(r.x, r.y, r.w, r.h); };
      const strokeR = (c, r, st_, lw = 1) => { c.strokeStyle = st_; c.lineWidth = lw; c.strokeRect(r.x + lw / 2, r.y + lw / 2, r.w - lw, r.h - lw); };
      const boost = contrastMQ.matches ? 1.6 : 1;

      // Package substrate under both dies, rim-lit from above.
      const pkg = rect(a0 - pkgM, c0 - pkgM, b1 + pkgM, c1 + pkgM);
      K.roundRect(ctx, pkg.x, pkg.y, pkg.w, pkg.h, 10 * s);
      ctx.fillStyle = '#070709';
      ctx.fill();
      const rim = ctx.createLinearGradient(0, pkg.y, 0, pkg.y + pkg.h);
      rim.addColorStop(0, white(0.16 * boost));
      rim.addColorStop(0.35, white(0.06 * boost));
      rim.addColorStop(1, white(0.04 * boost));
      ctx.strokeStyle = rim; ctx.lineWidth = 1;
      K.roundRect(ctx, pkg.x + 0.5, pkg.y + 0.5, pkg.w - 1, pkg.h - 1, 10 * s);
      ctx.stroke();

      // Polished silicon: graphite falling off away from a key light at
      // the top left, a broad specular bloom, and a machined top/left edge.
      for (const d of G.dies) {
        const g = ctx.createLinearGradient(d.x, d.y, d.x + d.w * 0.55, d.y + d.h);
        g.addColorStop(0, '#1c1c21');
        g.addColorStop(0.5, '#121215');
        g.addColorStop(1, '#0a0a0c');
        ctx.fillStyle = g;
        ctx.fillRect(d.x, d.y, d.w, d.h);
        const R = Math.hypot(d.w, d.h);
        const sp = ctx.createRadialGradient(d.x + d.w * 0.16, d.y - d.h * 0.08, 0, d.x + d.w * 0.16, d.y - d.h * 0.08, R * 0.75);
        sp.addColorStop(0, white(0.075));
        sp.addColorStop(0.45, white(0.022));
        sp.addColorStop(1, white(0));
        ctx.fillStyle = sp;
        ctx.fillRect(d.x, d.y, d.w, d.h);
        strokeR(ctx, d, white(0.07 * boost));
        const top = ctx.createLinearGradient(d.x, 0, d.x + d.w, 0);
        top.addColorStop(0, white(0.55 * boost));
        top.addColorStop(0.6, white(0.2 * boost));
        top.addColorStop(1, white(0.1 * boost));
        ctx.fillStyle = top; ctx.fillRect(d.x, d.y, d.w, 1);
        const left = ctx.createLinearGradient(0, d.y, 0, d.y + d.h);
        left.addColorStop(0, white(0.4 * boost));
        left.addColorStop(1, white(0.06 * boost));
        ctx.fillStyle = left; ctx.fillRect(d.x, d.y, 1, d.h);
        strokeR(ctx, { x: d.x + 4, y: d.y + 4, w: d.w - 8, h: d.h - 8 }, white(0.035 * boost));
      }

      // A core tile: one core block and one cache band — enough to read
      // as compute, quiet enough that the gold path owns the die.
      const drawTile = (c, t, on, dim) => {
        const r = rect(t.a0, t.c0, t.a1, t.c1);
        const m = dim ? 0.65 : 1;
        fillR(c, r, white((on ? 0.03 : 0.014) * m));
        strokeR(c, r, white((on ? 0.09 : 0.045) * m * boost));
        const la = t.a1 - t.a0, lc = t.c1 - t.c0;
        const core = rect(t.a0 + la * 0.14, t.c0 + lc * 0.14, t.a1 - la * 0.14, t.c0 + lc * 0.6);
        fillR(c, core, white((on ? 0.055 : 0.026) * m));
        const band = rect(t.a0 + la * 0.14, t.c0 + lc * 0.72, t.a1 - la * 0.14, t.c0 + lc * 0.84);
        fillR(c, band, white((on ? 0.05 : 0.022) * m));
      };
      for (const t of tilesL) drawTile(ctx, t, false, false);
      for (const t of tilesR) drawTile(ctx, t, false, true);
      for (const t of tilesL) drawTile(hi.ctx, t, true, false);

      // PHY strips (fixed V) on the facing edges.
      const phyL = rect(aPhy0, c0 + 5, a1 - 5, c1 - 5);
      const phyR = rect(b0 + 5, c0 + 5, bPhy1, c1 - 5);
      for (const r of [phyL, phyR]) { fillR(ctx, r, white(0.03)); strokeR(ctx, r, white(0.1 * boost)); }

      // Voltage-domain boundary.
      ctx.save();
      ctx.setLineDash([3 * s, 4 * s]);
      ctx.strokeStyle = white(0.3 * boost); ctx.lineWidth = 1;
      ctx.beginPath();
      let p0 = map(aB, c0 + 6), p1 = map(aB, c1 - 6);
      ctx.moveTo(Math.round(p0[0]) + 0.5, Math.round(p0[1]) + 0.5);
      ctx.lineTo(Math.round(p1[0]) + 0.5, Math.round(p1[1]) + 0.5);
      ctx.stroke();
      ctx.restore();

      // Per-lane: level shifter → PHY driver → bump → lane → bump → receiver.
      for (let i = 0; i < n; i++) {
        const c = laneC(i);
        const line = (aa, ab, col, lw = 1) => {
          const q0 = map(aa, c), q1 = map(ab, c);
          ctx.strokeStyle = col; ctx.lineWidth = lw;
          ctx.beginPath();
          if (portrait) { ctx.moveTo(Math.round(q0[0]) + 0.5, q0[1]); ctx.lineTo(Math.round(q1[0]) + 0.5, q1[1]); }
          else { ctx.moveTo(q0[0], Math.round(q0[1]) + 0.5); ctx.lineTo(q1[0], Math.round(q1[1]) + 0.5); }
          ctx.stroke();
        };
        line(aB + 4 * s, aPhy0 + Lp * 0.3, white(0.07 * boost));
        line(aPhy0 + Lp * 0.6, a1, white(0.08 * boost));
        line(a1, b0, white(0.2 * boost));
        line(b0, b0 + Lp * 0.42, white(0.08 * boost));
        const ls = lsRect(i);
        fillR(ctx, ls, '#0d0d10');
        fillR(ctx, ls, white(0.08));
        strokeR(ctx, ls, white(0.3 * boost));
        fillR(ctx, txRect(i), white(0.11));
        fillR(ctx, rect(b0 + Lp * 0.42, c - 3 * s, b0 + Lp * 0.68, c + 3 * s), white(0.1));
        for (const aa of [a1 - 3, b0 + 3]) {
          const q = map(aa, c);
          ctx.fillStyle = white(0.36 * boost);
          ctx.beginPath(); ctx.arc(q[0], q[1], 1.8 * s, 0, Math.PI * 2); ctx.fill();
        }
      }

      // The path itself, at rest: a quiet route on the metal.
      ctx.save();
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.strokeStyle = white(0.16 * boost); ctx.lineWidth = 1.25;
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.stroke();
      ctx.restore();
      for (const m of markers) {
        if (m.kind === 'ff') {
          const h = m.size / 2;
          ctx.fillStyle = '#0b0b0e'; ctx.fillRect(m.x - h, m.y - h, m.size, m.size);
          ctx.strokeStyle = white(0.62 * boost); ctx.lineWidth = 1;
          ctx.strokeRect(m.x - h + 0.5, m.y - h + 0.5, m.size - 1, m.size - 1);
        } else if (m.kind === 'g') {
          const h = m.size / 2;
          ctx.fillStyle = white(0.42 * boost); ctx.fillRect(m.x - h, m.y - h, m.size, m.size);
        } else if (m.kind === 'ls') {
          strokeR(ctx, m.r, white(0.6 * boost));
        }
      }

      // Labels — tiny block names only; everything that matters is DOM.
      // Kept off the base layer so the reveal can fade each one in whole
      // once the light has passed it, never clipped mid-glyph.
      const labs = [], ticks = [];
      const lab = (text, x, y, a, o = {}) => labs.push({ text, x, y, a, o });
      const tick = (x0, y0, x1, y1, a) => ticks.push({ x0, y0, x1, y1, a });
      if (!portrait) {
        const yTop = c0 - pkgM - 14 * s;
        lab('SoC · dynamic V', a0 + pad, yTop, a0 + pad + 50 * s);
        lab('PHY · fixed V', a1, yTop, a1, { align: 'right' });
        const yBot = c1 + pkgM + 22 * s;
        const xl = Math.round(aB) + 0.5;
        tick(xl, c1 + 6, xl, yBot - 12 * s, aB);
        lab('Level shifters', aB, yBot, aB, { align: 'center' });
        const xg = Math.round((a1 + b0) / 2) + 0.5;
        tick(xg, laneC(n - 1) + 6 * s, xg, yBot - 12 * s, (a1 + b0) / 2);
        lab('D2D lanes', (a1 + b0) / 2, yBot, (a1 + b0) / 2, { align: 'center' });
      } else {
        // Portrait: a right-hand label column with leader ticks.
        const xL = c1 + pkgM + 12 * s;
        const two = (l1, l2, aMid) => {
          lab(l1, xL, aMid - 2, aMid);
          lab(l2, xL, aMid + 11 * s, aMid);
          tick(c1 + 3, Math.round(aMid) - 5.5, xL - 6, Math.round(aMid) - 5.5, aMid);
        };
        two('SoC', 'dynamic V', (a0 + aB) / 2);
        two('Level', 'shifters', aB + 5);
        two('PHY', 'fixed V', aPhy0 + Lp * 0.75);
        two('D2D', 'lanes', (a1 + b0) / 2 + 4);
      }
      const labSize = Math.round(10 * Math.min(1, s * 1.05));
      G.drawLabels = (c, sweep) => {
        const fe = 70 * s;
        const al = (a) => (sweep === undefined ? 1 : smoothstep((sweep - a - 30 * s) / fe));
        c.lineWidth = 1;
        for (const t of ticks) {
          const k_ = al(t.a);
          if (k_ <= 0.004) continue;
          c.strokeStyle = white(0.2 * boost * k_);
          c.beginPath(); c.moveTo(t.x0, t.y0); c.lineTo(t.x1, t.y1); c.stroke();
        }
        for (const L of labs) {
          const k_ = al(L.a);
          if (k_ > 0.004) K.label(c, L.text, L.x, L.y, { size: labSize, color: white(0.54 * boost * k_), ...L.o });
        }
      };
      const labL = layer(W, H, dpr);
      G.drawLabels(labL.ctx);
      const rev = layer(W, H, dpr);

      // Gold head sprite.
      const hs = 40;
      const halo = layer(hs, hs, dpr);
      const hg = halo.ctx.createRadialGradient(hs / 2, hs / 2, 0, hs / 2, hs / 2, hs / 2);
      hg.addColorStop(0, gold(0.55));
      hg.addColorStop(0.35, gold(0.18));
      hg.addColorStop(1, gold(0));
      halo.ctx.fillStyle = hg;
      halo.ctx.fillRect(0, 0, hs, hs);

      G.base = base.c; G.hi = hi.c; G.halo = halo.c; G.hs = hs; G.labL = labL.c; G.rev = rev;
    }

    function pointAt(s) {
      const { pts, cum } = G;
      let i = 1;
      while (i < cum.length - 1 && cum[i] < s) i++;
      const seg = cum[i] - cum[i - 1] || 1;
      const f = clamp01((s - cum[i - 1]) / seg);
      return [lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)];
    }
    function traceRange(ctx, s0, s1) {
      const { pts, cum } = G;
      const p = pointAt(s0);
      ctx.moveTo(p[0], p[1]);
      for (let i = 1; i < cum.length - 1; i++) if (cum[i] > s0 && cum[i] < s1) ctx.lineTo(pts[i][0], pts[i][1]);
      const q = pointAt(s1);
      ctx.lineTo(q[0], q[1]);
    }

    function pushTrail(s) {
      trailS[trailHead] = s; trailT[trailHead] = st.clock;
      trailHead = (trailHead + 1) % TRN;
      trailCount = Math.min(TRN, trailCount + 1);
    }

    function stepA(dt) {
      if (!G || !st.introOn) return;
      if (st.intro < 1) {
        st.intro = Math.min(1, st.intro + dt / INTRO);
        if (st.intro >= 1) { pulse.s = 0; pulse.run = true; st.clock = 0; G.markers[0].t = 0; }
        return;
      }
      advancePulse(dt);
      const target = pulse.final && !pulse.run ? 1 : 0;
      st.restA = target ? Math.min(1, st.restA + dt / 0.9) : Math.max(0, st.restA - dt / 0.35);
    }
    // Replay the choreography (slider touched, view re-entered).
    function kick() {
      if (!G || st.intro < 1 || st.frozen || reduced()) return;
      pulse.cycles = 0;
      if (pulse.final) {
        pulse.final = false;
        if (!pulse.run) restartPulse();
      }
      wake();
    }
    function restartPulse() {
      pulse.run = true; pulse.s = 0; trailCount = 0;
      G.markers[0].t = st.clock;
      for (let i = 1; i < G.markers.length; i++) G.markers[i].t = -9;
    }
    function advancePulse(dt) {
      st.clock += dt;
      if (pulse.run) {
        const prev = pulse.s;
        let left = dt, s = prev;
        // Two speed regimes, split exactly at the level shifter.
        while (left > 1e-6 && s < G.len) {
          const inDyn = s < G.sLS;
          const speed = inDyn ? G.sLS / (T_DYN * dynFactor(st.v)) : (G.len - G.sLS) / T_FIX;
          const end = inDyn ? G.sLS : G.len;
          const need = (end - s) / speed;
          if (need > left) { s += speed * left; left = 0; } else { s = end; left -= need; }
        }
        pulse.s = s;
        for (const m of G.markers) if (m.s > prev && m.s <= s) m.t = st.clock;
        pushTrail(s);
        if (s >= G.len) {
          pulse.run = false; pulse.rest = 0;
          if (++pulse.cycles >= CYCLES) pulse.final = true;
        }
      } else {
        pulse.rest += dt;
        if (pulse.rest >= T_REST && !pulse.final) restartPulse();
      }
    }

    function drawA() {
      const ctx = A.ctx, W = A.w, H = A.h;
      ctx.clearRect(0, 0, W, H);
      if (!G || (!st.introOn && !reduced())) return;
      const rm = reduced();
      const hiA = 0.15 + 0.85 * st.v;

      if (!rm && st.intro < 1) {
        // Reveal: a feathered light front sweeps across the package. The
        // lit layers are masked by a soft gradient (no hard clip), and the
        // labels fade in whole once the front has passed them.
        const p = st.intro, fe = 170 * G.s;
        const sweep = lerp(G.aMin - 40, G.aMax + fe + 40, easeInOut(segment(p, 0, 0.92)));
        const rc = G.rev.ctx;
        rc.globalCompositeOperation = 'source-over';
        rc.clearRect(0, 0, W, H);
        rc.drawImage(G.base, 0, 0, W, H);
        rc.globalAlpha = hiA; rc.drawImage(G.hi, 0, 0, W, H); rc.globalAlpha = 1;
        const mg = G.portrait ? rc.createLinearGradient(0, sweep - fe, 0, sweep) : rc.createLinearGradient(sweep - fe, 0, sweep, 0);
        mg.addColorStop(0, '#000'); mg.addColorStop(1, 'rgba(0,0,0,0)');
        rc.globalCompositeOperation = 'destination-in';
        rc.fillStyle = mg; rc.fillRect(0, 0, W, H);
        rc.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = smoothstep(segment(p, 0, 0.12));
        ctx.drawImage(G.rev.c, 0, 0, W, H);
        ctx.globalAlpha = 1;
        G.drawLabels(ctx, sweep);
        // Specular band riding the front, on the dies only.
        ctx.save();
        ctx.beginPath();
        for (const d of G.dies) ctx.rect(d.x, d.y, d.w, d.h);
        ctx.clip();
        const bw = 150 * G.s, c0 = sweep - fe * 0.55;
        const g = G.portrait ? ctx.createLinearGradient(0, c0 - bw, 0, c0 + bw * 0.4) : ctx.createLinearGradient(c0 - bw, 0, c0 + bw * 0.4, 0);
        const fade = 1 - smoothstep(segment(p, 0.75, 1));
        g.addColorStop(0, white(0));
        g.addColorStop(0.72, white(0.09 * fade));
        g.addColorStop(1, white(0));
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
        return;
      }

      ctx.drawImage(G.base, 0, 0, W, H);
      ctx.globalAlpha = hiA;
      ctx.drawImage(G.hi, 0, 0, W, H);
      ctx.globalAlpha = 1;
      ctx.drawImage(G.labL, 0, 0, W, H);

      ctx.save();
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      if (rm) {
        // Static frame: the whole path lit, every stage marked.
        drawRestPath(ctx, 1);
        ctx.restore();
        return;
      }
      if (st.restA > 0.004) drawRestPath(ctx, smoothstep(st.restA));

      // Path travelled so far this cycle, faint.
      const travA = pulse.run ? 0.22 : 0.22 * (1 - smoothstep(pulse.rest / (T_REST * 0.8)));
      if (travA > 0.004 && pulse.s > 0) {
        ctx.strokeStyle = gold(travA); ctx.lineWidth = 1.25;
        ctx.beginPath(); traceRange(ctx, 0, pulse.s); ctx.stroke();
      }
      // Fading trail behind the head.
      ctx.lineWidth = 2.25;
      for (let i = 1; i < trailCount; i++) {
        const ia = (trailHead - trailCount + i - 1 + TRN) % TRN, ib = (ia + 1) % TRN;
        const age = st.clock - trailT[ib];
        if (age > TRAIL || trailS[ib] <= trailS[ia]) continue;
        const a = Math.pow(1 - age / TRAIL, 2) * 0.95;
        ctx.strokeStyle = gold(a);
        ctx.beginPath(); traceRange(ctx, trailS[ia], trailS[ib]); ctx.stroke();
      }
      // Stage flashes as the edge passes each one.
      for (const m of G.markers) {
        const age = st.clock - m.t;
        if (age >= 0 && age < 0.7) markerGold(ctx, m, Math.pow(1 - age / 0.7, 2));
      }
      // Head.
      if (pulse.run) {
        const [x, y] = pointAt(pulse.s);
        const hs = G.hs * G.s;
        ctx.drawImage(G.halo, x - hs / 2, y - hs / 2, hs, hs);
        ctx.fillStyle = P.gold;
        ctx.beginPath(); ctx.arc(x, y, 2.6 * G.s, 0, Math.PI * 2); ctx.fill();
      } else if (pulse.rest < 0.9) {
        // Captured: one calm ring at the far flop.
        const m = G.markers[G.markers.length - 1];
        const q = pulse.rest / 0.9;
        ctx.strokeStyle = gold(0.55 * (1 - q)); ctx.lineWidth = 1.25;
        ctx.beginPath(); ctx.arc(m.x, m.y, (5 + 14 * K.easeOut(q)) * G.s, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    }
    function drawRestPath(ctx, k) {
      ctx.strokeStyle = gold(0.8 * k); ctx.lineWidth = 1.6;
      ctx.beginPath(); traceRange(ctx, 0, G.len); ctx.stroke();
      for (const m of G.markers) markerGold(ctx, m, 0.85 * k);
    }
    function markerGold(ctx, m, a) {
      if (a <= 0.004) return;
      if (m.r) {
        ctx.fillStyle = gold(a * 0.9); ctx.fillRect(m.r.x, m.r.y, m.r.w, m.r.h);
      } else {
        const h = m.size / 2;
        if (m.kind === 'ff') {
          ctx.strokeStyle = gold(a); ctx.lineWidth = 1.25;
          ctx.strokeRect(m.x - h + 0.5, m.y - h + 0.5, m.size - 1, m.size - 1);
        } else {
          ctx.fillStyle = gold(a); ctx.fillRect(m.x - h, m.y - h, m.size, m.size);
        }
      }
    }

    // ── Voltage slider (direct manipulation) ──────────────────
    let railW = 0, railLeft = 0, barW = 0, drag = null, pend = null, lastNow = -1, lastTier = '';
    const SLOP = 8;
    const knobS = new F.Spring(st.v, { dampingRatio: 1, response: 0.3, precision: 0.0005, onUpdate: renderKnob });
    function renderKnob(val) {
      knob.style.transform = `translate3d(${(val * railW).toFixed(2)}px,0,0)`;
      fill.style.transform = `scaleX(${clamp01(val).toFixed(4)})`;
      st.v = clamp01(val);
      renderDelay();
      if (A && mix.value < 0.999 && reduced()) wake();
    }
    function tierOf(v) {
      return v < 0.15 ? ['lowest voltage', 'longest'] : v < 0.4 ? ['lower voltage', 'longer'] : v < 0.62 ? ['middle voltage', 'moderate'] : v < 0.86 ? ['higher voltage', 'shorter'] : ['highest voltage', 'shortest'];
    }
    function renderDelay() {
      const f = (T_DYN * dynFactor(st.v)) / MAX_DELAY;
      barDyn.style.transform = `scaleX(${f.toFixed(4)})`;
      barFix.style.transform = `translate3d(${(f * barW + 2).toFixed(2)}px,0,0)`;
      // Assistive tech hears the committed value, not the knob's travel.
      const cv = clamp01(knobS.target);
      const now = Math.round(cv * 100);
      if (now !== lastNow) { lastNow = now; slider.setAttribute('aria-valuenow', String(now)); }
      const [vt, dt] = tierOf(cv);
      if (vt !== lastTier) {
        lastTier = vt;
        slider.setAttribute('aria-valuetext', `${vt[0].toUpperCase() + vt.slice(1)}, ${dt} SoC-side delay`);
        barDesc.textContent = `: ${dt} on the SoC side at ${vt}; the PHY and die-to-die segment stays the same.`;
      }
    }

    const barIn = $('.kvc-tt-bar-in');
    const sliderRO = new ResizeObserver(() => {
      if (destroyed) return;
      railW = slider.clientWidth;
      barW = barIn.clientWidth;
      barFix.style.width = `${Math.max(0, (T_FIX / MAX_DELAY) * barW - 2).toFixed(2)}px`;
      renderKnob(knobS.value);
    });
    sliderRO.observe(slider);
    sliderRO.observe(barIn);
    const vTrack = new F.VelocityTracker();
    function sliderValueAt(x) {
      let px = x - railLeft - (drag ? drag.grab : 0);
      if (px < 0) px = -F.rubberband(-px, railW);
      else if (px > railW) px = railW + F.rubberband(px - railW, railW);
      return railW ? px / railW : 0;
    }
    function beginSlide(id, x, onKnob, kx, v0) {
      drag = { id, grab: onKnob ? x - kx : 0, catching: !onKnob, v0 };
      // Touch is implicitly captured already; re-capturing would fire a
      // lostpointercapture that ends the drag we are starting.
      try { if (!slider.hasPointerCapture(id)) slider.setPointerCapture(id); } catch (_) { /* pointer already gone */ }
      slider.classList.add('is-active');
      vTrack.reset();
      if (onKnob) knobS.set(knobS.value);
      else knobS.to(clamp01(sliderValueAt(x)), { instant: reduced() });
      kick();
    }
    listen(slider, 'pointerdown', (e) => {
      if (e.button !== 0 || !railW) return;
      railLeft = slider.getBoundingClientRect().left;
      const kx = railLeft + knobS.value * railW;
      const onKnob = Math.abs(e.clientX - kx) <= 18;
      // Touch: nothing changes until the finger shows intent — a tap, or a
      // horizontal move past the slop. A vertical scroll leaves it untouched.
      if (e.pointerType === 'touch') { pend = { id: e.pointerId, x0: e.clientX, y0: e.clientY, onKnob, kx, v0: knobS.target }; return; }
      beginSlide(e.pointerId, e.clientX, onKnob, kx, knobS.target);
    });
    listen(slider, 'pointermove', (e) => {
      if (pend && e.pointerId === pend.id) {
        const dx = e.clientX - pend.x0, dy = e.clientY - pend.y0;
        if (Math.hypot(dx, dy) < SLOP) return;
        const p = pend; pend = null;
        if (Math.abs(dx) <= Math.abs(dy)) return;      // a scroll: let the page have it
        beginSlide(p.id, p.x0, p.onKnob, p.kx, p.v0);
      }
      if (!drag || e.pointerId !== drag.id) return;
      const v = sliderValueAt(e.clientX);
      vTrack.add(v);
      if (drag.catching && !reduced()) {
        knobS.to(v);
        if (Math.abs(knobS.value - v) * railW < 1.5) drag.catching = false;
      } else knobS.set(v);
    });
    const endSlide = (e) => {
      if (pend && e.pointerId === pend.id) {
        const p = pend; pend = null;
        if (e.type === 'pointerup') {                    // a tap on the track
          knobS.to(clamp01(sliderValueAt(e.clientX)), { instant: reduced() });
          kick();
        }
        return;
      }
      if (!drag || e.pointerId !== drag.id) return;
      const v0 = drag.v0;
      drag = null;
      slider.classList.remove('is-active');
      if (e.type === 'pointercancel') { knobS.to(v0, { instant: reduced(), velocity: 0 }); return; }
      knobS.to(clamp01(knobS.target), { instant: reduced(), velocity: knobS.target > 1 || knobS.target < 0 ? 0 : undefined });
    };
    listen(slider, 'pointerup', endSlide);
    listen(slider, 'pointercancel', endSlide);
    // Only our own capture ending counts — a child losing implicit touch
    // capture (when we take it) bubbles up here too.
    listen(slider, 'lostpointercapture', (e) => { if (e.target === slider) endSlide(e); });
    listen(slider, 'keydown', (e) => {
      const steps = { ArrowRight: 0.05, ArrowUp: 0.05, ArrowLeft: -0.05, ArrowDown: -0.05, PageUp: 0.2, PageDown: -0.2 };
      let t;
      if (e.key in steps) t = clamp01(Math.round((knobS.target + steps[e.key]) * 100) / 100);
      else if (e.key === 'Home') t = 0;
      else if (e.key === 'End') t = 1;
      else return;
      e.preventDefault();
      knobS.to(t, { instant: reduced() });
      kick();
    });

    // ══════════════════ View B · PVT corners ══════════════════
    let B = null;
    const NP = 4, NV = 4, NT = 3;
    const YS = 0.8, ZS = 0.78;
    const gx = (p) => lerp(1, -1, p / (NP - 1)), gy = (v) => lerp(-YS, YS, v / (NV - 1)), gz = (t) => lerp(-ZS, ZS, t / (NT - 1));
    const skip = new Set(['1,2,1', '2,1,1']);            // a sparse set: not every site is a corner
    const sites = [];
    for (let p = 0; p < NP; p++) for (let v = 0; v < NV; v++) for (let t = 0; t < NT; t++) {
      if (!skip.has(`${p},${v},${t}`)) sites.push({ p, v, t, x: gx(p), y: gy(v), z: gz(t) });
    }
    const NS = sites.length;                              // 46
    const norm = (q) => [q.p / (NP - 1), q.v / (NV - 1), q.t / (NT - 1)];
    const dist = (a, b) => { const A_ = norm(a), B_ = norm(b); return Math.hypot(A_[0] - B_[0], A_[1] - B_[1], A_[2] - B_[2]); };
    // Representatives: k-medoids (farthest-point seeds, PAM swaps), with
    // the dominant corner pinned. Medoids sit inside their clusters, so the
    // collapse reads as local gathering rather than lines across the cube.
    const dominant = sites.findIndex((q) => q.p === 0 && q.v === 0 && q.t === 0);
    const reps = [dominant];
    while (reps.length < 10) {
      let best = -1, bd = -1;
      for (let i = 0; i < NS; i++) {
        if (reps.includes(i)) continue;
        let d = Infinity;
        for (const r of reps) d = Math.min(d, dist(sites[i], sites[r]));
        if (d > bd + 1e-9) { bd = d; best = i; }
      }
      reps.push(best);
    }
    {
      // PAM swap refinement (46 sites: a few ms, once per mount).
      const DM = new Float32Array(NS * NS);
      for (let i = 0; i < NS; i++) for (let j = 0; j < NS; j++) DM[i * NS + j] = dist(sites[i], sites[j]);
      const cost = () => { let c = 0; for (let i = 0; i < NS; i++) { let d = Infinity; for (const r of reps) d = Math.min(d, DM[i * NS + r]); c += d; } return c; };
      let cur = cost();
      for (let it = 0; it < 40; it++) {
        let bc = cur, bk = -1, bh = -1;
        for (let k = 1; k < reps.length; k++) for (let h = 0; h < NS; h++) {
          if (reps.includes(h)) continue;
          const old = reps[k]; reps[k] = h;
          const c = cost(); reps[k] = old;
          if (c < bc - 1e-9) { bc = c; bk = k; bh = h; }
        }
        if (bk < 0) break;
        reps[bk] = bh; cur = bc;
      }
    }
    // Brighten order: outward from the dominant corner.
    reps.sort((a, b) => (a === dominant ? -1 : b === dominant ? 1 : dist(sites[a], sites[dominant]) - dist(sites[b], sites[dominant])));
    const repOrder = new Int8Array(NS).fill(-1);
    reps.forEach((r, k) => { repOrder[r] = k; });
    const owner = new Int16Array(NS), rank = new Float32Array(NS), members = new Int16Array(NS);
    {
      let dmax = 0;
      for (let i = 0; i < NS; i++) {
        let best = reps[0], d = Infinity;
        for (const r of reps) { const dd = dist(sites[i], sites[r]); if (dd < d) { d = dd; best = r; } }
        owner[i] = best; rank[i] = d; dmax = Math.max(dmax, d);
        members[best]++;
      }
      for (let i = 0; i < NS; i++) rank[i] = dmax ? rank[i] / dmax : 0;
    }
    // Lattice lines across the full grid (including the two empty sites).
    const lines = [];
    for (let v = 0; v < NV; v++) for (let t = 0; t < NT; t++) lines.push([gx(0), gy(v), gz(t), gx(NP - 1), gy(v), gz(t), (v === 0 || v === NV - 1) && (t === 0 || t === NT - 1)]);
    for (let p = 0; p < NP; p++) for (let t = 0; t < NT; t++) lines.push([gx(p), gy(0), gz(t), gx(p), gy(NV - 1), gz(t), (p === 0 || p === NP - 1) && (t === 0 || t === NT - 1)]);
    for (let p = 0; p < NP; p++) for (let v = 0; v < NV; v++) lines.push([gx(p), gy(v), gz(0), gx(p), gy(v), gz(NT - 1), (p === 0 || p === NP - 1) && (v === 0 || v === NV - 1)]);
    // Axis labels ride the outermost (silhouette) edge parallel to each
    // axis, pushed outward along its screen normal — never inside the cube.
    const axes = [
      { name: 'P · process', edges: [[-1, -YS, -ZS, 1, -YS, -ZS], [-1, YS, -ZS, 1, YS, -ZS], [-1, -YS, ZS, 1, -YS, ZS], [-1, YS, ZS, 1, YS, ZS]] },
      { name: 'V · voltage', edges: [[-1, -YS, -ZS, -1, YS, -ZS], [1, -YS, -ZS, 1, YS, -ZS], [-1, -YS, ZS, -1, YS, ZS], [1, -YS, ZS, 1, YS, ZS]] },
      { name: 'T · temperature', edges: [[-1, -YS, -ZS, -1, -YS, ZS], [1, -YS, -ZS, 1, -YS, ZS], [-1, YS, -ZS, -1, YS, ZS], [1, YS, -ZS, 1, YS, ZS]] },
    ];
    const axScore = new Float32Array(4), axX = new Float32Array(4), axY = new Float32Array(4);
    const SX = new Float32Array(NS), SY = new Float32Array(NS), SZ = new Float32Array(NS), SK = new Float32Array(NS);
    const LP = new Float32Array(lines.length * 4);
    const order = Array.from({ length: NS }, (_, i) => i);
    const byDepth = (i, j) => SZ[j] - SZ[i];

    const YAW0 = -0.62, PITCH0 = 0.36, PITCH_LO = 0.06, PITCH_HI = 0.98, ROT_K = 0.0085;
    const markB = () => { st.dirtyB = true; wake(); };
    const rot = new F.Spring2D(dbg.yaw !== undefined ? +dbg.yaw : YAW0, dbg.pitch !== undefined ? +dbg.pitch : PITCH0, {
      dampingRatio: 0.8, response: 0.55, precision: 0.0005, onUpdate: markB,
    });
    const sel = new F.Spring(0, { dampingRatio: 1, response: 1.5, precision: 0.0008, onUpdate: renderSel });

    let proj = null;
    function setupProj() {
      const W = B.w, H = B.h;
      const portrait = H > W * 1.02;
      const S = portrait ? Math.min(W * 0.32, H * 0.3) : Math.min(W, H) * 0.3;
      proj = { W, H, S, cx: W / 2, cy: H * (portrait ? 0.47 : 0.52), D: 4.4, k: Math.min(1.15, Math.max(0.8, S / 200)) };
    }
    function project(x, y, z, cy_, sy_, cp, sp) {
      const x1 = x * cy_ - z * sy_;
      const z1 = x * sy_ + z * cy_;
      const y2 = y * cp + z1 * sp;
      const z2 = -y * sp + z1 * cp;
      const f = proj.D / (proj.D + z2);
      return [proj.cx + x1 * proj.S * f, proj.cy - y2 * proj.S * f, z2, f];
    }

    function drawB() {
      const ctx = B.ctx, W = B.w, H = B.h;
      ctx.clearRect(0, 0, W, H);
      if (!proj) return;
      const boost = contrastMQ.matches ? 1.6 : 1;
      const yaw = rot.x.value, pitch = rot.y.value;
      const cy_ = Math.cos(yaw), sy_ = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const s = sel.value;

      // Lattice.
      ctx.lineWidth = 1;
      for (let i = 0; i < lines.length; i++) {
        const L = lines[i];
        const a = project(L[0], L[1], L[2], cy_, sy_, cp, sp), b = project(L[3], L[4], L[5], cy_, sy_, cp, sp);
        LP[i * 4] = a[0]; LP[i * 4 + 1] = a[1]; LP[i * 4 + 2] = b[0]; LP[i * 4 + 3] = b[1];
      }
      // Selected: the lattice recedes to a whisper so only the ten remain.
      const gridOut = smoothstep(segment(s, 0.15, 0.85));
      ctx.strokeStyle = white(lerp(0.05, 0.016, gridOut) * boost);
      ctx.beginPath();
      for (let i = 0; i < lines.length; i++) if (!lines[i][6]) { ctx.moveTo(LP[i * 4], LP[i * 4 + 1]); ctx.lineTo(LP[i * 4 + 2], LP[i * 4 + 3]); }
      ctx.stroke();
      ctx.strokeStyle = white(lerp(0.13, 0.03, gridOut) * boost);
      ctx.beginPath();
      for (let i = 0; i < lines.length; i++) if (lines[i][6]) { ctx.moveTo(LP[i * 4], LP[i * 4 + 1]); ctx.lineTo(LP[i * 4 + 2], LP[i * 4 + 3]); }
      ctx.stroke();
      drawAxes(ctx, cy_, sy_, cp, sp, boost * lerp(1, 0.75, gridOut));

      // Sites.
      for (let i = 0; i < NS; i++) {
        const q = sites[i];
        const r = project(q.x, q.y, q.z, cy_, sy_, cp, sp);
        SX[i] = r[0]; SY[i] = r[1]; SZ[i] = r[2]; SK[i] = r[3];
      }
      order.sort(byDepth);
      const r0 = 3.1 * proj.k;
      const shade = (i) => lerp(1, 0.5, clamp01((SZ[i] + 1.2) / 2.4));

      // Collapse: each corner reaches for its representative, then a bead
      // carries it in and the link retracts behind the bead — nothing left.
      if (s > 0.001) {
        ctx.lineWidth = 1;
        for (let i = 0; i < NS; i++) {
          if (repOrder[i] >= 0) continue;
          const o = owner[i], rk = rank[i];
          const g = smoothstep(segment(s, 0.22 + 0.2 * rk, 0.46 + 0.2 * rk));
          if (g <= 0) continue;
          const f = smoothstep(segment(s, 0.4 + 0.2 * rk, 0.68 + 0.2 * rk));
          if (f >= 0.999) continue;
          const e = easeInOut(f);
          ctx.strokeStyle = white(0.26 * g * (1 - f) * shade(i) * boost);
          ctx.beginPath();
          ctx.moveTo(lerp(SX[i], SX[o], e), lerp(SY[i], SY[o], e));
          ctx.lineTo(lerp(SX[i], SX[o], g), lerp(SY[i], SY[o], g));
          ctx.stroke();
        }
      }

      const arrive = smoothstep(segment(s, 0.6, 0.95));
      const gd = smoothstep(segment(s, 0.18, 0.46));
      for (let n = 0; n < NS; n++) {
        const i = order[n];
        const sh = shade(i);
        const rr = r0 * SK[i];
        const k = repOrder[i];
        if (k < 0) {
          const rk = rank[i];
          const f = smoothstep(segment(s, 0.4 + 0.2 * rk, 0.68 + 0.2 * rk));
          // What stays behind is a ghost, barely there.
          ctx.fillStyle = white(lerp(0.6, 0.07, f) * sh);
          ctx.beginPath(); ctx.arc(SX[i], SY[i], rr * lerp(1, 0.5, f), 0, Math.PI * 2); ctx.fill();
          if (f > 0.001 && f < 0.999) {
            const e = easeInOut(f), o = owner[i];
            ctx.fillStyle = white(0.75 * (1 - f * f) * sh);
            ctx.beginPath(); ctx.arc(lerp(SX[i], SX[o], e), lerp(SY[i], SY[o], e), rr * 0.75, 0, Math.PI * 2); ctx.fill();
          }
        } else {
          const b = smoothstep(segment(s, 0.02 * k, 0.26 + 0.02 * k));
          const grow = 1 + 0.32 * b + 0.3 * arrive * Math.min(1, members[i] / 6);
          const R = rr * grow;
          if (i === dominant && gd > 0.001) {
            const hs = R * 9;
            if (G && G.halo) { ctx.globalAlpha = gd; ctx.drawImage(G.halo, SX[i] - hs / 2, SY[i] - hs / 2, hs, hs); ctx.globalAlpha = 1; }
            const c = (a, z) => Math.round(lerp(a, z, gd));
            ctx.fillStyle = `rgba(${c(255, 224)},${c(255, 185)},${c(255, 108)},${lerp(lerp(0.6, 0.96, b) * sh, 1, gd).toFixed(3)})`;
          } else {
            ctx.fillStyle = white(lerp(0.6, 0.96, b) * lerp(sh, 1, b * 0.7));
          }
          ctx.beginPath(); ctx.arc(SX[i], SY[i], R, 0, Math.PI * 2); ctx.fill();
        }
      }
      const la = smoothstep(segment(s, 0.32, 0.6));
      if (la > 0.004) {
        const right = SX[dominant] + 130 < proj.W;
        K.label(ctx, 'Dominant corner', SX[dominant] + (right ? 1 : -1) * 12 * proj.k, SY[dominant] + 3.5, { size: 10, color: gold(0.9 * la), align: right ? 'left' : 'right' });
      }
    }

    function drawAxes(ctx, cy_, sy_, cp, sp, boost) {
      const c = project(0, 0, 0, cy_, sy_, cp, sp);
      const off = 16 * proj.k;
      for (const ax of axes) {
        let best = -Infinity;
        for (let j = 0; j < 4; j++) {
          const E = ax.edges[j];
          const a = project(E[0], E[1], E[2], cy_, sy_, cp, sp), b = project(E[3], E[4], E[5], cy_, sy_, cp, sp);
          const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
          let nx = -(b[1] - a[1]), ny = b[0] - a[0];
          const nl = Math.hypot(nx, ny) || 1;
          nx /= nl; ny /= nl;
          let d = (mx - c[0]) * nx + (my - c[1]) * ny;
          if (d < 0) { nx = -nx; ny = -ny; d = -d; }
          axScore[j] = d - 0.15 * ((a[2] + b[2]) / 2) * proj.S;   // prefer the nearer of two silhouettes
          axX[j] = mx + nx * off; axY[j] = my + ny * off;
          if (axScore[j] > best) best = axScore[j];
        }
        // Crossfade near ties so a label never pops between edges.
        const band = 5 * proj.k;
        for (let j = 0; j < 4; j++) {
          const w = smoothstep((axScore[j] - best + band) / band);
          if (w <= 0.01) continue;
          const hw = ax.name.length * 3.5 + 6;                      // ≈ half the 10px mono label
          K.label(ctx, ax.name, F.clamp(axX[j], hw, proj.W - hw), F.clamp(axY[j], 10, proj.H - 10), { size: 10, color: white(0.5 * boost * w), align: 'center', baseline: 'middle' });
        }
      }
    }
    function renderSel(s) {
      const a = 1 - smoothstep(segment(s, 0.28, 0.52)), b = smoothstep(segment(s, 0.42, 0.72));
      roA.style.opacity = a.toFixed(3);
      roB.style.opacity = b.toFixed(3);
      markB();
    }
    function select(on, o = {}) {
      on = !!on;
      st.autoplayed = true;
      if (on === st.selOn && !o.force) return;
      st.selOn = on;
      if (on) { btnLabels[0].setAttribute('aria-hidden', 'true'); btnLabels[1].removeAttribute('aria-hidden'); }
      else { btnLabels[1].setAttribute('aria-hidden', 'true'); btnLabels[0].removeAttribute('aria-hidden'); }
      roA.setAttribute('aria-hidden', String(on));
      roB.setAttribute('aria-hidden', String(!on));
      if (!o.quiet) live.textContent = on
        ? 'Ten representative corners highlighted, one dominant; the rest gathered into their nearest representative. A targeted reduction from about 46.'
        : 'All approximately 46 corners shown.';
      sel.to(on ? 1 : 0, { instant: o.instant || reduced(), response: on ? 1.5 : 0.9 });
    }
    listen(btn, 'click', () => select(!st.selOn));
    function maybeAutoplay() {
      if (st.autoplayed || st.view !== 1 || !st.bInView || reduced()) return;
      st.autoplayed = true;
      const t = setTimeout(() => {
        if (destroyed) return;
        if (st.view === 1 && st.bInView) { if (!st.selOn) select(true, { quiet: true }); }
        else st.autoplayed = false;          // left before it played: try again next time
      }, 650);
      cleanup.push(() => clearTimeout(t));
    }
    function firstSeeB() {
      if (st.bSeen || reduced() || dbg.yaw !== undefined) return;
      st.bSeen = true;
      // A small settle reveals that the lattice is a 3D object.
      rot.x.set(rot.x.value - 0.38);
      rot.x.to(YAW0, { dampingRatio: 1, response: 1.3 });
    }

    // Lattice drag: 1:1 rotation, rubber-banded pitch, flick handoff.
    // Touch waits for a horizontal intent past the slop, so a vertical
    // page scroll that starts here never turns the lattice.
    const tx = new F.VelocityTracker(), ty = new F.VelocityTracker();
    const W_PITCH = (2 * Math.PI) / 0.55;
    let rdrag = null, rpend = null;
    function beginRot(id, x, y) {
      try { if (!viewB.hasPointerCapture(id)) viewB.setPointerCapture(id); } catch (_) { /* pointer already gone */ }
      rot.stop();
      rdrag = { id, x0: x, y0: y, yaw0: rot.x.value, pitch0: rot.y.value };
      tx.reset(); ty.reset(); tx.add(rdrag.yaw0); ty.add(rdrag.pitch0);
      viewB.classList.add('is-dragging');
    }
    listen(viewB, 'pointerdown', (e) => {
      if (e.button !== 0) return;
      if (e.pointerType === 'touch') { rpend = { id: e.pointerId, x0: e.clientX, y0: e.clientY }; return; }
      beginRot(e.pointerId, e.clientX, e.clientY);
    });
    listen(viewB, 'pointermove', (e) => {
      if (rpend && e.pointerId === rpend.id) {
        const dx = e.clientX - rpend.x0, dy = e.clientY - rpend.y0;
        if (Math.hypot(dx, dy) < SLOP) return;
        rpend = null;
        if (Math.abs(dx) > Math.abs(dy)) beginRot(e.pointerId, e.clientX, e.clientY);
        return;
      }
      if (!rdrag || e.pointerId !== rdrag.id) return;
      const yaw = rdrag.yaw0 + (e.clientX - rdrag.x0) * ROT_K;
      let p = rdrag.pitch0 + (e.clientY - rdrag.y0) * ROT_K;
      if (p > PITCH_HI) p = PITCH_HI + F.rubberband(p - PITCH_HI, 1);
      else if (p < PITCH_LO) p = PITCH_LO - F.rubberband(PITCH_LO - p, 1);
      tx.add(yaw); ty.add(p);
      rot.set(yaw, p);
    });
    const endRot = (e) => {
      if (rpend && e.pointerId === rpend.id) { rpend = null; return; }
      if (!rdrag || e.pointerId !== rdrag.id) return;
      rdrag = null;
      viewB.classList.remove('is-dragging');
      const yaw = rot.x.value, p = rot.y.value, pIn = F.clamp(p, PITCH_LO, PITCH_HI);
      if (reduced()) { rot.set(yaw, pIn); return; }
      if (e.type === 'pointercancel') {
        // The system took the gesture: settle where we are, no momentum.
        rot.x.to(yaw, { velocity: 0, dampingRatio: 1, response: 0.4 });
        rot.y.to(pIn, { velocity: 0, dampingRatio: 1, response: 0.4 });
        return;
      }
      // Yaw is free: a capped throw with a little life (ζ 0.8).
      const vx = F.clamp(tx.velocity(), -9, 9);
      rot.x.to(yaw + F.project(vx, 0.995), { velocity: vx, dampingRatio: 0.8, response: 0.55 });
      // Pitch is bounded: critically damped, aimed inside the limits, and
      // never thrown faster than it can stop — so it cannot cross a limit.
      let vy = F.clamp(ty.velocity(), -6, 6);
      const pT = F.clamp(p + F.project(vy, 0.995), PITCH_LO, PITCH_HI), d = pT - p;
      vy = d * vy > 0 ? Math.sign(vy) * Math.min(Math.abs(vy), W_PITCH * Math.abs(d)) : 0;
      rot.y.to(pT, { velocity: vy, dampingRatio: 1, response: 0.55 });
    };
    listen(viewB, 'pointerup', endRot);
    listen(viewB, 'pointercancel', endRot);
    listen(viewB, 'lostpointercapture', (e) => { if (e.target === viewB) endRot(e); });

    // ── Observers ─────────────────────────────────────────────
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.target === root) {
          const was = st.rootIn;
          st.rootIn = e.isIntersecting && e.intersectionRatio >= 0.25;
          if (st.rootIn && !st.introOn) { st.introOn = true; wake(); }
          else if (st.rootIn && !was) kick();         // came back: play it again
        }
        if (e.target === viewB) {
          st.bInView = e.isIntersecting && e.intersectionRatio >= 0.5;
          maybeAutoplay();
        }
      }
    }, { threshold: [0, 0.25, 0.5] });
    io.observe(root);
    io.observe(viewB);
    const onRM = () => {
      if (reduced()) {
        st.introOn = true; st.intro = 1;
        if (!st.selOn) select(true, { instant: true, quiet: true });
        mix.to(st.view, { instant: true }); segS.to(st.view, { instant: true });
        knobS.to(clamp01(knobS.target), { instant: true });
      }
      st.dirtyB = true; wake();
    };
    const rmq = matchMedia('(prefers-reduced-motion: reduce)');
    listen(rmq, 'change', onRM);
    listen(contrastMQ, 'change', () => { if (A) buildA(); st.dirtyB = true; wake(); });

    // ── Canvases (last, so everything above exists for onResize) ─
    K.canvas(viewA, { maxDpr: 2, onResize: (c) => { if (destroyed) return; A = c; buildA(); wake(); } });
    K.canvas(viewB, { maxDpr: 2, onResize: (c) => { if (destroyed) return; B = c; setupProj(); st.dirtyB = true; wake(); } });

    // Initial state.
    setView(st.view);
    applyMix(mix.value);
    segS.set(st.view);
    renderKnob(knobS.value);
    renderSel(sel.value);
    if (reduced() || dbg.sel !== undefined) {
      const on = dbg.sel !== undefined ? !!+dbg.sel : true;
      if (on) select(true, { instant: true, quiet: true });
      else st.autoplayed = true;
    }
    if (dbg.sel !== undefined && !reduced() && +dbg.sel > 0 && +dbg.sel < 1) sel.set(+dbg.sel);
    if (dbg.intro !== undefined && !reduced()) {
      st.introOn = true; st.intro = clamp01(+dbg.intro); st.frozen = true;
    }
    if (dbg.time !== undefined && !reduced() && G) {
      st.introOn = true; st.intro = 1; G.markers[0].t = 0;
      const n = Math.round(+dbg.time * 60);
      for (let i = 0; i < n; i++) advancePulse(1 / 60);
      st.frozen = true;
    }
    wake();

    return {
      setView: (i) => setView(i === 'pvt' || i === 1 ? 1 : 0),
      setVoltage: (v, o = {}) => knobS.to(clamp01(v), { instant: o.instant || reduced() }),
      select: (on, o) => select(on, o),
      get state() {
        return { view: st.view, mix: mix.value, voltage: st.v, delay: (T_DYN * dynFactor(st.v) + T_FIX) / MAX_DELAY, selection: sel.value, selected: st.selOn, yaw: rot.x.value, pitch: rot.y.value, running: loop.running, intro: st.intro, pulse: pulse.s / (G ? G.len : 1) };
      },
      destroy() {
        destroyed = true;
        loop.stop();
        [segS, mix, knobS, sel].forEach((s) => s.stop());
        rot.stop();
        if (pendingDraw) cancelAnimationFrame(pendingDraw);
        io.disconnect();
        sliderRO.disconnect();
        cleanup.forEach((f) => f());
        root.remove();
      },
    };
  }

  KVChipRegister();
  function KVChipRegister() { K.Tenstorrent = { mount }; }
})();
