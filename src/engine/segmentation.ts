import { Point } from '../types';

/**
 * Creates a blank alpha mask initialized to 0
 */
export function createEmptyMask(width: number, height: number): Uint8ClampedArray {
  return new Uint8ClampedArray(width * height);
}

/**
 * Creates a fully selected mask initialized to 255 (100% visible)
 */
export function createFullMask(width: number, height: number): Uint8ClampedArray {
  const mask = new Uint8ClampedArray(width * height);
  mask.fill(255);
  return mask;
}

/**
 * Smart Lasso Selection & Isolation Engine:
 * - Outside the lasso loop: completely erased (0).
 * - Inside the lasso loop: starts from the lasso line and snaps to the outer contour of the subject.
 * - Subject inside: preserved (255, or respects previous 0s if already deleted).
 */
export function smartLassoCutout(
  srcCtx: CanvasRenderingContext2D,
  outputMask: Uint8ClampedArray,
  totalWidth: number,
  totalHeight: number,
  lassoPoints: Point[],
  mode: 'replace' | 'add' | 'subtract' = 'replace',
  existingMask?: Uint8ClampedArray | null,
  snappingDepth = 28
): void {
  if (lassoPoints.length === 0) return;

  const imgData = srcCtx.getImageData(0, 0, totalWidth, totalHeight);
  const pixels = imgData.data;

  // 1. Calculate Bounding Box of Lasso Loop
  let minX = totalWidth - 1;
  let maxX = 0;
  let minY = totalHeight - 1;
  let maxY = 0;

  for (const pt of lassoPoints) {
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  }

  // Handle single-click point (expand into local radius of 140px)
  if (lassoPoints.length < 3 || (maxX - minX < 8 && maxY - minY < 8)) {
    const cx = lassoPoints[0].x;
    const cy = lassoPoints[0].y;
    const radius = 140;
    minX = Math.max(0, Math.floor(cx - radius));
    maxX = Math.min(totalWidth - 1, Math.ceil(cx + radius));
    minY = Math.max(0, Math.floor(cy - radius));
    maxY = Math.min(totalHeight - 1, Math.ceil(cy + radius));
  } else {
    minX = Math.max(0, Math.floor(minX));
    maxX = Math.min(totalWidth - 1, Math.ceil(maxX));
    minY = Math.max(0, Math.floor(minY));
    maxY = Math.min(totalHeight - 1, Math.ceil(maxY));
  }

  const boxW = maxX - minX + 1;
  const boxH = maxY - minY + 1;
  if (boxW < 4 || boxH < 4) return;

  // 2. Rasterize Lasso Polygon
  const lassoCanvas = document.createElement('canvas');
  lassoCanvas.width = totalWidth;
  lassoCanvas.height = totalHeight;
  const lassoCtx = lassoCanvas.getContext('2d');
  if (!lassoCtx) return;

  lassoCtx.fillStyle = '#ffffff';
  if (lassoPoints.length >= 3) {
    lassoCtx.beginPath();
    lassoCtx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
    for (let i = 1; i < lassoPoints.length; i++) {
      lassoCtx.lineTo(lassoPoints[i].x, lassoPoints[i].y);
    }
    lassoCtx.closePath();
    lassoCtx.fill();
  } else {
    const cx = lassoPoints[0].x;
    const cy = lassoPoints[0].y;
    lassoCtx.beginPath();
    lassoCtx.arc(cx, cy, 140, 0, Math.PI * 2);
    lassoCtx.fill();
  }

  const lassoImgData = lassoCtx.getImageData(0, 0, totalWidth, totalHeight);
  const lassoAlpha = lassoImgData.data;

  const isInsideLasso = (x: number, y: number): boolean => {
    return lassoAlpha[(y * totalWidth + x) * 4 + 3] > 128;
  };

  // 3. Precompute Smoothed Sobel Edge & Color Gradients
  const lum = new Uint8Array(totalWidth * totalHeight);
  for (let y = minY; y <= maxY; y++) {
    const rowOffset = y * totalWidth;
    for (let x = minX; x <= maxX; x++) {
      const idx = (rowOffset + x) * 4;
      lum[rowOffset + x] = (pixels[idx] * 54 + pixels[idx + 1] * 183 + pixels[idx + 2] * 19) >> 8;
    }
  }

  // Pre-filter luminance with 3x3 Gaussian smoothing to eliminate sensor grain / JPEG noise
  const smoothLum = new Uint8Array(totalWidth * totalHeight);
  for (let y = minY; y <= maxY; y++) {
    const rowOffset = y * totalWidth;
    const prevRow = Math.max(minY, y - 1) * totalWidth;
    const nextRow = Math.min(maxY, y + 1) * totalWidth;
    for (let x = minX; x <= maxX; x++) {
      const xPrev = Math.max(minX, x - 1);
      const xNext = Math.min(maxX, x + 1);
      const s =
        lum[prevRow + xPrev] + (lum[prevRow + x] << 1) + lum[prevRow + xNext] +
        (lum[rowOffset + xPrev] << 1) + (lum[rowOffset + x] << 2) + (lum[rowOffset + xNext] << 1) +
        lum[nextRow + xPrev] + (lum[nextRow + x] << 1) + lum[nextRow + xNext];
      smoothLum[rowOffset + x] = s >> 4;
    }
  }

  const edgeBarrier = new Uint8Array(totalWidth * totalHeight);
  for (let y = minY + 1; y < maxY; y++) {
    const rowOffset = y * totalWidth;
    for (let x = minX + 1; x < maxX; x++) {
      const idx = rowOffset + x;

      // Smoothed luminance gradient
      const gx = Math.abs(smoothLum[idx + 1] - smoothLum[idx - 1]);
      const gy = Math.abs(smoothLum[(y + 1) * totalWidth + x] - smoothLum[(y - 1) * totalWidth + x]);
      const gradLum = gx + gy;

      // Color channel gradients
      const pLeft = (idx - 1) * 4;
      const pRight = (idx + 1) * 4;
      const pUp = ((y - 1) * totalWidth + x) * 4;
      const pDown = ((y + 1) * totalWidth + x) * 4;

      const dr = Math.abs(pixels[pRight] - pixels[pLeft]) + Math.abs(pixels[pDown] - pixels[pUp]);
      const dg = Math.abs(pixels[pRight + 1] - pixels[pLeft + 1]) + Math.abs(pixels[pDown + 1] - pixels[pUp + 1]);
      const db = Math.abs(pixels[pRight + 2] - pixels[pLeft + 2]) + Math.abs(pixels[pDown + 2] - pixels[pUp + 2]);
      const gradColor = Math.max(dr, dg, db);

      const maxEdge = Math.max(gradLum, gradColor);
      if (maxEdge > 18) {
        edgeBarrier[idx] = 1;
      }
    }
  }

  // 4. Depth-Limited Inward Wavefront from Lasso Perimeter
  const maxInwardDistance = Math.max(8, Math.min(snappingDepth, Math.round(Math.min(boxW, boxH) * 0.18)));

  const visited = new Uint8Array(totalWidth * totalHeight);
  const isBackground = new Uint8Array(totalWidth * totalHeight);
  const queue: number[] = [];

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (isInsideLasso(x, y)) {
        const isBorder = (
          !isInsideLasso(x - 1, y) ||
          !isInsideLasso(x + 1, y) ||
          !isInsideLasso(x, y - 1) ||
          !isInsideLasso(x, y + 1)
        );

        if (isBorder) {
          const idx = y * totalWidth + x;
          const pidx = idx * 4;
          visited[idx] = 1;
          isBackground[idx] = 1;
          queue.push(x, y, pixels[pidx], pixels[pidx + 1], pixels[pidx + 2], 0);
        }
      }
    }
  }

  let head = 0;
  while (head < queue.length) {
    const qx = queue[head++];
    const qy = queue[head++];
    const sr = queue[head++];
    const sg = queue[head++];
    const sb = queue[head++];
    const currentDepth = queue[head++];

    if (currentDepth >= maxInwardDistance) {
      continue;
    }

    const qidx = (qy * totalWidth + qx) * 4;
    const qr = pixels[qidx];
    const qg = pixels[qidx + 1];
    const qb = pixels[qidx + 2];

    const neighbors = [
      [qx + 1, qy],
      [qx - 1, qy],
      [qx, qy + 1],
      [qx, qy - 1]
    ];

    for (const [nx, ny] of neighbors) {
      if (nx >= minX && nx <= maxX && ny >= minY && ny <= maxY && isInsideLasso(nx, ny)) {
        const nidx = ny * totalWidth + nx;
        if (!visited[nidx]) {
          const npidx = nidx * 4;
          const na = pixels[npidx + 3];

          if (na < 15) {
            visited[nidx] = 1;
            isBackground[nidx] = 1;
            queue.push(nx, ny, sr, sg, sb, currentDepth + 1);
            continue;
          }

          const nr = pixels[npidx];
          const ng = pixels[npidx + 1];
          const nb = pixels[npidx + 2];

          const stepDiff = Math.abs(nr - qr) + Math.abs(ng - qg) + Math.abs(nb - qb);
          const seedDiff = Math.abs(nr - sr) + Math.abs(ng - sg) + Math.abs(nb - sb);

          // Stop upon hitting true object boundary (robust against sensor noise)
          if (edgeBarrier[nidx] || stepDiff > 16 || seedDiff > 32) {
            visited[nidx] = 1;
          } else {
            visited[nidx] = 1;
            isBackground[nidx] = 1;
            queue.push(nx, ny, sr, sg, sb, currentDepth + 1);
          }
        }
      }
    }
  }

  // 5. Apply to Output Mask according to Mode
  if (mode === 'replace') {
    // Default Lasso: ISOLATE SELECTION (erase everything outside the lasso)
    outputMask.fill(0);

    for (let y = minY; y <= maxY; y++) {
      const rowOffset = y * totalWidth;
      for (let x = minX; x <= maxX; x++) {
        const idx = rowOffset + x;
        // If inside lasso and not peeled as background -> Keep subject!
        if (isInsideLasso(x, y) && !isBackground[idx]) {
          outputMask[idx] = existingMask ? existingMask[idx] : 255;
        }
      }
    }
  } else if (mode === 'subtract') {
    // Alt: Subtract the lassoed subject from existing mask
    if (existingMask) {
      outputMask.set(existingMask);
    } else {
      outputMask.fill(255);
    }

    for (let y = minY; y <= maxY; y++) {
      const rowOffset = y * totalWidth;
      for (let x = minX; x <= maxX; x++) {
        const idx = rowOffset + x;
        if (isInsideLasso(x, y) && !isBackground[idx]) {
          outputMask[idx] = 0;
        }
      }
    }
  } else if (mode === 'add') {
    // Shift: Add the lassoed subject to existing mask
    if (existingMask) {
      outputMask.set(existingMask);
    } else {
      outputMask.fill(0);
    }

    for (let y = minY; y <= maxY; y++) {
      const rowOffset = y * totalWidth;
      for (let x = minX; x <= maxX; x++) {
        const idx = rowOffset + x;
        if (isInsideLasso(x, y) && !isBackground[idx]) {
          outputMask[idx] = 255;
        }
      }
    }
  }

  // 6. Automatic Post-processing Cleanup & Contour Smoothing
  // Remove small stray background fragments, fill pinholes, and smooth boundaries
  removeSmallMaskNoise(outputMask, totalWidth, totalHeight, minX, maxX, minY, maxY, 80, 80);
  smoothMaskContours(outputMask, totalWidth, totalHeight, minX, maxX, minY, maxY, 2.5);
}

/**
 * Removes isolated small islands of foreground noise (dust/speckles) and fills small internal holes
 */
export function removeSmallMaskNoise(
  mask: Uint8ClampedArray,
  width: number,
  height: number,
  minX = 0,
  maxX = width - 1,
  minY = 0,
  maxY = height - 1,
  minFgArea = 80,
  minHoleArea = 80
): void {
  const bMinX = Math.max(0, minX - 4);
  const bMaxX = Math.min(width - 1, maxX + 4);
  const bMinY = Math.max(0, minY - 4);
  const bMaxY = Math.min(height - 1, maxY + 4);
  const bW = bMaxX - bMinX + 1;
  const bH = bMaxY - bMinY + 1;
  if (bW < 4 || bH < 4) return;

  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(bW * bH + 16);

  // 1. Fill small background holes inside the subject
  for (let y = bMinY; y <= bMaxY; y++) {
    const rowOffset = y * width;
    for (let x = bMinX; x <= bMaxX; x++) {
      const idx = rowOffset + x;
      if (mask[idx] === 0 && !visited[idx]) {
        let head = 0;
        let tail = 0;
        queue[tail++] = idx;
        visited[idx] = 1;
        let isTouchingCanvasBorder = false;

        while (head < tail) {
          const cur = queue[head++];
          const cx = cur % width;
          const cy = (cur / width) | 0;

          if (cx === 0 || cx === width - 1 || cy === 0 || cy === height - 1) {
            isTouchingCanvasBorder = true;
          }

          const neighbors = [cur - 1, cur + 1, cur - width, cur + width];
          for (let k = 0; k < 4; k++) {
            const n = neighbors[k];
            if (n >= 0 && n < width * height) {
              const nx = n % width;
              if (Math.abs(nx - cx) <= 1 && mask[n] === 0 && !visited[n]) {
                visited[n] = 1;
                if (tail < queue.length) {
                  queue[tail++] = n;
                }
              }
            }
          }
        }

        // If enclosed inside object and smaller than minHoleArea -> fill it
        if (!isTouchingCanvasBorder && tail < minHoleArea) {
          for (let i = 0; i < tail; i++) {
            mask[queue[i]] = 255;
          }
        }
      }
    }
  }

  // 2. Remove small foreground islands (stray dust/background noise)
  visited.fill(0);
  for (let y = bMinY; y <= bMaxY; y++) {
    const rowOffset = y * width;
    for (let x = bMinX; x <= bMaxX; x++) {
      const idx = rowOffset + x;
      if (mask[idx] > 0 && !visited[idx]) {
        let head = 0;
        let tail = 0;
        queue[tail++] = idx;
        visited[idx] = 1;

        while (head < tail) {
          const cur = queue[head++];
          const cx = cur % width;

          const neighbors = [cur - 1, cur + 1, cur - width, cur + width];
          for (let k = 0; k < 4; k++) {
            const n = neighbors[k];
            if (n >= 0 && n < width * height) {
              const nx = n % width;
              if (Math.abs(nx - cx) <= 1 && mask[n] > 0 && !visited[n]) {
                visited[n] = 1;
                if (tail < queue.length) {
                  queue[tail++] = n;
                }
              }
            }
          }
        }

        // If isolated island is smaller than minFgArea -> erase it
        if (tail < minFgArea) {
          for (let i = 0; i < tail; i++) {
            mask[queue[i]] = 0;
          }
        }
      }
    }
  }
}

/**
 * Fast separable Gaussian-weighted smoothing for mask contours.
 * Eliminates pixelated jagged staircases and leaves clean, organic, smooth edges.
 */
export function smoothMaskContours(
  mask: Uint8ClampedArray,
  width: number,
  height: number,
  minX = 0,
  maxX = width - 1,
  minY = 0,
  maxY = height - 1,
  radius = 2.5
): void {
  const r = Math.max(1, Math.round(radius));
  const bMinX = Math.max(0, minX - r - 4);
  const bMaxX = Math.min(width - 1, maxX + r + 4);
  const bMinY = Math.max(0, minY - r - 4);
  const bMaxY = Math.min(height - 1, maxY + r + 4);

  const temp = new Float32Array(width * height);

  // Horizontal pass with triangular/Gaussian weights
  for (let y = bMinY; y <= bMaxY; y++) {
    const rowOffset = y * width;
    for (let x = bMinX; x <= bMaxX; x++) {
      let sum = 0;
      let weightSum = 0;
      for (let dx = -r; dx <= r; dx++) {
        const nx = x + dx;
        if (nx >= 0 && nx < width) {
          const w = r + 1 - Math.abs(dx);
          sum += mask[rowOffset + nx] * w;
          weightSum += w;
        }
      }
      temp[rowOffset + x] = sum / weightSum;
    }
  }

  // Vertical pass and smooth thresholding
  for (let x = bMinX; x <= bMaxX; x++) {
    for (let y = bMinY; y <= bMaxY; y++) {
      let sum = 0;
      let weightSum = 0;
      for (let dy = -r; dy <= r; dy++) {
        const ny = y + dy;
        if (ny >= 0 && ny < height) {
          const w = r + 1 - Math.abs(dy);
          sum += temp[ny * width + x] * w;
          weightSum += w;
        }
      }
      const avg = sum / weightSum;
      const idx = y * width + x;
      if (avg >= 128) {
        mask[idx] = 255;
      } else if (avg >= 36) {
        mask[idx] = Math.round(((avg - 36) / 92) * 255);
      } else {
        mask[idx] = 0;
      }
    }
  }
}
