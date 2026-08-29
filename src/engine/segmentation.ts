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
 * Advanced Magic Wand / Smart Lasso Object Cutout Engine:
 * Analyzes the encircled region (lasso loop) with Sobel boundary detection,
 * edge-constrained flood fill, and topological hole filling to extract the full object.
 */
export function smartLassoCutout(
  srcCtx: CanvasRenderingContext2D,
  outputMask: Uint8ClampedArray,
  totalWidth: number,
  totalHeight: number,
  lassoPoints: Point[],
  mode: 'replace' | 'add' | 'subtract' = 'replace',
  existingMask?: Uint8ClampedArray | null
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

  // 3. Precompute luminance and Sobel edge gradients with dilation
  const lum = new Uint8Array(totalWidth * totalHeight);
  for (let y = minY; y <= maxY; y++) {
    const rowOffset = y * totalWidth;
    for (let x = minX; x <= maxX; x++) {
      const idx = (rowOffset + x) * 4;
      lum[rowOffset + x] = (pixels[idx] * 54 + pixels[idx + 1] * 183 + pixels[idx + 2] * 19) >> 8;
    }
  }

  const rawGrad = new Uint8Array(totalWidth * totalHeight);
  for (let y = minY + 1; y < maxY; y++) {
    const rowOffset = y * totalWidth;
    for (let x = minX + 1; x < maxX; x++) {
      const gx = Math.abs(lum[rowOffset + x + 1] - lum[rowOffset + x - 1]);
      const gy = Math.abs(lum[(y + 1) * totalWidth + x] - lum[(y - 1) * totalWidth + x]);
      rawGrad[rowOffset + x] = Math.min(255, gx + gy);
    }
  }

  // 1px edge barrier closure (dilation) to prevent edge leaks
  const edgeBarrier = new Uint8Array(totalWidth * totalHeight);
  for (let y = minY + 1; y < maxY; y++) {
    const rowOffset = y * totalWidth;
    for (let x = minX + 1; x < maxX; x++) {
      const g = rawGrad[rowOffset + x];
      if (g > 26) {
        edgeBarrier[rowOffset + x] = 1;
        edgeBarrier[rowOffset + x + 1] = 1;
        edgeBarrier[rowOffset + x - 1] = 1;
        edgeBarrier[(y + 1) * totalWidth + x] = 1;
        edgeBarrier[(y - 1) * totalWidth + x] = 1;
      }
    }
  }

  // 4. Sample background colors along the perimeter of the lasso loop
  const bgClusters: { r: number; g: number; b: number; count: number }[] = [];

  const addBgSample = (x: number, y: number) => {
    const idx = (y * totalWidth + x) * 4;
    const a = pixels[idx + 3];
    if (a < 15) return;

    const r = pixels[idx];
    const g = pixels[idx + 1];
    const b = pixels[idx + 2];

    let bestDist = Infinity;
    let bestCluster: { r: number; g: number; b: number; count: number } | null = null;

    for (const c of bgClusters) {
      const dr = r - c.r;
      const dg = g - c.g;
      const db = b - c.b;
      const d = dr * dr + dg * dg + db * db;
      if (d < bestDist) {
        bestDist = d;
        bestCluster = c;
      }
    }

    if (bestCluster && bestDist < 1200) {
      bestCluster.r = Math.round((bestCluster.r * bestCluster.count + r) / (bestCluster.count + 1));
      bestCluster.g = Math.round((bestCluster.g * bestCluster.count + g) / (bestCluster.count + 1));
      bestCluster.b = Math.round((bestCluster.b * bestCluster.count + b) / (bestCluster.count + 1));
      bestCluster.count++;
    } else if (bgClusters.length < 24) {
      bgClusters.push({ r, g, b, count: 1 });
    }
  };

  for (let y = minY; y <= maxY; y += 2) {
    for (let x = minX; x <= maxX; x += 2) {
      if (isInsideLasso(x, y)) {
        if (
          !isInsideLasso(x - 2, y) ||
          !isInsideLasso(x + 2, y) ||
          !isInsideLasso(x, y - 2) ||
          !isInsideLasso(x, y + 2)
        ) {
          addBgSample(x, y);
        }
      }
    }
  }

  const isBackgroundLike = (x: number, y: number, toleranceSq = 3200): boolean => {
    const idx = (y * totalWidth + x) * 4;
    const a = pixels[idx + 3];
    if (a < 15) return true;

    const r = pixels[idx];
    const g = pixels[idx + 1];
    const b = pixels[idx + 2];

    for (const c of bgClusters) {
      const dr = r - c.r;
      const dg = g - c.g;
      const db = b - c.b;
      if (dr * dr + dg * dg + db * db <= toleranceSq) {
        return true;
      }
    }
    return false;
  };

  // 5. Inward Connected Flood Fill from Lasso Perimeter
  const isBg = new Uint8Array(totalWidth * totalHeight);
  const queue: number[] = [];

  const pushBgSeed = (x: number, y: number) => {
    const idx = y * totalWidth + x;
    if (!isBg[idx]) {
      isBg[idx] = 1;
      queue.push(x, y);
    }
  };

  // Start at perimeter
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (isInsideLasso(x, y)) {
        if (
          !isInsideLasso(x - 1, y) ||
          !isInsideLasso(x + 1, y) ||
          !isInsideLasso(x, y - 1) ||
          !isInsideLasso(x, y + 1)
        ) {
          pushBgSeed(x, y);
        }
      }
    }
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
      if (nx >= minX && nx <= maxX && ny >= minY && ny <= maxY && isInsideLasso(nx, ny)) {
        const nidx = ny * totalWidth + nx;
        if (!isBg[nidx]) {
          // Stop flood-fill at edge barrier or if color diverges strongly from bg samples
          if (!edgeBarrier[nidx] && (bgClusters.length === 0 || isBackgroundLike(nx, ny))) {
            isBg[nidx] = 1;
            queue.push(nx, ny);
          }
        }
      }
    }
  }

  // 6. Subject is all unflooded pixels inside lasso
  const isSubject = new Uint8Array(totalWidth * totalHeight);
  for (let y = minY; y <= maxY; y++) {
    const rowOffset = y * totalWidth;
    for (let x = minX; x <= maxX; x++) {
      if (isInsideLasso(x, y) && !isBg[rowOffset + x]) {
        isSubject[rowOffset + x] = 1;
      }
    }
  }

  // 7. Topological Hole Filling: Fill internal holes enclosed within the subject
  const invertedBg = new Uint8Array(totalWidth * totalHeight);
  const holeQueue: number[] = [];

  // Seed hole search from corners outside lasso
  for (let x = 0; x < totalWidth; x++) {
    invertedBg[x] = 1;
    invertedBg[(totalHeight - 1) * totalWidth + x] = 1;
    holeQueue.push(x, 0, x, totalHeight - 1);
  }
  for (let y = 0; y < totalHeight; y++) {
    invertedBg[y * totalWidth] = 1;
    invertedBg[y * totalWidth + totalWidth - 1] = 1;
    holeQueue.push(0, y, totalWidth - 1, y);
  }

  let holeHead = 0;
  while (holeHead < holeQueue.length) {
    const hx = holeQueue[holeHead++];
    const hy = holeQueue[holeHead++];

    const nbs = [
      [hx + 1, hy],
      [hx - 1, hy],
      [hx, hy + 1],
      [hx, hy - 1]
    ];

    for (const [nx, ny] of nbs) {
      if (nx >= 0 && nx < totalWidth && ny >= 0 && ny < totalHeight) {
        const nidx = ny * totalWidth + nx;
        if (!invertedBg[nidx] && !isSubject[nidx]) {
          invertedBg[nidx] = 1;
          holeQueue.push(nx, ny);
        }
      }
    }
  }

  // Internal holes (pixels not reachable from outside) become part of subject
  for (let y = minY; y <= maxY; y++) {
    const rowOffset = y * totalWidth;
    for (let x = minX; x <= maxX; x++) {
      if (isInsideLasso(x, y) && !invertedBg[rowOffset + x]) {
        isSubject[rowOffset + x] = 1;
      }
    }
  }

  // 8. Apply to Output Mask
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
