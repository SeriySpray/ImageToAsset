import { HalftoneSettings } from '../types';

/**
 * Applies contrast and brightness adjustments to a normalized luminance value (0..1)
 */
export function adjustLuminance(
  lum: number,
  contrast: number,
  brightness: number,
  blackThreshold: number,
  whiteThreshold: number
): number {
  // Apply brightness (-100..100) -> (-0.5..0.5)
  let val = lum + (brightness / 200);
  
  // Apply contrast (-100..100)
  const factor = (259 * (contrast + 100)) / (100 * (259 - contrast));
  val = factor * (val - 0.5) + 0.5;

  // Clamp 0..1
  val = Math.max(0, Math.min(1, val));

  // Thresholds mapping
  const bThresh = blackThreshold / 255;
  const wThresh = whiteThreshold / 255;
  
  if (val <= bThresh) return 0;
  if (val >= wThresh) return 1;
  
  return (val - bThresh) / (wThresh - bThresh);
}

/**
 * Generates the stylized halftone artwork from the source canvas and selection mask
 */
export function renderHalftone(
  sourceCtx: CanvasRenderingContext2D,
  targetCtx: CanvasRenderingContext2D,
  maskData: Uint8ClampedArray | null,
  width: number,
  height: number,
  settings: HalftoneSettings
): void {
  // Clear target
  targetCtx.clearRect(0, 0, width, height);

  const imgData = sourceCtx.getImageData(0, 0, width, height);
  const srcPixels = imgData.data;

  // Create temporary offscreen canvas for crisp rendering
  const outCanvas = document.createElement('canvas');
  outCanvas.width = width;
  outCanvas.height = height;
  const outCtx = outCanvas.getContext('2d', { willReadFrequently: true });
  if (!outCtx) return;

  // Solid white paper background for the halftone artwork
  outCtx.fillStyle = '#ffffff';
  outCtx.fillRect(0, 0, width, height);

  // Set ink color
  const inkColor = settings.invert ? '#ffffff' : '#0a0a0c';
  outCtx.fillStyle = inkColor;
  outCtx.strokeStyle = inkColor;

  const {
    dotSize,
    spacing,
    angle,
    contrast,
    brightness,
    blackThreshold,
    whiteThreshold,
    pattern,
  } = settings;

  const gridStep = Math.max(2, dotSize * spacing);
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  // Diagonal bounding to cover entire rotated canvas
  const diag = Math.sqrt(width * width + height * height);
  const minX = -diag;
  const maxX = diag * 2;
  const minY = -diag;
  const maxY = diag * 2;

  // Helper to sample luminance at pixel (px, py)
  const getPixelLum = (px: number, py: number): number => {
    const ix = Math.floor(Math.max(0, Math.min(width - 1, px)));
    const iy = Math.floor(Math.max(0, Math.min(height - 1, py)));
    const idx = (iy * width + ix) * 4;

    // Check mask if present
    if (maskData && maskData[iy * width + ix] < 10) {
      return 1.0; // treat unmasked as pure white (no ink)
    }

    const r = srcPixels[idx];
    const g = srcPixels[idx + 1];
    const b = srcPixels[idx + 2];
    const a = srcPixels[idx + 3] / 255;

    if (a < 0.05) return 1.0;

    // Standard perceptual luminance
    const rawLum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return adjustLuminance(rawLum, contrast, brightness, blackThreshold, whiteThreshold);
  };

  // Helper to sample average luminance in a small region
  const getRegionLum = (cx: number, cy: number, radius: number): number => {
    let sum = 0;
    let count = 0;
    const step = Math.max(1, Math.floor(radius / 2));
    for (let dy = -radius; dy <= radius; dy += step) {
      for (let dx = -radius; dx <= radius; dx += step) {
        if (dx * dx + dy * dy <= radius * radius) {
          sum += getPixelLum(cx + dx, cy + dy);
          count++;
        }
      }
    }
    return count > 0 ? sum / count : getPixelLum(cx, cy);
  };

  if (pattern === 'dots') {
    const maxRadius = (gridStep / Math.SQRT2) * 1.08;
    outCtx.beginPath();

    for (let gy = minY; gy < maxY; gy += gridStep) {
      for (let gx = minX; gx < maxX; gx += gridStep) {
        // Rotate grid coordinates back to image space
        const x = gx * cos - gy * sin;
        const y = gx * sin + gy * cos;

        if (x < -gridStep || x > width + gridStep || y < -gridStep || y > height + gridStep) {
          continue;
        }

        // Check if inside image mask bounds
        const ix = Math.floor(x);
        const iy = Math.floor(y);
        if (maskData && (ix < 0 || ix >= width || iy < 0 || iy >= height || maskData[iy * width + ix] < 10)) {
          continue;
        }

        const lum = getRegionLum(x, y, gridStep / 2);
        const darkness = 1 - lum;

        if (darkness <= 0.02) continue; // Pure white highlight

        if (darkness >= 0.98) {
          // Solid square for deep shadow
          const half = gridStep / 2;
          outCtx.rect(x - half, y - half, gridStep, gridStep);
        } else {
          // Halftone circle dot
          const r = maxRadius * Math.sqrt(darkness);
          outCtx.moveTo(x + r, y);
          outCtx.arc(x, y, r, 0, Math.PI * 2);
        }
      }
    }
    outCtx.fill();
  } else if (pattern === 'crosshatch' || pattern === 'lines' || pattern === 'engraving') {
    // Line / engraving patterns
    outCtx.lineWidth = 1;
    outCtx.lineCap = 'round';

    for (let gy = minY; gy < maxY; gy += gridStep) {
      outCtx.beginPath();
      let isDrawing = false;

      for (let gx = minX; gx < maxX; gx += 2) {
        let x = gx * cos - gy * sin;
        let y = gx * sin + gy * cos;

        if (pattern === 'engraving') {
          // Add subtle wave modulation
          const wave = Math.sin(gx * 0.08) * 3;
          x += -sin * wave;
          y += cos * wave;
        }

        if (x < 0 || x >= width || y < 0 || y >= height) {
          isDrawing = false;
          continue;
        }

        const ix = Math.floor(x);
        const iy = Math.floor(y);
        if (maskData && maskData[iy * width + ix] < 10) {
          isDrawing = false;
          continue;
        }

        const lum = getPixelLum(x, y);
        const darkness = 1 - lum;

        if (darkness > 0.15) {
          const thickness = Math.max(0.5, darkness * gridStep * 0.9);
          outCtx.lineWidth = thickness;
          
          if (!isDrawing) {
            outCtx.moveTo(x, y);
            isDrawing = true;
          } else {
            outCtx.lineTo(x, y);
          }
        } else {
          isDrawing = false;
        }
      }
      outCtx.stroke();

      // Second angled pass for crosshatch
      if (pattern === 'crosshatch') {
        outCtx.beginPath();
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

          const ix = Math.floor(x2);
          const iy = Math.floor(y2);
          if (maskData && maskData[iy * width + ix] < 10) {
            isDrawing = false;
            continue;
          }

          const lum = getPixelLum(x2, y2);
          const darkness = 1 - lum;

          if (darkness > 0.4) {
            outCtx.lineWidth = Math.max(0.5, (darkness - 0.3) * gridStep * 0.7);
            if (!isDrawing) {
              outCtx.moveTo(x2, y2);
              isDrawing = true;
            } else {
              outCtx.lineTo(x2, y2);
            }
          } else {
            isDrawing = false;
          }
        }
        outCtx.stroke();
      }
    }
  } else if (pattern === 'dither') {
    // High-contrast Atkinson Dithering
    const ditherBuffer = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
      const x = i % width;
      const y = Math.floor(i / width);
      ditherBuffer[i] = getPixelLum(x, y);
    }

    const outImg = outCtx.createImageData(width, height);
    const outData = outImg.data;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const isMasked = maskData ? maskData[idx] >= 10 : true;

        if (!isMasked) {
          // Transparent / white
          outData[idx * 4] = 255;
          outData[idx * 4 + 1] = 255;
          outData[idx * 4 + 2] = 255;
          outData[idx * 4 + 3] = 255;
          continue;
        }

        const oldVal = ditherBuffer[idx];
        const newVal = oldVal < 0.5 ? 0 : 1;
        const err = (oldVal - newVal) / 8;

        ditherBuffer[idx] = newVal;

        // Atkinson diffusion
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

        const col = newVal === 0 ? (settings.invert ? 255 : 10) : (settings.invert ? 10 : 255);
        outData[idx * 4] = col;
        outData[idx * 4 + 1] = col;
        outData[idx * 4 + 2] = col;
        outData[idx * 4 + 3] = 255;
      }
    }
    outCtx.putImageData(outImg, 0, 0);
  }

  // Copy result to target context
  targetCtx.drawImage(outCanvas, 0, 0);
}
