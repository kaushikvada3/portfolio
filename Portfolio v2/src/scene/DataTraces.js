import * as THREE from 'three';

/**
 * Animated electrical signal pulses that flow along the ACTUAL
 * copper interconnect buses and substrate traces of the SoC model.
 *
 * Signals are added directly to the relevant layer groups so they
 * move correctly during the exploded-view scroll animation.
 */

/* ── Vertex Shader ──────────────────────────────── */
const vertexShader = /* glsl */ `
  attribute float aLineDistance;
  varying float vDist;
  void main() {
    vDist = aLineDistance;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/* ── Fragment Shader ────────────────────────────── */
const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform float uIntensity;
  uniform float uSpeed;
  uniform float uSpacing;

  varying float vDist;

  void main() {
    // Base trace color — brighter warm gold so the routes stay legible.
    vec3 baseColor  = vec3(0.76, 0.56, 0.16);
    // Pulse color — hot amber packet.
    vec3 pulseColor = vec3(1.00, 0.80, 0.28);
    // Bright head — near-white highlight.
    vec3 headColor  = vec3(1.00, 0.97, 0.86);

    // Traveling pulse along the line
    float d = mod(vDist - uTime * uSpeed, uSpacing);
    float glow   = smoothstep(0.60, 0.0, d);
    float packet = smoothstep(0.26, 0.0, d);
    float head   = smoothstep(0.09, 0.0, d);

    vec3 color = mix(baseColor, pulseColor, packet);
    color += pulseColor * glow * 0.25;
    color = mix(color, headColor, head * 0.82);
    color *= uIntensity;

    float alpha = (0.30 + glow * 0.18 + packet * 0.86 + head * 0.35) * uOpacity;
    gl_FragColor = vec4(color, alpha);
  }
`;

export class DataTraces {
  constructor(scene, assembly) {
    this.lines = [];

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime:    { value: 0 },
        uOpacity: { value: 0 },     // Revealed via GSAP once the chip opens up
        uIntensity: { value: 1.15 },
        uSpeed:   { value: 0.4 },
        uSpacing: { value: 1.2 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });

    if (assembly) {
      this._buildModelSignals(assembly);
    }
  }

  /* ── Public ─────────────────────────────────── */
  update(time) {
    this.material.uniforms.uTime.value = time;
  }

  /* ── Build signals along actual model geometry ─ */
  _buildModelSignals(assembly) {
    const layers = assembly.getLayers();
    const dieLayer = layers[2];        // Silicon die layer
    const subLayer = layers[1];        // Substrate layer

    // === DIE-LEVEL SIGNALS ===
    // These follow the copper interconnect buses defined in SoCAssembly._buildDie()
    //
    // Die local coordinates:
    //   Copper H buses: x ∈ [-0.65, 0.65], y = 0.035, z = i * 0.025 (i: -3..3)
    //   Copper V buses: z ∈ [-0.65, 0.65], y = 0.036, x = i * 0.16  (i: -2..2)

    const DY = 0.039;  // Lifted slightly for cleaner read over the die texture

    // Horizontal bus signals — core ↔ core data paths
    const hBusZ = [-0.075, -0.025, 0.025, 0.075];
    hBusZ.forEach((z, i) => {
      this._createSignal(dieLayer, [
        [-0.65, DY, z],
        [0.65, DY, z],
      ], 0.3 + i * 0.08, 0.8 + i * 0.2);
    });

    // Vertical bus signals — core ↔ cache paths
    const vBusX = [-0.32, 0, 0.32];
    vBusX.forEach((x, i) => {
      this._createSignal(dieLayer, [
        [x, DY, -0.65],
        [x, DY, 0.65],
      ], 0.25 + i * 0.1, 1.0 + i * 0.15);
    });

    // L-shaped signal: I/O pad → horizontal bus → core (left side)
    this._createSignal(dieLayer, [
      [-0.70, DY, -0.50],   // From left I/O pad
      [-0.65, DY, -0.50],   // Enter die area
      [-0.65, DY, -0.025],  // Travel along edge
      [-0.32, DY, -0.025],  // Turn onto H bus
      [-0.32, DY, -0.30],   // Reach core 0
    ], 0.35, 1.4);

    // L-shaped signal: I/O pad → horizontal bus → core (right side)
    this._createSignal(dieLayer, [
      [0.70, DY, -0.50],    // From right I/O pad
      [0.65, DY, -0.50],    // Enter die area
      [0.65, DY, 0.025],    // Travel along edge
      [0.32, DY, 0.025],    // Turn onto H bus
      [0.32, DY, -0.30],    // Reach core 1
    ], 0.40, 1.2);

    // Core → Cache signal paths
    this._createSignal(dieLayer, [
      [-0.32, DY, 0.10],    // From core 2
      [-0.32, DY, 0.48],    // Down to cache
      [-0.35, DY, 0.48],    // Into cache array
    ], 0.50, 1.0);

    this._createSignal(dieLayer, [
      [0.32, DY, 0.10],     // From core 3
      [0.32, DY, 0.48],     // Down to cache
      [0.35, DY, 0.48],     // Into cache array
    ], 0.45, 1.1);

    // Core ↔ Core cross-connect through center bus
    this._createSignal(dieLayer, [
      [-0.32, DY, -0.30],   // Core 0
      [0, DY, -0.30],       // Center
      [0, DY, 0.10],        // Vertical bus
      [0.32, DY, 0.10],     // Core 3
    ], 0.30, 1.5);

    // Bottom cache to I/O
    this._createSignal(dieLayer, [
      [0, DY, -0.58],       // Bottom cache
      [0, DY, -0.65],       // South edge
      [0, DY, -0.70],       // I/O pad
    ], 0.55, 0.6);

    // === SUBSTRATE-LEVEL SIGNALS ===
    // Follow the gold traces defined in SoCAssembly._buildSubstrate()
    //
    // Substrate local coords:
    //   H traces: x ∈ [-1.9, 1.9], y = 0.094, z = i * 0.22
    //   V traces: z ∈ [-1.9, 1.9], y = 0.094, x = i * 0.22

    const SY = 0.099;  // Lifted slightly so the substrate routes read sooner

    // Major horizontal substrate bus signals
    [-0.44, 0, 0.44].forEach((z, i) => {
      this._createSignal(subLayer, [
        [-1.9, SY, z],
        [1.9, SY, z],
      ], 0.15 + i * 0.05, 2.0 + i * 0.3);
    });

    // Major vertical substrate bus signals
    [-0.44, 0.44].forEach((x, i) => {
      this._createSignal(subLayer, [
        [x, SY, -1.9],
        [x, SY, 1.9],
      ], 0.20 + i * 0.08, 2.2 + i * 0.2);
    });

    // Substrate edge → die area routed signal
    this._createSignal(subLayer, [
      [-1.8, SY, -0.88],    // Near edge capacitor
      [-0.85, SY, -0.88],   // Approach die
      [-0.85, SY, -0.44],   // Turn north
      [0, SY, -0.44],       // Route to center
    ], 0.25, 2.5);

    this._createSignal(subLayer, [
      [1.8, SY, 0.88],      // Near opposite cap
      [0.85, SY, 0.88],     // Approach die
      [0.85, SY, 0.44],     // Turn
      [0, SY, 0.44],        // Route to center
    ], 0.22, 2.3);
  }

  /**
   * Create a single signal line along a defined path.
   * @param {THREE.Group} parentGroup - Layer group to add the line to
   * @param {number[][]} path - Array of [x, y, z] coordinates
   * @param {number} speed - Pulse animation speed
   * @param {number} spacing - Distance between pulses
   */
  _createSignal(parentGroup, path, speed, spacing) {
    const positions = [];
    const distances = [];
    let cumDist = 0;

    for (let i = 0; i < path.length; i++) {
      const [x, y, z] = path[i];
      positions.push(x, y, z);

      if (i === 0) {
        distances.push(0);
      } else {
        const [px, py, pz] = path[i - 1];
        cumDist += Math.sqrt((x-px)**2 + (y-py)**2 + (z-pz)**2);
        distances.push(cumDist);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('aLineDistance', new THREE.Float32BufferAttribute(distances, 1));

    // Clone material with unique speed/spacing but shared time/opacity
    const mat = this.material.clone();
    mat.uniforms.uSpeed   = { value: speed };
    mat.uniforms.uSpacing = { value: spacing };
    mat.uniforms.uOpacity = this.material.uniforms.uOpacity;
    mat.uniforms.uTime    = this.material.uniforms.uTime;

    const line = new THREE.Line(geo, mat);
    line.renderOrder = 8;
    this.lines.push(line);
    parentGroup.add(line);
  }
}
