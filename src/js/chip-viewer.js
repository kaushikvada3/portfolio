import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const LAYER_COLORS = [
  0x4fc3f7, 0xba68c8, 0x4db6ac, 0xff8a65,
  0x7986cb, 0xaed581, 0xf06292, 0xffd54f,
  0x90a4ae, 0xe0e0e0,
];

function colorForName(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('via') || n.includes('contact')) return 0xf06292;
  if (n.includes('pad') || n.includes('bond')) return 0xffd54f;
  if (n.includes('sub') || n.includes('bulk') || n.includes('die')) return 0x546e7a;
  if (n.includes('m1') || n.includes('metal1') || n.includes('metal_1')) return 0x4fc3f7;
  if (n.includes('m2') || n.includes('metal2') || n.includes('metal_2')) return 0xba68c8;
  if (n.includes('m3') || n.includes('metal3') || n.includes('metal_3')) return 0x4db6ac;
  if (n.includes('m4') || n.includes('metal4') || n.includes('metal_4')) return 0xff8a65;
  return null;
}

// ── Model cache ───────────────────────────────────────────────────────────────
let _model = null;
let _loading = true;
let _progress = 0;
let _waiters = [];   // attach callbacks queued while model is in-flight
let _readyCallbacks = [];   // preloader dismiss callbacks

// ── Preloader helpers ─────────────────────────────────────────────────────────
function _setPreloaderProgress(pct) {
  const bar = document.getElementById('preloader-bar');
  const status = document.getElementById('preloader-status');
  if (bar) bar.style.width = pct + '%';
  if (status) status.textContent = pct < 100 ? `Loading model… ${pct}%` : 'Ready';
}

function _fireReady() {
  _readyCallbacks.forEach(fn => fn());
  _readyCallbacks = [];
}

// ── Worker-based preload ──────────────────────────────────────────────────────
// The Web Worker handles fetch + parse entirely off the main thread.
// The main thread is never blocked — scroll and animations stay perfectly smooth.
// On browsers without module-worker support we fall back to an inline load.
(function startPreload() {
  let worker;
  try {
    worker = new Worker(
      new URL('./chip-worker.js', import.meta.url),
      { type: 'module' }
    );
  } catch (_) {
    // Module workers unsupported (rare) — fall back
    _fallbackLoad();
    return;
  }

  worker.onmessage = ({ data }) => {
    if (data.type === 'progress') {
      _progress = data.pct;
      _setPreloaderProgress(_progress);
      // Live-update loading text if the modal is already open
      document.querySelectorAll('.chip-loading').forEach((el) => {
        if (el.style.display !== 'none') el.textContent = `Loading… ${_progress}%`;
      });

    } else if (data.type === 'done') {
      _model = _buildGroup(data.meshes);
      _loading = false;
      _setPreloaderProgress(100);
      _waiters.forEach(fn => fn(_model, null));
      _waiters = [];
      worker.terminate();
      _fireReady();

    } else if (data.type === 'error') {
      console.warn('[ChipViewer] worker parse failed, trying inline:', data.message);
      _loading = false;
      worker.terminate();
      // If anyone is waiting, fall back inline for them
      if (_waiters.length) _fallbackLoad();
      // Still reveal the site even on error
      _fireReady();
    }
  };

  worker.onerror = (e) => {
    console.warn('[ChipViewer] worker crashed, falling back:', e.message);
    _loading = false;
    worker.terminate();
    _fallbackLoad();
  };

  // Pass the absolute URL so the worker resolves it correctly regardless of
  // its own script location.
  const fbxUrl = new URL('Final%20Chip.fbx', document.baseURI).href;
  worker.postMessage({ type: 'parse', url: fbxUrl });
})();

// ── Inline fallback (Safari / old browsers / CSP) ────────────────────────────
function _fallbackLoad() {
  import('three/addons/loaders/FBXLoader.js').then(({ FBXLoader }) => {
    const fbxUrl = new URL('Final%20Chip.fbx', document.baseURI).href;
    fetch(fbxUrl)
      .then(r => r.arrayBuffer())
      .then(buf => {
        const raw = new FBXLoader().parse(buf, '');
        const box = new THREE.Box3().setFromObject(raw);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const s = 3 / Math.max(size.x, size.y, size.z);
        raw.scale.setScalar(s);
        raw.position.set(-center.x * s, -center.y * s, -center.z * s);
        _applyColors(raw);
        _model = raw;
        _loading = false;
        _setPreloaderProgress(100);
        _waiters.forEach(fn => fn(_model, null));
        _waiters = [];
        _fireReady();
      })
      .catch(err => {
        _loading = false;
        _waiters.forEach(fn => fn(null, err));
        _waiters = [];
        _fireReady();
      });
  });
}

// ── Reconstruct Three.js scene from worker geometry buffers ──────────────────
function _buildGroup(meshDataList) {
  const group = new THREE.Group();
  let idx = 0;

  meshDataList.forEach((m) => {
    if (!m.pos) { idx++; return; }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(m.pos), 3));
    if (m.nor) geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(m.nor), 3));
    if (m.idx) {
      const arr = m.idxU32 ? new Uint32Array(m.idx) : new Uint16Array(m.idx);
      geo.setIndex(new THREE.BufferAttribute(arr, 1));
    }
    if (!m.nor) geo.computeVertexNormals();
    geo.computeBoundingSphere();

    const hex = colorForName(m.name) ?? LAYER_COLORS[idx % LAYER_COLORS.length];
    const mat = new THREE.MeshPhongMaterial({
      color: new THREE.Color(hex),
      shininess: 60,
      specular: new THREE.Color(0x333333),
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geo, mat);
    new THREE.Matrix4().fromArray(m.matrix).decompose(
      mesh.position, mesh.quaternion, mesh.scale
    );
    group.add(mesh);
    idx++;
  });

  return group;
}

function _applyColors(object) {
  let i = 0;
  object.traverse((child) => {
    if (!child.isMesh) return;
    const hex = colorForName(child.name) ?? LAYER_COLORS[i % LAYER_COLORS.length];
    child.material = new THREE.MeshPhongMaterial({
      color: new THREE.Color(hex), shininess: 60,
      specular: new THREE.Color(0x333333), side: THREE.DoubleSide,
    });
    i++;
  });
}

// ── ChipViewer class ──────────────────────────────────────────────────────────
class ChipViewer {
  constructor() { this._clear(); }

  _clear() {
    this.scene = this.camera = this.renderer =
      this.controls = this._rafId = this._onResize = this._onVis = null;
  }

  init(container) {
    if (!container) return;

    const mobile = window.matchMedia('(max-width: 768px)').matches ||
      ('ontouchstart' in window && window.innerWidth < 1024);

    // Scene
    this.scene = new THREE.Scene();

    // Camera — elevated 3/4 top-right view
    const w = container.clientWidth, h = container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(38, w / h, 0.01, 500);
    this.camera.position.set(2.0, 3.0, 2.8);

    // Renderer — lighter settings on mobile
    this.renderer = new THREE.WebGLRenderer({
      antialias: !mobile,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(mobile ? 1 : Math.min(window.devicePixelRatio, 1.5));
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.6;
    this.controls.enablePan = !mobile;
    this.controls.minDistance = 0.5;
    this.controls.maxDistance = 15;
    this.controls.target.set(0, 0, 0);
    this.controls.update();

    this.renderer.domElement.addEventListener('pointerdown', () => {
      if (this.controls) this.controls.autoRotate = false;
    });
    this.renderer.domElement.addEventListener('pointerup', () => {
      setTimeout(() => { if (this.controls) this.controls.autoRotate = true; }, 2500);
    });

    // Lighting
    const key = new THREE.DirectionalLight(0xffffff, 3.0); key.position.set(4, 8, 5);
    const fill = new THREE.DirectionalLight(0x88aaff, 1.5); fill.position.set(-5, 5, -3);
    const back = new THREE.DirectionalLight(0xffffff, 1.0); back.position.set(0, 3, -6);
    const bot = new THREE.DirectionalLight(0x6688cc, 0.6); bot.position.set(0, -5, 0);
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.8), key, fill, back, bot);

    // Attach model — instant if cached, queued otherwise
    const loadingEl = container.querySelector('.chip-loading');

    const attach = (model, err) => {
      if (!this.scene) return;
      if (err || !model) {
        if (loadingEl) { loadingEl.textContent = 'Could not load model'; loadingEl.style.color = '#f87171'; }
        return;
      }
      this.scene.add(model);
      this.controls?.update();
      if (loadingEl) loadingEl.style.display = 'none';
    };

    if (!_loading && _model) {
      attach(_model, null);
    } else {
      if (loadingEl && _progress > 0) loadingEl.textContent = `Loading… ${_progress}%`;
      _waiters.push(attach);
    }

    // Pause when tab is backgrounded
    this._onVis = () => {
      if (document.hidden) this._stopRender();
      else this._startRender();
    };
    document.addEventListener('visibilitychange', this._onVis);

    this._onResize = () => {
      if (!this.camera || !this.renderer) return;
      const cw = container.clientWidth, ch = container.clientHeight;
      this.camera.aspect = cw / ch;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(cw, ch);
    };
    window.addEventListener('resize', this._onResize);

    this._startRender();
  }

  _startRender() {
    if (this._rafId || !this.renderer) return;
    const tick = () => {
      if (!this.renderer) return;
      this.controls?.update();
      this.renderer.render(this.scene, this.camera);
      this._rafId = requestAnimationFrame(tick);
    };
    this._rafId = requestAnimationFrame(tick);
  }

  _stopRender() {
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
  }

  dispose() {
    this._stopRender();
    if (this._onVis) document.removeEventListener('visibilitychange', this._onVis);
    if (this._onResize) window.removeEventListener('resize', this._onResize);
    if (this.controls) this.controls.dispose();
    // Detach the cached group without destroying it — it's reused on re-open
    if (this.scene && _model) this.scene.remove(_model);
    if (this.renderer) { this.renderer.dispose(); this.renderer.domElement?.remove(); }
    _waiters = [];
    this._clear();
  }
}

const _chipViewerInstance = new ChipViewer();

// Expose preloader integration API
_chipViewerInstance.onReady = function (cb) {
  if (!_loading) { cb(); return; }
  _readyCallbacks.push(cb);
};
_chipViewerInstance.getProgress = function () { return _progress; };

window.ChipViewer = _chipViewerInstance;
