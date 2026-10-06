// ─────────────────────────────────────────────────────────────
// All the smaller easter eggs + the `/` command palette.
//   • Command palette: synth · sta · pnr · tapeout · rtl · clock · power · route · konami · help
//   • Key-hint that fades in after 10s of idle
//   • Konami code → Vivado boot log in the terminal drawer
//   • Hover "3.93 GPA" → "STA: WNS +0.07ns" cycling stats
//   • Scroll to footer → fake Makefile target prints in
//   • Shift + wheel → film-grain + lens-flare overlay
//   • Idle 30s → graph forms "KV" in Manhattan routing
// ─────────────────────────────────────────────────────────────
(() => {
  // ═══ 1. COMMAND PALETTE (`/`) ════════════════════════════════
  const palette = document.createElement('div');
  palette.className = 'cmd-palette';
  palette.setAttribute('aria-hidden', 'true');
  palette.innerHTML = `
    <div class="cmd-card" role="dialog" aria-modal="true" aria-label="Command palette">
      <div class="cmd-head">
        <span class="cmd-prompt" aria-hidden="true">▸</span>
        <input class="cmd-input" aria-label="Command" autocomplete="off" spellcheck="false" placeholder="run command…  e.g. sta, tapeout, rtl, clock, power, route, help" />
        <span class="cmd-esc">ESC</span>
      </div>
      <ul class="cmd-list"></ul>
      <div class="cmd-foot">
        <span><kbd>↑↓</kbd> select</span>
        <span><kbd>↵</kbd> run</span>
        <span><kbd>/</kbd> open</span>
      </div>
    </div>
  `;
  document.body.appendChild(palette);

  const COMMANDS = [
    { id: 'synth',   name: 'synth',    desc: 'open the timing report drawer',           run: openTerminal },
    { id: 'sta',     name: 'sta',      desc: 'report_timing — alias for synth',         run: openTerminal },
    { id: 'tapeout', name: 'tapeout',  desc: 'collapse graph into die floorplan',       run: () => window.__triggerTapeout?.() },
    { id: 'pnr',     name: 'pnr',      desc: 'place & route — alias for tapeout',       run: () => window.__triggerTapeout?.() },
    { id: 'rtl',     name: 'rtl',      desc: 'flip graph edges to Manhattan routing',   run: () => window.__triggerRTL?.(3000) },
    { id: 'route',   name: 'route',    desc: 'longer Manhattan routing flash',          run: () => window.__triggerRTL?.(6000) },
    { id: 'clock',   name: 'clock',    desc: 'broadcast a clock pulse across the page', run: clockPulse },
    { id: 'power',   name: 'power',    desc: 'gold accents glow up for a beat',         run: powerSurge },
    { id: 'konami',  name: 'konami',   desc: 'vivado boot log',                         run: vivadoBoot },
    { id: 'help',    name: 'help',     desc: 'list all available commands',             run: () => { /* re-rendered below */ } },
  ];

  const cmdInput = palette.querySelector('.cmd-input');
  const cmdList  = palette.querySelector('.cmd-list');
  let cursor = 0;
  let returnFocus = null;
  // Hover only selects a row after the pointer has really moved since
  // the palette opened — a resting cursor must not steal the first
  // match (and with it, what Enter runs).
  let hoverArmed = false;

  function openPalette() {
    if (!palette.classList.contains('open')) returnFocus = document.activeElement;
    hoverArmed = false;
    palette.classList.add('open');
    palette.setAttribute('aria-hidden', 'false');
    cmdInput.value = '';
    cursor = 0;
    renderList('');
    cmdInput.focus({ preventScroll: true });
  }
  function closePalette() {
    palette.classList.remove('open');
    palette.setAttribute('aria-hidden', 'true');
    cmdInput.blur();
    // Give focus back to wherever the reader was.
    if (returnFocus && returnFocus !== document.body && document.contains(returnFocus)) {
      returnFocus.focus({ preventScroll: true });
    }
    returnFocus = null;
  }
  function renderList(filter) {
    const f = filter.trim().toLowerCase();
    const matches = COMMANDS.filter(c => !f || c.name.startsWith(f) || c.desc.includes(f));
    cmdList.innerHTML = matches.map((c, i) => `
      <li class="cmd-row ${i === cursor ? 'active' : ''}" data-id="${c.id}">
        <span class="cmd-row-name">${c.name}</span>
        <span class="cmd-row-desc">${c.desc}</span>
      </li>
    `).join('');
    cmdList._matches = matches;
    cmdList.querySelectorAll('.cmd-row').forEach((row, i) => {
      row.addEventListener('pointermove', () => {
        if (!hoverArmed || cursor === i) return;
        cursor = i; refresh();
      });
      row.addEventListener('click', () => fire(matches[i]));
    });
  }
  function refresh() {
    cmdList.querySelectorAll('.cmd-row').forEach((row, i) =>
      row.classList.toggle('active', i === cursor)
    );
  }
  function fire(c) {
    if (!c) return;
    closePalette();
    if (c.id === 'help') { setTimeout(openPalette, 60); return; }
    c.run();
  }

  cmdInput.addEventListener('input', () => { cursor = 0; renderList(cmdInput.value); });
  cmdInput.addEventListener('keydown', (e) => {
    const list = cmdList._matches || [];
    if (e.key === 'Escape') { closePalette(); }
    else if (e.key === 'ArrowDown') { cursor = (cursor + 1) % Math.max(list.length, 1); refresh(); e.preventDefault(); }
    else if (e.key === 'ArrowUp')   { cursor = (cursor - 1 + list.length) % Math.max(list.length, 1); refresh(); e.preventDefault(); }
    // Consume Enter: focus is handed back to the page inside fire(), and an
    // unconsumed Enter would land on (and click) whatever just got focus.
    else if (e.key === 'Enter')     { e.preventDefault(); fire(list[cursor]); }
    // A modal with one control: Tab stays on it.
    else if (e.key === 'Tab')       { e.preventDefault(); }
  });
  palette.addEventListener('pointermove', (e) => {
    if (e.movementX || e.movementY) hoverArmed = true;
  });

  // Click on the dimmed backdrop closes the palette.
  palette.addEventListener('click', (e) => { if (e.target === palette) closePalette(); });

  document.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) && document.activeElement !== cmdInput) return;
    // Don't stack the palette on top of an open project sheet.
    if (document.querySelector('.proj-detail.is-open')) return;
    if (e.key === '/' && !palette.classList.contains('open')) {
      e.preventDefault();
      openPalette();
    }
    if (e.key === 'Escape' && palette.classList.contains('open')) {
      closePalette();
    }
  });

  // ═══ 2. KEY HINT after 10s idle ═════════════════════════════
  const hint = document.createElement('div');
  hint.className = 'kv-hint';
  hint.innerHTML = `press <kbd>/</kbd> to run a command · try <kbd>synth</kbd> · <kbd>tapeout</kbd> · <kbd>rtl</kbd>`;
  document.body.appendChild(hint);
  let hintShown = false;
  let idleTimer = setTimeout(() => {
    if (!hintShown) { hint.classList.add('show'); hintShown = true; }
  }, 10000);
  ['mousemove','keydown','scroll','click'].forEach(ev =>
    addEventListener(ev, () => {
      if (hintShown) { hint.classList.remove('show'); }
    }, { passive: true })
  );

  // ═══ 3. KONAMI CODE → Vivado boot in terminal ═══════════════
  const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
  let konIdx = 0;
  addEventListener('keydown', (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === KONAMI[konIdx]) {
      konIdx++;
      if (konIdx === KONAMI.length) { konIdx = 0; vivadoBoot(); }
    } else {
      konIdx = (k === KONAMI[0]) ? 1 : 0;
    }
  });
  // An FPGA build log — Vivado makes bitstreams, not tapeouts, so the
  // joke stays technically honest. Lines fit 56 columns (phone width).
  function vivadoBoot() {
    const lines = [
      ['dim',  '> vivado -mode batch -source kv.tcl'],
      ['dim',  'Loading Vivado ...                                [OK]'],
      ['dim',  'Loading Tcl libraries ...                         [OK]'],
      ['dim',  ''],
      ['norm', '# ──────────────────────────────────────────────────'],
      ['norm', '# KV-01 · top.v · fpga build'],
      ['norm', '# ──────────────────────────────────────────────────'],
      ['dim',  ''],
      ['dim',  'synth_design -top top'],
      ['norm', '  INFO: [Synth 8-256] done synthesizing module top'],
      ['gold', '  ✓ synth_design complete'],
      ['dim',  ''],
      ['dim',  'opt_design · place_design · route_design'],
      ['norm', '  INFO: [Place 30-575] placement phase 1 complete'],
      ['norm', '  INFO: [Route 35-39] initial routing'],
      ['gold', '  ✓ route_design complete'],
      ['dim',  ''],
      ['dim',  'report_timing_summary'],
      ['norm', '  WNS  +0.074 ns    TNS  0.000 ns    WHS  +0.038 ns'],
      ['dim',  ''],
      ['dim',  'write_bitstream kv01.bit'],
      ['gold', '  ✓ Bitstream written. Timing met.'],
      ['dim',  '  (An FPGA build, not a tapeout. The ASIC work'],
      ['dim',  '   lives in Innovus.)'],
      ['dim',  ''],
      ['dim',  '> _'],
    ];
    window.openTerminal?.(lines, 70);
  }

  // ═══ 4. GPA hover → cycle of engineering stats ══════════════
  const gpaCell = [...document.querySelectorAll('.about-meta-row .v')]
    .find(el => /3\.9/.test(el.textContent));
  if (gpaCell) {
    const original = gpaCell.textContent;
    const cycle = [
      'STA: WNS +0.07ns',
      'SLACK: +0.07ns clean',
      'PPA: optimal',
      'DRC: 0 violations',
    ];
    let idx = 0, hovTimer;
    gpaCell.style.cursor = 'help';
    gpaCell.style.transition = 'color 0.2s';
    gpaCell.addEventListener('mouseenter', () => {
      idx = 0;
      gpaCell.style.color = 'var(--gold)';
      gpaCell.textContent = cycle[idx];
      hovTimer = setInterval(() => {
        idx = (idx + 1) % cycle.length;
        gpaCell.textContent = cycle[idx];
      }, 800);
    });
    gpaCell.addEventListener('mouseleave', () => {
      clearInterval(hovTimer);
      gpaCell.style.color = '';
      gpaCell.textContent = original;
    });
  }

  // ═══ 5. SCROLL-TO-FOOTER → Makefile prints ═════════════════
  const footer = document.querySelector('footer');
  if (footer) {
    const make = document.createElement('pre');
    make.className = 'makefile-egg';
    make.textContent = [
      '$ make portfolio',
      'cc -O3 -Wall portfolio.c -o portfolio',
      'building hero ........................... [OK]',
      'rendering graph backplane ............... [OK]',
      'embedding live demos .................... [OK]',
      'stamping easter eggs .................... [OK]',
      'linking ................................. [OK]',
      '',
      '# portfolio.elf  ready  ·  0 warnings  ·  ship it',
    ].join('\n');
    footer.appendChild(make);
    const io = new IntersectionObserver((es) => {
      for (const e of es) if (e.isIntersecting) { make.classList.add('show'); io.disconnect(); }
    }, { threshold: 0.3 });
    io.observe(footer);
  }

  // ═══ 6. SHIFT + WHEEL → grain + flare ═══════════════════════
  // Only an actual Shift-scroll triggers it: Shift on its own is part
  // of Shift+Tab and of typing capitals, and must never tint the page.
  // Skipped under reduced motion, and while typing in a field.
  const flare = document.createElement('div');
  flare.className = 'film-flare';
  flare.setAttribute('aria-hidden', 'true');
  flare.innerHTML = `<div class="film-grain"></div><div class="film-vignette"></div>`;
  document.body.appendChild(flare);
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  let flareOff = 0;
  const flareStop = () => { clearTimeout(flareOff); flare.classList.remove('on'); };
  addEventListener('wheel', (e) => {
    if (!e.shiftKey || motionQuery.matches) return;
    const a = document.activeElement;
    if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable)) return;
    if (palette.classList.contains('open')) return;
    flare.classList.add('on');
    clearTimeout(flareOff);
    flareOff = setTimeout(flareStop, 450);
  }, { passive: true });
  addEventListener('keyup', (e) => { if (e.key === 'Shift') flareStop(); });
  addEventListener('blur', flareStop);

  // ═══ 7. UTILITIES (clock + power) ═══════════════════════════
  function clockPulse() {
    document.body.classList.remove('kv-clock');
    void document.body.offsetWidth;
    document.body.classList.add('kv-clock');
    setTimeout(() => document.body.classList.remove('kv-clock'), 2400);
  }
  function powerSurge() {
    document.body.classList.remove('kv-power');
    void document.body.offsetWidth;
    document.body.classList.add('kv-power');
    setTimeout(() => document.body.classList.remove('kv-power'), 2000);
  }

  function openTerminal() {
    if (typeof window.openTerminal === 'function') window.openTerminal();
  }
})();
