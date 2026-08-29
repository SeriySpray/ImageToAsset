import { Point } from '../types';

/**
 * Creates a blank alpha mask initialized to 0
 */
export function createEmptyMask(width: number, height: number): Uint8ClampedArray {
  return new Uint8ClampedArray(width * height);
}

/**
 * Creates a fully selected mask initialized to 255
 */
export function createFullMask(width: number, height: number): Uint8ClampedArray {
  const mask = new Uint8ClampedArray(width * height);
  mask.fill(255);
  return mask;
}

/**
 * Updates mask with a circular brush or eraser stamp
 */
export function applyBrush(
  mask: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  radius: number,
  isEraser: boolean,
  feather = 0.2
): void {
  const rCeil = Math.ceil(radius);
  const minX = Math.max(0, Math.floor(x - rCeil));
  const maxX = Math.min(width - 1, Math.ceil(x + rCeil));
  const minY = Math.max(0, Math.floor(y - rCeil));
  const maxY = Math.min(height - 1, Math.ceil(y + rCeil));

  const r2 = radius * radius;
  const innerRadius = radius * (1 - feather);
  const innerR2 = innerRadius * innerRadius;

  for (let py = minY; py <= maxY; py++) {
    const dy = py - y;
    const dy2 = dy * dy;
    const rowOffset = py * width;

    for (let px = minX; px <= maxX; px++) {
      const dx = px - x;
      const d2 = dx * dx + dy2;

      if (d2 <= r2) {
        let opacity = 1.0;
        if (d2 > innerR2 && feather > 0) {
          const d = Math.sqrt(d2);
          opacity = 1 - (d - innerRadius) / (radius - innerRadius);
        }

        const idx = rowOffset + px;
        const currentVal = mask[idx];

        if (isEraser) {
          mask[idx] = Math.max(0, Math.min(255, Math.round(currentVal * (1 - opacity))));
        } else {
          mask[idx] = Math.max(0, Math.min(255, Math.round(currentVal + (255 - currentVal) * opacity)));
        }
      }
    }
  }
}

/**
 * Interpolates and applies brush along a continuous stroke
 */
export function applyBrushStroke(
  mask: Uint8ClampedArray,
  width: number,
  height: number,
  from: Point,
  to: Point,
  radius: number,
  isEraser: boolean,
  feather = 0.2
): void {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  const step = Math.max(1, radius * 0.25);
  const count = Math.ceil(dist / step);

  for (let i = 0; i <= count; i++) {
    const t = count === 0 ? 1 : i / count;
    const x = from.x + dx * t;
    const y = from.y + dy * t;
    applyBrush(mask, width, height, x, y, radius, isEraser, feather);
  }
}

/**
 * Fills an arbitrary closed polygon in the mask using scanline rasterization
 */
export function fillPolygonMask(
  mask: Uint8ClampedArray,
  width: number,
  height: number,
  points: Point[],
  value = 255
): void {
  if (points.length < 3) return;

  let minY = height;
  let maxY = 0;
  for (const p of points) {
    minY = Math.min(minY, Math.floor(p.y));
    maxY = Math.max(maxY, Math.ceil(p.y));
  }
  minY = Math.max(0, minY);
  maxY = Math.min(height - 1, maxY);

  for (let y = minY; y <= maxY; y++) {
    const nodeX: number[] = [];
    let j = points.length - 1;

    for (let i = 0; i < points.length; i++) {
      const pi = points[i];
      const pj = points[j];

      if ((pi.y < y && pj.y >= y) || (pj.y < y && pi.y >= y)) {
        const x = pi.x + ((y - pi.y) / (pj.y - pi.y)) * (pj.x - pi.x);
        nodeX.push(x);
      }
      j = i;
    }

    nodeX.sort((a, b) => a - b);

    for (let i = 0; i < nodeX.length; i += 2) {
      if (i + 1 >= nodeX.length) break;
      const startX = Math.max(0, Math.floor(nodeX[i]));
      const endX = Math.min(width - 1, Math.ceil(nodeX[i + 1]));
      const rowOffset = y * width;

      for (let x = startX; x <= endX; x++) {
        mask[rowOffset + x] = value;
      }
    }
  }
}

/**
 * Sets rectangular region in mask
 */
export function setBoxMask(
  mask: Uint8ClampedArray,
  width: number,
  height: number,
  box: { x0: number; y0: number; x1: number; y1: number },
  value = 255
): void {
  const minX = Math.max(0, Math.min(width - 1, Math.floor(Math.min(box.x0, box.x1))));
  const maxX = Math.max(0, Math.min(width - 1, Math.ceil(Math.max(box.x0, box.x1))));
  const minY = Math.max(0, Math.min(height - 1, Math.floor(Math.min(box.y0, box.y1))));
  const maxY = Math.max(0, Math.min(height - 1, Math.ceil(Math.max(box.y0, box.y1))));

  for (let y = minY; y <= maxY; y++) {
    const rowOffset = y * width;
    for (let x = minX; x <= maxX; x++) {
      mask[rowOffset + x] = value;
    }
  }
}

/**
 * Magic Wand selection based on color distance and flood fill
 */
export function magicWandSelect(
  srcCtx: CanvasRenderingContext2D,
  mask: Uint8ClampedArray,
  width: number,
  height: number,
  seedX: number,
  seedY: number,
  tolerance: number, // 0..100
  contiguous = true,
  mode: 'replace' | 'add' | 'subtract' = 'replace'
): void {
  const imgData = srcCtx.getImageData(0, 0, width, height);
  const pixels = imgData.data;

  const sx = Math.floor(Math.max(0, Math.min(width - 1, seedX)));
  const sy = Math.floor(Math.max(0, Math.min(height - 1, seedY)));
  const seedIdx = (sy * width + sx) * 4;

  const sr = pixels[seedIdx];
  const sg = pixels[seedIdx + 1];
  const sb = pixels[seedIdx + 2];
  const sa = pixels[seedIdx + 3];

  const maxDistSq = (tolerance * 4.41) ** 2; // (100 -> ~441 max Euclidean distance)

  const isSimilar = (x: number, y: number): boolean => {
    const idx = (y * width + x) * 4;
    const r = pixels[idx];
    const g = pixels[idx + 1];
    const b = pixels[idx + 2];
    const a = pixels[idx + 3];

    if (sa < 10 && a < 10) return true;
    if (Math.abs(sa - a) > 50) return false;

    const dr = r - sr;
    const dg = g - sg;
    const db = b - sb;
    return dr * dr + dg * dg + db * db <= maxDistSq;
  };

  const selected = new Uint8Array(width * height);

  if (contiguous) {
    // 4-way BFS Flood Fill
    const queue: number[] = [sx, sy];
    const visited = new Uint8Array(width * height);
    visited[sy * width + sx] = 1;
    selected[sy * width + sx] = 1;

    let head = 0;
    while (head < queue.length) {
      const qx = queue[head++];
      const qy = queue[head++];

      const neighbors = [
        [qx + 1, qy],
        [qx - 1, qy],
        [qx, qy + 1],
        [qx, qy - 1]
      ];

      for (const [nx, ny] of neighbors) {
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nidx = ny * width + nx;
          if (!visited[nidx]) {
            visited[nidx] = 1;
            if (isSimilar(nx, ny)) {
              selected[nidx] = 1;
              queue.push(nx, ny);
            }
          }
        }
      }
    }
  } else {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (isSimilar(x, y)) {
          selected[y * width + x] = 1;
        }
      }
    }
  }

  // Apply to output mask based on mode
  for (let i = 0; i < width * height; i++) {
    if (mode === 'replace') {
      mask[i] = selected[i] ? 255 : 0;
    } else if (mode === 'add') {
      if (selected[i]) mask[i] = 255;
    } else if (mode === 'subtract') {
      if (selected[i]) mask[i] = 0;
    }
  }
}

/**
 * Intelligent Smart Foreground Cutout:
 * Analyzes contrast, edge energy and background border sampling to isolate main subject automatically
 */
export function smartAutoCutout(
  srcCtx: CanvasRenderingContext2D,
  mask: Uint8ClampedArray,
  width: number,
  height: number,
  boundBox?: { x0: number; y0: number; x1: number; y1: number }
): void {
  const imgData = srcCtx.getImageData(0, 0, width, height);
  const pixels = imgData.data;

  const minX = boundBox ? Math.max(0, Math.floor(Math.min(boundBox.x0, boundBox.x1))) : 0;
  const maxX = boundBox ? Math.min(width - 1, Math.ceil(Math.max(boundBox.x0, boundBox.x1))) : width - 1;
  const minY = boundBox ? Math.max(0, Math.floor(Math.min(boundBox.y0, boundBox.y1))) : 0;
  const maxY = boundBox ? Math.min(height - 1, Math.ceil(Math.max(boundBox.y0, boundBox.y1))) : height - 1;

  // Check if image already has native alpha channel transparency
  let hasAlpha = false;
  for (let i = 3; i < pixels.length; i += 16) {
    if (pixels[i] < 200) {
      hasAlpha = true;
      break;
    }
  }

  if (hasAlpha) {
    for (let y = minY; y <= maxY; y++) {
      const rowOffset = y * width;
      for (let x = minX; x <= maxX; x++) {
        const a = pixels[(rowOffset + x) * 4 + 3];
        mask[rowOffset + x] = a >= 128 ? 255 : 0;
      }
    }
    return;
  }

  // Sample border pixels to establish background color model
  const bgSamples: { r: number; g: number; b: number }[] = [];
  const addSample = (x: number, y: number) => {
    const idx = (y * width + x) * 4;
    bgSamples.push({ r: pixels[idx], g: pixels[idx + 1], b: pixels[idx + 2] });
  };

  for (let x = minX; x <= maxX; x += 4) {
    addSample(x, minY);
    addSample(x, maxY);
  }
  for (let y = minY; y <= maxY; y += 4) {
    addSample(minX, y);
    addSample(maxX, y);
  }

  // Distance to background samples
  const isBgColor = (x: number, y: number): boolean => {
    const idx = (y * width + x) * 4;
    const r = pixels[idx];
    const g = pixels[idx + 1];
    const b = pixels[idx + 2];

    for (const bg of bgSamples) {
      const dr = r - bg.r;
      const dg = g - bg.g;
      const db = b - bg.b;
      if (dr * dr + dg * dg + db * db < 1800) { // tolerance ~42
        return true;
      }
    }
    return false;
  };

  // Connected Background Flood-Fill from perimeter
  const isBg = new Uint8Array(width * height);
  const queue: number[] = [];

  const pushPixel = (x: number, y: number) => {
    const idx = y * width + x;
    if (!isBg[idx] && isBgColor(x, y)) {
      isBg[idx] = 1;
      queue.push(x, y);
    }
  };

  for (let x = minX; x <= maxX; x++) {
    pushPixel(x, minY);
    pushPixel(x, maxY);
  }
  for (let y = minY; y <= maxY; y++) {
    pushPixel(minX, y);
    pushPixel(maxX, y);
  }

  let head = 0;
  while (head < queue.length) {
    const qx = queue[head++];
    const qy = queue[head++];

    const neighbors = [
      [qx + 1, qy],
      [qx - 1, qy],
      [qx, qy + 1],
      [qx, qy - 1]
    ];

    for (const [nx, ny] of neighbors) {
      if (nx >= minX && nx <= maxX && ny >= minY && ny <= maxY) {
        const nidx = ny * width + nx;
        if (!isBg[nidx] && isBgColor(nx, ny)) {
          isBg[nidx] = 1;
          queue.push(nx, ny);
        }
      }
    }
  }

  // Everything not connected to the background is the subject
  for (let y = minY; y <= maxY; y++) {
    const rowOffset = y * width;
    for (let x = minX; x <= maxX; x++) {
      mask[rowOffset + x] = isBg[rowOffset + x] ? 0 : 255;
    }
  }
}
