import { HalftoneSettings } from '../types';

/**
 * Applies professional S-curve contrast, brightness, gamma, and level adjustments to normalized luminance (0..1)
 */
export function mapLuminance(
  lum: number,
  contrast: number,
  brightness: number,
  blackThreshold: number,
  whiteThreshold: number,
  gamma = 1.0
): number {
  // Brightness (-50..50) -> (-0.25..0.25)
  let val = lum + brightness / 200;
  val = Math.max(0, Math.min(1, val));

  // Levels mapping (black point to white point)
  const bPoint = blackThreshold / 255;
  const wPoint = whiteThreshold / 255;
  if (wPoint > bPoint) {
    val = Math.max(0, Math.min(1, (val - bPoint) / (wPoint - bPoint)));
  }

  // Gamma correction for midtone richness
  if (gamma !== 1.0 && gamma > 0.1) {
    val = Math.pow(val, 1 / gamma);
  }

  // Sigmoid / S-curve Contrast boost (-50..100)
  if (contrast !== 0) {
    const c = contrast / 100;
    // S-curve transfer function preserving smooth gray transitions
    if (c > 0) {
      val = val < 0.5
        ? 0.5 * Math.pow(2 * val, 1 + c * 2)
        : 1 - 0.5 * Math.pow(2 * (1 - val), 1 + c * 2);
    } else {
      val = val + c * (val - 0.5) * 0.5;
    }
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

  // Offscreen canvas for crisp buffer rendering
  const outCanvas = document.createElement('canvas');
  outCanvas.width = width;
  outCanvas.height = height;
  const outCtx = outCanvas.getContext('2d', { willReadFrequently: true });
  if (!outCtx) return;

  const {
    mode,
    contrast,
    brightness,
    blackThreshold,
    whiteThreshold,
    gamma = 1.0,
    grain = 0,
    dotSize,
    spacing,
    angle,
    halftoneBlend = 50,
    invert,
  } = settings;

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
    let mappedLum = mapLuminance(rawLum, contrast, brightness, blackThreshold, whiteThreshold, gamma);

    // Subtle film grain noise
    if (grain > 0) {
      const noise = ((Math.random() - 0.5) * grain) / 255;
      mappedLum = Math.max(0, Math.min(1, mappedLum + noise));
    }

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

  const gridStep = Math.max(2, dotSize * spacing);
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
  } else if (mode === 'crosshatch' || mode === 'lines' || mode === 'engraving') {
    htCtx.lineWidth = 1;
    htCtx.lineCap = 'round';

    for (let gy = minY; gy < maxY; gy += gridStep) {
      htCtx.beginPath();
      let isDrawing = false;

      for (let gx = minX; gx < maxX; gx += 2) {
        let x = gx * cos - gy * sin;
        let y = gx * sin + gy * cos;

        if (mode === 'engraving') {
          const wave = Math.sin(gx * 0.08) * 3;
          x += -sin * wave;
          y += cos * wave;
        }

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

      if (mode === 'crosshatch') {
        htCtx.beginPath();
        isDrawing = false;
        const rad2 = rad + Math.PI / 2;
        const cos2 = Math.cos(rad2);
        const sin2 = Math.sin(rad2);

        for (let gx2 = minX; gx2 < maxX; gx2 += 2) {
          const x2 = gx2 * cos2 - gy * sin2;
          const y2 = gx2 * sin2 + gy * cos2;

          if (x2 < 0 || x2 >= width || y2 < 0 || y2 >= height) {
            isDrawing = false;
            continue;
          }

          const lum = getLum(x2, y2);
          const darkness = 1 - lum;

          if (darkness > 0.4) {
            htCtx.lineWidth = Math.max(0.5, (darkness - 0.3) * gridStep * 0.7);
            if (!isDrawing) {
              htCtx.moveTo(x2, y2);
              isDrawing = true;
            } else {
              htCtx.lineTo(x2, y2);
            }
          } else {
            isDrawing = false;
          }
        }
        htCtx.stroke();
      }
    }
  } else if (mode === 'dither') {
    const ditherBuffer = new Float32Array(lumBuffer);
    const outImg = htCtx.createImageData(width, height);
    const outData = outImg.data;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const oldVal = ditherBuffer[idx];
        const newVal = oldVal < 0.5 ? 0 : 1;
        const err = (oldVal - newVal) / 8;

        ditherBuffer[idx] = newVal;

        const spread = [
          [1, 0], [2, 0],
          [-1, 1], [0, 1], [1, 1],
          [0, 2]
        ];

        for (const [dx, dy] of spread) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            ditherBuffer[ny * width + nx] += err;
          }
        }

        const col = newVal === 0 ? (invert ? 255 : 0) : (invert ? 0 : 255);
        outData[idx * 4] = col;
        outData[idx * 4 + 1] = col;
        outData[idx * 4 + 2] = col;
        outData[idx * 4 + 3] = 255;
      }
    }
    htCtx.putImageData(outImg, 0, 0);
  }

  // 3. Output Composition
  if (mode === 'hybrid') {
    // Blend Grayscale Photo Base + Halftone Pattern Overlay with Multiply
    outCtx.drawImage(grayCanvas, 0, 0);
    outCtx.save();
    outCtx.globalCompositeOperation = 'multiply';
    outCtx.globalAlpha = Math.max(0, Math.min(1, halftoneBlend / 100));
    outCtx.drawImage(htPatternCanvas, 0, 0);
    outCtx.restore();
    targetCtx.drawImage(outCanvas, 0, 0);
  } else {
    targetCtx.drawImage(htPatternCanvas, 0, 0);
  }
}
