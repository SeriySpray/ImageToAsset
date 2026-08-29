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
 * Advanced Magic Wand selection tool with color tolerance, 8-way flood fill, and edge antialiasing
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
  mode: 'replace' | 'add' | 'subtract' = 'add'
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

  // Map tolerance (0..100) -> Euclidean distance squared in RGB space
  const tolDist = (tolerance / 100) * 255;
  const maxDistSq = tolDist * tolDist * 3;

  const isSimilar = (x: number, y: number): boolean => {
    const idx = (y * width + x) * 4;
    const r = pixels[idx];
    const g = pixels[idx + 1];
    const b = pixels[idx + 2];
    const a = pixels[idx + 3];

    // Transparent pixel matching
    if (sa < 15 && a < 15) return true;
    if (Math.abs(sa - a) > 60) return false;

    // Perceptually weighted color distance
    const rMean = (sr + r) / 2;
    const dr = sr - r;
    const dg = sg - g;
    const db = sb - b;
    const distSq = (2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db;
    return distSq <= maxDistSq;
  };

  const selected = new Uint8Array(width * height);

  if (contiguous) {
    // 8-way BFS Flood Fill
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
        [qx, qy - 1],
        [qx + 1, qy + 1],
        [qx - 1, qy - 1],
        [qx + 1, qy - 1],
        [qx - 1, qy + 1],
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

  // Smooth mask transitions & apply mode
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
 * Intelligent Smart Foreground Cutout Engine:
 * Analyzes current user edits or full photo to extract and isolate the subject from background
 */
export function smartAutoCutout(
  srcCtx: CanvasRenderingContext2D,
  mask: Uint8ClampedArray,
  totalWidth: number,
  totalHeight: number,
  boundBox?: { x0: number; y0: number; x1: number; y1: number },
  currentMask?: Uint8ClampedArray | null
): void {
  const imgData = srcCtx.getImageData(0, 0, totalWidth, totalHeight);
  const pixels = imgData.data;

  const minX = boundBox ? Math.max(0, Math.floor(Math.min(boundBox.x0, boundBox.x1))) : 0;
  const maxX = boundBox ? Math.min(totalWidth - 1, Math.ceil(Math.max(boundBox.x0, boundBox.x1))) : totalWidth - 1;
  const minY = boundBox ? Math.max(0, Math.floor(Math.min(boundBox.y0, boundBox.y1))) : 0;
  const maxY = boundBox ? Math.min(totalHeight - 1, Math.ceil(Math.max(boundBox.y0, boundBox.y1))) : totalHeight - 1;

  const boxW = maxX - minX + 1;
  const boxH = maxY - minY + 1;
  const totalBoxPixels = boxW * boxH;
  if (totalBoxPixels < 16) return;

  // 1. Check if user already performed manual edits (erased/painted areas)
  let userActiveCount = 0;
  if (currentMask) {
    for (let y = minY; y <= maxY; y++) {
      const rowOffset = y * totalWidth;
      for (let x = minX; x <= maxX; x++) {
        if (currentMask[rowOffset + x] > 128) userActiveCount++;
      }
    }
  }

  const isPartiallyEdited = currentMask && userActiveCount > 0.03 * totalBoxPixels && userActiveCount < 0.97 * totalBoxPixels;

  // 2. Precompute luminance and Sobel edge gradient magnitude
  const lum = new Uint8Array(totalWidth * totalHeight);
  for (let y = minY; y <= maxY; y++) {
    const rowOffset = y * totalWidth;
    for (let x = minX; x <= maxX; x++) {
      const idx = (rowOffset + x) * 4;
      lum[rowOffset + x] = (pixels[idx] * 54 + pixels[idx + 1] * 183 + pixels[idx + 2] * 19) >> 8;
    }
  }

  const grad = new Uint8Array(totalWidth * totalHeight);
  for (let y = minY + 1; y < maxY; y++) {
    const rowOffset = y * totalWidth;
    for (let x = minX + 1; x < maxX; x++) {
      const gx = Math.abs(lum[rowOffset + x + 1] - lum[rowOffset + x - 1]);
      const gy = Math.abs(lum[(y + 1) * totalWidth + x] - lum[(y - 1) * totalWidth + x]);
      grad[rowOffset + x] = Math.min(255, gx + gy);
    }
  }

  // 3. Build Background Color Clusters
  const bgClusters: { r: number; g: number; b: number; count: number }[] = [];

  const addBgSample = (x: number, y: number) => {
    const idx = (y * totalWidth + x) * 4;
    const a = pixels[idx + 3];
    if (a < 15) return; // Skip transparent padding

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

  // Sample along perimeter of the target box
  const step = Math.max(1, Math.floor(Math.min(boxW, boxH) / 60));
  for (let x = minX; x <= maxX; x += step) {
    addBgSample(x, minY);
    addBgSample(x, Math.min(maxY, minY + 3));
    addBgSample(x, maxY);
    addBgSample(x, Math.max(minY, maxY - 3));
  }
  for (let y = minY; y <= maxY; y += step) {
    addBgSample(minX, y);
    addBgSample(Math.min(maxX, minX + 3), y);
    addBgSample(maxX, y);
    addBgSample(Math.max(minX, maxX - 3), y);
  }

  // Check if pixel color matches background clusters
  const isBackgroundLike = (x: number, y: number, toleranceSq = 2400): boolean => {
    const idx = (y * totalWidth + x) * 4;
    const a = pixels[idx + 3];
    if (a < 15) return true; // Transparent is always background

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

  // 4. Connected Background Flood Fill
  const isBg = new Uint8Array(totalWidth * totalHeight);
  const queue: number[] = [];

  const pushBgSeed = (x: number, y: number) => {
    const idx = y * totalWidth + x;
    if (!isBg[idx] && isBackgroundLike(x, y, 3600)) {
      isBg[idx] = 1;
      queue.push(x, y);
    }
  };

  for (let x = minX; x <= maxX; x++) {
    pushBgSeed(x, minY);
    pushBgSeed(x, maxY);
  }
  for (let y = minY; y <= maxY; y++) {
    pushBgSeed(minX, y);
    pushBgSeed(maxX, y);
  }

  if (isPartiallyEdited && currentMask) {
    for (let y = minY; y <= maxY; y += 2) {
      const rowOffset = y * totalWidth;
      for (let x = minX; x <= maxX; x += 2) {
        if (currentMask[rowOffset + x] === 0 && !isBg[rowOffset + x]) {
          isBg[rowOffset + x] = 1;
          queue.push(x, y);
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
      if (nx >= minX && nx <= maxX && ny >= minY && ny <= maxY) {
        const nidx = ny * totalWidth + nx;
        if (!isBg[nidx]) {
          const edgeMag = grad[nidx];
          if (edgeMag < 55 && isBackgroundLike(nx, ny, 2800)) {
            isBg[nidx] = 1;
            queue.push(nx, ny);
          }
        }
      }
    }
  }

  // 5. Initial Subject Candidate
  const isSubject = new Uint8Array(totalWidth * totalHeight);
  for (let y = minY; y <= maxY; y++) {
    const rowOffset = y * totalWidth;
    for (let x = minX; x <= maxX; x++) {
      isSubject[rowOffset + x] = isBg[rowOffset + x] ? 0 : 1;
    }
  }

  // 6. Connected Component Analysis to Keep Only the Main Subject (Remove noise speckles)
  const labels = new Int32Array(totalWidth * totalHeight);
  let currentLabel = 0;
  const componentSizes: number[] = [0];

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const idx = y * totalWidth + x;
      if (isSubject[idx] && labels[idx] === 0) {
        currentLabel++;
        let size = 0;

        const compQueue = [x, y];
        labels[idx] = currentLabel;

        let compHead = 0;
        while (compHead < compQueue.length) {
          const cx = compQueue[compHead++];
          const cy = compQueue[compHead++];
          size++;

          const nbs = [
            [cx + 1, cy],
            [cx - 1, cy],
            [cx, cy + 1],
            [cx, cy - 1]
          ];
          for (const [nx, ny] of nbs) {
            if (nx >= minX && nx <= maxX && ny >= minY && ny <= maxY) {
              const nidx = ny * totalWidth + nx;
              if (isSubject[nidx] && labels[nidx] === 0) {
                labels[nidx] = currentLabel;
                compQueue.push(nx, ny);
              }
            }
          }
        }

        componentSizes.push(size);
      }
    }
  }

  let maxCompSize = 0;
  for (let l = 1; l <= currentLabel; l++) {
    if (componentSizes[l] > maxCompSize) {
      maxCompSize = componentSizes[l];
    }
  }

  // Keep significant foreground components (> 8% of max component)
  const validLabels = new Set<number>();
  for (let l = 1; l <= currentLabel; l++) {
    if (componentSizes[l] >= maxCompSize * 0.08) {
      validLabels.add(l);
    }
  }

  // 7. Write clean isolated subject mask
  mask.fill(0);
  for (let y = minY; y <= maxY; y++) {
    const rowOffset = y * totalWidth;
    for (let x = minX; x <= maxX; x++) {
      const l = labels[rowOffset + x];
      if (l > 0 && validLabels.has(l)) {
        mask[rowOffset + x] = 255;
      }
    }
  }
}
