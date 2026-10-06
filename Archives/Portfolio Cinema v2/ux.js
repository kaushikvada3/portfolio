// ─────────────────────────────────────────────────────────────
// UX layer: nav scroll edge, scroll reveals, experience
// disclosures, and the project detail lightbox.
//
// Motion is spring-driven, described the way Apple describes it:
// a damping ratio (1 = critically damped, no overshoot) and a
// response in seconds. Springs integrate from their live value and
// velocity, so every transition here can be interrupted and
// reversed mid-flight without a jump or a velocity brick-wall.
// Nothing on this page is a momentum gesture, so nothing bounces.
// ─────────────────────────────────────────────────────────────
(() => {
  'use strict';
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  let REDUCED = motionQuery.matches;
  motionQuery.addEventListener?.('change', (e) => { REDUCED = e.matches; });

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  // stiffness = (2π / response)², damping = 4π·ζ / response, mass = 1
  class Spring {
    constructor(value, { dampingRatio = 1, response = 0.4, precision = 0.001, onUpdate, onRest } = {}) {
      this.value = value;
      this.target = value;
      this.velocity = 0;
      this.dampingRatio = dampingRatio;
      this.response = response;
      this.precision = precision;
      this.onUpdate = onUpdate;
      this.onRest = onRest;
      this.raf = 0;
      this.last = 0;
      this.tick = this.tick.bind(this);
    }

    get animating() { return this.raf !== 0; }

    // Retarget from wherever the value is right now, keeping velocity.
    to(target, { response, dampingRatio, instant } = {}) {
      if (response !== undefined) this.response = response;
      if (dampingRatio !== undefined) this.dampingRatio = dampingRatio;
      this.target = target;
      if (instant) {
        this.stop();
        this.value = target;
        this.velocity = 0;
        this.onUpdate?.(target);
        this.onRest?.(target);
        return;
      }
      if (!this.raf) {
        this.last = performance.now();
        this.raf = requestAnimationFrame(this.tick);
      }
    }

    stop() {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }

    tick(now) {
      const dt = Math.min((now - this.last) / 1000, 1 / 20);
      this.last = now;
      const k = (2 * Math.PI / this.response) ** 2;
      const c = (4 * Math.PI * this.dampingRatio) / this.response;
      const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
      const h = dt / steps;
      for (let i = 0; i < steps; i++) {
        this.velocity += (-k * (this.value - this.target) - c * this.velocity) * h;
        this.value += this.velocity * h;
      }
      if (Math.abs(this.value - this.target) < this.precision &&
          Math.abs(this.velocity) < this.precision * 10) {
        this.value = this.target;
        this.velocity = 0;
        this.raf = 0;
        this.onUpdate?.(this.value);
        this.onRest?.(this.value);
        return;
      }
      this.onUpdate?.(this.value);
      this.raf = requestAnimationFrame(this.tick);
    }
  }

  // ═══ 1. Nav scroll edge ══════════════════════════════════════
  // The bar's material only appears once content is under it. A
  // sentinel at the top of the document flips the state — no
  // scroll handler on the main thread.
  const nav = document.querySelector('.nav');
  if (nav && 'IntersectionObserver' in window) {
    const sentinel = document.createElement('div');
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:56px;pointer-events:none;visibility:hidden;';
    document.body.prepend(sentinel);
    new IntersectionObserver(([entry]) => {
      nav.classList.toggle('is-scrolled', !entry.isIntersecting);
    }).observe(sentinel);
  }

  // The ambient graph is the hero's backdrop; once reading content
  // owns most of the viewport it steps back (CSS: .past-hero).
  const hero = document.querySelector('.hero');
  if (hero && 'IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      document.documentElement.classList.toggle('past-hero', entry.intersectionRatio < 0.4);
    }, { threshold: [0, 0.4, 1] }).observe(hero);
  }

  // ═══ 2. Scroll reveals ═══════════════════════════════════════
  // JS adds `.reveal`, so no-JS / reduced-motion readers always see
  // fully rendered content. Once an element has arrived the reveal
  // classes and stagger delay are stripped, so they never leak into
  // the element's own hover / press transitions.
  if (!REDUCED && 'IntersectionObserver' in window) {
    const SEL = '.sec-head, .chip-bay, .about-quote, .about-meta, ' +
                '.exp-item, .proj, .skill-card, ' +
                '.contact-headline, .contact-cta, .contact-foot';
    const targets = [...document.querySelectorAll(SEL)];

    const byParent = new Map();
    for (const el of targets) {
      const arr = byParent.get(el.parentElement) || [];
      arr.push(el);
      byParent.set(el.parentElement, arr);
    }
    const delays = new Map();
    for (const arr of byParent.values()) {
      arr.forEach((el, i) => delays.set(el, Math.min(i, 6) * 55));
    }

    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target;
        io.unobserve(el);
        el.classList.add('revealed');
        setTimeout(() => {
          el.classList.remove('reveal', 'revealed');
          el.style.transitionDelay = '';
        }, 720 + (delays.get(el) || 0));
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    for (const el of targets) {
      el.style.transitionDelay = delays.get(el) + 'ms';
      el.classList.add('reveal');
      io.observe(el);
    }
  }

  // ═══ 3. Experience disclosures ═══════════════════════════════
  // Each row is a <button aria-expanded>. Its panel grows out of the
  // row: height follows a critically damped spring, the content rides
  // down from under the row (hinting where it is going) and fades in
  // once there is room. Clicking again mid-flight reverses from the
  // height that is on screen right now, keeping the spring's velocity.
  for (const item of document.querySelectorAll('.exp-item')) {
    const btn = item.querySelector('.exp-row');
    const panel = item.querySelector('.exp-panel');
    const inner = panel?.querySelector('.exp-panel-inner');
    if (!btn || !panel || !inner) continue;

    let open = false;
    let contentH = 0;

    const paintPanel = (p) => {
      panel.style.height = (p * contentH).toFixed(2) + 'px';
      inner.style.opacity = clamp((p - 0.12) / 0.6, 0, 1).toFixed(3);
      inner.style.transform = `translateY(${((1 - p) * -14).toFixed(2)}px)`;
      item.style.setProperty('--p', p.toFixed(4));
    };

    const settlePanel = (p) => {
      if (p <= 0) {
        panel.setAttribute('hidden', 'until-found');
        inner.style.opacity = '';
      }
      // At rest the panel is height:auto again, so it reflows with
      // the viewport instead of holding a stale pixel height.
      panel.style.height = '';
      inner.style.transform = '';
    };

    const spring = new Spring(0, {
      dampingRatio: 1,
      response: 0.44,
      precision: 0.0015,
      onUpdate: paintPanel,
      onRest: settlePanel,
    });

    const setOpen = (next) => {
      if (next === open) return;
      open = next;
      btn.setAttribute('aria-expanded', String(open));
      item.classList.toggle('is-open', open);

      const wasHidden = panel.hasAttribute('hidden');
      panel.removeAttribute('hidden');
      contentH = inner.offsetHeight || 1;

      if (REDUCED) {
        // Cross-fade, no height travel.
        spring.stop();
        spring.value = spring.target = open ? 1 : 0;
        spring.velocity = 0;
        item.style.setProperty('--p', open ? '1' : '0');
        settlePanel(open ? 1 : 0);
        // WAAPI, not a CSS transition: the content was in a skipped
        // (hidden=until-found) subtree, so it has no before-change style
        // for a transition to start from.
        if (open) inner.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'linear' });
        return;
      }

      // Presentation value: the height actually on screen this frame.
      const live = wasHidden ? 0 : panel.getBoundingClientRect().height / contentH;
      spring.value = clamp(live, 0, 1);
      paintPanel(spring.value);
      spring.to(open ? 1 : 0, { response: open ? 0.44 : 0.36 });
    };

    btn.addEventListener('click', () => setOpen(!open));
    // Find-in-page lands inside a closed panel → open it.
    panel.addEventListener('beforematch', () => setOpen(true));
  }

  // ═══ 4. Project detail lightbox ══════════════════════════════
  const cards = [...document.querySelectorAll('.proj[data-project]')];
  if (!cards.length) return;

  // Built only from résumé facts.
  const DETAILS = {
    minigpu: {
      eyebrow: '03a · custom asic · in progress',
      title: 'MiniGPU-2',
      subtitle: 'A custom graphics accelerator ASIC.',
      body: [
        'A SystemVerilog graphics pipeline spanning vertex transformation and rasterization. I worked with a team on its RTL-to-gate synthesis in Synopsys Design Compiler and Cadence Genus.',
        'Now implementing floorplanning and place-and-route in Cadence Innovus on a SAED 32nm checkpoint, iterating on timing and congestion.',
        'Designed dual-clock asynchronous FIFOs with Gray-coded pointer synchronizers to carry data across clock domains.',
      ],
      specs: [
        ['Node', 'SAED 32nm'],
        ['P&amp;R', 'Cadence Innovus'],
        ['Synthesis', 'Synopsys DC · Cadence Genus'],
        ['RTL', 'SystemVerilog'],
        ['Pipeline', 'Vertex transformation · rasterization'],
        ['CDC', 'Dual-clock async FIFOs · Gray-coded pointers'],
        ['Started', 'Mar 2026'],
        ['Status', 'In progress'],
      ],
      links: [
        ['github profile', 'https://github.com/kaushikvada'],
      ],
    },
  };

  const overlay = document.createElement('div');
  overlay.className = 'proj-detail';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = `
    <div class="pd-scrim"></div>
    <div class="pd-card" role="dialog" aria-modal="true" aria-labelledby="pd-title">
      <div class="pd-inner">
        <button class="pd-close" type="button" aria-label="Close project detail">esc / close</button>
        <span class="pd-eyebrow"></span>
        <h3 class="pd-title" id="pd-title"></h3>
        <p class="pd-subtitle"></p>
        <div class="pd-body"></div>
        <div class="pd-spec"></div>
        <div class="pd-links"></div>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const scrim = overlay.querySelector('.pd-scrim');
  const sheet = overlay.querySelector('.pd-card');
  const inner = overlay.querySelector('.pd-inner');
  const closeBtn = overlay.querySelector('.pd-close');
  const radius = parseFloat(getComputedStyle(sheet).borderTopLeftRadius) || 22;

  let source = null;   // the card the sheet grew out of, and returns to
  let trigger = null;  // its details button — where focus goes back to
  let isOpen = false;
  let flip = null;     // card box relative to the sheet's resting box
  let filled = null;

  function fill(d) {
    if (filled === d) return;
    filled = d;
    overlay.querySelector('.pd-eyebrow').textContent = d.eyebrow;
    overlay.querySelector('.pd-title').textContent = d.title;
    overlay.querySelector('.pd-subtitle').textContent = d.subtitle;
    overlay.querySelector('.pd-body').innerHTML = d.body.map((p) => `<p>${p}</p>`).join('');
    overlay.querySelector('.pd-spec').innerHTML =
      d.specs.map(([k, v]) => `<span class="k">${k}</span><span class="v">${v}</span>`).join('');
    overlay.querySelector('.pd-links').innerHTML =
      d.links.map(([label, href]) =>
        `<a href="${href}" target="_blank" rel="noopener">${label} <svg class="icon" aria-hidden="true"><use href="#i-external"></use></svg></a>`).join('');
  }

  // FLIP: where the card sits, expressed as a transform of the sheet's
  // resting box. Re-measured on every open/close so a reversal always
  // aims at the card's current position.
  function measure() {
    sheet.style.transform = 'none';
    inner.style.transform = 'none';
    const t = sheet.getBoundingClientRect();
    const c = source.getBoundingClientRect();
    flip = {
      dx: c.left - t.left,
      dy: c.top - t.top,
      sx: c.width / t.width,
      sy: c.height / t.height,
    };
  }

  function paint(p) {
    // Only the scrim's opacity moves; its blur radius is constant (CSS).
    scrim.style.opacity = p.toFixed(3);
    if (REDUCED || !flip) {
      // Reduced motion: a plain cross-fade, no travel.
      sheet.style.transform = '';
      sheet.style.borderRadius = '';
      sheet.style.opacity = p.toFixed(3);
      inner.style.transform = '';
      inner.style.opacity = '';
      if (source) source.style.opacity = '';
      return;
    }
    const sx = lerp(flip.sx, 1, p);
    const sy = lerp(flip.sy, 1, p);
    sheet.style.transform =
      `translate(${lerp(flip.dx, 0, p).toFixed(2)}px, ${lerp(flip.dy, 0, p).toFixed(2)}px) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`;
    // Elliptical radii cancel the non-uniform scale: corners stay round.
    sheet.style.borderRadius = `${(radius / sx).toFixed(2)}px / ${(radius / sy).toFixed(2)}px`;
    // The card becomes the sheet: the surface materialises over it
    // while the card itself fades out, so there is never a second
    // copy of the card left behind. The sheet's content arrives while
    // the shape is still travelling, counter-scaled so it never
    // stretches — revealed by the growing edges, not faded onto a slab.
    sheet.style.opacity = clamp(p / 0.12, 0, 1).toFixed(3);
    if (source) source.style.opacity = (1 - clamp(p / 0.3, 0, 1)).toFixed(3);
    inner.style.opacity = clamp((p - 0.22) / 0.45, 0, 1).toFixed(3);
    inner.style.transform = `scale(${(1 / sx).toFixed(4)}, ${(1 / sy).toFixed(4)})`;
  }

  function settle(p) {
    sheet.style.transform = '';
    sheet.style.borderRadius = '';
    inner.style.transform = '';
    if (p <= 0) {
      overlay.classList.remove('is-visible', 'is-open');
      document.documentElement.style.overflow = '';
      sheet.style.opacity = '';
      inner.style.opacity = '';
      scrim.style.opacity = '';
      if (source) source.style.opacity = '';
      flip = null;
    }
  }

  const spring = new Spring(0, {
    dampingRatio: 1,
    response: 0.46,
    precision: 0.0008,
    onUpdate: paint,
    onRest: settle,
  });

  function openDetail(card) {
    const d = DETAILS[card.dataset.project];
    if (!d) return;
    fill(d);
    if (source && source !== card) source.style.opacity = '';
    source = card;
    trigger = card.querySelector('.proj-open');
    isOpen = true;
    if (!overlay.classList.contains('is-visible')) {
      document.documentElement.style.overflow = 'hidden';
      overlay.classList.add('is-visible');
    }
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    measure();
    paint(spring.value);          // continue from the live frame, no jump
    closeBtn.focus({ preventScroll: true });
    spring.to(1, { response: REDUCED ? 0.22 : 0.46 });
  }

  function closeDetail() {
    if (!isOpen) return;
    isOpen = false;
    // Pointer events drop immediately, so the card underneath can be
    // clicked again mid-flight to send the sheet straight back out.
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    if (source) {
      measure();
      paint(spring.value);
    }
    trigger?.focus({ preventScroll: true });
    spring.to(0, { response: REDUCED ? 0.2 : 0.38 });
  }

  // The card stays a semantic <article> (heading, description, tools
  // all readable in place). Its "details" <button> is the keyboard /
  // screen-reader control; pointer users can click anywhere on the
  // card. The button's click bubbles here too, so one handler serves
  // both.
  for (const card of cards) {
    if (!DETAILS[card.dataset.project]) continue;
    card.addEventListener('click', (e) => {
      // Don't hijack a text selection made inside the card.
      if (!e.target.closest('.proj-open') && String(getSelection?.() || '').length) return;
      openDetail(card);
    });
  }

  scrim.addEventListener('click', closeDetail);
  closeBtn.addEventListener('click', closeDetail);
  document.addEventListener('keydown', (e) => {
    if (!isOpen) return;
    if (e.key === 'Escape') { closeDetail(); return; }
    if (e.key !== 'Tab') return;
    // Keep focus inside the dialog while it is open.
    const focusable = [...sheet.querySelectorAll('a[href], button')];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  addEventListener('resize', () => { if (spring.animating && source) measure(); });
})();
