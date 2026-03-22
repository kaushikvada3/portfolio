import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  createBrushedMetalMaps,
  createCeramicMaps,
  createSubstrateMaps,
  deriveMapsFromImage,
} from './ProceduralMaps';

/**
 * Procedural SoC assembly with 5 explodable layers.
 *
 * PERFORMANCE: all repeated geometry is merged into single draw calls
 * using BufferGeometryUtils.mergeGeometries or InstancedMesh.
 * Target: < 25 draw calls total (was ~600+).
 */

const USE_EXTERNAL_MODEL = false;

/* ── Color palette ──────────────────────────────── */
const COL = {
  titanium:   0x8a9098,
  darkTi:     0x6d737b,
  substrate:  0x343a33,
  subTrace:   0xa38e59,
  gold:       0xd8b25b,
  solder:     0x9ca3ac,
  silicon:    0x5b6169,
  tim:        0x2a2e33,
  capacitor:  0x6e5b45,
  capMetal:   0xb0b5bc,
};

export class SoCAssembly {
  constructor(scene) {
    this.group = new THREE.Group();
    this.layers = [];
    this.dieMesh = null;
    this.ready = false;
    this.surfaceMaps = {
      brushedMetal: createBrushedMetalMaps({ size: 512, repeat: [1.2, 1.2] }),
      substrate: createSubstrateMaps({ size: 512, repeat: [2.8, 2.8] }),
      ceramic: createCeramicMaps({ size: 384, repeat: [1.8, 1.8] }),
    };

    if (USE_EXTERNAL_MODEL) {
      this._loadGLTF();
    } else {
      this._buildProcedural();
    }

    scene.add(this.group);
  }

  /* ── Public API ─────────────────────────────── */
  getLayers()  { return this.layers; }
  getDieMesh() { return this.dieMesh; }

  /* ── GLTF Loader (placeholder) ──────────────── */
  _loadGLTF() {
    const loader = new GLTFLoader();
    loader.load(
      '/models/soc_model.glb',
      (gltf) => {
        const model = gltf.scene;
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        const layer = new THREE.Group();
        layer.add(model);
        this.layers.push(layer);
        this.group.add(layer);
        this.ready = true;
      },
      undefined,
      (err) => {
        console.warn('GLTF load failed, building procedural fallback.', err);
        this._buildProcedural();
      }
    );
  }

  /* ── Procedural Builder ─────────────────────── */
  _buildProcedural() {
    this._buildBGA();        // layer 0
    this._buildSubstrate();  // layer 1
    this._buildDie();        // layer 2
    this._buildTIM();        // layer 3
    this._buildIHS();        // layer 4
    this.ready = true;
  }

  _addLayer(group) {
    this.layers.push(group);
    this.group.add(group);
  }

  /* ── Helper: place a box geo at a position (for merging) ── */
  _positionedBox(w, h, d, x, y, z) {
    const geo = new THREE.BoxGeometry(w, h, d);
    geo.translate(x, y, z);
    return geo;
  }

  _createEngravingTexture(label) {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 512;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 180px Georgia, "Times New Roman", serif';

    ctx.fillStyle = 'rgba(86, 92, 101, 0.88)';
    ctx.fillText(label, canvas.width * 0.5, canvas.height * 0.5 + 10);

    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(215, 222, 232, 0.16)';
    ctx.strokeText(label, canvas.width * 0.5, canvas.height * 0.5 + 10);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }

  /* ── Layer 0: BGA Ball Array ────────────────── */
  _buildBGA() {
    const layer = new THREE.Group();
    layer.userData.name = 'bga';

    const { brushedMetal } = this.surfaceMaps;

    // Slightly smoother spheres so the solder reads less faceted.
    const ballGeo = new THREE.SphereGeometry(0.06, 12, 12);
    const ballMat = new THREE.MeshPhysicalMaterial({
      color: 0xa6abb3,
      metalness: 1.0,
      roughness: 0.16,
      clearcoat: 0.22,
      clearcoatRoughness: 0.25,
      envMapIntensity: 0.9,
      roughnessMap: brushedMetal.roughnessMap,
      normalMap: brushedMetal.normalMap,
      normalScale: new THREE.Vector2(0.18, 0.18),
    });

    const gridSize = 12;
    const spacing = 0.32;
    const offset = (gridSize - 1) * spacing * 0.5;

    const count = gridSize * gridSize;
    const instancedBalls = new THREE.InstancedMesh(ballGeo, ballMat, count);
    const dummy = new THREE.Object3D();
    let idx = 0;

    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const cx = c * spacing - offset;
        const cz = r * spacing - offset;
        if (Math.abs(cx) < 0.8 && Math.abs(cz) < 0.8) continue;

        dummy.position.set(cx, -0.25, cz);
        dummy.updateMatrix();
        instancedBalls.setMatrixAt(idx++, dummy.matrix);
      }
    }
    instancedBalls.count = idx;
    instancedBalls.instanceMatrix.needsUpdate = true;
    // No shadow on tiny balls — not visible, saves GPU
    layer.add(instancedBalls);

    layer.position.y = -0.3;
    this._addLayer(layer);
  }

  /* ── Layer 1: Package Substrate ─────────────── */
  _buildSubstrate() {
    const layer = new THREE.Group();
    layer.userData.name = 'substrate';
    const { substrate, ceramic, brushedMetal } = this.surfaceMaps;

    // Main board — 1 draw call
    const boardGeo = new RoundedBoxGeometry(4.5, 0.18, 4.5, 4, 0.08);
    const boardMat = new THREE.MeshPhysicalMaterial({
      color: 0x343a33,
      metalness: 0.08,
      roughness: 0.84,
      clearcoat: 0.14,
      clearcoatRoughness: 0.7,
      envMapIntensity: 0.55,
      roughnessMap: substrate.roughnessMap,
      normalMap: substrate.normalMap,
      normalScale: new THREE.Vector2(0.3, 0.3),
    });
    const board = new THREE.Mesh(boardGeo, boardMat);
    board.castShadow = true;
    board.receiveShadow = true;
    layer.add(board);

    // MERGE all traces into 1 draw call
    const traceGeos = [];
    const traceMat = new THREE.MeshPhysicalMaterial({
      color: 0xb0965d,
      metalness: 1.0,
      roughness: 0.22,
      clearcoat: 0.08,
      envMapIntensity: 1.0,
      roughnessMap: brushedMetal.roughnessMap,
      normalMap: brushedMetal.normalMap,
      normalScale: new THREE.Vector2(0.08, 0.08),
    });
    for (let i = -8; i <= 8; i++) {
      traceGeos.push(this._positionedBox(3.8, 0.005, 0.015, 0, 0.092, i * 0.22));
      traceGeos.push(this._positionedBox(0.015, 0.005, 3.8, i * 0.22, 0.092, 0));
    }
    const traceMerged = mergeGeometries(traceGeos, false);
    layer.add(new THREE.Mesh(traceMerged, traceMat));

    // MERGE all gold pads into 1 draw call
    const padGeos = [];
    const padMat = new THREE.MeshPhysicalMaterial({
      color: 0xcfa957,
      metalness: 1.0,
      roughness: 0.15,
      clearcoat: 0.12,
      envMapIntensity: 1.2,
    });
    for (let i = -8; i <= 8; i++) {
      padGeos.push(this._positionedBox(0.08, 0.008, 0.04, i * 0.1, 0.094, -0.85));
      padGeos.push(this._positionedBox(0.08, 0.008, 0.04, i * 0.1, 0.094, 0.85));
    }
    const padMerged = mergeGeometries(padGeos, false);
    layer.add(new THREE.Mesh(padMerged, padMat));

    // MERGE capacitors + cap ends into 2 draw calls
    const capGeos = [];
    const capEndGeos = [];
    const capMat = new THREE.MeshPhysicalMaterial({
      color: 0x64513b,
      metalness: 0.1,
      roughness: 0.76,
      clearcoat: 0.05,
      envMapIntensity: 0.35,
      roughnessMap: ceramic.roughnessMap,
      normalMap: ceramic.normalMap,
      normalScale: new THREE.Vector2(0.12, 0.12),
    });
    const capEndMat = new THREE.MeshPhysicalMaterial({
      color: 0xadb0b6,
      metalness: 1.0,
      roughness: 0.24,
      envMapIntensity: 1.0,
      roughnessMap: brushedMetal.roughnessMap,
      normalMap: brushedMetal.normalMap,
      normalScale: new THREE.Vector2(0.12, 0.12),
    });

    const capPositions = [
      [-1.8, 0.13, 1.8], [1.8, 0.13, 1.8],
      [-1.8, 0.13, -1.8], [1.8, 0.13, -1.8],
      [-1.8, 0.13, 0], [1.8, 0.13, 0],
      [0, 0.13, 1.8], [0, 0.13, -1.8],
    ];
    capPositions.forEach(([x, y, z]) => {
      capGeos.push(this._positionedBox(0.12, 0.08, 0.06, x, y, z));
      capEndGeos.push(this._positionedBox(0.02, 0.08, 0.06, x - 0.06, y, z));
      capEndGeos.push(this._positionedBox(0.02, 0.08, 0.06, x + 0.06, y, z));
    });
    layer.add(new THREE.Mesh(mergeGeometries(capGeos, false), capMat));
    layer.add(new THREE.Mesh(mergeGeometries(capEndGeos, false), capEndMat));

    // Total substrate draw calls: 5 (board + traces + pads + caps + capEnds)
    layer.position.y = -0.08;
    this._addLayer(layer);
  }

  /* ── Layer 2: Silicon Die ───────────────────── */
  _buildDie() {
    const layer = new THREE.Group();
    layer.userData.name = 'die';
    const { ceramic, brushedMetal } = this.surfaceMaps;

    // ── Die base slab — 1 draw call
    const baseGeo = new RoundedBoxGeometry(1.5, 0.06, 1.5, 3, 0.045);
    const baseMat = new THREE.MeshPhysicalMaterial({
      color: 0x3d434a,
      metalness: 0.08,
      roughness: 0.72,
      clearcoat: 0.16,
      clearcoatRoughness: 0.45,
      envMapIntensity: 0.72,
      roughnessMap: ceramic.roughnessMap,
      normalMap: ceramic.normalMap,
      normalScale: new THREE.Vector2(0.14, 0.14),
    });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.0;
    base.castShadow = true;
    base.receiveShadow = true;
    layer.add(base);

    // ── Die floor (textured) — 1 draw call
    const floorGeo = new THREE.PlaneGeometry(1.44, 1.44);
    const floorMat = new THREE.MeshPhysicalMaterial({
      color: 0x676f78,
      metalness: 0.58,
      roughness: 0.56,
      clearcoat: 0.62,
      clearcoatRoughness: 0.28,
      envMapIntensity: 0.96,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    });
    const texLoader = new THREE.TextureLoader();
    texLoader.load('/textures/die_macro_photo.png', (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      floorMat.map = tex;
      floorMat.color.set(0x7a7f86);

      const derivedMaps = deriveMapsFromImage(tex.image, { size: 768 });
      floorMat.roughnessMap = derivedMaps.roughnessMap;
      floorMat.normalMap = derivedMaps.normalMap;
      floorMat.normalScale = new THREE.Vector2(0.42, 0.42);
      floorMat.needsUpdate = true;
    }, undefined, () => {});
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.031;
    layer.add(floor);
    this.dieMesh = floor;

    // ── Shared materials
    const blockMat = new THREE.MeshPhysicalMaterial({
      color: 0x616872,
      metalness: 0.32,
      roughness: 0.42,
      clearcoat: 0.18,
      clearcoatRoughness: 0.3,
      envMapIntensity: 0.92,
      roughnessMap: ceramic.roughnessMap,
      normalMap: ceramic.normalMap,
      normalScale: new THREE.Vector2(0.08, 0.08),
    });
    const metalMat = new THREE.MeshPhysicalMaterial({
      color: 0xc4cad3,
      metalness: 1.0,
      roughness: 0.18,
      envMapIntensity: 1.18,
      roughnessMap: brushedMetal.roughnessMap,
      normalMap: brushedMetal.normalMap,
      normalScale: new THREE.Vector2(0.12, 0.12),
    });
    const goldMat = new THREE.MeshPhysicalMaterial({
      color: 0xd9b15a,
      metalness: 1.0,
      roughness: 0.12,
      clearcoat: 0.08,
      envMapIntensity: 1.25,
    });
    const copperMat = new THREE.MeshPhysicalMaterial({
      color: 0xb27d50,
      metalness: 1.0,
      roughness: 0.24,
      envMapIntensity: 1.0,
      roughnessMap: brushedMetal.roughnessMap,
      normalMap: brushedMetal.normalMap,
      normalScale: new THREE.Vector2(0.08, 0.08),
    });

    const Y = 0.031;

    // ── MERGE core logic blocks + all grid lines into 2 draw calls
    const coreGeos = [];
    const gridGeos = [];

    const cores = [
      { x: -0.32, z: -0.30, w: 0.34, d: 0.30, h: 0.025 },
      { x:  0.32, z: -0.30, w: 0.34, d: 0.30, h: 0.025 },
      { x: -0.32, z:  0.10, w: 0.34, d: 0.25, h: 0.020 },
      { x:  0.32, z:  0.10, w: 0.34, d: 0.25, h: 0.020 },
    ];
    cores.forEach(({ x, z, w, d, h }) => {
      coreGeos.push(this._positionedBox(w, h, d, x, Y + h / 2, z));
      // Metal grid lines on top
      for (let i = 0; i < 6; i++) {
        const t = (i / 5) * (w - 0.03) - (w - 0.03) / 2;
        gridGeos.push(this._positionedBox(0.004, 0.003, d - 0.02, x + t, Y + h + 0.0015, z));
      }
      for (let i = 0; i < 4; i++) {
        const t = (i / 3) * (d - 0.03) - (d - 0.03) / 2;
        gridGeos.push(this._positionedBox(w - 0.02, 0.003, 0.004, x, Y + h + 0.0015, z + t));
      }
    });

    // ── MERGE cache body + SRAM cells into blockMat and metalMat geos
    const cacheBodyGeos = [];
    const caches = [
      { x: 0.35, z: 0.48, w: 0.30, d: 0.14, h: 0.015 },
      { x: -0.35, z: 0.48, w: 0.30, d: 0.14, h: 0.015 },
      { x: 0.0,  z: -0.58, w: 0.55, d: 0.10, h: 0.012 },
    ];
    caches.forEach(({ x, z, w, d, h }) => {
      cacheBodyGeos.push(this._positionedBox(w, h, d, x, Y + h / 2, z));
      // SRAM cells — merge into grid mesh
      const cols = Math.floor(w / 0.018);
      const rows = Math.floor(d / 0.018);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          gridGeos.push(this._positionedBox(
            0.012, 0.004, 0.012,
            x - w / 2 + 0.012 + c * 0.018,
            Y + h + 0.002,
            z - d / 2 + 0.012 + r * 0.018
          ));
        }
      }
    });

    // ── Small detail blocks (PLLs, voltage regulators)
    [
      { x: 0, z: 0, w: 0.12, d: 0.12, h: 0.018 },
      { x: -0.55, z: -0.55, w: 0.08, d: 0.06, h: 0.014 },
      { x: 0.55, z: -0.55, w: 0.08, d: 0.06, h: 0.014 },
      { x: -0.55, z: 0.55, w: 0.06, d: 0.06, h: 0.010 },
      { x: 0.55, z: 0.55, w: 0.06, d: 0.06, h: 0.010 },
    ].forEach(({ x, z, w, d, h }) => {
      coreGeos.push(this._positionedBox(w, h, d, x, Y + h / 2, z));
    });

    // Merge blockMat geos (cores + cache bodies + detail blocks) => 1 draw call
    const allBlockGeos = coreGeos.concat(cacheBodyGeos);
    const blockMerged = new THREE.Mesh(mergeGeometries(allBlockGeos, false), blockMat);
    blockMerged.castShadow = true;
    blockMerged.receiveShadow = true;
    layer.add(blockMerged);

    // Merge metalMat geos (grid lines + SRAM cells) => 1 draw call
    const metalMerged = new THREE.Mesh(mergeGeometries(gridGeos, false), metalMat);
    layer.add(metalMerged);

    // ── MERGE copper interconnect buses => 1 draw call
    const copperGeos = [];
    for (let i = -3; i <= 3; i++) {
      copperGeos.push(this._positionedBox(1.3, 0.004, 0.008, 0, Y + 0.002, i * 0.025));
    }
    for (let i = -2; i <= 2; i++) {
      copperGeos.push(this._positionedBox(0.008, 0.004, 1.3, i * 0.16, Y + 0.003, 0));
    }
    layer.add(new THREE.Mesh(mergeGeometries(copperGeos, false), copperMat));

    // ── MERGE I/O ring gold pads => 1 draw call
    const ioPadGeos = [];
    for (let i = 0; i < 22; i++) {
      const t = (i / 21) * 1.36 - 0.68;
      [-0.70, 0.70].forEach(edge => {
        ioPadGeos.push(this._positionedBox(0.035, 0.008, 0.035, t, Y + 0.004, edge));
        ioPadGeos.push(this._positionedBox(0.035, 0.008, 0.035, edge, Y + 0.004, t));
      });
    }
    layer.add(new THREE.Mesh(mergeGeometries(ioPadGeos, false), goldMat));

    // Total die draw calls: 6 (base + floor + blocks + metal + copper + gold)
    layer.position.y = 0.1;
    this._addLayer(layer);
  }

  /* ── Layer 3: Thermal Interface Material ────── */
  _buildTIM() {
    const layer = new THREE.Group();
    layer.userData.name = 'tim';
    const { ceramic } = this.surfaceMaps;

    const timGeo = new RoundedBoxGeometry(1.6, 0.02, 1.6, 3, 0.025);
    const timMat = new THREE.MeshPhysicalMaterial({
      color: 0x2a2e33,
      metalness: 0.02,
      roughness: 0.92,
      envMapIntensity: 0.28,
      roughnessMap: ceramic.roughnessMap,
      normalMap: ceramic.normalMap,
      normalScale: new THREE.Vector2(0.06, 0.06),
    });
    const tim = new THREE.Mesh(timGeo, timMat);
    tim.position.y = 0.01;
    tim.receiveShadow = true;
    layer.add(tim);

    layer.position.y = 0.22;
    this._addLayer(layer);
  }

  /* ── Layer 4: Integrated Heat Spreader (IHS) ── */
  _buildIHS() {
    const layer = new THREE.Group();
    layer.userData.name = 'ihs';
    const { brushedMetal } = this.surfaceMaps;

    const lidGeo = new RoundedBoxGeometry(3.8, 0.25, 3.8, 4, 0.16);
    const lidMat = new THREE.MeshPhysicalMaterial({
      color: 0xa5abb3,
      metalness: 1.0,
      roughness: 0.24,
      clearcoat: 0.62,
      clearcoatRoughness: 0.2,
      envMapIntensity: 1.28,
      roughnessMap: brushedMetal.roughnessMap,
      normalMap: brushedMetal.normalMap,
      normalScale: new THREE.Vector2(0.2, 0.2),
    });
    const lid = new THREE.Mesh(lidGeo, lidMat);
    lid.castShadow = true;
    lid.receiveShadow = true;
    layer.add(lid);

    // MERGE indent + mark => 1 draw call
    const detailGeos = [];
    detailGeos.push(this._positionedBox(3.2, 0.015, 3.2, 0, 0.12, 0));
    detailGeos.push(this._positionedBox(0.6, 0.003, 0.08, -1.0, 0.127, -1.2));
    const detailMat = new THREE.MeshPhysicalMaterial({
      color: 0x747b85,
      metalness: 0.9,
      roughness: 0.46,
      envMapIntensity: 0.8,
      roughnessMap: brushedMetal.roughnessMap,
      normalMap: brushedMetal.normalMap,
      normalScale: new THREE.Vector2(0.1, 0.1),
    });
    layer.add(new THREE.Mesh(mergeGeometries(detailGeos, false), detailMat));

    const engravingTexture = this._createEngravingTexture('Kaushik Vada');
    const engravingMat = new THREE.MeshPhysicalMaterial({
      map: engravingTexture,
      transparent: true,
      opacity: 0.92,
      metalness: 0,
      roughness: 1,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const engraving = new THREE.Mesh(
      new THREE.PlaneGeometry(1.95, 0.42),
      engravingMat
    );
    engraving.rotation.set(-Math.PI / 2, 0, 0);
    engraving.rotateZ(Math.PI / 2);
    engraving.position.set(0, 0.1282, -0.02);
    layer.add(engraving);

    // Total IHS draw calls: 3 (lid + details + engraving)
    layer.position.y = 0.45;
    this._addLayer(layer);
  }
}
