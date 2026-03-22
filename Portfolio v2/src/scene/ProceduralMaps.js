import * as THREE from 'three';

function fract(value) {
  return value - Math.floor(value);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function fade(t) {
  return t * t * (3 - 2 * t);
}

function noise2D(x, y, seed = 0) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;

  const tx = x - x0;
  const ty = y - y0;

  const a = fract(Math.sin(x0 * 127.1 + y0 * 311.7 + seed * 17.0) * 43758.5453123);
  const b = fract(Math.sin(x1 * 127.1 + y0 * 311.7 + seed * 17.0) * 43758.5453123);
  const c = fract(Math.sin(x0 * 127.1 + y1 * 311.7 + seed * 17.0) * 43758.5453123);
  const d = fract(Math.sin(x1 * 127.1 + y1 * 311.7 + seed * 17.0) * 43758.5453123);

  const sx = fade(tx);
  const sy = fade(ty);
  return lerp(lerp(a, b, sx), lerp(c, d, sx), sy);
}

function fbm(x, y, seed = 0, octaves = 4) {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let total = 0;

  for (let i = 0; i < octaves; i++) {
    value += noise2D(x * frequency, y * frequency, seed + i * 13) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2.0;
  }

  return value / total;
}

function clamp01(value) {
  return Math.min(Math.max(value, 0), 1);
}

function createCanvas(size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function textureFromCanvas(canvas, options = {}) {
  const {
    colorSpace = THREE.NoColorSpace,
    repeat = [1, 1],
  } = options;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  texture.needsUpdate = true;
  return texture;
}

function heightToNormalTexture(height, size, strength = 1.0, repeat = [1, 1]) {
  const canvas = createCanvas(size);
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const left = height[y * size + ((x - 1 + size) % size)];
      const right = height[y * size + ((x + 1) % size)];
      const up = height[((y - 1 + size) % size) * size + x];
      const down = height[((y + 1) % size) * size + x];

      const dx = (right - left) * strength;
      const dy = (down - up) * strength;
      let nx = -dx;
      let ny = -dy;
      let nz = 1.0;

      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;

      const idx = (y * size + x) * 4;
      image.data[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      image.data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      image.data[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      image.data[idx + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
  return textureFromCanvas(canvas, { repeat });
}

function grayscaleTextureFromArray(values, size, repeat = [1, 1]) {
  const canvas = createCanvas(size);
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(size, size);

  for (let i = 0; i < values.length; i++) {
    const value = Math.round(clamp01(values[i]) * 255);
    const idx = i * 4;
    image.data[idx] = value;
    image.data[idx + 1] = value;
    image.data[idx + 2] = value;
    image.data[idx + 3] = 255;
  }

  ctx.putImageData(image, 0, 0);
  return textureFromCanvas(canvas, { repeat });
}

export function createBrushedMetalMaps(options = {}) {
  const size = options.size ?? 512;
  const repeat = options.repeat ?? [1, 1];
  const height = new Float32Array(size * size);
  const roughness = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const lineField = fbm(v * 220, u * 6, 11, 5);
      const scratches = fbm(u * 900, v * 40, 17, 3);
      const pitting = fbm(u * 34, v * 34, 27, 4);

      const idx = y * size + x;
      height[idx] = clamp01(
        0.48 +
        (lineField - 0.5) * 0.18 +
        (scratches - 0.5) * 0.05 +
        (pitting - 0.5) * 0.03
      );

      roughness[idx] = clamp01(
        0.36 +
        (1.0 - lineField) * 0.12 +
        (1.0 - scratches) * 0.08 +
        pitting * 0.1
      );
    }
  }

  return {
    roughnessMap: grayscaleTextureFromArray(roughness, size, repeat),
    normalMap: heightToNormalTexture(height, size, 3.2, repeat),
  };
}

export function createSubstrateMaps(options = {}) {
  const size = options.size ?? 512;
  const repeat = options.repeat ?? [2.5, 2.5];
  const height = new Float32Array(size * size);
  const roughness = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const weaveA = fbm(u * 22, v * 180, 31, 4);
      const weaveB = fbm(u * 180, v * 22, 37, 4);
      const grain = fbm(u * 84, v * 84, 41, 3);

      const idx = y * size + x;
      height[idx] = clamp01(
        0.5 +
        (weaveA - 0.5) * 0.06 +
        (weaveB - 0.5) * 0.04 +
        (grain - 0.5) * 0.03
      );

      roughness[idx] = clamp01(
        0.62 +
        (1.0 - weaveA) * 0.14 +
        (1.0 - weaveB) * 0.08 +
        grain * 0.08
      );
    }
  }

  return {
    roughnessMap: grayscaleTextureFromArray(roughness, size, repeat),
    normalMap: heightToNormalTexture(height, size, 2.2, repeat),
  };
}

export function createCeramicMaps(options = {}) {
  const size = options.size ?? 384;
  const repeat = options.repeat ?? [1.5, 1.5];
  const height = new Float32Array(size * size);
  const roughness = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const grain = fbm(u * 90, v * 90, 51, 4);
      const blotch = fbm(u * 18, v * 18, 57, 3);

      const idx = y * size + x;
      height[idx] = clamp01(0.5 + (grain - 0.5) * 0.05 + (blotch - 0.5) * 0.02);
      roughness[idx] = clamp01(0.66 + (1.0 - grain) * 0.14 + blotch * 0.06);
    }
  }

  return {
    roughnessMap: grayscaleTextureFromArray(roughness, size, repeat),
    normalMap: heightToNormalTexture(height, size, 1.8, repeat),
  };
}

export function deriveMapsFromImage(image, options = {}) {
  const size = options.size ?? 1024;
  const repeat = options.repeat ?? [1, 1];
  const canvas = createCanvas(size);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, size, size);

  const { data } = ctx.getImageData(0, 0, size, size);
  const height = new Float32Array(size * size);
  const roughness = new Float32Array(size * size);

  for (let i = 0; i < height.length; i++) {
    const idx = i * 4;
    const r = data[idx] / 255;
    const g = data[idx + 1] / 255;
    const b = data[idx + 2] / 255;
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    height[i] = clamp01(Math.pow(luminance, 1.25));
    roughness[i] = clamp01(0.32 + (1.0 - luminance) * 0.45);
  }

  return {
    roughnessMap: grayscaleTextureFromArray(roughness, size, repeat),
    normalMap: heightToNormalTexture(height, size, 5.0, repeat),
  };
}
