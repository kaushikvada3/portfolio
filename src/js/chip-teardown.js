/**
 * chip-teardown.js — modal-only 3D scrollytelling teardown.
 *
 * This module is lazy-loaded from app.js only when the modal opens.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

/* global gsap, ScrollTrigger */
gsap.registerPlugin(ScrollTrigger);

const ASSET_VERSION = '20260305-4';
const MODEL_URL_FULL_LOCAL = new URL('../../Two_Level_Cache_Draco.glb', import.meta.url);
MODEL_URL_FULL_LOCAL.searchParams.set('v', ASSET_VERSION);
const MODEL_URL_LITE_LOCAL = new URL('../../Two_Level_Cache_Draco_Lite.glb', import.meta.url);
MODEL_URL_LITE_LOCAL.searchParams.set('v', ASSET_VERSION);
const MODEL_URL_FULL_RAW = `https://raw.githubusercontent.com/kaushikvada3/Personal-Portfolio/main/Two_Level_Cache_Draco.glb?v=${ASSET_VERSION}`;
const MODEL_URL_LITE_RAW = `https://raw.githubusercontent.com/kaushikvada3/Personal-Portfolio/main/Two_Level_Cache_Draco_Lite.glb?v=${ASSET_VERSION}`;
const DECODER_PATHS = [
  'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/',
  'https://unpkg.com/three@0.170.0/examples/jsm/libs/draco/',
  'https://www.gstatic.com/draco/versioned/decoders/1.5.7/',
];

let cachedGLTF = null;
let gltfLoadPromise = null;
let selectedModelUrl = '';
let selectedDecoderPath = '';
let lastLoadError = '';

let renderer = null;
let scene = null;
let camera = null;
let model = null;
let pivot = null;
let animId = 0;
let roObs = null;
let stInstance = null;

let allMeshes = [];
let layerMaterials = [];
let baseMaterialState = [];
const lookTarget = new THREE.Vector3(0, 0, 0);
const highlightColor = new THREE.Color();

const LAYER_COLORS = [
  0xff4444, 0xfa7316, 0xf59e0b, 0xeab308, 0x84cc16,
  0x22c55e, 0x14b8a6, 0x06b6d4, 0x3b82f6, 0x6366f1,
  0x8b5cf6, 0xa855f7, 0xd946ef, 0xec4899, 0xf43f5e,
  0x10b981, 0x0ea5e9
];

function shouldUseLiteModel() {
  const perfMode = document.body && document.body.dataset
    ? document.body.dataset.perfMode
    : 'full';
  if (perfMode === 'lite') return true;

  const lowMemory = typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 6;
  const lowCpu = typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 6;
  const smallViewport = window.matchMedia('(max-width: 900px)').matches;
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const saveData = !!(connection && connection.saveData);
  const slowNetwork = !!(
    connection &&
    typeof connection.effectiveType === 'string' &&
    /(^2g$|^slow-2g$|^3g$)/i.test(connection.effectiveType)
  );

  return lowMemory || lowCpu || smallViewport || saveData || slowNetwork;
}

function getModelCandidates() {
  const preferLite = shouldUseLiteModel();
  if (preferLite) {
    return [
      MODEL_URL_LITE_LOCAL.href,
      MODEL_URL_FULL_LOCAL.href,
      MODEL_URL_LITE_RAW,
      MODEL_URL_FULL_RAW,
    ];
  }
  return [
    MODEL_URL_FULL_LOCAL.href,
    MODEL_URL_LITE_LOCAL.href,
    MODEL_URL_FULL_RAW,
    MODEL_URL_LITE_RAW,
  ];
}

function normalizeLoadError(err) {
  if (!err) return 'unknown error';
  if (typeof err === 'string') return err;
  if (err && typeof err.message === 'string' && err.message.trim()) return err.message.trim();
  if (err && err.target && typeof err.target.status === 'number') {
    return `network status ${err.target.status}`;
  }
  return String(err);
}

function loadModel(url, decoderPath) {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.setCrossOrigin('anonymous');
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(decoderPath);
    loader.setDRACOLoader(dracoLoader);

    loader.load(
      url,
      (gltf) => {
        dracoLoader.dispose();
        resolve(gltf);
      },
      undefined,
      (err) => {
        dracoLoader.dispose();
        reject(err);
      }
    );
  });
}

async function loadModelWithFallback() {
  const candidates = getModelCandidates();
  let lastErr = null;

  for (const modelUrl of candidates) {
    for (const decoderPath of DECODER_PATHS) {
      try {
        const gltf = await loadModel(modelUrl, decoderPath);
        selectedModelUrl = modelUrl;
        selectedDecoderPath = decoderPath;
        console.info('[teardown] model loaded', { modelUrl: selectedModelUrl, decoderPath: selectedDecoderPath });
        return gltf;
      } catch (err) {
        lastErr = err;
        console.warn('[teardown] model load attempt failed', {
          modelUrl,
          decoderPath,
          error: normalizeLoadError(err),
        });
      }
    }
  }

  throw lastErr || new Error('No GLB source could be loaded');
}

function ensureGLTFLoaded() {
  if (cachedGLTF) return Promise.resolve(cachedGLTF);
  if (gltfLoadPromise) return gltfLoadPromise;
  lastLoadError = '';

  gltfLoadPromise = loadModelWithFallback()
    .then((gltf) => {
      cachedGLTF = gltf;
      return gltf;
    })
    .catch((err) => {
      lastLoadError = normalizeLoadError(err);
      gltfLoadPromise = null;
      throw err;
    });

  return gltfLoadPromise;
}

export function getLastTeardownError() {
  return lastLoadError;
}

export async function preloadChipTeardown() {
  try {
    await ensureGLTFLoaded();
    return true;
  } catch (err) {
    console.error('[teardown] preload failed:', err);
    return false;
  }
}

function setGlobalLayerFns() {
  window.highlightChipLayer = function highlightChipLayer(labelIdx) {
    if (layerMaterials.length === 0) return;
    const meshIdx = Math.min(labelIdx, layerMaterials.length - 1);
    highlightColor.setHex(LAYER_COLORS[labelIdx % LAYER_COLORS.length]);

    layerMaterials.forEach((mat, i) => {
      if (!mat) return;
      if (i === meshIdx) {
        mat.transparent = false;
        mat.opacity = 1;
        if (mat.emissive) mat.emissive.copy(highlightColor);
        if (typeof mat.emissiveIntensity === 'number') mat.emissiveIntensity = 0.6;
      } else {
        mat.transparent = true;
        mat.opacity = 0.15;
        if (mat.emissive) mat.emissive.setHex(0x000000);
        if (typeof mat.emissiveIntensity === 'number') mat.emissiveIntensity = 0;
      }
      mat.needsUpdate = true;
    });
  };

  window.resetChipLayers = function resetChipLayers() {
    layerMaterials.forEach((mat, i) => {
      const base = baseMaterialState[i];
      if (!mat || !base) return;
      mat.transparent = base.transparent;
      mat.opacity = base.opacity;
      if (mat.emissive && base.emissive) mat.emissive.copy(base.emissive);
      if (typeof mat.emissiveIntensity === 'number') {
        mat.emissiveIntensity = base.emissiveIntensity;
      }
      mat.needsUpdate = true;
    });
  };
}

function clearGlobalLayerFns() {
  window.highlightChipLayer = undefined;
  window.resetChipLayers = undefined;
}

function buildScene(container, isLiteMode) {
  const w = container.clientWidth;
  const h = container.clientHeight;

  renderer = new THREE.WebGLRenderer({ antialias: !isLiteMode, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(devicePixelRatio, isLiteMode ? 1.25 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  renderer.domElement.style.cssText =
    'position:absolute;inset:0;width:100%;height:100%;z-index:2;pointer-events:none;opacity:0;transition:opacity 0.6s ease;';
  container.appendChild(renderer.domElement);
  requestAnimationFrame(() => {
    if (renderer) renderer.domElement.style.opacity = '1';
  });

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(50, w / h, 0.001, 100);
  camera.position.set(0, 1.5, 3.5);
  lookTarget.set(0, 0, 0);
  camera.lookAt(lookTarget);

  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const d1 = new THREE.DirectionalLight(0xffffff, 1.1);
  d1.position.set(3, 5, 4);
  scene.add(d1);
  const d2 = new THREE.DirectionalLight(0x6688ff, 0.5);
  d2.position.set(-3, 2, -2);
  scene.add(d2);

  const pivotGroup = new THREE.Group();
  scene.add(pivotGroup);
  model = cachedGLTF.scene.clone(true);
  pivotGroup.add(model);
  pivot = pivotGroup;

  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.sub(center);

  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  pivot.scale.setScalar(2.2 / maxDim);
  pivot.rotation.set(-0.3, 0.4, 0.1);

  allMeshes = [];
  layerMaterials = [];
  baseMaterialState = [];
  model.traverse((child) => {
    if (!child.isMesh) return;
    const clonedMaterial = child.material.clone();
    child.material = clonedMaterial;
    allMeshes.push(child);
    layerMaterials.push(clonedMaterial);
    baseMaterialState.push({
      transparent: clonedMaterial.transparent,
      opacity: clonedMaterial.opacity,
      emissive: clonedMaterial.emissive ? clonedMaterial.emissive.clone() : null,
      emissiveIntensity: typeof clonedMaterial.emissiveIntensity === 'number'
        ? clonedMaterial.emissiveIntensity
        : 0,
    });
  });
  setGlobalLayerFns();

  const animate = () => {
    if (!renderer || !scene || !camera) return;
    animId = requestAnimationFrame(animate);
    camera.lookAt(lookTarget);
    renderer.render(scene, camera);
  };
  animate();

  roObs = new ResizeObserver(() => {
    if (!renderer || !camera) return;
    const w2 = container.clientWidth;
    const h2 = container.clientHeight;
    if (!w2 || !h2) return;
    renderer.setSize(w2, h2);
    camera.aspect = w2 / h2;
    camera.updateProjectionMatrix();
  });
  roObs.observe(container);
}

function buildTimeline(scroller, spacer) {
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: spacer,
      scroller,
      start: 'top top',
      end: 'bottom top',
      scrub: 0.85,
      invalidateOnRefresh: true,
    }
  });

  tl.to(camera.position, {
    x: 0, y: 0.1, z: -0.8,
    duration: 1, ease: 'none'
  }, 0);

  tl.to(lookTarget, {
    x: 0, y: 0, z: -2.5,
    duration: 1, ease: 'none'
  }, 0);

  tl.to(pivot.rotation, {
    x: 0, y: 0, z: 0,
    duration: 0.3, ease: 'power2.inOut'
  }, 0);

  stInstance = tl.scrollTrigger;
  requestAnimationFrame(() => ScrollTrigger.refresh());
}

export async function initChipTeardown(modalRoot) {
  const container = modalRoot.querySelector('.chip-viewer-container');
  const scroller = modalRoot.querySelector('.modal-scroll-container');
  const spacer = modalRoot.querySelector('#teardown-spacer');
  if (!container || !scroller || !spacer) return false;

  destroyChipTeardown();

  try {
    await ensureGLTFLoaded();
  } catch (err) {
    console.error('[teardown] GLB load failed:', err);
    return false;
  }

  if (!document.body.contains(container)) return false;
  const isLiteMode = document.body.dataset.perfMode === 'lite';
  buildScene(container, isLiteMode);
  buildTimeline(scroller, spacer);
  return true;
}

export function destroyChipTeardown() {
  if (animId) {
    cancelAnimationFrame(animId);
    animId = 0;
  }
  if (stInstance) {
    stInstance.kill();
    stInstance = null;
  }
  if (roObs) {
    roObs.disconnect();
    roObs = null;
  }
  if (renderer) {
    renderer.dispose();
    renderer.domElement.remove();
  }

  layerMaterials.forEach((mat) => {
    if (mat && typeof mat.dispose === 'function') mat.dispose();
  });
  allMeshes = [];
  layerMaterials = [];
  baseMaterialState = [];
  clearGlobalLayerFns();

  renderer = null;
  scene = null;
  camera = null;
  model = null;
  pivot = null;
}
