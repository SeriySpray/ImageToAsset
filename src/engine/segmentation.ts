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
 * Depth-Limited Strict-Barrier Smart Lasso Cutout Engine:
 * Restricts background peeling strictly to a narrow outer margin (15-30px) immediately adjacent to
 * the drawn lasso line, using ultra-strict edge gradients (E > 10) and color difference thresholds (Δ < 10).
 * Completely protects all internal content (t-shirts, skin, clothes, details) from being eroded.
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
  if (existingMask && mode !== 'replace') {
    outputMask.set(existingMask);
  }

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

  // 3. Precompute Ultra-Sensitive Sobel Edge & Color Gradients
  const lum = new Uint8Array(totalWidth * totalHeight);
  for (let y = minY; y <= maxY; y++) {
    const rowOffset = y * totalWidth;
    for (let x = minX; x <= maxX; x++) {
      const idx = (rowOffset + x) * 4;
      lum[rowOffset + x] = (pixels[idx] * 54 + pixels[idx + 1] * 183 + pixels[idx + 2] * 19) >> 8;
    }
  }

  const edgeBarrier = new Uint8Array(totalWidth * totalHeight);
  for (let y = minY + 1; y < maxY; y++) {
    const rowOffset = y * totalWidth;
    for (let x = minX + 1; x < maxX; x++) {
      const idx = rowOffset + x;

      // Luminance gradient
      const gx = Math.abs(lum[idx + 1] - lum[idx - 1]);
      const gy = Math.abs(lum[(y + 1) * totalWidth + x] - lum[(y - 1) * totalWidth + x]);
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
      // Ultra-strict edge barrier (detects even subtle edges on light backgrounds)
      if (maxEdge > 10) {
        edgeBarrier[idx] = 1;
      }
    }
  }

  // 4. Depth-Limited Inward Wavefront from Lasso Perimeter
  // Maximum inward penetration buffer (strictly limits how deep background peeling can go)
  const maxInwardDistance = Math.max(8, Math.min(snappingDepth, Math.round(Math.min(boxW, boxH) * 0.18)));

  // Queue stores: x, y, seedR, seedG, seedB, currentDepth
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

    // If reached maximum inward fence depth, STOP expanding deeper!
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

          // Transparent buffer is always background
          if (na < 15) {
            visited[nidx] = 1;
            isBackground[nidx] = 1;
            queue.push(nx, ny, sr, sg, sb, currentDepth + 1);
            continue;
          }

          const nr = pixels[npidx];
          const ng = pixels[npidx + 1];
          const nb = pixels[npidx + 2];

          // Strict step color jump and strict seed drift
          const stepDiff = Math.abs(nr - qr) + Math.abs(ng - qg) + Math.abs(nb - qb);
          const seedDiff = Math.abs(nr - sr) + Math.abs(ng - sg) + Math.abs(nb - sb);

          // STRICT FIRST-HIT STOP RULE:
          // Stop immediately upon hitting an edge barrier or subtle color jump
          if (edgeBarrier[nidx] || stepDiff > 10 || seedDiff > 20) {
            visited[nidx] = 1; // Stop wavefront, belongs to SUBJECT
          } else {
            visited[nidx] = 1;
            isBackground[nidx] = 1;
            queue.push(nx, ny, sr, sg, sb, currentDepth + 1);
          }
        }
      }
    }
  }

  // 5. Subject is all pixels inside lasso that are NOT background
  const isSubject = new Uint8Array(totalWidth * totalHeight);
  for (let y = minY; y <= maxY; y++) {
    const rowOffset = y * totalWidth;
    for (let x = minX; x <= maxX; x++) {
      if (isInsideLasso(x, y) && !isBackground[rowOffset + x]) {
        isSubject[rowOffset + x] = 1;
      }
    }
  }

  // 6. Apply to Output Mask according to Mode
  if (mode === 'replace') {
    outputMask.fill(0);
    for (let y = minY; y <= maxY; y++) {
      const rowOffset = y * totalWidth;
      for (let x = minX; x <= maxX; x++) {
        if (isSubject[rowOffset + x]) {
          outputMask[rowOffset + x] = 255;
        }
      }
    }
  } else if (mode === 'add') {
    for (let y = minY; y <= maxY; y++) {
      const rowOffset = y * totalWidth;
      for (let x = minX; x <= maxX; x++) {
        if (isSubject[rowOffset + x]) {
          outputMask[rowOffset + x] = 255;
        }
      }
    }
  } else if (mode === 'subtract') {
    for (let y = minY; y <= maxY; y++) {
      const rowOffset = y * totalWidth;
      for (let x = minX; x <= maxX; x++) {
        if (isSubject[rowOffset + x]) {
          outputMask[rowOffset + x] = 0;
        }
      }
    }
  }
}
