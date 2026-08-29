import { HalftoneSettings } from '../types';

/**
 * Applies smart S-curve contrast, black floor, and highlight stretch from a single master contrast slider
 */
export function applySmartContrast(lum: number, contrast: number): number {
  // Normalize contrast (0 to 100) -> (0 to 1)
  const c = Math.max(0, Math.min(100, contrast)) / 100;

  // 1. Dynamic Black & White points
  const blackFloor = c * 0.12; // 0 to 0.12
  const whiteCeil = 1.0 - c * 0.08; // 1.0 to 0.92

  let val = lum;
  if (val <= blackFloor) {
    val = 0;
  } else if (val >= whiteCeil) {
    val = 1;
  } else {
    val = (val - blackFloor) / (whiteCeil - blackFloor);
  }

  // 2. High-grade S-curve sigmoid transfer function
  if (c > 0.05) {
    const power = 1 + c * 2.2;
    val = val < 0.5
      ? 0.5 * Math.pow(2 * val, power)
      : 1 - 0.5 * Math.pow(2 * (1 - val), power);
  }

  return Math.max(0, Math.min(1, val));
}

/**
 * Generates stylized high-contrast grayscale or halftone raster artwork
 */
export function renderHalftone(
  sourceCtx: CanvasRenderingContext2D,
  targetCtx: CanvasRenderingContext2D,
  width: number,
  height: number,
  settings: HalftoneSettings
): void {
  targetCtx.clearRect(0, 0, width, height);

  const imgData = sourceCtx.getImageData(0, 0, width, height);
  const srcPixels = imgData.data;

  const { mode, contrast, dotSize, invert } = settings;

  // 1. Generate High-Contrast Rich Grayscale Base Canvas
  const grayCanvas = document.createElement('canvas');
  grayCanvas.width = width;
  grayCanvas.height = height;
  const grayCtx = grayCanvas.getContext('2d', { willReadFrequently: true });
  if (!grayCtx) return;

  const grayImgData = grayCtx.createImageData(width, height);
  const grayPixels = grayImgData.data;
  const lumBuffer = new Float32Array(width * height);

  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    const r = srcPixels[idx];
    const g = srcPixels[idx + 1];
    const b = srcPixels[idx + 2];
    const a = srcPixels[idx + 3] / 255;

    if (a < 0.02) {
      grayPixels[idx] = 255;
      grayPixels[idx + 1] = 255;
      grayPixels[idx + 2] = 255;
      grayPixels[idx + 3] = 255;
      lumBuffer[i] = 1.0;
      continue;
    }

    // Standard Rec.709 perceptual luminance
    const rawLum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const mappedLum = applySmartContrast(rawLum, contrast);

    lumBuffer[i] = mappedLum;

    const grayVal = Math.round((invert ? 1 - mappedLum : mappedLum) * 255);
    grayPixels[idx] = grayVal;
    grayPixels[idx + 1] = grayVal;
    grayPixels[idx + 2] = grayVal;
    grayPixels[idx + 3] = 255;
  }

  grayCtx.putImageData(grayImgData, 0, 0);

  // If mode is pure high-contrast grayscale, output immediately
  if (mode === 'grayscale-contrast') {
    targetCtx.drawImage(grayCanvas, 0, 0);
    return;
  }

  // 2. Halftone Screen Pattern Canvas
  const htPatternCanvas = document.createElement('canvas');
  htPatternCanvas.width = width;
  htPatternCanvas.height = height;
  const htCtx = htPatternCanvas.getContext('2d', { willReadFrequently: true });
  if (!htCtx) return;

  // Solid white paper base for dots
  htCtx.fillStyle = '#ffffff';
  htCtx.fillRect(0, 0, width, height);

  const inkColor = invert ? '#ffffff' : '#000000';
  htCtx.fillStyle = inkColor;
  htCtx.strokeStyle = inkColor;

  const gridStep = Math.max(2, dotSize);
  const angle = 45;
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const diag = Math.sqrt(width * width + height * height);
  const minX = -diag;
  const maxX = diag * 2;
  const minY = -diag;
  const maxY = diag * 2;

  const getLum = (px: number, py: number): number => {
    const ix = Math.floor(Math.max(0, Math.min(width - 1, px)));
    const iy = Math.floor(Math.max(0, Math.min(height - 1, py)));
    return lumBuffer[iy * width + ix];
  };

  const getRegionLum = (cx: number, cy: number, radius: number): number => {
    let sum = 0;
    let count = 0;
    const step = Math.max(1, Math.floor(radius / 2));
    for (let dy = -radius; dy <= radius; dy += step) {
      for (let dx = -radius; dx <= radius; dx += step) {
        if (dx * dx + dy * dy <= radius * radius) {
          sum += getLum(cx + dx, cy + dy);
          count++;
        }
      }
    }
    return count > 0 ? sum / count : getLum(cx, cy);
  };

  if (mode === 'dots' || mode === 'hybrid') {
    const maxRadius = (gridStep / Math.SQRT2) * 1.08;
    htCtx.beginPath();

    for (let gy = minY; gy < maxY; gy += gridStep) {
      for (let gx = minX; gx < maxX; gx += gridStep) {
        const x = gx * cos - gy * sin;
        const y = gx * sin + gy * cos;

        if (x < -gridStep || x > width + gridStep || y < -gridStep || y > height + gridStep) {
          continue;
        }

        const lum = getRegionLum(x, y, gridStep / 2);
        const darkness = 1 - lum;

        if (darkness <= 0.02) continue;

        if (darkness >= 0.98) {
          const half = gridStep / 2;
          htCtx.rect(x - half, y - half, gridStep, gridStep);
        } else {
          const r = maxRadius * Math.sqrt(darkness);
          htCtx.moveTo(x + r, y);
          htCtx.arc(x, y, r, 0, Math.PI * 2);
        }
      }
    }
    htCtx.fill();
  } else if (mode === 'engraving') {
    htCtx.lineWidth = 1;
    htCtx.lineCap = 'round';

    for (let gy = minY; gy < maxY; gy += gridStep) {
      htCtx.beginPath();
      let isDrawing = false;

      for (let gx = minX; gx < maxX; gx += 2) {
        let x = gx * cos - gy * sin;
        let y = gx * sin + gy * cos;

        const wave = Math.sin(gx * 0.08) * 2.5;
        x += -sin * wave;
        y += cos * wave;

        if (x < 0 || x >= width || y < 0 || y >= height) {
          isDrawing = false;
          continue;
        }

        const lum = getLum(x, y);
        const darkness = 1 - lum;

        if (darkness > 0.15) {
          const thickness = Math.max(0.5, darkness * gridStep * 0.9);
          htCtx.lineWidth = thickness;
          if (!isDrawing) {
            htCtx.moveTo(x, y);
            isDrawing = true;
          } else {
            htCtx.lineTo(x, y);
          }
        } else {
          isDrawing = false;
        }
      }
      htCtx.stroke();
    }
  }

  // 3. Output Composition
  if (mode === 'hybrid') {
    const outCanvas = document.createElement('canvas');
    outCanvas.width = width;
    outCanvas.height = height;
    const outCtx = outCanvas.getContext('2d');
    if (!outCtx) return;

    outCtx.drawImage(grayCanvas, 0, 0);
    outCtx.save();
    outCtx.globalCompositeOperation = 'multiply';
    outCtx.globalAlpha = 0.55;
    outCtx.drawImage(htPatternCanvas, 0, 0);
    outCtx.restore();
    targetCtx.drawImage(outCanvas, 0, 0);
  } else {
    targetCtx.drawImage(htPatternCanvas, 0, 0);
  }
}
