// ─────────────────────────────────────────────────────────────
// UX layer: scroll-reveal for sections + project detail lightbox.
// ─────────────────────────────────────────────────────────────
(() => {
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ═══ 1. Scroll reveals ═══════════════════════════════════════
  // JS adds the `.reveal` class so no-JS / reduced-motion users
  // always see fully-rendered content. Each element fades + rises
  // once as it enters the viewport; siblings stagger.
  if (!REDUCED && 'IntersectionObserver' in window) {
    const SEL = '.sec-head, .chip-bay, .about-quote, .about-meta, ' +
                '.exp-item, .proj, .skill-card, ' +
                '.contact-headline, .contact-cta, .contact-foot';
    const targets = [...document.querySelectorAll(SEL)];

    // Stagger siblings that share a parent.
    const byParent = new Map();
    for (const el of targets) {
      const arr = byParent.get(el.parentElement) || [];
      arr.push(el);
      byParent.set(el.parentElement, arr);
    }
    for (const arr of byParent.values()) {
      arr.forEach((el, i) => {
        el.style.transitionDelay = (Math.min(i, 6) * 55) + 'ms';
      });
    }

    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('revealed');
        io.unobserve(e.target);
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    for (const el of targets) {
      el.classList.add('reveal');
      io.observe(el);
    }
  }

  // ═══ 2. Project detail lightbox ══════════════════════════════
  const cards = [...document.querySelectorAll('.proj')];
  if (!cards.length) return;

  // Per-project content, keyed by a substring of the card's title.
  const DETAILS = {
    obsidian: {
      eyebrow: '03a · rtl → gdsii',
      title: 'Project Obsidian',
      subtitle: 'A 2D graphics accelerator, all the way to silicon.',
      body: [
        'A specialized Blitter that offloads pixel-copy from a custom Fantasy Console host CPU — a memory-mapped APB slave with on-chip SRAM, a dedicated compute engine, and a VGA scanner.',
        'Driven through the full Synopsys flow: RTL elaboration, synthesis in Design Compiler, place-and-route in Fusion Compiler, and timing closure — targeting clean DRC/LVS sign-off and an academic tapeout.',
      ],
      specs: [
        ['Bus', 'APB slave · memory-mapped'],
        ['Engine', 'Blitter · pixel-copy offload'],
        ['Memory', 'On-chip SRAM framebuffer'],
        ['Flow', 'RTL → synth → P&R → tapeout'],
        ['Tools', 'Synopsys DC · Fusion Compiler'],
        ['Status', 'In flight · sign-off pending'],
      ],
      links: [
        ['github', 'https://github.com/kaushikvada'],
      ],
    },
    cache: {
      eyebrow: '03b · verilog · vcs',
      title: 'Two-Level Cache',
      subtitle: 'A parameterized L1–L2 hierarchy, verified end-to-end.',
      body: [
        'Configurable L1–L2 RTL: parametric sets, ways, and line size, LRU replacement, write-back / write-allocate. Tag, data, and valid structures sit over a simple memory model that emulates main-memory latency.',
        'Validated in Synopsys VCS against crafted access traces — hit/miss counters and Verdi waveforms confirm LRU ordering and write policy hold across every configuration.',
      ],
      specs: [
        ['L1', 'Parametric sets / ways / line'],
        ['L2', 'Inclusive · LRU replacement'],
        ['Policy', 'Write-back · write-allocate'],
        ['Verify', 'Synopsys VCS · crafted traces'],
        ['Debug', 'Verdi waveforms · hit/miss counters'],
        ['Status', 'Complete'],
      ],
      links: [
        ['github', 'https://github.com/kaushikvada'],
        ['writeup .pdf', 'Two-Level%20Cache.pdf'],
      ],
    },
  };

  function detailFor(card) {
    const name = (card.querySelector('.proj-name')?.textContent || '').toLowerCase();
    if (name.includes('obsidian')) return DETAILS.obsidian;
    if (name.includes('cache')) return DETAILS.cache;
    return null;
  }

  // Build the overlay once.
  const overlay = document.createElement('div');
  overlay.className = 'proj-detail';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = `
    <div class="pd-card glass" role="dialog" aria-modal="true" aria-label="Project detail">
      <button class="pd-close" aria-label="Close">esc / close</button>
      <span class="pd-eyebrow"></span>
      <h3 class="pd-title"></h3>
      <p class="pd-subtitle"></p>
      <div class="pd-body"></div>
      <div class="pd-spec"></div>
      <div class="pd-links"></div>
    </div>`;
  document.body.appendChild(overlay);
  let lastFocus = null;

  function fill(d) {
    overlay.querySelector('.pd-eyebrow').textContent = d.eyebrow;
    overlay.querySelector('.pd-title').textContent = d.title;
    overlay.querySelector('.pd-subtitle').textContent = d.subtitle;
    overlay.querySelector('.pd-body').innerHTML =
      d.body.map(p => `<p>${p}</p>`).join('');
    overlay.querySelector('.pd-spec').innerHTML =
      d.specs.map(([k, v]) => `<span class="k">${k}</span><span class="v">${v}</span>`).join('');
    overlay.querySelector('.pd-links').innerHTML =
      d.links.map(([label, href]) =>
        `<a href="${href}" target="_blank" rel="noopener">${label} <svg class="icon" aria-hidden="true"><use href="#i-external"></use></svg></a>`).join('');
  }

  function openDetail(card) {
    const d = detailFor(card);
    if (!d) return;
    fill(d);
    // Centered modal — scales from its own center (Emil: modals are not
    // trigger-anchored, so center origin is correct, unlike popovers).
    lastFocus = card;
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    overlay.querySelector('.pd-close').focus();
  }

  function closeDetail() {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }

  cards.forEach(card => {
    if (!detailFor(card)) return;
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    const n = card.querySelector('.proj-name')?.textContent.trim();
    card.setAttribute('aria-label', `Open project detail: ${n}`);
    card.addEventListener('click', () => openDetail(card));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openDetail(card);
      }
    });
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeDetail();
  });
  overlay.querySelector('.pd-close').addEventListener('click', closeDetail);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) closeDetail();
  });
})();
