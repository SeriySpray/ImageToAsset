import { TornEdgeSettings } from '../types';
import { FastNoise } from './noise';

// Reusable static buffers for distance transform to avoid GC allocations
let sharedF: Float32Array | null = null;
let sharedD: Float32Array | null = null;
let sharedV: Int32Array | null = null;
let sharedZ: Float32Array | null = null;

function ensureBuffers(maxDim: number) {
  if (!sharedF || sharedF.length < maxDim) {
    sharedF = new Float32Array(maxDim);
    sharedD = new Float32Array(maxDim);
    sharedV = new Int32Array(maxDim);
    sharedZ = new Float32Array(maxDim + 1);
  }
}

/**
 * High-performance Euclidean Distance Transform (8SED / Felzenszwalb-Huttenlocher) in O(N) time
 */
export function computeDistanceTransform(
  mask: Uint8ClampedArray,
  width: number,
  height: number
): Float32Array {
  const size = width * height;
  const dist = new Float32Array(size);
  const INF = 1e9;

  // Initialize: 0 if inside mask, INF if outside
  for (let i = 0; i < size; i++) {
    dist[i] = mask[i] >= 128 ? 0 : INF;
  }

  const maxDim = Math.max(width, height);
  ensureBuffers(maxDim);

  const f = sharedF!;
  const d = sharedD!;
  const v = sharedV!;
  const z = sharedZ!;

  // Transform along columns
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      f[y] = dist[y * width + x];
    }

    let k = 0;
    v[0] = 0;
    z[0] = -INF;
    z[1] = INF;

    for (let q = 1; q < height; q++) {
      let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) {
        k--;
        s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      }
      k++;
      v[k] = q;
      z[k] = s;
      z[k + 1] = INF;
    }

    k = 0;
    for (let q = 0; q < height; q++) {
      while (z[k + 1] < q) k++;
      const dy = q - v[k];
      d[q] = dy * dy + f[v[k]];
    }

    for (let y = 0; y < height; y++) {
      dist[y * width + x] = d[y];
    }
  }

  // Transform along rows
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      f[x] = dist[rowOffset + x];
    }

    let k = 0;
    v[0] = 0;
    z[0] = -INF;
    z[1] = INF;

    for (let q = 1; q < width; q++) {
      let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) {
        k--;
        s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      }
      k++;
      v[k] = q;
      z[k] = s;
      z[k + 1] = INF;
    }

    k = 0;
    for (let q = 0; q < width; q++) {
      while (z[k + 1] < q) k++;
      const dx = q - v[k];
      d[q] = dx * dx + f[v[k]];
    }

    for (let x = 0; x < width; x++) {
      dist[rowOffset + x] = Math.sqrt(d[x]);
    }
  }

  return dist;
}

const noiseGenerator = new FastNoise(4242);

/**
 * Optimized Torn Paper sticker edge generator and composite renderer
 */
export function renderTornPaperAsset(
  halftoneCanvas: HTMLCanvasElement,
  targetCtx: CanvasRenderingContext2D,
  maskData: Uint8ClampedArray,
  width: number,
  height: number,
  settings: TornEdgeSettings
): void {
  targetCtx.clearRect(0, 0, width, height);

  if (!settings.enabled) {
    // If torn edge is disabled, draw halftone clipped directly to mask
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    tempCtx.drawImage(halftoneCanvas, 0, 0);
    const imgData = tempCtx.getImageData(0, 0, width, height);
    const pixels = imgData.data;

    for (let i = 0; i < width * height; i++) {
      if (maskData[i] < 128) {
        pixels[i * 4 + 3] = 0;
      }
    }
    tempCtx.putImageData(imgData, 0, 0);
    targetCtx.drawImage(tempCanvas, 0, 0);
    return;
  }

  // 1. Calculate distance transform from selection mask
  const distField = computeDistanceTransform(maskData, width, height);

  // 2. Generate paper sticker backing
  const paperCanvas = document.createElement('canvas');
  paperCanvas.width = width;
  paperCanvas.height = height;
  const paperCtx = paperCanvas.getContext('2d', { willReadFrequently: true });
  if (!paperCtx) return;

  const paperImgData = paperCtx.createImageData(width, height);
  const paperPixels = paperImgData.data;

  // Parse paper background color
  const hex = settings.paperColor.replace('#', '');
  const pr = parseInt(hex.substring(0, 2), 16) || 255;
  const pg = parseInt(hex.substring(2, 4), 16) || 255;
  const pb = parseInt(hex.substring(4, 6), 16) || 255;

  const { padding, roughness, frequency, octaves, paperTexture } = settings;
  const maxPossiblePadding = padding + roughness * 1.6;

  // Render paper backing with fast boundary noise evaluation
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      const idx = rowOffset + x;
      const pixelIdx = idx * 4;
      const dist = distField[idx];

      // Fast path: Far outside sticker
      if (dist > maxPossiblePadding) {
        paperPixels[pixelIdx + 3] = 0;
        continue;
      }

      // Fast path: Inside mask core
      if (dist === 0) {
        let r = pr;
        let g = pg;
        let b = pb;
        if (paperTexture) {
          const grain = (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453 % 1) * 6 - 3;
          r = Math.max(0, Math.min(255, r + grain));
          g = Math.max(0, Math.min(255, g + grain));
          b = Math.max(0, Math.min(255, b + grain));
        }
        paperPixels[pixelIdx] = r;
        paperPixels[pixelIdx + 1] = g;
        paperPixels[pixelIdx + 2] = b;
        paperPixels[pixelIdx + 3] = 255;
        continue;
      }

      // Boundary region: Evaluate fractal torn paper edge noise
      const n1 = noiseGenerator.fbm2D(x * frequency, y * frequency, octaves);
      const n2 = noiseGenerator.noise2D(x * frequency * 4, y * frequency * 4) * 0.25;
      const tornNoise = (n1 + n2) * roughness;
      const effectivePadding = Math.max(2, padding + tornNoise);

      if (dist <= effectivePadding) {
        let r = pr;
        let g = pg;
        let b = pb;

        if (paperTexture) {
          const grain = (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453 % 1) * 6 - 3;
          r = Math.max(0, Math.min(255, r + grain));
          g = Math.max(0, Math.min(255, g + grain));
          b = Math.max(0, Math.min(255, b + grain));
        }

        const edgeDist = effectivePadding - dist;
        let alpha = 255;
        if (edgeDist < 1.2) {
          alpha = Math.floor(Math.max(0, Math.min(1, edgeDist / 1.2)) * 255);
        }

        paperPixels[pixelIdx] = r;
        paperPixels[pixelIdx + 1] = g;
        paperPixels[pixelIdx + 2] = b;
        paperPixels[pixelIdx + 3] = alpha;
      } else {
        paperPixels[pixelIdx + 3] = 0;
      }
    }
  }

  paperCtx.putImageData(paperImgData, 0, 0);

  // 3. Render drop shadow if requested
  if (settings.dropShadow) {
    targetCtx.save();
    targetCtx.shadowColor = `rgba(0, 0, 0, ${settings.shadowOpacity || 0.35})`;
    targetCtx.shadowBlur = settings.shadowBlur || 18;
    targetCtx.shadowOffsetX = 0;
    targetCtx.shadowOffsetY = 8;
    targetCtx.drawImage(paperCanvas, 0, 0);
    targetCtx.restore();
  }

  // 4. Draw paper base
  targetCtx.drawImage(paperCanvas, 0, 0);

  // 5. Draw halftone artwork clipped strictly inside object mask
  const clippedArtCanvas = document.createElement('canvas');
  clippedArtCanvas.width = width;
  clippedArtCanvas.height = height;
  const clippedArtCtx = clippedArtCanvas.getContext('2d');
  if (!clippedArtCtx) return;

  clippedArtCtx.drawImage(halftoneCanvas, 0, 0);
  const artImgData = clippedArtCtx.getImageData(0, 0, width, height);
  const artPixels = artImgData.data;

  for (let i = 0; i < width * height; i++) {
    const m = maskData[i];
    if (m === 0) {
      artPixels[i * 4 + 3] = 0;
    } else if (m < 255) {
      artPixels[i * 4 + 3] = Math.floor((artPixels[i * 4 + 3] * m) / 255);
    }
  }
  clippedArtCtx.putImageData(artImgData, 0, 0);

  // Composite halftone onto paper
  targetCtx.drawImage(clippedArtCanvas, 0, 0);
}
