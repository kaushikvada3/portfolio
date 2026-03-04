// Profile Data
const profile = {
  name: "Kaushik Vada",
  title: "RTL & VLSI Engineer",
  summary: "Electrical Engineering student at UCR (GPA 3.93) specializing in VLSI, RTL design, and Computer Architecture. Experienced in SystemVerilog, FPGA prototyping, and ASIC verification flows.",
  contacts: {
    email: "kaushikvada3@gmail.com",
    phone: "858-305-8647",
    linkedin: "https://www.linkedin.com/in/kaushikv198",
    github: "https://github.com/kaushikvada3",
    resume: "assets/Kaushik_Vada_Resume.pdf"
  },
  skills: {
    languages: "Verilog, SystemVerilog, C/C++, Python, TCL, MATLAB, LaTeX",
    tools: "Synopsys Design Compiler, Synopsys VCS, Xilinx Vivado, Verdi, LTspice, Cadence Virtuoso",
    concepts: "RTL Design, Static Timing Analysis, Computer Architecture, Caches, RISC-V Architecture, Logic Synthesis",
    protocols: "UART, APB, Valid/Ready Handshake",
    os: "Unix/Linux, Windows"
  },
  education: {
    school: "University of California, Riverside",
    degree: "B.S. Electrical Engineering · Regents Distinguished Scholar",
    date: "Aug 2023 - May 2027",
    details: [
      "GPA: 3.93/4.00",
      "Relevant Coursework: Introduction to VLSI, Data Structures and Algorithms, Design and Architecture of Computer Systems, Machine Organization and Assembly Language, Digital Logic Design."
    ]
  },
  projects: [
    {
      id: "two-level-cache",
      year: "Verilog · Caches · Jan 2025 - Present",
      name: "Two-Level Cache RTL (L1/L2)",
      desc: "Designed a parameterizable two-level cache memory hierarchy (L1/L2) in SystemVerilog, implementing the MESI coherence protocol to ensure data consistency across multicore simulations. Architected for low-latency concurrent access.",
      bullets: [
        "Implemented configurable Verilog RTL for L1/L2 caches (parameterized sets, ways, and line sizes) with LRU replacement and write-back/write-allocate policies.",
        "Designed tag/data/valid arrays and a lightweight memory interface to emulate main-memory latency and hierarchy-level handshakes.",
        "Developed directed verification tests in Synopsys VCS to stress hit/miss paths, replacement behavior, and write-back/write-allocate flows.",
        "Debugged behavior using Verdi by instrumenting hit/miss counters, tracing tag/LRU updates, and inspecting waveforms across cache configurations.",
        "Analyzed timing and throughput trade-offs through parameter sweeps under varying associativities and line sizes."
      ]
    },
    {
      id: "risc-v-pipeline",
      year: "Verilog · FPGA · Jun 2025 - Present",
      name: "RISC-V Pipeline Modules",
      desc: "Implemented core RTL stages for a custom RISC-V soft-core processor on FPGA. Validated correctness via Vivado simulation and waveform analysis.",
      bullets: [
        "Implemented core RTL modules for a custom RISC-V processor on FPGA, including Instruction Fetch, Instruction Decode, and ALU stages.",
        "Simulated, debugged, and waveform-analyzed pipeline behavior using Xilinx Vivado.",
        "Collaborated with teammates integrating pipeline modules into a larger embedded vision system."
      ]
    },
    {
      id: "bms",
      year: "Embedded · BMS · Nov 2024 - Present",
      name: "Battery Management System",
      desc: "PCB-based energy monitor with embedded C/C++ firmware, wireless telemetry, and an iOS companion app.",
      bullets: [
        "Designing a custom PCB-based 10-cell Li-ion BMS with voltage, current, and temperature sensing for safe pack operation.",
        "Performing CAD modeling and thermal simulations to evaluate airflow, heat dissipation, and enclosure design for reliable cooling.",
        "Developing embedded C/C++ firmware for data acquisition, fan control, USB communication, and real-time safety protection.",
        "Validating hardware performance using oscilloscopes, multimeters, and thermistors to ensure accurate sensing and thermal response."
      ]
    }
  ],

  experience: [
    {
      company: "VSCLab @ UC Riverside",
      role: "Undergraduate Researcher",
      location: "Riverside, CA",
      time: "Sep 2025 - Present",
      bullets: [
        "Co-designing a custom RISC-V CPU core and practicing complete RTL-to-gate sign-off inside Synopsys flows.",
        "Learning constraint-driven synthesis, SDC authoring, and early optimization strategies for balanced PPA.",
        "Reviewing timing/power reports to optimize pipeline depth."
      ]
    },
    {
      company: "Digital Force Technologies",
      role: "Hardware Design Intern",
      location: "San Diego, CA",
      time: "Jun 2025 - Aug 2025",
      bullets: [
        "Implemented core RTL modules for a custom RISC-V processor on FPGA, including Instruction Fetch, Instruction Decode, and ALU stages.",
        "Verified module correctness through simulation, waveform inspection, and iterative debugging.",
        "Collaborated with engineers integrating processor components into a larger embedded vision system.",
        "Gained exposure to synthesis and EDA workflows used in industry RTL development environments."
      ]
    }
  ]
};

// Initialize Lenis with smoother settings
const lenis = new Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  direction: 'vertical',
  gestureDirection: 'vertical',
  smooth: true,
  mouseMultiplier: 1,
  smoothTouch: false,
  touchMultiplier: 2,
});

function raf(time) {
  lenis.raf(time);
  requestAnimationFrame(raf);
}

// GSAP ScrollTrigger integration with Lenis
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => {
  lenis.raf(time * 1000);
});
gsap.ticker.lagSmoothing(0);

requestAnimationFrame(raf);


// Render Functions for Crystal Glass Aesthetic
function renderProjects() {
  const list = document.getElementById('project-list');
  if (!list) return;

  list.innerHTML = '';

  profile.projects.forEach((p) => {
    const item = document.createElement('div');
    item.className = 'liquidGlass-wrapper project-card-glass';

    const bulletsHtml = p.bullets.map(b => `<li>${b}</li>`).join('');

    // Add "Click to explore" indicator for the Two-Level Cache project
    const isExpandable = p.id === 'two-level-cache';
    if (isExpandable) {
      item.classList.add('project-card-expandable');
    }

    const exploreHtml = isExpandable ? `
      <div class="explore-indicator">
        <span>Click to explore</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </div>
    ` : '';

    item.innerHTML = `
      <div class="liquidGlass-text">
        <div class="project-card-content">
          <span class="project-tech">${p.year}</span>
          <h3>${p.name}</h3>
          <ul>
            ${bulletsHtml}
          </ul>
          ${exploreHtml}
        </div>
      </div>
    `;

    if (isExpandable) {
      item.addEventListener('click', () => openCacheModal());
    }

    list.appendChild(item);
  });
}

// ─── Two-Level Cache Detail Modal ───

function getCacheDetailHTML() {
  return `
    <button class="modal-close-btn" aria-label="Close">&times;</button>

    <div class="modal-scroll-container" data-lenis-prevent>

      <!-- 3D Model Viewer -->
      <div class="modal-viewer-section">
        <div class="chip-viewer-container" id="chip-3d-container">
          <div class="chip-loading" id="chip-loading">Loading 3D model...</div>
        </div>
        <div class="viewer-hint">Drag to rotate &middot; Scroll to zoom &middot; Right-click to pan</div>
      </div>

      <!-- Project Header -->
      <div class="modal-header">
        <span class="project-tech">Verilog &middot; Caches &middot; Jan 2025</span>
        <h2>Two-Level Cache RTL (L1/L2)</h2>
        <p class="modal-subtitle">A fully synthesizable two-level cache memory system in Verilog, designed to bridge the speed gap between a fast processor and slow main memory — addressing the classic "memory wall" problem.</p>
      </div>

      <!-- Architecture Spec Cards -->
      <div class="spec-grid">
        <div class="spec-card">
          <div class="spec-label">L1 Cache</div>
          <div class="spec-value">4 KB</div>
          <div class="spec-detail">64 Sets &times; 4 Ways &times; 16B</div>
        </div>
        <div class="spec-card">
          <div class="spec-label">L2 Cache</div>
          <div class="spec-value">32 KB</div>
          <div class="spec-detail">128 Sets &times; 8 Ways &times; 32B</div>
        </div>
        <div class="spec-card">
          <div class="spec-label">L1 Associativity</div>
          <div class="spec-value">4-Way</div>
          <div class="spec-detail">Set-Associative</div>
        </div>
        <div class="spec-card">
          <div class="spec-label">L2 Associativity</div>
          <div class="spec-value">8-Way</div>
          <div class="spec-detail">Set-Associative</div>
        </div>
        <div class="spec-card">
          <div class="spec-label">Write Policy</div>
          <div class="spec-value">Write-Back</div>
          <div class="spec-detail">Write-Allocate</div>
        </div>
        <div class="spec-card">
          <div class="spec-label">Replacement</div>
          <div class="spec-value">LRU</div>
          <div class="spec-detail">Exact Matrix / Rank</div>
        </div>
      </div>

      <!-- Key Design Decisions -->
      <div class="detail-section">
        <h3>Key Design Decisions</h3>
        <div class="decision-item">
          <strong>Split L1/L2 Hierarchy</strong>
          <p>L1 is optimized for low-latency access (fast hit time), while L2 provides a larger backing store to minimize costly off-chip memory accesses. This separation balances speed and capacity.</p>
        </div>
        <div class="decision-item">
          <strong>Set-Associative Placement</strong>
          <p>4-way associativity for L1 and 8-way for L2 reduces conflict misses compared to direct-mapped caches while keeping hardware complexity manageable.</p>
        </div>
        <div class="decision-item">
          <strong>LRU Replacement Policy</strong>
          <p>Implemented using exact matrix or rank-based logic to maximize hit rates by retaining temporally local data. The accessed way becomes MRU (rank 0), and all others are incremented.</p>
        </div>
        <div class="decision-item">
          <strong>Write-Back with Write-Allocate</strong>
          <p>Reduces bus bandwidth by only writing dirty cache lines to the lower level upon eviction, rather than on every store operation (as in Write-Through).</p>
        </div>
        <div class="decision-item">
          <strong>Blocking Cache Behavior</strong>
          <p>The CPU stalls on an L1 miss until the line is fully refilled. Backpressure naturally propagates: if Memory is busy, L2 waits, so L1 waits, stalling the CPU.</p>
        </div>
      </div>

      <!-- FSM Control Flow -->
      <div class="detail-section">
        <h3>FSM Control Flow</h3>
        <p>The cache controller transitions through these states to resolve hits and misses:</p>
        <div class="fsm-flow">
          <span class="fsm-state">IDLE</span>
          <span class="fsm-arrow">&rarr;</span>
          <span class="fsm-state">CHECK_HIT</span>
          <span class="fsm-arrow">&rarr;</span>
          <span class="fsm-state fsm-branch">Hit?</span>
        </div>
        <div class="fsm-flow" style="margin-left: 1rem;">
          <span class="fsm-arrow">Yes &rarr;</span>
          <span class="fsm-state">UPDATE_LRU</span>
          <span class="fsm-arrow">&rarr;</span>
          <span class="fsm-state">Ready</span>
        </div>
        <div class="fsm-flow" style="margin-left: 1rem;">
          <span class="fsm-arrow">No &rarr;</span>
          <span class="fsm-state">MISS_SELECT</span>
          <span class="fsm-arrow">&rarr;</span>
          <span class="fsm-state">WRITEBACK?</span>
          <span class="fsm-arrow">&rarr;</span>
          <span class="fsm-state">MEM_READ</span>
          <span class="fsm-arrow">&rarr;</span>
          <span class="fsm-state">REFILL</span>
          <span class="fsm-arrow">&rarr;</span>
          <span class="fsm-state">UPDATE_LRU</span>
        </div>
        <ul style="margin-top: 1rem;">
          <li><strong>MISS_SELECT:</strong> Scans <code>lru_array</code> to find the LRU victim way.</li>
          <li><strong>MISS_WRITEBACK:</strong> If the victim is dirty, writes it back to L2 before fetching new data.</li>
          <li><strong>MISS_MEM_READ:</strong> Requests the missing line from L2 (or main memory).</li>
          <li><strong>REFILL:</strong> Captures incoming data, updates tag/valid, clears the dirty bit.</li>
          <li><strong>UPDATE_LRU:</strong> Promotes the accessed way to MRU. For write-miss (Write-Allocate), the pending write is performed here.</li>
        </ul>
      </div>

      <!-- Address Decomposition -->
      <div class="detail-section">
        <h3>Address Decomposition</h3>
        <p>The 32-bit physical address is decomposed differently for each cache level:</p>
        <div class="addr-table-wrapper">
          <table class="addr-table">
            <thead>
              <tr><th>Field</th><th>L1 Bits</th><th>L2 Bits</th><th>Purpose</th></tr>
            </thead>
            <tbody>
              <tr><td>Offset</td><td>[3:0]</td><td>[4:0]</td><td>Byte select within cache line</td></tr>
              <tr><td>Index</td><td>[9:4]</td><td>[11:5]</td><td>Set selection</td></tr>
              <tr><td>Tag</td><td>[31:10]</td><td>[31:12]</td><td>Unique identifier for hit/miss</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Performance -->
      <div class="detail-section">
        <h3>Performance Analysis</h3>
        <div class="perf-grid">
          <div class="perf-item">
            <div class="perf-label">L1 Hit</div>
            <div class="perf-value">~2 cycles</div>
            <div class="perf-desc">1 cycle Req + Tag Check, 1 cycle Data availability</div>
          </div>
          <div class="perf-item">
            <div class="perf-label">L1 Miss / L2 Hit</div>
            <div class="perf-value">~6-8 cycles</div>
            <div class="perf-desc">L1 latency + L2 latency (~3 cycles) + transfer</div>
          </div>
          <div class="perf-item">
            <div class="perf-label">L2 Miss / Mem</div>
            <div class="perf-value">~15+ cycles</div>
            <div class="perf-desc">Full hierarchy traversal + 5-cycle memory latency</div>
          </div>
        </div>
        <p style="margin-top: 1rem;">The critical timing path is <strong>Tag Comparison</strong>: reading tags from registers and comparing against the input address in a single cycle limits frequency. In high-speed designs, tag access and comparison would be pipelined across multiple stages.</p>
      </div>

      <!-- System Integration -->
      <div class="detail-section">
        <h3>System Integration</h3>
        <p>The <code>system_top.v</code> module wires the complete hierarchy using a valid/ready handshake protocol:</p>
        <div class="fsm-flow" style="margin: 1rem 0;">
          <span class="fsm-state">CPU Stub</span>
          <span class="fsm-arrow">&rarr;</span>
          <span class="fsm-state">L1 Cache</span>
          <span class="fsm-arrow">&rarr;</span>
          <span class="fsm-state">L2 Cache</span>
          <span class="fsm-arrow">&rarr;</span>
          <span class="fsm-state">Memory Model</span>
        </div>
        <ul>
          <li>Synchronous global reset initializes all FSMs to IDLE and clears latency counters.</li>
          <li>L2 simulates additional latency with a 2-cycle delay counter in CHECK_HIT.</li>
          <li>The memory model mandates a 5-cycle wait for every access, modeling off-chip DRAM latency.</li>
        </ul>
      </div>

      <!-- Verification -->
      <div class="detail-section">
        <h3>Verification Strategy</h3>
        <div class="decision-item">
          <strong>L1 Unit Testbench (tb_cache_l1.v)</strong>
          <p>Validates L1 in isolation — cold miss (write to empty cache), read hit (verifying data retention and tag match), with mock memory manually asserting mem_ready to simulate L2 responses.</p>
        </div>
        <div class="decision-item">
          <strong>Full System Testbench (tb_system.v)</strong>
          <p>End-to-end simulation via cpu_stub running traffic patterns: Write 0x1000 (Miss + Alloc), Read 0x1000 (Hit), Write 0x2000 (potential conflict if mapped to the same set), and data integrity verification.</p>
        </div>
        <div class="decision-item">
          <strong>Tools</strong>
          <p>Developed directed verification tests in Synopsys VCS to stress hit/miss paths. Debugged behavior using Verdi by instrumenting hit/miss counters, tracing tag/LRU updates, and inspecting waveforms.</p>
        </div>
      </div>

      <!-- Synthesis -->
      <div class="detail-section">
        <h3>Synthesis Considerations</h3>
        <p>The logic for tag comparison, LRU updates, and FSM control is <strong>fully synthesizable</strong>. The storage arrays (Data/Tag RAMs) are modeled as registers for simulation but would map to <strong>SRAM hard macros</strong> in a production physical design flow. Parameter sweeps under varying associativities and line sizes were used to analyze timing and throughput trade-offs.</p>
      </div>

    </div>
  `;
}

function openCacheModal() {
  // Prevent background scroll
  if (typeof lenis !== 'undefined') lenis.stop();

  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'project-modal-overlay';
  overlay.id = 'cache-modal';

  const modal = document.createElement('div');
  modal.className = 'project-modal liquidGlass-wrapper';
  modal.innerHTML = getCacheDetailHTML();
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Animate in
  requestAnimationFrame(() => {
    overlay.classList.add('active');
  });

  // Init 3D viewer — model is pre-cached, so this is instant
  const container = document.getElementById('chip-3d-container');
  if (container && window.ChipViewer) {
    window.ChipViewer.init(container);
  }

  // Close handlers
  const closeBtn = modal.querySelector('.modal-close-btn');
  closeBtn.addEventListener('click', closeCacheModal);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeCacheModal();
  });

  document.addEventListener('keydown', handleModalEsc);
}

function closeCacheModal() {
  const overlay = document.getElementById('cache-modal');
  if (!overlay) return;

  overlay.classList.remove('active');

  // Dispose 3D viewer
  if (window.ChipViewer) {
    window.ChipViewer.dispose();
  }

  // Remove after animation
  setTimeout(() => {
    overlay.remove();
  }, 400);

  // Resume background scroll
  if (typeof lenis !== 'undefined') lenis.start();

  document.removeEventListener('keydown', handleModalEsc);
}

function handleModalEsc(e) {
  if (e.key === 'Escape') closeCacheModal();
}

function renderExperience() {
  const list = document.getElementById('exp-list');
  if (!list) return;

  list.innerHTML = '';

  profile.experience.forEach((e) => {
    const item = document.createElement('div');
    item.className = 'liquidGlass-wrapper exp-item-glass';

    const bulletsHtml = e.bullets.map(b => `<li>${b}</li>`).join('');

    item.innerHTML = `
      <div class="liquidGlass-text">
        <div class="exp-item-content">
          <h4>${e.role}</h4>
          <div class="exp-company">${e.company} · ${e.location}</div>
          <div class="exp-date">${e.time}</div>
          <ul>
            ${bulletsHtml}
          </ul>
        </div>
      </div>
    `;
    list.appendChild(item);
  });
}

function renderSkills() {
  const grid = document.querySelector('.skills-grid');
  if (!grid) return;

  grid.innerHTML = '';

  // Map friendly names for keys
  const titles = {
    languages: "Programming Languages",
    tools: "Tools",
    concepts: "Concepts",
    protocols: "Protocols",
    os: "OS/Environment"
  };

  for (const [key, value] of Object.entries(profile.skills)) {
    const item = document.createElement('div');
    item.className = 'liquidGlass-wrapper skills-card-glass';

    item.innerHTML = `
        <div class="liquidGlass-text">
          <div class="skills-card-content">
            <h3>${titles[key] || key}</h3>
            <p>${value}</p>
          </div>
        </div>
      `;
    grid.appendChild(item);
  }
}

function renderEducation() {
  const list = document.getElementById('education-list');
  if (!list) return;

  list.innerHTML = '';

  const e = profile.education;
  const item = document.createElement('div');
  item.className = 'liquidGlass-wrapper exp-item-glass';

  const detailsHtml = e.details.map(d => `<li>${d}</li>`).join('');

  item.innerHTML = `
      <div class="liquidGlass-text">
        <div class="exp-item-content">
          <h4>${e.school}</h4>
          <div class="exp-company">${e.degree}</div>
          <div class="exp-date">${e.date}</div>
          <ul>
            ${detailsHtml}
          </ul>
        </div>
      </div>
    `;
  list.appendChild(item);
}


// Liquid Glass Hover Effects
function initHoverEffects() {
  document.querySelectorAll('.liquidGlass-wrapper').forEach(glass => {
    glass.addEventListener('mouseenter', () => {
      gsap.to(glass, {
        scale: 1.02,
        duration: 0.4,
        ease: "power2.out"
      });
    });

    glass.addEventListener('mouseleave', () => {
      gsap.to(glass, {
        scale: 1,
        duration: 0.4,
        ease: "power2.out"
      });
    });
  });
}

// Init Content
document.addEventListener("DOMContentLoaded", () => {

  // Load Displacement Map for Crystal Glass Filter
  const glassImage = document.getElementById('glass-map-image');
  if (glassImage) glassImage.setAttribute('href', 'assets/glass-map.png');

  // Ensure Lenis is running
  requestAnimationFrame(raf);

  // Render all content immediately (during preload = no jank)
  renderProjects();
  renderExperience();
  renderSkills();
  renderEducation();

  if (window.feather) feather.replace();

  initHoverEffects();

  // ── GSAP Plugin setup ──────────────────────────────────────────────────
  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);

    // Dual-orb parallax — both orbs scroll at different rates/directions
    gsap.to(".orb-1", {
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 1.4 },
      y: 180, x: 60, scale: 1.25
    });
    gsap.to(".orb-2", {
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 1.8 },
      y: -120, x: -80, scale: 0.85
    });

    // ── Stat counter animation ───────────────────────────────────────────
    document.querySelectorAll('.stat-number').forEach(el => {
      const target = parseFloat(el.dataset.target);
      const decimals = parseInt(el.dataset.decimals || '0');
      const suffix = el.dataset.suffix || '';

      const obj = { val: 0 };
      gsap.to(obj, {
        val: target,
        duration: 1.8,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 88%',
          once: true,
        },
        onUpdate() {
          el.textContent = obj.val.toFixed(decimals) + suffix;
        },
        onComplete() {
          el.textContent = target.toFixed(decimals) + suffix;
        },
      });
    });
  }

  // ── Scroll reveal (IntersectionObserver) ───────────────────────────────
  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.reveal-item').forEach(el => revealObs.observe(el));

  // ── Preloader dismiss ───────────────────────────────────────────────
  function dismissPreloader() {
    const preloader = document.getElementById('preloader');
    if (!preloader) { document.body.classList.remove('is-loading'); return; }
    preloader.classList.add('done');
    setTimeout(() => {
      preloader.style.display = 'none';
      document.body.classList.remove('is-loading');
      // Fire hero title reveal after preloader gone
      runHeroReveal();
    }, 650);
  }

  // ── Hero title reveal (whole-title fade+slide) ──────────────────────────
  // Note: background-clip:text gradient breaks with display:inline-block char
  // spans, so we animate the whole h1 instead — still looks premium.
  function prepareHeroReveal() {
    if (window.gsap) {
      gsap.set('#hero-title', { y: 40, opacity: 0 });
      gsap.set('.hero-sub, .hero-scholar, .hero-meta', { y: 24, opacity: 0 });
    }
  }

  function runHeroReveal() {
    if (window.gsap) {
      gsap.to('#hero-title', {
        y: 0, opacity: 1,
        duration: 1.1,
        ease: 'power4.out',
      });
      gsap.to('.hero-sub, .hero-scholar, .hero-meta', {
        y: 0, opacity: 1,
        duration: 0.8,
        ease: 'power3.out',
        stagger: 0.12,
        delay: 0.45,
      });
    } else {
      ['#hero-title', '.hero-sub', '.hero-scholar', '.hero-meta'].forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';
        });
      });
    }
  }

  prepareHeroReveal();



  // ── Model-gated reveal ─────────────────────────────────────────────
  function waitForModel() {
    let dismissed = false;
    function reveal() {
      if (dismissed) return;
      dismissed = true;
      dismissPreloader();
    }

    const safetyTimer = setTimeout(reveal, 8000);

    function tryHook() {
      if (window.ChipViewer && typeof window.ChipViewer.onReady === 'function') {
        window.ChipViewer.onReady(() => {
          clearTimeout(safetyTimer);
          reveal();
        });
      } else {
        setTimeout(tryHook, 50);
      }
    }
    tryHook();
  }

  waitForModel();
});


