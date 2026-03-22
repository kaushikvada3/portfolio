import * as THREE from 'three';

function clamp01(value) {
  return Math.min(Math.max(value, 0), 1);
}

function smoothstep(edge0, edge1, value) {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function band(inStart, inEnd, outStart, outEnd, value) {
  return smoothstep(inStart, inEnd, value) * (1 - smoothstep(outStart, outEnd, value));
}

function toVector3(values) {
  return new THREE.Vector3(values[0], values[1], values[2]);
}

export class ChipTour {
  constructor(assembly) {
    this.assembly = assembly;
    this.layers = assembly.getLayers();
    this.progress = 0;
    this.features = this._buildFeatures();
  }

  setProgress(progress) {
    this.progress = progress;
  }

  update() {
    const phase = clamp01((this.progress - 0.54) / 0.28);
    const sectionFade = smoothstep(0.54, 0.62, this.progress) * (1 - smoothstep(0.86, 0.94, this.progress));
    const globalReveal = smoothstep(0.04, 0.18, phase);

    this.features.forEach((feature) => {
      const discovery = smoothstep(feature.revealStart, feature.revealEnd, phase);
      const focus = band(
        feature.focus - 0.07,
        feature.focus - 0.015,
        feature.focus + 0.035,
        feature.focus + 0.11,
        phase
      );

      const opacity = clamp01(globalReveal * 0.18 + discovery * 0.28 + focus * 0.4) * sectionFade;
      const scale = 1 + focus * 0.05;

      feature.material.opacity = opacity * feature.maxOpacity;
      feature.mesh.scale.setScalar(scale);
      feature.mesh.position.copy(feature.basePosition);
      feature.mesh.position.y += focus * feature.lift;
    });
  }

  _buildFeatures() {
    const dieLayer = this.layers[2];

    const definitions = [
      {
        kicker: '01 // DIE',
        titleLines: ['SILICON DIE'],
        position: [0.44, 0.036, 0.63],
        size: [0.46, 0.13],
        focus: 0.28,
        revealStart: 0.02,
        revealEnd: 0.12,
        maxOpacity: 0.54,
        titleSize: 118,
      },
      {
        kicker: '02 // CTRL',
        titleLines: ['SYSTEM CTRL'],
        position: [0.0, 0.051, 0.0],
        size: [0.34, 0.095],
        focus: 0.4,
        revealStart: 0.03,
        revealEnd: 0.14,
        maxOpacity: 0.58,
        titleSize: 84,
      },
      {
        kicker: '03 // CORE',
        titleLines: ['CORE CLUSTERS'],
        position: [0.32, 0.0585, -0.3],
        size: [0.58, 0.13],
        focus: 0.58,
        revealStart: 0.04,
        revealEnd: 0.17,
        maxOpacity: 0.62,
        titleSize: 96,
      },
      {
        kicker: '04 // FABRIC',
        titleLines: ['INTERCONNECT', 'FABRIC'],
        position: [0.0, 0.036, 0.2],
        size: [0.56, 0.17],
        focus: 0.68,
        revealStart: 0.05,
        revealEnd: 0.2,
        maxOpacity: 0.58,
        titleSize: 88,
      },
      {
        kicker: '05 // SRAM',
        titleLines: ['CACHE BANKS'],
        position: [0.0, 0.047, -0.58],
        size: [0.5, 0.13],
        focus: 0.78,
        revealStart: 0.06,
        revealEnd: 0.24,
        maxOpacity: 0.6,
        titleSize: 92,
      },
      {
        kicker: '06 // I/O',
        titleLines: ['I/O PAD RING'],
        position: [0.0, 0.0395, 0.69],
        size: [0.58, 0.13],
        focus: 0.88,
        revealStart: 0.08,
        revealEnd: 0.28,
        maxOpacity: 0.56,
        titleSize: 94,
      },
    ];

    return definitions.map((definition) => {
      const texture = this._createDieLabelTexture(definition);
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });

      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(definition.size[0], definition.size[1]),
        material
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.copy(toVector3(definition.position));
      mesh.renderOrder = 12;
      dieLayer.add(mesh);

      return {
        ...definition,
        mesh,
        material,
        basePosition: mesh.position.clone(),
        lift: definition.lift ?? 0.0012,
      };
    });
  }

  _createDieLabelTexture(definition) {
    const canvas = document.createElement('canvas');
    canvas.width = 1536;
    canvas.height = 384;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width * 0.5;
    const kickerY = 76;
    const lines = definition.titleLines;
    const lineGap = lines.length > 1 ? 88 : 0;
    const firstLineY = lines.length > 1 ? 184 : 206;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = '600 38px "Space Mono", monospace';
    ctx.fillStyle = 'rgba(215, 179, 90, 0.64)';
    ctx.fillText(definition.kicker, centerX, kickerY);

    lines.forEach((line, index) => {
      const y = firstLineY + index * lineGap;

      ctx.font = `700 ${definition.titleSize}px "Space Mono", monospace`;
      ctx.lineWidth = 14;
      ctx.strokeStyle = 'rgba(11, 14, 18, 0.28)';
      ctx.strokeText(line, centerX + 3, y + 3);

      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(92, 104, 118, 0.32)';
      ctx.strokeText(line, centerX, y);

      ctx.fillStyle = 'rgba(230, 235, 242, 0.74)';
      ctx.fillText(line, centerX, y);
    });

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }
}
