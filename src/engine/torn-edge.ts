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

// Distance transform cache
let cachedMaskRef: Uint8ClampedArray | null = null;
let cachedDistField: Float32Array | null = null;
let cachedWidth = 0;
let cachedHeight = 0;
let cachedSubsampled = false;

/**
 * High-performance Euclidean Distance Transform with 2x multi-resolution acceleration for 60 FPS
 */
export function computeDistanceTransform(
  mask: Uint8ClampedArray,
  width: number,
  height: number
): { distField: Float32Array; isSubsampled: boolean; gridW: number; gridH: number } {
  // Use 2x sub-grid acceleration if dimension is large (runs 4x faster in ~12ms)
  const shouldSubsample = width > 700 || height > 700;
  const gridW = shouldSubsample ? Math.ceil(width / 2) : width;
  const gridH = shouldSubsample ? Math.ceil(height / 2) : height;

  // Check cache (instant 0.00ms on slider moves)
  if (
    cachedMaskRef === mask &&
    cachedDistField &&
    cachedWidth === width &&
    cachedHeight === height &&
    cachedSubsampled === shouldSubsample
  ) {
    return { distField: cachedDistField, isSubsampled: shouldSubsample, gridW, gridH };
  }

  const t0 = performance.now();
  const size = gridW * gridH;
  const dist = new Float32Array(size);
  const INF = 1e8;

  // Initialize: 0 if inside mask, INF if outside
  if (shouldSubsample) {
    for (let y = 0; y < gridH; y++) {
      const srcRow = (y * 2) * width;
      const dstRow = y * gridW;
      for (let x = 0; x < gridW; x++) {
        const srcX = x * 2;
        dist[dstRow + x] = mask[srcRow + srcX] >= 128 ? 0 : INF;
      }
    }
  } else {
    for (let i = 0; i < size; i++) {
      dist[i] = mask[i] >= 128 ? 0 : INF;
    }
  }

  const maxDim = Math.max(gridW, gridH);
  ensureBuffers(maxDim);

  const f = sharedF!;
  const d = sharedD!;
  const v = sharedV!;
  const z = sharedZ!;

  // 1. Transform along columns
  for (let x = 0; x < gridW; x++) {
    for (let y = 0; y < gridH; y++) {
      f[y] = dist[y * gridW + x];
    }

    let k = 0;
    v[0] = 0;
    z[0] = -INF;
    z[1] = INF;

    for (let q = 1; q < gridH; q++) {
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
    for (let q = 0; q < gridH; q++) {
      while (z[k + 1] < q) k++;
      const dy = q - v[k];
      d[q] = dy * dy + f[v[k]];
    }

    for (let y = 0; y < gridH; y++) {
      dist[y * gridW + x] = d[y];
    }
  }

  // 2. Transform along rows
  for (let y = 0; y < gridH; y++) {
    const rowOffset = y * gridW;
    for (let x = 0; x < gridW; x++) {
      f[x] = dist[rowOffset + x];
    }

    let k = 0;
    v[0] = 0;
    z[0] = -INF;
    z[1] = INF;

    for (let q = 1; q < gridW; q++) {
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
    for (let q = 0; q < gridW; q++) {
      while (z[k + 1] < q) k++;
      const dx = q - v[k];
      d[q] = dx * dx + f[v[k]];
    }

    for (let x = 0; x < gridW; x++) {
      dist[rowOffset + x] = Math.sqrt(d[x]);
    }
  }

  // Update cache
  cachedMaskRef = mask;
  cachedDistField = dist;
  cachedWidth = width;
  cachedHeight = height;
  cachedSubsampled = shouldSubsample;

  const t1 = performance.now();
  console.log(`[ImageToAsset Perf] Distance transform computed in ${(t1 - t0).toFixed(2)}ms (grid: ${gridW}x${gridH}, subsampled: ${shouldSubsample})`);

  return { distField: dist, isSubsampled: shouldSubsample, gridW, gridH };
}

const noiseGenerator = new FastNoise(4242);

// Precomputed 256x256 high-fidelity paper texture map (fibers + tooth grain + pulp flecks)
const PAPER_TEXTURE_SIZE = 256;
const paperTextureMap = new Int8Array(PAPER_TEXTURE_SIZE * PAPER_TEXTURE_SIZE);

(() => {
  // Deterministic PRNG for consistent, beautiful paper grain
  let seed = 1337;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) | 0;
    return ((seed >>> 0) / 4294967296);
  };

  for (let y = 0; y < PAPER_TEXTURE_SIZE; y++) {
    for (let x = 0; x < PAPER_TEXTURE_SIZE; x++) {
      // 1. High frequency micro-grain (paper tooth)
      const microTooth = (rnd() - 0.5) * 12;

      // 2. Multi-directional organic paper fibers & pulp variation
      const organicPulp = Math.sin(x * 0.15) * Math.cos(y * 0.15) * 5;
      const diagonalFibers = Math.sin((x * 1.4 + y * 0.8) * 0.3) * 3.5;
      const horizontalGrain = Math.sin(y * 0.6 + rnd() * 0.5) * 2.5;

      // 3. Subtle natural pulp flecks and inclusions
      let pulpFleck = 0;
      if (rnd() < 0.007) {
        pulpFleck = (rnd() > 0.4 ? -1 : 1) * (9 + rnd() * 10);
      }

      const totalGrain = Math.round(microTooth + organicPulp + diagonalFibers + horizontalGrain + pulpFleck);
      paperTextureMap[y * PAPER_TEXTURE_SIZE + x] = Math.max(-24, Math.min(24, totalGrain));
    }
  }
})();

/**
 * Ultra-fast paper sticker backing renderer using 32-bit integer pixel writes, fast noise LUT, and multi-stage culling
 */
export function renderPaperBacking(
  targetCanvas: HTMLCanvasElement,
  maskData: Uint8ClampedArray,
  width: number,
  height: number,
  settings: TornEdgeSettings
): void {
  const t0 = performance.now();

  targetCanvas.width = width;
  targetCanvas.height = height;
  const paperCtx = targetCanvas.getContext('2d', { willReadFrequently: true });
  if (!paperCtx) return;

  const { distField, isSubsampled, gridW } = computeDistanceTransform(maskData, width, height);
  const paperImgData = paperCtx.createImageData(width, height);
  const pixels32 = new Uint32Array(paperImgData.data.buffer);

  // Parse paper background color into RGB
  const hex = settings.paperColor.replace('#', '');
  const pr = parseInt(hex.substring(0, 2), 16) || 255;
  const pg = parseInt(hex.substring(2, 4), 16) || 255;
  const pb = parseInt(hex.substring(4, 6), 16) || 255;

  const { padding, roughness, paperTexture } = settings;
  const maxPossiblePadding = padding + roughness * 1.25;
  const innerCorePadding = Math.max(0, padding - roughness * 1.25);

  // Render paper backing with instant O(1) noise lookup on boundary pixels
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    const gridY = isSubsampled ? y >> 1 : y;
    const gridRowOffset = gridY * gridW;
    const textureYOffset = (y & 255) * PAPER_TEXTURE_SIZE;

    for (let x = 0; x < width; x++) {
      const idx = rowOffset + x;
      const gridX = isSubsampled ? x >> 1 : x;
      const rawDist = distField[gridRowOffset + gridX];
      const dist = isSubsampled ? rawDist * 2 : rawDist;

      // Fast path 1: Far outside sticker (skip all math)
      if (dist > maxPossiblePadding) {
        pixels32[idx] = 0;
        continue;
      }

      // Fast path 2: Solid core of sticker (skip edge boundary math)
      if (dist <= innerCorePadding) {
        if (paperTexture) {
          const grain = paperTextureMap[textureYOffset + (x & 255)];
          const gr = Math.max(0, Math.min(255, pr + grain));
          const gg = Math.max(0, Math.min(255, pg + Math.round(grain * 0.95)));
          const gb = Math.max(0, Math.min(255, pb + Math.round(grain * 0.85)));
          pixels32[idx] = (255 << 24) | (gb << 16) | (gg << 8) | gr;
        } else {
          pixels32[idx] = (255 << 24) | (pb << 16) | (pg << 8) | pr;
        }
        continue;
      }

      // Fast path 3: Narrow boundary ribbon (instant O(1) table lookup)
      const noise = noiseGenerator.fastNoise2D(x, y);
      const tornNoise = noise * roughness;
      const effectivePadding = Math.max(2, padding + tornNoise);

      if (dist <= effectivePadding) {
        let gr = pr;
        let gg = pg;
        let gb = pb;

        if (paperTexture) {
          const grain = paperTextureMap[textureYOffset + (x & 255)];
          gr = Math.max(0, Math.min(255, pr + grain));
          gg = Math.max(0, Math.min(255, pg + Math.round(grain * 0.95)));
          gb = Math.max(0, Math.min(255, pb + Math.round(grain * 0.85)));
        }

        const edgeDist = effectivePadding - dist;
        const alpha = edgeDist < 1.2 ? Math.floor(Math.max(0, Math.min(1, edgeDist / 1.2)) * 255) : 255;
        pixels32[idx] = (alpha << 24) | (gb << 16) | (gg << 8) | gr;
      } else {
        pixels32[idx] = 0;
      }
    }
  }

  paperCtx.putImageData(paperImgData, 0, 0);

  const t1 = performance.now();
  console.log(`[ImageToAsset Perf] Paper backing rendered in ${(t1 - t0).toFixed(2)}ms (size: ${width}x${height})`);
}

/**
 * Ultra-fast GPU hardware composite of paper backing + halftone artwork clipped by mask
 */
export function renderTornPaperAsset(
  halftoneCanvas: HTMLCanvasElement,
  targetCtx: CanvasRenderingContext2D,
  maskCanvas: HTMLCanvasElement | Uint8ClampedArray,
  width: number,
  height: number,
  settings: TornEdgeSettings,
  preRenderedPaperCanvas?: HTMLCanvasElement | null
): void {
  const t0 = performance.now();
  targetCtx.clearRect(0, 0, width, height);

  if (!settings.enabled) {
    // If torn edge is disabled, draw halftone clipped directly to mask
    if (maskCanvas instanceof HTMLCanvasElement) {
      targetCtx.save();
      targetCtx.drawImage(halftoneCanvas, 0, 0);
      targetCtx.globalCompositeOperation = 'destination-in';
      targetCtx.drawImage(maskCanvas, 0, 0);
      targetCtx.restore();
    }
    return;
  }

  // 1. Get or render paper backing
  let paperCanvas = preRenderedPaperCanvas;
  if (!paperCanvas) {
    paperCanvas = document.createElement('canvas');
    if (maskCanvas instanceof Uint8ClampedArray) {
      renderPaperBacking(paperCanvas, maskCanvas, width, height, settings);
    }
  }

  // 2. Render drop shadow if requested
  if (settings.dropShadow) {
    targetCtx.save();
    targetCtx.shadowColor = `rgba(0, 0, 0, ${settings.shadowOpacity || 0.35})`;
    targetCtx.shadowBlur = settings.shadowBlur || 18;
    targetCtx.shadowOffsetX = 0;
    targetCtx.shadowOffsetY = 8;
    targetCtx.drawImage(paperCanvas, 0, 0);
    targetCtx.restore();
  }

  // 3. Draw paper base
  targetCtx.drawImage(paperCanvas, 0, 0);

  // 4. Draw halftone artwork clipped strictly inside mask via hardware Canvas 2D
  if (maskCanvas instanceof HTMLCanvasElement) {
    const clippedCanvas = document.createElement('canvas');
    clippedCanvas.width = width;
    clippedCanvas.height = height;
    const clipCtx = clippedCanvas.getContext('2d');
    if (clipCtx) {
      clipCtx.drawImage(halftoneCanvas, 0, 0);
      clipCtx.globalCompositeOperation = 'destination-in';
      clipCtx.drawImage(maskCanvas, 0, 0);
      targetCtx.drawImage(clippedCanvas, 0, 0);
    }
  }

  const t1 = performance.now();
  console.log(`[ImageToAsset Perf] Final composite completed in ${(t1 - t0).toFixed(2)}ms`);
}
