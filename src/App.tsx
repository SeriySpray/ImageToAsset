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
import { createFullMask, createEmptyMask, smartAutoCutout } from './engine/segmentation';
import { renderHalftone } from './engine/halftone';
import { renderTornPaperAsset } from './engine/torn-edge';

export const App: React.FC = () => {
  const [currentPresetId, setCurrentPresetId] = useState<string>('grayscale-rich');
  const [halftone, setHalftone] = useState<HalftoneSettings>(PRESETS[0].halftone);
  const [tornEdge, setTornEdge] = useState<TornEdgeSettings>(PRESETS[0].tornEdge);

  const [image, setImage] = useState<HTMLImageElement | null>(null);
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

  // Load image into memory with initial 100% full visible mask (No auto cutout on load)
  const loadImage = useCallback((imgElement: HTMLImageElement, autoCutout = false) => {
    setImage(imgElement);
    const width = imgElement.naturalWidth || imgElement.width;
    const height = imgElement.naturalHeight || imgElement.height;

    const initialMask = createFullMask(width, height);
    if (autoCutout) {
      const offCanvas = document.createElement('canvas');
      offCanvas.width = width;
      offCanvas.height = height;
      const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });
      if (offCtx) {
        offCtx.drawImage(imgElement, 0, 0);
        smartAutoCutout(offCtx, initialMask, width, height);
      }
    }

    setMask(initialMask);
    setUndoStack([]);
    setRedoStack([]);

    // Fit to viewport
    const maxW = window.innerWidth - 380;
    const maxH = window.innerHeight - 90;
    const fitScale = Math.min(1, Math.min(maxW / width, maxH / height) * 0.88);
    setScale(Math.max(0.15, fitScale));
    setPan({ x: 0, y: 0 });
  }, []);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (typeof e.target?.result === 'string') {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => loadImage(img, false);
        img.src = e.target.result;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSelectSample = (samplePath: string, presetId?: string) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
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
    setMask((currentMask) => {
      if (currentMask) {
        setUndoStack((prev) => [...prev.slice(-35), new Uint8ClampedArray(currentMask)]);
        setRedoStack([]);
      }
      return newMask;
    });
  }, []);

  // Undo
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0 || !mask) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack((r) => [...r, new Uint8ClampedArray(mask)]);
    setUndoStack((u) => u.slice(0, -1));
    setMask(prev);
  }, [undoStack, mask]);

  // Redo
  const handleRedo = useCallback(() => {
    if (redoStack.length === 0 || !mask) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((u) => [...u, new Uint8ClampedArray(mask)]);
    setRedoStack((r) => r.slice(0, -1));
    setMask(next);
  }, [redoStack, mask]);

  // On-demand Smart AI Cutout
  const handleSmartAutoCutout = () => {
    if (!image) return;
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    const autoMask = createFullMask(width, height);
    const offCanvas = document.createElement('canvas');
    offCanvas.width = width;
    offCanvas.height = height;
    const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });
    if (offCtx) {
      offCtx.drawImage(image, 0, 0);
      smartAutoCutout(offCtx, autoMask, width, height);
      handleUpdateMask(autoMask);
    }
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
    if (!mask) return;
    const inverted = new Uint8ClampedArray(mask.length);
    for (let i = 0; i < mask.length; i++) {
      inverted[i] = 255 - mask[i];
    }
    handleUpdateMask(inverted);
  };

  const handleClearMask = () => {
    if (!image) return;
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    handleUpdateMask(createEmptyMask(width, height));
  };

  const handleFillAllMask = () => {
    if (!image) return;
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    handleUpdateMask(createFullMask(width, height));
  };

  const handleSelectPreset = (preset: Preset) => {
    setCurrentPresetId(preset.id);
    setHalftone(preset.halftone);
    setTornEdge(preset.tornEdge);
  };

  // Copy transparent PNG to clipboard
  const handleCopyToClipboard = async (): Promise<boolean> => {
    if (!renderedCanvasRef.current) return false;
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        renderedCanvasRef.current!.toBlob(resolve, 'image/png')
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

  // Export 1x, 2x, 4x
  const handleDownload = (exportScale = 1) => {
    if (!image || !mask) return;

    const origW = image.naturalWidth || image.width;
    const origH = image.naturalHeight || image.height;
    const w = origW * exportScale;
    const h = origH * exportScale;

    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = w;
    srcCanvas.height = h;
    const srcCtx = srcCanvas.getContext('2d');
    if (!srcCtx) return;
    srcCtx.drawImage(image, 0, 0, w, h);

    const scaledMask = new Uint8ClampedArray(w * h);
    for (let y = 0; y < h; y++) {
      const origY = Math.floor(y / exportScale);
      for (let x = 0; x < w; x++) {
        const origX = Math.floor(x / exportScale);
        scaledMask[y * w + x] = mask[origY * origW + origX];
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
    htCanvas.width = w;
    htCanvas.height = h;
    const htCtx = htCanvas.getContext('2d', { willReadFrequently: true });
    if (!htCtx) return;

    renderHalftone(srcCtx, htCtx, w, h, scaledHalftone);

    const outCanvas = document.createElement('canvas');
    outCanvas.width = w;
    outCanvas.height = h;
    const outCtx = outCanvas.getContext('2d');
    if (!outCtx) return;

    renderTornPaperAsset(htCanvas, outCtx, scaledMask, w, h, scaledTornEdge);

    const link = document.createElement('a');
    link.download = `asset_${halftone.mode}_${exportScale}x.png`;
    link.href = outCanvas.toDataURL('image/png');
    link.click();
  };

  const handleResetZoom = () => {
    if (!image) return;
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    const maxW = window.innerWidth - 380;
    const maxH = window.innerHeight - 90;
    const fitScale = Math.min(1, Math.min(maxW / width, maxH / height) * 0.88);
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
