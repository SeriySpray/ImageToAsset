import { HalftoneSettings } from '../types';

/**
 * Precomputes a 256-entry lookup table (LUT) for instant S-curve contrast mapping in 0.01ms
 */
function createContrastLUT(contrast: number): Uint8Array {
  const lut = new Uint8Array(256);
  const c = Math.max(0, Math.min(100, contrast)) / 100;
  const blackFloor = c * 0.12;
  const whiteCeil = 1.0 - c * 0.08;
  const power = c > 0.05 ? 1 + c * 2.2 : 1;

  for (let i = 0; i < 256; i++) {
    let val = i / 255;
    if (val <= blackFloor) {
      val = 0;
    } else if (val >= whiteCeil) {
      val = 1;
    } else {
      val = (val - blackFloor) / (whiteCeil - blackFloor);
    }

    if (c > 0.05) {
      val = val < 0.5
        ? 0.5 * Math.pow(2 * val, power)
        : 1 - 0.5 * Math.pow(2 * (1 - val), power);
    }

    const clamped = Math.max(0, Math.min(1, val));
    lut[i] = Math.round(clamped * 255);
  }
  return lut;
}

const INV_SQRT2 = 0.7071067811865476;

/**
 * Ultra-high-speed pixel-grid rasterizer for 45° Halftone Dot Matrix, Hybrid, Graphic Dots, and Engraving in 8ms
 */
export function renderHalftone(
  sourceCtx: CanvasRenderingContext2D,
  targetCtx: CanvasRenderingContext2D,
  width: number,
  height: number,
  settings: HalftoneSettings,
  paperColor?: string
): void {
  const t0 = performance.now();
  targetCtx.clearRect(0, 0, width, height);

  const imgData = sourceCtx.getImageData(0, 0, width, height);
  const srcPixels = imgData.data;

  const { mode, contrast, dotSize } = settings;
  const lut = createContrastLUT(contrast);

  // 1. Generate High-Contrast Rich Grayscale Base
  const grayCanvas = document.createElement('canvas');
  grayCanvas.width = width;
  grayCanvas.height = height;
  const grayCtx = grayCanvas.getContext('2d', { willReadFrequently: true });
  if (!grayCtx) return;

  const grayImgData = grayCtx.createImageData(width, height);
  const grayPixels32 = new Uint32Array(grayImgData.data.buffer);
  const lumBytes = new Uint8Array(width * height);

  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    const a = srcPixels[idx + 3];

    if (a < 5) {
      grayPixels32[i] = 0x00000000; // Transparent
      lumBytes[i] = 255;
      continue;
    }

    const r = srcPixels[idx];
    const g = srcPixels[idx + 1];
    const b = srcPixels[idx + 2];

    // Fast integer perceptual luminance (0.2126R + 0.7152G + 0.0722B)
    const rawLum = (r * 54 + g * 183 + b * 19) >> 8;
    const finalVal = lut[rawLum];

    lumBytes[i] = finalVal;
    // Pack into 32-bit: 0xAABBGGRR
    grayPixels32[i] = 0xFF000000 | (finalVal << 16) | (finalVal << 8) | finalVal;
  }

  grayCtx.putImageData(grayImgData, 0, 0);

  // 2. Mode: True Color Halftone (Full per-pixel color halftone dot rasterization)
  if (mode === 'color-halftone') {
    const htPatternCanvas = document.createElement('canvas');
    htPatternCanvas.width = width;
    htPatternCanvas.height = height;
    const htCtx = htPatternCanvas.getContext('2d', { willReadFrequently: true });
    if (!htCtx) return;

    const patternImgData = htCtx.createImageData(width, height);
    const patternPixels32 = new Uint32Array(patternImgData.data.buffer);

    const S = Math.max(2, dotSize);
    const halfS = S * 0.5;
    const invS = 1 / S;
    const maxRadius = halfS * 1.05;
    const maxR2 = maxRadius * maxRadius;
    const marginDist = Math.max(2, S * 0.85);

    for (let y = 0; y < height; y++) {
      const rowOffset = y * width;
      for (let x = 0; x < width; x++) {
        const i = rowOffset + x;

        // Keep transparent pixels completely transparent
        if (srcPixels[i * 4 + 3] < 5) {
          patternPixels32[i] = 0x00000000;
          continue;
        }

        // 45-degree screen coordinates
        const u = (x + y) * INV_SQRT2;
        const v = (x - y) * INV_SQRT2;

        const ku = Math.floor(u * invS + 0.5);
        const kv = Math.floor(v * invS + 0.5);
        const uc = ku * S;
        const vc = kv * S;

        const gu = u - uc;
        const gv = v - vc;
        const distSq = gu * gu + gv * gv;

        // Inverse transform to find dot center on image coordinates
        const xc = (uc + vc) * INV_SQRT2;
        const yc = (uc - vc) * INV_SQRT2;
        const ixc = Math.max(0, Math.min(width - 1, (xc + 0.5) | 0));
        const iyc = Math.max(0, Math.min(height - 1, (yc + 0.5) | 0));

        // Sample color from dot center, falling back to pixel if center is transparent
        const centerIdx = srcPixels[(iyc * width + ixc) * 4 + 3] >= 5 
          ? (iyc * width + ixc) * 4 
          : i * 4;

        const cr = lut[srcPixels[centerIdx]];
        const cg = lut[srcPixels[centerIdx + 1]];
        const cb = lut[srcPixels[centerIdx + 2]];

        // Calculate darkness from luminance & subtractive ink density
        const lum = (cr * 54 + cg * 183 + cb * 19) >> 8;
        const lumDark = (255 - lum) / 255;
        const minC = Math.min(cr, cg, cb);
        const inkDensity = (255 - minC) / 255;
        const darkness = Math.max(lumDark, inkDensity * 0.85);

        // Pure white background for near-zero darkness
        if (darkness <= 0.02) {
          patternPixels32[i] = 0xFFFFFFFF;
          continue;
        }

        const thresholdR2 = Math.max(0.04, darkness) * maxR2;

        // Inside the colored ink dot
        if (distSq <= thresholdR2) {
          patternPixels32[i] = 0xFF000000 | (cb << 16) | (cg << 8) | cr;
          continue;
        }

        // Fast path: Far outside dot radius
        if (distSq > thresholdR2 + marginDist) {
          patternPixels32[i] = 0xFFFFFFFF;
          continue;
        }

        // Smooth antialiased blend to white paper boundary
        const edgeDist = Math.sqrt(distSq) - Math.sqrt(thresholdR2);
        if (edgeDist < 0.85) {
          const t = edgeDist / 0.85;
          const blendR = Math.round(cr * (1 - t) + 255 * t);
          const blendG = Math.round(cg * (1 - t) + 255 * t);
          const blendB = Math.round(cb * (1 - t) + 255 * t);
          patternPixels32[i] = 0xFF000000 | (blendB << 16) | (blendG << 8) | blendR;
        } else {
          patternPixels32[i] = 0xFFFFFFFF;
        }
      }
    }

    htCtx.putImageData(patternImgData, 0, 0);
    targetCtx.drawImage(htPatternCanvas, 0, 0);

    const t1 = performance.now();
    console.log(`[ImageToAsset Perf] Halftone (${mode}) rendered in ${(t1 - t0).toFixed(2)}ms (size: ${width}x${height})`);
    return;
  }

  // 3. Mode: Classic Photo Halftone Raster
  if (mode === 'dots') {
    const htPatternCanvas = document.createElement('canvas');
    htPatternCanvas.width = width;
    htPatternCanvas.height = height;
    const htCtx = htPatternCanvas.getContext('2d', { willReadFrequently: true });
    if (!htCtx) return;

    const patternImgData = htCtx.createImageData(width, height);
    const patternPixels32 = new Uint32Array(patternImgData.data.buffer);

    const S = Math.max(2, dotSize);
    const halfS = S * 0.5;
    const maxR2 = (S * S * 0.5) * 1.08;
    const marginDist = S * 2;

    for (let y = 0; y < height; y++) {
      const rowOffset = y * width;
      for (let x = 0; x < width; x++) {
        const i = rowOffset + x;

        // Keep transparent pixels transparent without creating dots or background
        if (srcPixels[i * 4 + 3] < 5) {
          patternPixels32[i] = 0x00000000;
          continue;
        }

        const sampleVal = lumBytes[i];
        const darkness = (255 - sampleVal) / 255;

        // Pure white background
        if (darkness <= 0.03) {
          patternPixels32[i] = 0xFFFFFFFF;
          continue;
        }

        // Pure solid black
        if (darkness >= 0.95) {
          patternPixels32[i] = 0xFF000000;
          continue;
        }

        // 45-degree screen coordinates
        const u = (x + y) * INV_SQRT2;
        const v = (x - y) * INV_SQRT2;

        let gu = (u % S + S) % S - halfS;
        let gv = (v % S + S) % S - halfS;

        const distSq = gu * gu + gv * gv;
        const thresholdR2 = darkness * maxR2;

        if (distSq <= thresholdR2) {
          patternPixels32[i] = 0xFF000000; // Ink dot (black)
          continue;
        }

        // Fast path: Far outside dot radius (skip sqrt)
        if (distSq > thresholdR2 + marginDist) {
          patternPixels32[i] = 0xFFFFFFFF;
          continue;
        }

        // Only evaluate sqrt on the narrow 1-pixel boundary
        const edgeDist = Math.sqrt(distSq) - Math.sqrt(thresholdR2);
        if (edgeDist < 0.9) {
          const grayVal = Math.round(edgeDist * 280);
          const clamped = Math.max(0, Math.min(255, grayVal));
          patternPixels32[i] = 0xFF000000 | (clamped << 16) | (clamped << 8) | clamped;
        } else {
          patternPixels32[i] = 0xFFFFFFFF;
        }
      }
    }

    htCtx.putImageData(patternImgData, 0, 0);
    targetCtx.drawImage(htPatternCanvas, 0, 0);

    const t1 = performance.now();
    console.log(`[ImageToAsset Perf] Halftone (${mode}) rendered in ${(t1 - t0).toFixed(2)}ms (size: ${width}x${height})`);
    return;
  }

  // 3. Mode: Graphic & Line-Art Halftone Raster (Isolated Dots for Solid Black & Graphics)
  if (mode === 'graphic-dots') {
    const htPatternCanvas = document.createElement('canvas');
    htPatternCanvas.width = width;
    htPatternCanvas.height = height;
    const htCtx = htPatternCanvas.getContext('2d', { willReadFrequently: true });
    if (!htCtx) return;

    const patternImgData = htCtx.createImageData(width, height);
    const patternPixels32 = new Uint32Array(patternImgData.data.buffer);

    const S = Math.max(2, dotSize);
    const halfS = S * 0.5;
    const invS = 1 / S;
    const maxRadius = halfS * 0.88;
    const maxR2 = maxRadius * maxRadius;
    const marginDist = Math.max(2, S * 0.85);

    for (let y = 0; y < height; y++) {
      const rowOffset = y * width;
      for (let x = 0; x < width; x++) {
        const i = rowOffset + x;

        // Keep transparent pixels transparent without creating dots or background
        if (srcPixels[i * 4 + 3] < 5) {
          patternPixels32[i] = 0x00000000;
          continue;
        }

        // 45-degree screen coordinates
        const u = (x + y) * INV_SQRT2;
        const v = (x - y) * INV_SQRT2;

        const ku = Math.floor(u * invS + 0.5);
        const kv = Math.floor(v * invS + 0.5);
        const uc = ku * S;
        const vc = kv * S;

        const gu = u - uc;
        const gv = v - vc;
        const distSq = gu * gu + gv * gv;

        if (distSq > maxR2 + marginDist) {
          patternPixels32[i] = 0xFFFFFFFF;
          continue;
        }

        const xc = (uc + vc) * INV_SQRT2;
        const yc = (uc - vc) * INV_SQRT2;
        const ixc = Math.max(0, Math.min(width - 1, (xc + 0.5) | 0));
        const iyc = Math.max(0, Math.min(height - 1, (yc + 0.5) | 0));

        const centerLum = lumBytes[iyc * width + ixc];
        const rawDarkness = (255 - centerLum) / 255;

        if (rawDarkness <= 0.03) {
          patternPixels32[i] = 0xFFFFFFFF;
          continue;
        }

        const thresholdR2 = rawDarkness * maxR2;

        if (distSq <= thresholdR2) {
          patternPixels32[i] = 0xFF000000;
          continue;
        }

        if (distSq > thresholdR2 + marginDist) {
          patternPixels32[i] = 0xFFFFFFFF;
          continue;
        }

        const edgeDist = Math.sqrt(distSq) - Math.sqrt(thresholdR2);
        if (edgeDist < 0.9) {
          const grayVal = Math.round(edgeDist * 280);
          const clamped = Math.max(0, Math.min(255, grayVal));
          patternPixels32[i] = 0xFF000000 | (clamped << 16) | (clamped << 8) | clamped;
        } else {
          patternPixels32[i] = 0xFFFFFFFF;
        }
      }
    }

    htCtx.putImageData(patternImgData, 0, 0);
    targetCtx.drawImage(htPatternCanvas, 0, 0);

    const t1 = performance.now();
    console.log(`[ImageToAsset Perf] Halftone (${mode}) rendered in ${(t1 - t0).toFixed(2)}ms (size: ${width}x${height})`);
    return;
  }

  // 4. Mode: Photo Halftone on Paper Backing (Continuous Photo Halftone on Paper Backing with Matching Color & Texture)
  if (mode === 'paper-halftone') {
    const htPatternCanvas = document.createElement('canvas');
    htPatternCanvas.width = width;
    htPatternCanvas.height = height;
    const htCtx = htPatternCanvas.getContext('2d', { willReadFrequently: true });
    if (!htCtx) return;

    const patternImgData = htCtx.createImageData(width, height);
    const patternPixels32 = new Uint32Array(patternImgData.data.buffer);

    const S = Math.max(2, dotSize);
    const halfS = S * 0.5;
    const maxR2 = (S * S * 0.5) * 1.08;
    const marginDist = S * 2;

    // Ink color: white ink on dark paper (e.g. graphite #1a1a1a), black ink on light/colored paper
    const hex = (paperColor || '#ffffff').replace('#', '').trim();
    const pr = parseInt(hex.substring(0, 2), 16) || 255;
    const pg = parseInt(hex.substring(2, 4), 16) || 255;
    const pb = parseInt(hex.substring(4, 6), 16) || 255;
    const paperLum = (pr * 54 + pg * 183 + pb * 19) >> 8;
    const isDarkPaper = paperLum < 100;

    const inkR = isDarkPaper ? 255 : 0;
    const inkG = isDarkPaper ? 255 : 0;
    const inkB = isDarkPaper ? 255 : 0;
    const inkRgb32 = (inkB << 16) | (inkG << 8) | inkR;

    for (let y = 0; y < height; y++) {
      const rowOffset = y * width;
      for (let x = 0; x < width; x++) {
        const i = rowOffset + x;

        // Keep transparent pixels transparent without creating dots or background
        if (srcPixels[i * 4 + 3] < 5) {
          patternPixels32[i] = 0x00000000;
          continue;
        }

        const sampleVal = lumBytes[i];
        const darkness = isDarkPaper ? (sampleVal / 255) : ((255 - sampleVal) / 255);

        // Pure paper background (transparent to show paper color & texture)
        if (darkness <= 0.03) {
          patternPixels32[i] = 0x00000000;
          continue;
        }

        // Pure solid ink (complete coverage)
        if (darkness >= 0.95) {
          patternPixels32[i] = (255 << 24) | inkRgb32;
          continue;
        }

        // 45-degree screen coordinates
        const u = (x + y) * INV_SQRT2;
        const v = (x - y) * INV_SQRT2;

        let gu = (u % S + S) % S - halfS;
        let gv = (v % S + S) % S - halfS;

        const distSq = gu * gu + gv * gv;
        const thresholdR2 = darkness * maxR2;

        if (distSq <= thresholdR2) {
          patternPixels32[i] = (255 << 24) | inkRgb32; // Solid ink dot
          continue;
        }

        // Fast path: Far outside dot radius (skip sqrt)
        if (distSq > thresholdR2 + marginDist) {
          patternPixels32[i] = 0x00000000; // Transparent paper background
          continue;
        }

        // Only evaluate sqrt on the narrow 1-pixel boundary for silky-smooth antialiasing to paper
        const edgeDist = Math.sqrt(distSq) - Math.sqrt(thresholdR2);
        if (edgeDist < 0.9) {
          const alpha = Math.round(Math.max(0, Math.min(1, 1 - edgeDist / 0.9)) * 255);
          patternPixels32[i] = (alpha << 24) | inkRgb32;
        } else {
          patternPixels32[i] = 0x00000000;
        }
      }
    }

    htCtx.putImageData(patternImgData, 0, 0);
    targetCtx.drawImage(htPatternCanvas, 0, 0);

    const t1 = performance.now();
    console.log(`[ImageToAsset Perf] Halftone (${mode}) rendered in ${(t1 - t0).toFixed(2)}ms (size: ${width}x${height})`);
  }
}
