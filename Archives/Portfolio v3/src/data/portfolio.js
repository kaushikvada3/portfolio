/** Human-readable section titles for canvas / panel / mobile */
export const SECTION_DISPLAY_NAMES = {
  hero: 'About',
  experience: 'Experience',
  projects: 'Projects',
  skills: 'Skills',
  education: 'Education',
  contact: 'Contact',
};

export const portfolio = {
  name: 'Kaushik Vada',
  title: 'RTL & VLSI Engineer',
  subtitle: 'Chip Architecture · RTL Design · Silicon Implementation',
  /** Tight one-liner for hero / mobile */
  tagline:
    'RTL & VLSI Engineer focused on digital design, implementation, and silicon-oriented hardware projects.',
  summary:
    'Student engineer focused on fluid RTL design pipelines, FPGA prototyping, and constraint-driven silicon implementation.',
  email: 'kvada001@ucr.edu',
  github: 'github.com/kaushikvada',
  linkedin: 'linkedin.com/in/kaushikvada',
  location: 'Riverside, CA',
  resumeUrl: './Kaushik_Vada_Resume.pdf',

  experience: [
    {
      company: 'Intel Corporation',
      role: 'RTL Design Intern',
      time: 'Jun 2025 – Present',
      location: 'San Diego, CA',
      type: 'FULL_TIME',
      bullets: [
        'Designed synthesizable SystemVerilog modules for compute datapaths, tuned for low-latency and power efficiency.',
        'Implemented self-checking verification benches and executed simulation, lint, synthesis, and STA for sign-off readiness.',
        'Closed functional/timing coverage with architecture & verification teams.',
      ],
    },
    {
      company: 'VSCLab @ UC Riverside',
      role: 'Undergraduate Researcher',
      time: 'Sep 2025 – Present',
      location: 'Riverside, CA',
      type: 'RESEARCH',
      bullets: [
        'Co-designing a custom RISC-V CPU core and practicing complete RTL-to-gate sign-off inside Synopsys flows.',
        'Learning constraint-driven synthesis, SDC authoring, and early optimization strategies for balanced PPA.',
        'Reviewing timing/power reports to optimize pipeline depth.',
      ],
    },
  ],

  education: [
    {
      school: 'University of California, Riverside',
      degree: 'B.S. Computer Engineering',
      time: '2022 – 2026',
      location: 'Riverside, CA',
      gpa: null,
      highlights: ['VLSI focus', 'VSCLab researcher'],
    },
  ],

  projects: [
    {
      id: 'two-level-cache',
      year: '2024',
      name: 'Two-Level Cache Controller',
      type: 'RTL_DESIGN',
      desc: 'Designed a parameterizable two-level cache memory hierarchy (L1/L2) in SystemVerilog, implementing the MESI coherence protocol to ensure data consistency across multicore simulations. Architected for low-latency concurrent access.',
      tags: ['SystemVerilog', 'RTL', 'MESI Coherence', 'Verification'],
      cells: 17983,
    },
    {
      id: 'field-vision',
      year: '2025',
      name: 'Field Vision Processing',
      type: 'FPGA_DESIGN',
      desc: 'Real-time FPGA vision stack combining a custom RISC-V processing core with sensor-specific pipelines. Architected secure, reconfigurable modules tailored for mission adaptability.',
      tags: ['FPGA', 'RISC-V', 'Vision', 'Xilinx'],
      cells: 9240,
    },
    {
      id: 'smart-power',
      year: '2024',
      name: 'Smart Power Monitor',
      type: 'EMBEDDED',
      desc: 'PCB-based energy monitor with embedded C/C++ firmware, wireless telemetry, and an iOS companion app. Integrated voltage/current sensors for precise real-time tracking.',
      tags: ['Embedded C++', 'IoT', 'PCB Design', 'iOS'],
      cells: null,
    },
  ],

  skills: [
    { category: 'RTL / HDL', items: ['SystemVerilog', 'Verilog', 'VHDL'] },
    { category: 'EDA Tools', items: ['Synopsys DC', 'Synopsys VCS', 'Verdi', 'PrimeTime', 'Fusion Compiler'] },
    { category: 'FPGA', items: ['Xilinx Vivado', 'Intel Quartus', 'Xilinx HLS'] },
    { category: 'Programming', items: ['Python', 'C++', 'Tcl', 'JavaScript'] },
    { category: 'Methodologies', items: ['RTL-to-GDS', 'STA', 'Lint', 'CDC', 'UVM', 'SVA'] },
    { category: 'Architectures', items: ['RISC-V', 'AXI', 'APB', 'MESI', 'Pipelining'] },
  ],
};

/** Design library / cell name (for title bar & console) */
export const DESIGN_LIB = 'kaushik_vada_lib';
export const DESIGN_NAME = 'portfolio.design';

// Chip floorplan macro definitions (design units: 0–1000 x 0–1260)
export const MACROS = [
  {
    id: 'HERO_MACRO',
    label: 'KAUSHIK_VADA_TOP',
    sublabel: 'PORTFOLIO_OWNER',
    x: 80,
    y: 40,
    w: 840,
    h: 110,
    section: 'hero',
    borderColor: '#00d4d4',
    hoverBorderColor: '#00ffff',
    selectedBorderColor: '#e0b96c',
  },
  {
    id: 'EXPERIENCE_MACRO',
    label: 'WORK_EXP_INST',
    sublabel: 'EXPERIENCE_BLOCK',
    x: 20,
    y: 180,
    w: 390,
    h: 430,
    section: 'experience',
    borderColor: '#00bfbf',
    hoverBorderColor: '#00e8e8',
    selectedBorderColor: '#e0b96c',
  },
  {
    id: 'PROJECTS_MACRO',
    label: 'PROJ_BLOCK_0',
    sublabel: 'PROJECT_ARRAY',
    x: 590,
    y: 180,
    w: 390,
    h: 430,
    section: 'projects',
    borderColor: '#00bfbf',
    hoverBorderColor: '#00e8e8',
    selectedBorderColor: '#e0b96c',
  },
  {
    id: 'SKILLS_MACRO',
    label: 'SKILLS_IP_0',
    sublabel: 'SKILLS_MATRIX',
    x: 15,
    y: 650,
    w: 300,
    h: 200,
    section: 'skills',
    borderColor: '#00bfbf',
    hoverBorderColor: '#00e8e8',
    selectedBorderColor: '#e0b96c',
  },
  {
    id: 'EDUCATION_MACRO',
    label: 'EDU_BLOCK_0',
    sublabel: 'EDUCATION_INST',
    x: 330,
    y: 650,
    w: 340,
    h: 200,
    section: 'education',
    borderColor: '#00bfbf',
    hoverBorderColor: '#00e8e8',
    selectedBorderColor: '#e0b96c',
  },
  {
    id: 'CONTACT_MACRO',
    label: 'CONTACT_CELL',
    sublabel: 'CONTACT_BLOCK',
    x: 685,
    y: 650,
    w: 300,
    h: 200,
    section: 'contact',
    borderColor: '#00bfbf',
    hoverBorderColor: '#00e8e8',
    selectedBorderColor: '#e0b96c',
  },
];

// Signal routes between macros (for animation)
export const ROUTES = [
  { from: 'HERO_MACRO', to: 'EXPERIENCE_MACRO', path: [[500, 150], [170, 150], [170, 180]] },
  { from: 'HERO_MACRO', to: 'PROJECTS_MACRO', path: [[500, 150], [785, 150], [785, 180]] },
  { from: 'EXPERIENCE_MACRO', to: 'SKILLS_MACRO', path: [[170, 610], [170, 650]] },
  { from: 'PROJECTS_MACRO', to: 'CONTACT_MACRO', path: [[785, 610], [785, 650]] },
  { from: 'SKILLS_MACRO', to: 'EDUCATION_MACRO', path: [[315, 750], [500, 750]] },
  { from: 'EDUCATION_MACRO', to: 'CONTACT_MACRO', path: [[670, 750], [785, 750]] },
  { from: 'SKILLS_MACRO', to: 'CONTACT_MACRO', path: [[315, 750], [500, 750], [785, 750]] },
];

/** Section id → Tcl-style macro name for console */
export const SECTION_TO_TCL = {
  hero: 'HERO_MACRO',
  experience: 'EXPERIENCE_MACRO',
  projects: 'PROJECTS_MACRO',
  skills: 'SKILLS_MACRO',
  education: 'EDUCATION_MACRO',
  contact: 'CONTACT_MACRO',
};

/** Console line on macro hover (context-aware) */
export function getMacroHoverConsoleLine(macro) {
  const sec = macro.section;
  if (sec === 'hero') {
    return `# Hover: ${macro.label} — ${portfolio.name}`;
  }
  if (sec === 'experience') {
    const e = portfolio.experience[0];
    return `# Hover: ${macro.label} — ${e.company}, ${e.role}`;
  }
  if (sec === 'projects') {
    const p = portfolio.projects.find((x) => x.id === 'field-vision') || portfolio.projects[1] || portfolio.projects[0];
    return `# Hover: ${macro.label} — ${p.name} (${p.year})`;
  }
  if (sec === 'skills') {
    return `# Hover: ${macro.label} — ${SECTION_DISPLAY_NAMES.skills}`;
  }
  if (sec === 'education') {
    const ed = portfolio.education[0];
    return `# Hover: ${macro.label} — ${ed.school}`;
  }
  if (sec === 'contact') {
    return `# Hover: ${macro.label} — ${portfolio.email}`;
  }
  return `# Hover: ${macro.label}`;
}

/** Console line on selection */
export function getMacroSelectionConsoleLine(macro) {
  const sec = macro.section;
  if (sec === 'hero') {
    return `# Selected: ${macro.label} — ${portfolio.name}, ${portfolio.title}`;
  }
  if (sec === 'experience') {
    const e = portfolio.experience[0];
    return `# Selected: ${macro.label} — ${e.company}, ${e.role}`;
  }
  if (sec === 'projects') {
    const p = portfolio.projects[0];
    return `# Selected: ${macro.label} — ${p.name} (${p.year})`;
  }
  if (sec === 'skills') {
    return `# Selected: ${macro.label} — Skills matrix`;
  }
  if (sec === 'education') {
    const ed = portfolio.education[0];
    return `# Selected: ${macro.label} — ${ed.school}, ${ed.degree}`;
  }
  if (sec === 'contact') {
    return `# Selected: ${macro.label} — ${portfolio.email}`;
  }
  return `# Selected: ${macro.label}`;
}
