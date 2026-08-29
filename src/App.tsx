import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ToolType, 
  HalftoneSettings, 
  TornEdgeSettings, 
  Preset, 
  Point 
} from './types';
import { PRESETS } from './constants/presets';
import { Header } from './components/Header';
import { ToolBar } from './components/ToolBar';
import { SettingsPanel } from './components/SettingsPanel';
import { CanvasViewport } from './components/CanvasViewport';
import { SampleImagesModal } from './components/SampleImagesModal';
import { createEmptyMask, smartAutoCutout } from './engine/segmentation';
import { renderHalftone } from './engine/halftone';
import { renderTornPaperAsset } from './engine/torn-edge';

const MAX_WORKING_DIM = 1400;

export const App: React.FC = () => {
  const [currentPresetId, setCurrentPresetId] = useState<string>('grayscale-rich');
  const [halftone, setHalftone] = useState<HalftoneSettings>(PRESETS[0].halftone);
  const [tornEdge, setTornEdge] = useState<TornEdgeSettings>(PRESETS[0].tornEdge);

  const [image, setImage] = useState<HTMLImageElement | HTMLCanvasElement | null>(null);
  const rawImageRef = useRef<HTMLImageElement | null>(null);
  const [mask, setMask] = useState<Uint8ClampedArray | null>(null);
  const [undoStack, setUndoStack] = useState<Uint8ClampedArray[]>([]);
  const [redoStack, setRedoStack] = useState<Uint8ClampedArray[]>([]);

  const [activeTool, setActiveTool] = useState<ToolType>('brush');
  const [brushSize, setBrushSize] = useState<number>(36);
  const [wandTolerance, setWandTolerance] = useState<number>(24);

  const [canvasBg, setCanvasBg] = useState<'dark-check' | 'light-check' | 'dark-solid' | 'light-solid'>('dark-check');
  const [showSplitView, setShowSplitView] = useState<boolean>(false);
  const [showSamplesModal, setShowSamplesModal] = useState<boolean>(false);

  const [scale, setScale] = useState<number>(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const renderedCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const pad = tornEdge.canvasPadding || 60;
  const rawW = image ? ((image as HTMLImageElement).naturalWidth || image.width) : 0;
  const rawH = image ? ((image as HTMLImageElement).naturalHeight || image.height) : 0;
  const totalW = rawW > 0 ? rawW + pad * 2 : 0;
  const totalH = rawH > 0 ? rawH + pad * 2 : 0;

  // Initialize mask with buffer margin around image
  const initializePaddedMask = useCallback((width: number, height: number, padding: number) => {
    const totalWidth = width + padding * 2;
    const totalHeight = height + padding * 2;
    const newMask = new Uint8ClampedArray(totalWidth * totalHeight);

    for (let y = padding; y < padding + height; y++) {
      const rowOffset = y * totalWidth;
      for (let x = padding; x < padding + width; x++) {
        newMask[rowOffset + x] = 255;
      }
    }
    return newMask;
  }, []);

  // Load image into memory with automatic working-canvas clamping for ultra-fast 60 FPS performance
  const loadImage = useCallback((imgElement: HTMLImageElement, autoCutout = false) => {
    const t0 = performance.now();
    rawImageRef.current = imgElement;
    const origW = imgElement.naturalWidth || imgElement.width;
    const origH = imgElement.naturalHeight || imgElement.height;
    const currentPad = tornEdge.canvasPadding || 60;

    let targetSource: HTMLImageElement | HTMLCanvasElement = imgElement;
    let workW = origW;
    let workH = origH;

    // Fast-path downscale for interactive editing if image exceeds MAX_WORKING_DIM
    if (origW > MAX_WORKING_DIM || origH > MAX_WORKING_DIM) {
      const scaleFactor = MAX_WORKING_DIM / Math.max(origW, origH);
      workW = Math.round(origW * scaleFactor);
      workH = Math.round(origH * scaleFactor);

      const workCanvas = document.createElement('canvas');
      workCanvas.width = workW;
      workCanvas.height = workH;
      const ctx = workCanvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(imgElement, 0, 0, workW, workH);
      }
      targetSource = workCanvas;
    }

    setImage(targetSource);

    const initialMask = initializePaddedMask(workW, workH, currentPad);

    if (autoCutout) {
      const totalWidth = workW + currentPad * 2;
      const totalHeight = workH + currentPad * 2;
      const offCanvas = document.createElement('canvas');
      offCanvas.width = totalWidth;
      offCanvas.height = totalHeight;
      const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });
      if (offCtx) {
        offCtx.drawImage(targetSource, currentPad, currentPad, workW, workH);
        smartAutoCutout(offCtx, initialMask, totalWidth, totalHeight, {
          x0: currentPad,
          y0: currentPad,
          x1: currentPad + workW,
          y1: currentPad + workH,
        });
      }
    }

    setMask(initialMask);
    setUndoStack([]);
    setRedoStack([]);

    const maxW = window.innerWidth - 380;
    const maxH = window.innerHeight - 90;
    const fitScale = Math.min(1, Math.min(maxW / (workW + currentPad * 2), maxH / (workH + currentPad * 2)) * 0.88);
    setScale(Math.max(0.15, fitScale));
    setPan({ x: 0, y: 0 });

    const t1 = performance.now();
    console.log(`[ImageToAsset Perf] Image setup completed in ${(t1 - t0).toFixed(2)}ms (working size: ${workW}x${workH}, padded total: ${workW + currentPad * 2}x${workH + currentPad * 2})`);
  }, [initializePaddedMask, tornEdge.canvasPadding]);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const t0 = performance.now();
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const t1 = performance.now();
      console.log(`[ImageToAsset Perf] User file loaded in ${(t1 - t0).toFixed(2)}ms (original resolution: ${img.naturalWidth}x${img.naturalHeight})`);
      loadImage(img, false);
    };
    img.src = objectUrl;
  };

  const handleSelectSample = (samplePath: string, presetId?: string) => {
    const t0 = performance.now();
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const t1 = performance.now();
      console.log(`[ImageToAsset Perf] Sample image fetched in ${(t1 - t0).toFixed(2)}ms (${samplePath})`);
      loadImage(img, false);
      if (presetId) {
        const preset = PRESETS.find((p) => p.id === presetId);
        if (preset) {
          setCurrentPresetId(preset.id);
          setHalftone(preset.halftone);
          setTornEdge(preset.tornEdge);
        }
      }
    };
    img.src = samplePath;
  };

  // Automatically load the books sample on launch
  useEffect(() => {
    handleSelectSample('/samples/books_reference.jpg', 'grayscale-rich');
  }, []);

  // Global Paste (Ctrl+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) handleFile(file);
          break;
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [loadImage]);

  // Mask Update with Undo Stack preservation
  const handleUpdateMask = useCallback((newMask: Uint8ClampedArray) => {
    const t0 = performance.now();
    setMask((currentMask) => {
      if (currentMask) {
        setUndoStack((prev) => [...prev.slice(-35), new Uint8ClampedArray(currentMask)]);
        setRedoStack([]);
      }
      return newMask;
    });
    const t1 = performance.now();
    console.log(`[ImageToAsset Perf] Mask updated and committed in ${(t1 - t0).toFixed(2)}ms`);
  }, []);

  // Undo
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0 || !mask) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack((r) => [...r, new Uint8ClampedArray(mask)]);
    setUndoStack((u) => u.slice(0, -1));
    setMask(prev);
    console.log(`[ImageToAsset Perf] Undo action performed`);
  }, [undoStack, mask]);

  // Redo
  const handleRedo = useCallback(() => {
    if (redoStack.length === 0 || !mask) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((u) => [...u, new Uint8ClampedArray(mask)]);
    setRedoStack((r) => r.slice(0, -1));
    setMask(next);
    console.log(`[ImageToAsset Perf] Redo action performed`);
  }, [redoStack, mask]);

  // On-demand Smart AI Cutout
  const handleSmartAutoCutout = () => {
    if (!image || totalW === 0 || totalH === 0) return;
    const t0 = performance.now();
    const autoMask = new Uint8ClampedArray(totalW * totalH);
    const offCanvas = document.createElement('canvas');
    offCanvas.width = totalW;
    offCanvas.height = totalH;
    const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });
    if (offCtx) {
      offCtx.drawImage(image, pad, pad, rawW, rawH);
      smartAutoCutout(offCtx, autoMask, totalW, totalH, {
        x0: pad,
        y0: pad,
        x1: pad + rawW,
        y1: pad + rawH,
      });
      handleUpdateMask(autoMask);
    }
    const t1 = performance.now();
    console.log(`[ImageToAsset Perf] Smart auto cutout completed in ${(t1 - t0).toFixed(2)}ms`);
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'SELECT') {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleCopyToClipboard();
      } else if (e.key.toLowerCase() === 'h') {
        setActiveTool('pan');
      } else if (e.key.toLowerCase() === 'm') {
        setActiveTool('box-select');
      } else if (e.key.toLowerCase() === 'l') {
        setActiveTool('lasso');
      } else if (e.key.toLowerCase() === 'p') {
        setActiveTool('polygon');
      } else if (e.key.toLowerCase() === 'b') {
        setActiveTool('brush');
      } else if (e.key.toLowerCase() === 'e') {
        setActiveTool('eraser');
      } else if (e.key.toLowerCase() === 'w') {
        setActiveTool('magic-wand');
      } else if (e.key === '[') {
        setBrushSize((s) => Math.max(4, s - 6));
      } else if (e.key === ']') {
        setBrushSize((s) => Math.min(120, s + 6));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  const handleInvertMask = () => {
    if (!mask || totalW === 0 || totalH === 0) return;
    const inverted = new Uint8ClampedArray(mask.length);
    for (let y = pad; y < pad + rawH; y++) {
      const rowOffset = y * totalW;
      for (let x = pad; x < pad + rawW; x++) {
        inverted[rowOffset + x] = 255 - mask[rowOffset + x];
      }
    }
    handleUpdateMask(inverted);
  };

  const handleClearMask = () => {
    if (!image || totalW === 0 || totalH === 0) return;
    handleUpdateMask(createEmptyMask(totalW, totalH));
  };

  const handleFillAllMask = () => {
    if (!image || totalW === 0 || totalH === 0) return;
    handleUpdateMask(initializePaddedMask(rawW, rawH, pad));
  };

  const handleSelectPreset = (preset: Preset) => {
    setCurrentPresetId(preset.id);
    setHalftone(preset.halftone);
    setTornEdge(preset.tornEdge);
  };

  // Helper to trim transparent empty margins with a tight aesthetic border
  const getTrimmedCanvas = (srcCanvas: HTMLCanvasElement): HTMLCanvasElement => {
    const w = srcCanvas.width;
    const h = srcCanvas.height;
    const ctx = srcCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return srcCanvas;

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    let minX = w, minY = h, maxX = 0, maxY = 0;
    let found = false;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const alpha = data[(y * w + x) * 4 + 3];
        if (alpha > 5) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          found = true;
        }
      }
    }

    if (!found) return srcCanvas;

    const margin = 12;
    const cropX = Math.max(0, minX - margin);
    const cropY = Math.max(0, minY - margin);
    const cropW = Math.min(w - cropX, maxX - minX + 1 + margin * 2);
    const cropH = Math.min(h - cropY, maxY - minY + 1 + margin * 2);

    const trimmed = document.createElement('canvas');
    trimmed.width = cropW;
    trimmed.height = cropH;
    const trimmedCtx = trimmed.getContext('2d');
    if (!trimmedCtx) return srcCanvas;

    trimmedCtx.drawImage(srcCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
    return trimmed;
  };

  // Copy transparent PNG to clipboard
  const handleCopyToClipboard = async (): Promise<boolean> => {
    if (!renderedCanvasRef.current) return false;
    try {
      const trimmedCanvas = getTrimmedCanvas(renderedCanvasRef.current);
      const blob = await new Promise<Blob | null>((resolve) =>
        trimmedCanvas.toBlob(resolve, 'image/png')
      );
      if (!blob) return false;

      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      return true;
    } catch (err) {
      console.error('Failed to copy to clipboard', err);
      return false;
    }
  };

  // Export 1x, 2x, 4x from full original resolution
  const handleDownload = (exportScale = 1) => {
    const t0 = performance.now();
    const srcImg = rawImageRef.current || image;
    if (!srcImg || !mask || totalW === 0 || totalH === 0) return;

    const expW = totalW * exportScale;
    const expH = totalH * exportScale;
    const expPad = pad * exportScale;
    const expRawW = rawW * exportScale;
    const expRawH = rawH * exportScale;

    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = expW;
    srcCanvas.height = expH;
    const srcCtx = srcCanvas.getContext('2d');
    if (!srcCtx) return;
    srcCtx.drawImage(srcImg, expPad, expPad, expRawW, expRawH);

    const scaledMask = new Uint8ClampedArray(expW * expH);
    for (let y = 0; y < expH; y++) {
      const origY = Math.floor(y / exportScale);
      for (let x = 0; x < expW; x++) {
        const origX = Math.floor(x / exportScale);
        scaledMask[y * expW + x] = mask[origY * totalW + origX];
      }
    }

    const scaledHalftone: HalftoneSettings = {
      ...halftone,
      dotSize: halftone.dotSize * exportScale,
    };

    const scaledTornEdge: TornEdgeSettings = {
      ...tornEdge,
      padding: tornEdge.padding * exportScale,
      roughness: tornEdge.roughness * exportScale,
      frequency: tornEdge.frequency / exportScale,
    };

    const htCanvas = document.createElement('canvas');
    htCanvas.width = expW;
    htCanvas.height = expH;
    const htCtx = htCanvas.getContext('2d', { willReadFrequently: true });
    if (!htCtx) return;

    renderHalftone(srcCtx, htCtx, expW, expH, scaledHalftone);

    const outCanvas = document.createElement('canvas');
    outCanvas.width = expW;
    outCanvas.height = expH;
    const outCtx = outCanvas.getContext('2d');
    if (!outCtx) return;

    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = expW;
    maskCanvas.height = expH;
    const mCtx = maskCanvas.getContext('2d');
    if (mCtx) {
      const mData = mCtx.createImageData(expW, expH);
      for (let i = 0; i < expW * expH; i++) {
        mData.data[i * 4] = 255;
        mData.data[i * 4 + 1] = 255;
        mData.data[i * 4 + 2] = 255;
        mData.data[i * 4 + 3] = scaledMask[i];
      }
      mCtx.putImageData(mData, 0, 0);
    }

    renderTornPaperAsset(htCanvas, outCtx, maskCanvas, expW, expH, scaledTornEdge);

    const finalCanvas = getTrimmedCanvas(outCanvas);
    const link = document.createElement('a');
    link.download = `asset_${halftone.mode}_${exportScale}x.png`;
    link.href = finalCanvas.toDataURL('image/png');
    link.click();

    const t1 = performance.now();
    console.log(`[ImageToAsset Perf] High-res export (${exportScale}x) generated in ${(t1 - t0).toFixed(2)}ms (${expW}x${expH})`);
  };

  const handleResetZoom = () => {
    if (!image || totalW === 0 || totalH === 0) return;
    const maxW = window.innerWidth - 380;
    const maxH = window.innerHeight - 90;
    const fitScale = Math.min(1, Math.min(maxW / totalW, maxH / totalH) * 0.88);
    setScale(Math.max(0.15, fitScale));
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className="flex flex-col w-screen h-screen bg-[#0d0f15] text-slate-100 overflow-hidden font-sans">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFile(e.target.files[0]);
          }
        }}
      />

      {/* Top Navigation Bar */}
      <Header
        currentPresetId={currentPresetId}
        onSelectPreset={handleSelectPreset}
        onUploadClick={() => fileInputRef.current?.click()}
        onOpenSamples={() => setShowSamplesModal(true)}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        onCopyToClipboard={handleCopyToClipboard}
        onDownload={handleDownload}
        showSplitView={showSplitView}
        onToggleSplitView={() => setShowSplitView(!showSplitView)}
        onResetZoom={handleResetZoom}
        hasImage={image !== null}
      />

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Toolbar */}
        <ToolBar
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          onAutoCutout={handleSmartAutoCutout}
          brushSize={brushSize}
          onChangeBrushSize={setBrushSize}
          wandTolerance={wandTolerance}
          onChangeWandTolerance={setWandTolerance}
          onInvertMask={handleInvertMask}
          onClearMask={handleClearMask}
          onFillAllMask={handleFillAllMask}
          hasImage={image !== null}
        />

        {/* Central Canvas Stage */}
        <CanvasViewport
          image={image}
          mask={mask}
          onUpdateMask={handleUpdateMask}
          activeTool={activeTool}
          brushSize={brushSize}
          wandTolerance={wandTolerance}
          halftone={halftone}
          tornEdge={tornEdge}
          canvasBg={canvasBg}
          showSplitView={showSplitView}
          onDropFile={handleFile}
          onOpenSamples={() => setShowSamplesModal(true)}
          scale={scale}
          pan={pan}
          onUpdateView={(s, p) => {
            setScale(s);
            setPan(p);
          }}
          renderedCanvasRef={renderedCanvasRef}
        />

        {/* Right Settings Panel */}
        <SettingsPanel
          halftone={halftone}
          onChangeHalftone={(s) => setHalftone((prev) => ({ ...prev, ...s }))}
          tornEdge={tornEdge}
          onChangeTornEdge={(s) => setTornEdge((prev) => ({ ...prev, ...s }))}
          canvasBg={canvasBg}
          onChangeCanvasBg={setCanvasBg}
          hasImage={image !== null}
        />
      </div>

      {/* Sample Reference Images Modal */}
      {showSamplesModal && (
        <SampleImagesModal
          isOpen={showSamplesModal}
          onSelectSample={handleSelectSample}
          onClose={() => setShowSamplesModal(false)}
        />
      )}
    </div>
  );
};

export default App;
