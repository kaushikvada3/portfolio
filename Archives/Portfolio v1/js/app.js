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

const teardownLayerInfo = [
  {
    tag: 'M1',
    name: 'Metal 1 - Local Interconnect',
    desc: 'The lowest level of horizontal metal wiring, used for dense local connections right above the transistors.',
  },
  {
    tag: 'M2',
    name: 'Metal 2 - Routing Layer',
    desc: 'The second tier of horizontal metal wiring.',
  },
  {
    tag: 'M3',
    name: 'Metal 3 - Routing Layer',
    desc: 'The third tier of horizontal metal wiring.',
  },
  {
    tag: 'M4',
    name: 'Metal 4 - Routing Layer',
    desc: 'The fourth tier of horizontal metal wiring.',
  },
  {
    tag: 'M5',
    name: 'Metal 5 - Medium-Distance Signal Routing',
    desc: 'The fifth tier of horizontal metal wiring, typically used for medium-distance signal routing.',
  },
  {
    tag: 'M6',
    name: 'Metal 6 - Upper Routing Layer',
    desc: 'The sixth tier of horizontal metal wiring.',
  },
  {
    tag: 'M7',
    name: 'Metal 7 - Power and Clock Distribution',
    desc: 'The seventh tier of horizontal metal wiring, usually thicker for broader power distribution or clock signals.',
  },
  {
    tag: 'M8',
    name: 'Metal 8 - Global Routing and Power Grid',
    desc: 'The eighth and highest tier of horizontal metal wiring in this stack, handling critical global routing and power grids.',
  },
  {
    tag: 'POLY',
    name: 'Polysilicon Gate Layer',
    desc: 'The polysilicon layer. Physically this sits below metal1 and forms the transistor gates that do the actual compute work.',
  },
  {
    tag: 'V1',
    name: 'Via 1 - M1 to M2',
    desc: 'Vertical pillars that connect the metal1 layer up to the metal2 layer.',
  },
  {
    tag: 'V2',
    name: 'Via 2 - M2 to M3',
    desc: 'Vertical pillars that connect metal2 up to metal3.',
  },
  {
    tag: 'V3',
    name: 'Via 3 - M3 to M4',
    desc: 'Vertical pillars that connect metal3 up to metal4.',
  },
  {
    tag: 'V4',
    name: 'Via 4 - M4 to M5',
    desc: 'Vertical pillars that connect metal4 up to metal5.',
  },
  {
    tag: 'V5',
    name: 'Via 5 - M5 to M6',
    desc: 'Vertical pillars that connect metal5 up to metal6.',
  },
  {
    tag: 'V6',
    name: 'Via 6 - M6 to M7',
    desc: 'Vertical pillars that connect metal6 up to metal7.',
  },
  {
    tag: 'V7',
    name: 'Via 7 - M7 to M8',
    desc: 'Vertical pillars that connect metal7 up to metal8.',
  },
  {
    tag: 'V8',
    name: 'Via 8 - Top Metal to External Pads',
    desc: 'Topmost vertical connections, typically leading up from metal8 to external bumps or pads.',
  },
];

function renderTeardownLabels() {
  return teardownLayerInfo.map((layer) => `
    <div class="teardown-label">
      <span class="teardown-tag">${layer.tag}</span>
      <h3 class="teardown-name">${layer.name}</h3>
      <p class="teardown-desc">${layer.desc}</p>
    </div>
  `).join('');
}

function detectPerfMode() {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lowMemory = typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 4;
  const lowCpu = typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4;
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const saveData = !!(connection && connection.saveData);
  const slowNetwork = !!(connection && typeof connection.effectiveType === 'string' &&
    /(^2g$|^slow-2g$|^3g$)/i.test(connection.effectiveType));
  return (reducedMotion || lowMemory || lowCpu || saveData || slowNetwork) ? 'lite' : 'full';
}

const perfMode = detectPerfMode();
document.body.dataset.perfMode = perfMode;
const isLiteMode = perfMode === 'lite';
const networkConnection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

let lenis = null;

if (!isLiteMode && typeof Lenis !== 'undefined') {
  lenis = new Lenis({
    duration: 0.92,
    easing: (t) => 1 - Math.pow(1 - t, 3.25),
    direction: 'vertical',
    gestureDirection: 'vertical',
    smooth: true,
    mouseMultiplier: 0.95,
    smoothTouch: false,
    touchMultiplier: 1.2,
  });
  window.lenis = lenis;

  let stUpdateQueued = false;
  lenis.on('scroll', () => {
    if (!window.ScrollTrigger || stUpdateQueued) return;
    stUpdateQueued = true;
    requestAnimationFrame(() => {
      ScrollTrigger.update();
      stUpdateQueued = false;
    });
  });

  function lenisRaf(time) {
    if (!lenis) return;
    lenis.raf(time);
    requestAnimationFrame(lenisRaf);
  }
  requestAnimationFrame(lenisRaf);
} else {
  window.lenis = null;
}

let teardownModulePromise = null;
let teardownModule = null;
let teardownPreloadPromise = null;
let teardownPreloadScheduled = false;
let teardownPreloadStarted = false;
let modalStylesPromise = null;
let activeModalToken = 0;
const TEARDOWN_MODULE_VERSION = '20260305-4';

function shouldSkipBackgroundTeardownPreload() {
  const saveData = !!(networkConnection && networkConnection.saveData);
  const slowNetwork = !!(
    networkConnection &&
    typeof networkConnection.effectiveType === 'string' &&
    /(^2g$|^slow-2g$|^3g$)/i.test(networkConnection.effectiveType)
  );
  return isLiteMode || saveData || slowNetwork;
}

function ensureModalStylesLoaded() {
  if (modalStylesPromise) return modalStylesPromise;

  const existingStylesheet = document.querySelector('link[data-modal-styles="teardown"]');
  if (existingStylesheet) {
    modalStylesPromise = Promise.resolve(true);
    return modalStylesPromise;
  }

  modalStylesPromise = new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'src/styles/modal-teardown.css';
    link.dataset.modalStyles = 'teardown';
    link.onload = () => resolve(true);
    link.onerror = (err) => {
      modalStylesPromise = null;
      reject(err);
    };
    document.head.appendChild(link);
  });

  return modalStylesPromise;
}

function loadTeardownModule() {
  if (teardownModulePromise) return teardownModulePromise;
  teardownModulePromise = import(`./chip-teardown.js?v=${TEARDOWN_MODULE_VERSION}`).then((mod) => {
    teardownModule = mod;
    return mod;
  }).catch((err) => {
    teardownModulePromise = null;
    throw err;
  });
  return teardownModulePromise;
}

function startTeardownPreload() {
  if (teardownPreloadPromise) return teardownPreloadPromise;
  teardownPreloadPromise = loadTeardownModule()
    .then((mod) => {
      if (typeof mod.preloadChipTeardown !== 'function') return false;
      return mod.preloadChipTeardown();
    })
    .catch((err) => {
      console.error('[teardown] background preload failed:', err);
      return false;
    });
  return teardownPreloadPromise;
}

function runTeardownPreload(force = false) {
  if (teardownPreloadStarted) return;
  if (!force && shouldSkipBackgroundTeardownPreload()) return;
  teardownPreloadStarted = true;
  ensureModalStylesLoaded().catch(() => false);
  startTeardownPreload().catch(() => false);
}

function scheduleTeardownPreload(force = false) {
  if (force) {
    runTeardownPreload(true);
    return;
  }
  if (teardownPreloadScheduled) return;
  teardownPreloadScheduled = true;

  const idleTask = () => runTeardownPreload(false);
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(idleTask, { timeout: 2500 });
  } else {
    setTimeout(idleTask, 800);
  }
}




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
      const warmTeardown = () => {
        scheduleTeardownPreload(true);
      };

      item.addEventListener('click', () => openCacheModal());
      item.addEventListener('pointerenter', warmTeardown, { passive: true, once: true });
      item.addEventListener('focusin', warmTeardown, { once: true });
      item.addEventListener('touchstart', warmTeardown, { passive: true, once: true });
    }

    list.appendChild(item);
  });
}

// ─── Two-Level Cache Detail Modal ───

function getCacheDetailHTML() {
  return `
    <button class="modal-close-btn" aria-label="Close">&times;</button>

    <div class="modal-scroll-container" data-lenis-prevent>

      <!-- 3D Scrollytelling Container -->
      <div class="modal-viewer-section">
        <div class="chip-viewer-container" id="modal-model-target">
          <div class="chip-loading" id="teardown-loading">Loading 3D teardown...</div>
          <div class="teardown-intro" id="teardown-intro">
            <span class="teardown-intro-tag">Interactive Teardown</span>
            <h3 class="teardown-intro-title">Two-Level Cache Layer Walkthrough</h3>
            <p class="teardown-intro-hint">Scroll to peel through the stack.</p>
          </div>
          <button
            class="teardown-scroll-indicator"
            id="teardown-scroll-indicator"
            type="button"
            aria-label="Scroll down to explore teardown layers"
          >
            <span class="teardown-scroll-copy">
              <strong>Scroll to Explore</strong>
              <em>Layers unlock as you move</em>
            </span>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <!-- Text labels — BEHIND the transparent Three.js canvas (z-index: 1) -->
          <div class="teardown-labels">
            ${renderTeardownLabels()}
          </div>
          <!-- Three.js <canvas> is appended here by chip-teardown.js (z-index: 2) -->
        </div>
      </div>

      <!-- Scroll spacer — drives the GSAP ScrollTrigger timeline (invisible) -->
      <div id="teardown-spacer" class="teardown-scroll-spacer"></div>

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

async function openCacheModal() {
  scheduleTeardownPreload(true);
  try {
    await ensureModalStylesLoaded();
  } catch (err) {
    console.warn('[cache-modal] modal stylesheet failed to load', err);
  }

  // Prevent background scroll
  if (lenis) lenis.stop();
  activeModalToken += 1;
  const modalToken = activeModalToken;

  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'project-modal-overlay';
  overlay.id = 'cache-modal';

  const modal = document.createElement('div');
  modal.className = 'project-modal liquidGlass-wrapper';
  modal.innerHTML = getCacheDetailHTML();
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  const loadingEl = modal.querySelector('#teardown-loading');
  const modalScroller = modal.querySelector('.modal-scroll-container');
  const introEl = modal.querySelector('#teardown-intro');
  const teardownScrollIndicator = modal.querySelector('#teardown-scroll-indicator');
  if (modalScroller) modalScroller.scrollTop = 0;

  // Animate in
  requestAnimationFrame(() => {
    overlay.classList.add('active');
  });

  let introHidden = false;
  function hideTeardownIntro() {
    if (introHidden) return;
    introHidden = true;
    if (introEl) introEl.classList.add('is-hidden');
    if (teardownScrollIndicator) teardownScrollIndicator.classList.add('is-hidden');
    if (modalScroller) modalScroller.removeEventListener('scroll', onIntroScroll);
  }

  function onIntroScroll() {
    if (!modalScroller) return;
    if (modalScroller.scrollTop > 36) hideTeardownIntro();
  }

  if (modalScroller) {
    if (modalScroller.scrollTop > 36) hideTeardownIntro();
    else modalScroller.addEventListener('scroll', onIntroScroll, { passive: true });
  }

  if (teardownScrollIndicator && modalScroller) {
    teardownScrollIndicator.addEventListener('click', (e) => {
      e.preventDefault();
      hideTeardownIntro();
      const step = Math.max(220, Math.round(modalScroller.clientHeight * 0.68));
      const targetTop = Math.min(modalScroller.scrollHeight - modalScroller.clientHeight, step);
      modalScroller.scrollTo({ top: targetTop, behavior: 'smooth' });
    });
  }

  // Startup preload should already be in-flight; this keeps modal-open robust.
  if (loadingEl) {
    loadingEl.classList.remove('is-hidden');
    loadingEl.textContent = 'Loading 3D teardown...';
  }
  let loadedTeardownModule = null;
  loadTeardownModule()
    .then((mod) => {
      loadedTeardownModule = mod;
      if (modalToken !== activeModalToken || !document.body.contains(overlay)) return false;
      return mod.initChipTeardown(modal);
    })
    .then((ready) => {
      if (!loadingEl || ready === undefined) return;
      if (modalToken !== activeModalToken || !document.body.contains(overlay)) return;
      if (ready) {
        loadingEl.classList.add('is-hidden');
      } else {
        const loadDetail = loadedTeardownModule && typeof loadedTeardownModule.getLastTeardownError === 'function'
          ? loadedTeardownModule.getLastTeardownError()
          : '';
        const shortDetail = loadDetail ? ` (${loadDetail.slice(0, 96)})` : '';
        loadingEl.textContent = `3D teardown unavailable${shortDetail}`;
        if (loadDetail) loadingEl.title = loadDetail;
      }
    })
    .catch((err) => {
      console.error('[cache-modal] failed to load 3D teardown', err);
      if (loadingEl && modalToken === activeModalToken && document.body.contains(overlay)) {
        loadingEl.textContent = 'Failed to load 3D teardown';
      }
    });

  // ── Teardown label scroll listener ──
  // Shows/hides layer labels as user scrolls through the spacer
  setTimeout(() => {
    const scroller = modalScroller;
    const spacer = modal.querySelector('#teardown-spacer');
    const labelEls = Array.from(modal.querySelectorAll('.teardown-label'));
    const viewerSection = modal.querySelector('.modal-viewer-section');
    const totalLabels = labelEls.length;
    let activeLabel = -1;
    let scrollTicking = false;
    let layersHighlighted = false;
    let isViewerHidden = false;
    let canvasEl = null;

    function getCanvasEl() {
      if (canvasEl && document.body.contains(canvasEl)) return canvasEl;
      canvasEl = modal.querySelector('.chip-viewer-container canvas');
      return canvasEl;
    }

    function setViewerHidden(hidden) {
      if (isViewerHidden === hidden) return;
      isViewerHidden = hidden;
      const canvas = getCanvasEl();
      if (canvas) {
        canvas.style.opacity = hidden ? '0' : '1';
        canvas.style.transition = 'opacity 0.4s ease';
      }
      if (viewerSection) {
        viewerSection.style.opacity = hidden ? '0' : '1';
        viewerSection.style.transition = 'opacity 0.4s ease';
      }
    }

    function hideAllLabels() {
      if (activeLabel >= 0 && activeLabel < totalLabels) {
        labelEls[activeLabel].style.opacity = '0';
        labelEls[activeLabel].style.transform = 'translate(-50%, -50%) translateY(-20px)';
      }
      activeLabel = -1;
      if (layersHighlighted && window.resetChipLayers) {
        window.resetChipLayers();
      }
      layersHighlighted = false;
    }

    // Ensure model starts in original colors
    if (window.resetChipLayers) window.resetChipLayers();

    if (scroller && spacer && totalLabels > 0) {
      const updateLabelState = () => {
        if (!document.body.contains(modal)) {
          scroller.removeEventListener('scroll', onLabelScroll);
          return;
        }

        // Progress: 0 = spacer top at scroller top, 1 = spacer fully scrolled
        const spacerHeight = Math.max(1, spacer.offsetHeight);
        const progress = Math.max(0, Math.min(1,
          (scroller.scrollTop - spacer.offsetTop) / spacerHeight
        ));

        // ── Labels only show between 4% and 82% progress ──
        if (progress > 0.82) {
          hideAllLabels();
          setViewerHidden(true);
          return;
        }
        if (progress < 0.04) {
          hideAllLabels();
          setViewerHidden(false);
          return;
        }

        // Ensure visible during active teardown
        setViewerHidden(false);

        // Scale progress to 0-1 within the active label window
        const adjustedProgress = (progress - 0.04) / 0.78;
        const idx = Math.min(totalLabels - 1, Math.floor(adjustedProgress * totalLabels));

        if (idx !== activeLabel) {
          if (activeLabel >= 0 && activeLabel < totalLabels) {
            labelEls[activeLabel].style.opacity = '0';
            labelEls[activeLabel].style.transform = 'translate(-50%, -50%) translateY(-20px)';
          }
          activeLabel = idx;
          labelEls[activeLabel].style.opacity = '1';
          labelEls[activeLabel].style.transform = 'translate(-50%, -50%) translateY(0)';

          // ── Highlight the individual 3D layer mesh ──
          if (window.highlightChipLayer) {
            window.highlightChipLayer(activeLabel);
            layersHighlighted = true;
          }
        }
      };

      function onLabelScroll() {
        if (scrollTicking) return;
        scrollTicking = true;
        requestAnimationFrame(() => {
          scrollTicking = false;
          updateLabelState();
        });
      }

      scroller.addEventListener('scroll', onLabelScroll, { passive: true });
      updateLabelState();
    }
  }, 300);

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
  activeModalToken += 1;

  if (teardownModule && typeof teardownModule.destroyChipTeardown === 'function') {
    teardownModule.destroyChipTeardown();
  }

  overlay.classList.remove('active');

  // Remove after animation
  setTimeout(() => {
    overlay.remove();
  }, 400);

  // Resume background scroll
  if (lenis) lenis.start();

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


// Init Content
document.addEventListener("DOMContentLoaded", () => {

  // Load Displacement Map for Crystal Glass Filter
  const glassImage = document.getElementById('glass-map-image');
  if (glassImage) glassImage.setAttribute('href', 'assets/glass-map.png');

  // Lenis is only active in full mode and runs via its own rAF loop

  // Render all content immediately (during preload = no jank)
  renderProjects();
  renderExperience();
  renderSkills();
  renderEducation();

  // ── GSAP Plugin setup ──────────────────────────────────────────────────
  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);

    // Dual-orb parallax — both orbs scroll at different rates/directions
    gsap.to(".orb-1", {
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 1.05 },
      y: 180, x: 60, scale: 1.25
    });
    gsap.to(".orb-2", {
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 1.25 },
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
        duration: 0.6,
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
  let preloaderDismissed = false;
  let preloaderGuardTimer = 0;
  function dismissPreloader() {
    if (preloaderDismissed) return;
    preloaderDismissed = true;
    if (preloaderGuardTimer) {
      clearTimeout(preloaderGuardTimer);
      preloaderGuardTimer = 0;
    }

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

  // ── Hero scroll indicator ───────────────────────────────────────────
  const scrollIndicator = document.querySelector('.scroll-indicator');
  if (scrollIndicator) {
    let hidden = false;
    const hideIndicator = () => {
      if (hidden) return;
      hidden = true;
      scrollIndicator.classList.add('is-hidden');
      window.removeEventListener('scroll', onFirstScroll);
    };
    const onFirstScroll = () => {
      if (window.scrollY > 40) hideIndicator();
    };

    if (window.scrollY > 40) hideIndicator();
    else window.addEventListener('scroll', onFirstScroll, { passive: true });

    scrollIndicator.addEventListener('click', (e) => {
      e.preventDefault();
      hideIndicator();
      if (lenis) {
        lenis.scrollTo('#projects', { offset: -60 });
        return;
      }
      const target = document.querySelector('#projects');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // ── Startup handoff (no network gate) ──
  const preloaderStatus = document.getElementById('preloader-status');
  if (preloaderStatus) preloaderStatus.textContent = 'Loading portfolio...';

  const startInteractiveBoot = () => {
    dismissPreloader();
    scheduleTeardownPreload();
  };

  preloaderGuardTimer = window.setTimeout(startInteractiveBoot, 1800);
  requestAnimationFrame(() => {
    requestAnimationFrame(startInteractiveBoot);
  });

  window.addEventListener('load', () => {
    scheduleTeardownPreload();
  }, { once: true });
});
