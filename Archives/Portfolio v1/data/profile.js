export const profile = {
  name: "Kaushik Vada",
  title: "RTL & VLSI Engineer",
  summary: "Student engineer focused on fluid RTL design pipelines, FPGA prototyping, and constraint-driven silicon implementation.",

  projects: [
    {
      id: "two-level-cache",
      year: "2024",
      name: "Two-Level Cache Controller",
      desc: "Designed a parameterizable two-level cache memory hierarchy (L1/L2) in SystemVerilog, implementing the MESI coherence protocol to ensure data consistency across multicore simulations. Architected for low-latency concurrent access.",
      tags: ["SystemVerilog", "RTL", "Coherence", "Verification"],
      icon: "layers"
    },
    {
      id: "field-vision",
      year: "2025",
      name: "Field Vision Processing",
      desc: "Real-time FPGA vision stack combining a custom RISC-V processing core with sensor-specific pipelines. Architected secure, reconfigurable modules tailored for mission adaptability.",
      tags: ["FPGA", "RISC-V", "Vision", "Xilinx"],
      icon: "cpu"
    },
    {
      id: "smart-power",
      year: "2024",
      name: "Smart Power Monitor",
      desc: "PCB-based energy monitor with embedded C/C++ firmware, wireless telemetry, and an iOS companion app. Integrated voltage/current sensors for precise real-time tracking.",
      tags: ["Embedded", "IoT", "PCB Design"],
      icon: "activity"
    }
  ],

  experience: [
    {
      company: "Intel Corporation",
      role: "RTL Design Intern",
      time: "Jun 2025 - Present",
      location: "San Diego, CA",
      bullets: [
        "Designed synthesizable SystemVerilog modules for compute datapaths, tuned for low-latency and power efficiency.",
        "Implemented self-checking verification benches and executed simulation, lint, synthesis, and STA for sign-off readiness.",
        "Closed functional/timing coverage with architecture & verification teams."
      ]
    },
    {
      company: "VSCLab @ UC Riverside",
      role: "Undergraduate Researcher",
      time: "Sep 2025 - Present",
      location: "Riverside, CA",
      bullets: [
        "Co-designing a custom RISC-V CPU core and practicing complete RTL-to-gate sign-off inside Synopsys flows.",
        "Learning constraint-driven synthesis, SDC authoring, and early optimization strategies for balanced PPA.",
        "Reviewing timing/power reports to optimize pipeline depth."
      ]
    }
  ]
};
