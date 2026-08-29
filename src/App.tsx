import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ToolType, 
  HalftoneSettings, 
  TornEdgeSettings, 
  Point 
} from './types';
import { PRESETS } from './constants/presets';
import { Header } from './components/Header';
import { ToolBar } from './components/ToolBar';
import { SettingsPanel } from './components/SettingsPanel';
import { CanvasViewport } from './components/CanvasViewport';
import { createEmptyMask } from './engine/segmentation';

const MAX_WORKING_DIM = 1400;

export const App: React.FC = () => {
  const [halftone, setHalftone] = useState<HalftoneSettings>(PRESETS[0].halftone);
  const [tornEdge, setTornEdge] = useState<TornEdgeSettings>({
    ...PRESETS[0].tornEdge,
    canvasPadding: 0 // Default: OFF (tight fit without outer border)
  });

  const [image, setImage] = useState<HTMLImageElement | HTMLCanvasElement | null>(null);
  const rawImageRef = useRef<HTMLImageElement | null>(null);
  const [mask, setMask] = useState<Uint8ClampedArray | null>(null);
  const [undoStack, setUndoStack] = useState<Uint8ClampedArray[]>([]);
  const [redoStack, setRedoStack] = useState<Uint8ClampedArray[]>([]);

  // Synchronous refs for 100% reliable global shortcuts
  const maskRef = useRef<Uint8ClampedArray | null>(null);
  maskRef.current = mask;
  const undoStackRef = useRef<Uint8ClampedArray[]>([]);
  undoStackRef.current = undoStack;
  const redoStackRef = useRef<Uint8ClampedArray[]>([]);
  redoStackRef.current = redoStack;

  const [activeTool, setActiveTool] = useState<ToolType>('magic-wand');
  const [brushSize, setBrushSize] = useState<number>(36);
  const [wandTolerance, setWandTolerance] = useState<number>(24);

  const [canvasBg, setCanvasBg] = useState<'dark-check' | 'light-check' | 'dark-solid' | 'light-solid'>('dark-check');

  const [scale, setScale] = useState<number>(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const renderedCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const pad = (tornEdge.canvasPadding && tornEdge.canvasPadding > 0) ? 60 : 0;
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

  // Toggle Buffer Margin (0px tight or 60px outer buffer)
  const handleToggleBufferPadding = useCallback((enabled: boolean) => {
    const oldPad = (tornEdge.canvasPadding && tornEdge.canvasPadding > 0) ? 60 : 0;
    const newPad = enabled ? 60 : 0;
    if (oldPad === newPad) return;

    setTornEdge((prev) => ({ ...prev, canvasPadding: newPad }));

    if (image && mask) {
      const workW = (image as HTMLImageElement).naturalWidth || image.width;
      const workH = (image as HTMLImageElement).naturalHeight || image.height;
      const oldTotalW = workW + oldPad * 2;
      const newTotalW = workW + newPad * 2;
      const newTotalH = workH + newPad * 2;
      const newMask = new Uint8ClampedArray(newTotalW * newTotalH);

      // Copy existing mask preserving cutout alignment
      for (let y = 0; y < workH; y++) {
        const oldRowOffset = (y + oldPad) * oldTotalW;
        const newRowOffset = (y + newPad) * newTotalW;
        for (let x = 0; x < workW; x++) {
          newMask[newRowOffset + (x + newPad)] = mask[oldRowOffset + (x + oldPad)];
        }
      }
      setMask(newMask);
      setUndoStack([]);
      setRedoStack([]);
    }
  }, [image, mask, tornEdge.canvasPadding]);

  // Load image into memory with automatic working-canvas clamping for ultra-fast 60 FPS performance
  const loadImage = useCallback((imgElement: HTMLImageElement) => {
    const t0 = performance.now();
    rawImageRef.current = imgElement;
    const origW = imgElement.naturalWidth || imgElement.width;
    const origH = imgElement.naturalHeight || imgElement.height;
    const currentPad = (tornEdge.canvasPadding && tornEdge.canvasPadding > 0) ? 60 : 0;

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
      loadImage(img);
    };
    img.src = objectUrl;
  };

  const handleSelectSample = (samplePath: string) => {
    const t0 = performance.now();
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const t1 = performance.now();
      console.log(`[ImageToAsset Perf] Default sample loaded in ${(t1 - t0).toFixed(2)}ms (${samplePath})`);
      loadImage(img);
    };
    img.src = samplePath;
  };

  // Automatically load default books reference on initial launch
  useEffect(() => {
    handleSelectSample('/samples/books_reference.jpg');
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
    const curMask = maskRef.current;
    if (curMask) {
      setUndoStack((prev) => [...prev.slice(-40), new Uint8ClampedArray(curMask)]);
      setRedoStack([]);
    }
    setMask(newMask);
  }, []);

  // Undo (Ctrl+Z)
  const handleUndo = useCallback(() => {
    const uStack = undoStackRef.current;
    const curMask = maskRef.current;
    if (uStack.length === 0 || !curMask) return;

    const prev = uStack[uStack.length - 1];
    setRedoStack((r) => [...r, new Uint8ClampedArray(curMask)]);
    setUndoStack((u) => u.slice(0, -1));
    setMask(prev);
    console.log(`[ImageToAsset Perf] Undo executed (remaining undo: ${uStack.length - 1})`);
  }, []);

  // Redo (Ctrl+Y / Ctrl+Shift+Z)
  const handleRedo = useCallback(() => {
    const rStack = redoStackRef.current;
    const curMask = maskRef.current;
    if (rStack.length === 0 || !curMask) return;

    const next = rStack[rStack.length - 1];
    setUndoStack((u) => [...u, new Uint8ClampedArray(curMask)]);
    setRedoStack((r) => r.slice(0, -1));
    setMask(next);
    console.log(`[ImageToAsset Perf] Redo executed (remaining redo: ${rStack.length - 1})`);
  }, []);

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

    const cropPadding = 12;
    const cropX = Math.max(0, minX - cropPadding);
    const cropY = Math.max(0, minY - cropPadding);
    const cropW = Math.min(w - cropX, maxX - minX + 1 + cropPadding * 2);
    const cropH = Math.min(h - cropY, maxY - minY + 1 + cropPadding * 2);

    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = cropW;
    croppedCanvas.height = cropH;
    const cropCtx = croppedCanvas.getContext('2d');
    if (cropCtx) {
      cropCtx.drawImage(srcCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
    }
    return croppedCanvas;
  };

  // Copy to Clipboard (Ctrl+C)
  const handleCopyToClipboard = useCallback(async (): Promise<boolean> => {
    if (!renderedCanvasRef.current) return false;
    try {
      const trimmedCanvas = getTrimmedCanvas(renderedCanvasRef.current);
      return new Promise<boolean>((resolve) => {
        trimmedCanvas.toBlob(async (blob) => {
          if (!blob) {
            resolve(false);
            return;
          }
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            resolve(true);
          } catch (err) {
            console.error('Clipboard copy error:', err);
            resolve(false);
          }
        }, 'image/png');
      });
    } catch (e) {
      console.error('Copy to clipboard failed:', e);
      return false;
    }
  }, []);

  // Global Keyboard Shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z, Ctrl+C, Tool shortcuts)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'SELECT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      const isCtrlOrMeta = e.ctrlKey || e.metaKey;

      if (isCtrlOrMeta && (e.key === 'z' || e.key === 'Z' || e.key === 'я' || e.key === 'Я' || e.code === 'KeyZ')) {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if (isCtrlOrMeta && (e.key === 'y' || e.key === 'Y' || e.key === 'н' || e.key === 'Н' || e.code === 'KeyY')) {
        e.preventDefault();
        e.stopPropagation();
        handleRedo();
      } else if (isCtrlOrMeta && (e.key === 'c' || e.key === 'C' || e.key === 'с' || e.key === 'С' || e.code === 'KeyC')) {
        e.preventDefault();
        handleCopyToClipboard();
      } else if (e.key.toLowerCase() === 'w' || e.code === 'KeyW') {
        setActiveTool('magic-wand');
      } else if (e.key.toLowerCase() === 'b' || e.code === 'KeyB') {
        setActiveTool('brush');
      } else if (e.key.toLowerCase() === 'e' || e.code === 'KeyE') {
        setActiveTool('eraser');
      } else if (e.key.toLowerCase() === 'm' || e.code === 'KeyM') {
        setActiveTool('box-select');
      } else if (e.key.toLowerCase() === 'l' || e.code === 'KeyL') {
        setActiveTool('lasso');
      } else if (e.key.toLowerCase() === 'h' || e.code === 'KeyH') {
        setActiveTool('pan');
      } else if (e.key === '[') {
        setBrushSize((s) => Math.max(4, s - 6));
      } else if (e.key === ']') {
        setBrushSize((s) => Math.min(120, s + 6));
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [handleUndo, handleRedo, handleCopyToClipboard]);

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

  // Direct Transparent PNG Export Engine (Sticker + Border + Shadow without background)
  const handleDownload = useCallback(() => {
    if (!renderedCanvasRef.current || totalW === 0 || totalH === 0) return;

    const trimmedCanvas = getTrimmedCanvas(renderedCanvasRef.current);

    trimmedCanvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `imagetoasset-sticker-${Date.now()}.png`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  }, [totalW, totalH]);

  const handleResetZoom = () => {
    if (!image) return;
    const maxW = window.innerWidth - 380;
    const maxH = window.innerHeight - 90;
    const fitScale = Math.min(1, Math.min(maxW / totalW, maxH / totalH) * 0.88);
    setScale(Math.max(0.15, fitScale));
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#000000] text-[#d4d4d4] overflow-hidden font-mono select-none">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }}
        className="hidden"
      />

      {/* Top Application Header */}
      <Header
        onUploadClick={() => fileInputRef.current?.click()}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        onCopyToClipboard={handleCopyToClipboard}
        onDownload={handleDownload}
        onResetZoom={handleResetZoom}
        hasImage={image !== null}
      />

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Toolbar */}
        <ToolBar
          activeTool={activeTool}
          onSelectTool={setActiveTool}
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
          onDropFile={handleFile}
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
          onToggleBufferPadding={handleToggleBufferPadding}
          canvasBg={canvasBg}
          onChangeCanvasBg={setCanvasBg}
          hasImage={image !== null}
        />
      </div>
    </div>
  );
};

export default App;
