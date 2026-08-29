import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ToolType, Point, HalftoneSettings, TornEdgeSettings } from '../types';
import { renderHalftone } from '../engine/halftone';
import { renderTornPaperAsset } from '../engine/torn-edge';
import {
  applyBrush,
  applyBrushStroke,
  fillPolygonMask,
  setBoxMask,
  magicWandSelect,
  smartAutoCutout,
} from '../engine/segmentation';

interface CanvasViewportProps {
  image: HTMLImageElement | null;
  mask: Uint8ClampedArray | null;
  onUpdateMask: (newMask: Uint8ClampedArray) => void;
  activeTool: ToolType;
  brushSize: number;
  wandTolerance: number;
  halftone: HalftoneSettings;
  tornEdge: TornEdgeSettings;
  canvasBg: 'dark-check' | 'light-check' | 'dark-solid' | 'light-solid';
  showSplitView: boolean;
  onDropFile: (file: File) => void;
  onOpenSamples: () => void;
  scale: number;
  pan: Point;
  onUpdateView: (scale: number, pan: Point) => void;
  renderedCanvasRef: React.RefObject<HTMLCanvasElement | null>;
}

export const CanvasViewport: React.FC<CanvasViewportProps> = ({
  image,
  mask,
  onUpdateMask,
  activeTool,
  brushSize,
  wandTolerance,
  halftone,
  tornEdge,
  canvasBg,
  showSplitView,
  onDropFile,
  onOpenSamples,
  scale,
  pan,
  onUpdateView,
  renderedCanvasRef,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
  const halftoneCanvasRef = useRef<HTMLCanvasElement>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  // Interaction states
  const [isInteracting, setIsInteracting] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [lastPoint, setLastPoint] = useState<Point | null>(null);
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [boxSelection, setBoxSelection] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [polygonPoints, setPolygonPoints] = useState<Point[]>([]);
  const [freehandPoints, setFreehandPoints] = useState<Point[]>([]);
  const [mousePos, setMousePos] = useState<Point | null>(null);
  const [splitPosition, setSplitPosition] = useState<number>(0.5); // 0..1

  // Handle global Space key for quick panning
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && document.activeElement?.tagName !== 'INPUT') {
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Update Source Canvas whenever image changes
  useEffect(() => {
    if (!image || !sourceCanvasRef.current) return;
    const srcCanvas = sourceCanvasRef.current;
    srcCanvas.width = image.naturalWidth || image.width;
    srcCanvas.height = image.naturalHeight || image.height;
    const ctx = srcCanvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, srcCanvas.width, srcCanvas.height);
      ctx.drawImage(image, 0, 0);
    }
  }, [image]);

  // Main Graphics Render Pipeline
  useEffect(() => {
    if (!image || !mask || !sourceCanvasRef.current || !displayCanvasRef.current) return;

    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;

    // 1. Prepare offscreen canvases
    if (!halftoneCanvasRef.current) {
      halftoneCanvasRef.current = document.createElement('canvas');
    }
    const htCanvas = halftoneCanvasRef.current;
    htCanvas.width = width;
    htCanvas.height = height;
    const htCtx = htCanvas.getContext('2d', { willReadFrequently: true });

    const srcCtx = sourceCanvasRef.current.getContext('2d', { willReadFrequently: true });
    const dispCanvas = displayCanvasRef.current;
    dispCanvas.width = width;
    dispCanvas.height = height;
    const dispCtx = dispCanvas.getContext('2d');

    if (!htCtx || !srcCtx || !dispCtx) return;

    // 2. Render Halftone artwork
    renderHalftone(srcCtx, htCtx, mask, width, height, halftone);

    // 3. Render Torn Paper Sticker Border & Composite
    renderTornPaperAsset(htCanvas, dispCtx, mask, width, height, tornEdge);

    // 4. Update rendered ref for export / clipboard
    if (renderedCanvasRef.current) {
      renderedCanvasRef.current.width = width;
      renderedCanvasRef.current.height = height;
      const refCtx = renderedCanvasRef.current.getContext('2d');
      if (refCtx) {
        refCtx.clearRect(0, 0, width, height);
        refCtx.drawImage(dispCanvas, 0, 0);
      }
    }
  }, [image, mask, halftone, tornEdge, renderedCanvasRef]);

  // Render Selection Overlay (Mask & Active Drawing Paths)
  useEffect(() => {
    if (!image || !mask || !overlayCanvasRef.current) return;
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    const canvas = overlayCanvasRef.current;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    // Only draw mask tint while actively painting/erasing with brush
    const isDrawingMask = isInteracting && (activeTool === 'brush' || activeTool === 'eraser');

    if (isDrawingMask) {
      const imgData = ctx.createImageData(width, height);
      const pixels = imgData.data;

      // Soft semi-transparent indigo tint for masked/selected area
      for (let i = 0; i < width * height; i++) {
        const m = mask[i];
        if (m > 10) {
          const idx = i * 4;
          pixels[idx] = 99;      // R (indigo)
          pixels[idx + 1] = 102;  // G
          pixels[idx + 2] = 241;  // B
          pixels[idx + 3] = Math.min(80, Math.floor(m * 0.3)); // alpha
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }

    // Draw active box select
    if (boxSelection && activeTool === 'box-select') {
      const minX = Math.min(boxSelection.x0, boxSelection.x1);
      const minY = Math.min(boxSelection.y0, boxSelection.y1);
      const w = Math.abs(boxSelection.x1 - boxSelection.x0);
      const h = Math.abs(boxSelection.y1 - boxSelection.y0);

      ctx.save();
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 2 / scale;
      ctx.setLineDash([4 / scale, 4 / scale]);
      ctx.strokeRect(minX, minY, w, h);
      ctx.fillStyle = 'rgba(99, 102, 241, 0.15)';
      ctx.fillRect(minX, minY, w, h);
      ctx.restore();
    }

    // Draw polygon nodes and path
    if (polygonPoints.length > 0) {
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2 / scale;
      ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
      ctx.beginPath();
      ctx.moveTo(polygonPoints[0].x, polygonPoints[0].y);
      for (let i = 1; i < polygonPoints.length; i++) {
        ctx.lineTo(polygonPoints[i].x, polygonPoints[i].y);
      }
      if (mousePos) {
        ctx.lineTo(mousePos.x, mousePos.y);
      }
      ctx.stroke();

      // Nodes
      for (const p of polygonPoints) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4 / scale, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#38bdf8';
        ctx.stroke();
      }
      ctx.restore();
    }

    // Draw freehand lasso path
    if (freehandPoints.length > 1) {
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2 / scale;
      ctx.beginPath();
      ctx.moveTo(freehandPoints[0].x, freehandPoints[0].y);
      for (let i = 1; i < freehandPoints.length; i++) {
        ctx.lineTo(freehandPoints[i].x, freehandPoints[i].y);
      }
      ctx.stroke();
      ctx.restore();
    }
  }, [image, mask, activeTool, isSpacePressed, boxSelection, polygonPoints, freehandPoints, mousePos, scale]);

  // Convert screen mouse coordinates to image pixel coordinates
  const screenToImage = useCallback(
    (clientX: number, clientY: number): Point | null => {
      if (!containerRef.current || !image) return null;
      const rect = containerRef.current.getBoundingClientRect();
      const cx = clientX - rect.left;
      const cy = clientY - rect.top;

      const imgWidth = image.naturalWidth || image.width;
      const imgHeight = image.naturalHeight || image.height;

      // Center offset
      const viewCenterX = rect.width / 2 + pan.x;
      const viewCenterY = rect.height / 2 + pan.y;

      const imgLeft = viewCenterX - (imgWidth * scale) / 2;
      const imgTop = viewCenterY - (imgHeight * scale) / 2;

      const x = (cx - imgLeft) / scale;
      const y = (cy - imgTop) / scale;

      return { x, y };
    },
    [image, scale, pan]
  );

  // Wheel Zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    const newScale = Math.max(0.1, Math.min(15, scale * zoomFactor));
    onUpdateView(newScale, pan);
  };

  // Mouse Down
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!image || !mask) return;

    // Pan with Middle Click or Space Key or Pan Tool
    if (e.button === 1 || isSpacePressed || activeTool === 'pan') {
      setIsInteracting(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    if (e.button !== 0) return; // Only Left Click for tools

    const pt = screenToImage(e.clientX, e.clientY);
    if (!pt) return;

    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;

    setIsInteracting(true);
    setLastPoint(pt);

    if (activeTool === 'brush' || activeTool === 'eraser') {
      const newMask = new Uint8ClampedArray(mask);
      applyBrush(newMask, width, height, pt.x, pt.y, brushSize, activeTool === 'eraser');
      onUpdateMask(newMask);
    } else if (activeTool === 'box-select' || activeTool === 'auto-cutout') {
      setBoxSelection({ x0: pt.x, y0: pt.y, x1: pt.x, y1: pt.y });
    } else if (activeTool === 'lasso') {
      setFreehandPoints([pt]);
    } else if (activeTool === 'polygon') {
      // If clicking near first point, close polygon
      if (polygonPoints.length >= 3) {
        const first = polygonPoints[0];
        const dist = Math.hypot(pt.x - first.x, pt.y - first.y);
        if (dist < 12 / scale) {
          const newMask = new Uint8ClampedArray(mask);
          fillPolygonMask(newMask, width, height, polygonPoints, 255);
          onUpdateMask(newMask);
          setPolygonPoints([]);
          setIsInteracting(false);
          return;
        }
      }
      setPolygonPoints((prev) => [...prev, pt]);
    } else if (activeTool === 'magic-wand' && sourceCanvasRef.current) {
      const newMask = new Uint8ClampedArray(mask);
      magicWandSelect(
        sourceCanvasRef.current.getContext('2d')!,
        newMask,
        width,
        height,
        pt.x,
        pt.y,
        wandTolerance,
        true,
        e.shiftKey ? 'add' : e.altKey ? 'subtract' : 'replace'
      );
      onUpdateMask(newMask);
      setIsInteracting(false);
    }
  };

  // Mouse Move
  const handleMouseMove = (e: React.MouseEvent) => {
    const pt = screenToImage(e.clientX, e.clientY);
    if (pt) setMousePos(pt);

    if (!isInteracting) return;

    // Panning
    if (dragStart && (isSpacePressed || activeTool === 'pan' || e.buttons === 4)) {
      onUpdateView(scale, {
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
      return;
    }

    if (!image || !mask || !pt) return;
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;

    if ((activeTool === 'brush' || activeTool === 'eraser') && lastPoint) {
      const newMask = new Uint8ClampedArray(mask);
      applyBrushStroke(newMask, width, height, lastPoint, pt, brushSize, activeTool === 'eraser');
      onUpdateMask(newMask);
      setLastPoint(pt);
    } else if (activeTool === 'box-select' || activeTool === 'auto-cutout') {
      if (boxSelection) {
        setBoxSelection({ ...boxSelection, x1: pt.x, y1: pt.y });
      }
    } else if (activeTool === 'lasso') {
      setFreehandPoints((prev) => [...prev, pt]);
    }
  };

  // Mouse Up
  const handleMouseUp = () => {
    if (!isInteracting) return;
    setIsInteracting(false);
    setDragStart(null);
    setLastPoint(null);

    if (!image || !mask) return;
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;

    if (activeTool === 'box-select' && boxSelection) {
      const newMask = new Uint8ClampedArray(mask);
      setBoxMask(newMask, width, height, boxSelection, 255);
      onUpdateMask(newMask);
      setBoxSelection(null);
    } else if (activeTool === 'auto-cutout' && boxSelection && sourceCanvasRef.current) {
      const newMask = new Uint8ClampedArray(mask);
      smartAutoCutout(
        sourceCanvasRef.current.getContext('2d')!,
        newMask,
        width,
        height,
        boxSelection
      );
      onUpdateMask(newMask);
      setBoxSelection(null);
    } else if (activeTool === 'lasso' && freehandPoints.length > 2) {
      const newMask = new Uint8ClampedArray(mask);
      fillPolygonMask(newMask, width, height, freehandPoints, 255);
      onUpdateMask(newMask);
      setFreehandPoints([]);
    }
  };

  // Drag and Drop files
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onDropFile(e.dataTransfer.files[0]);
    }
  };

  // Double click to close polygon
  const handleDoubleClick = () => {
    if (activeTool === 'polygon' && polygonPoints.length >= 3 && image && mask) {
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      const newMask = new Uint8ClampedArray(mask);
      fillPolygonMask(newMask, width, height, polygonPoints, 255);
      onUpdateMask(newMask);
      setPolygonPoints([]);
      setIsInteracting(false);
    }
  };

  // Get Canvas Background CSS class
  const getCanvasBgClass = () => {
    switch (canvasBg) {
      case 'dark-check':
        return 'bg-checkerboard';
      case 'light-check':
        return 'bg-checkerboard-light';
      case 'dark-solid':
        return 'bg-[#181a20]';
      case 'light-solid':
        return 'bg-[#f4f5f7]';
      default:
        return 'bg-checkerboard';
    }
  };

  const isPanning = isSpacePressed || activeTool === 'pan';

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDoubleClick={handleDoubleClick}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`relative flex-1 h-full overflow-hidden flex items-center justify-center select-none ${getCanvasBgClass()} ${
        isPanning ? (isInteracting ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-crosshair'
      }`}
    >
      {/* Hidden Offscreen Source Canvas */}
      <canvas ref={sourceCanvasRef} className="hidden" />

      {/* Main Interactive Stage */}
      {image ? (
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: isInteracting ? 'none' : 'transform 0.05s ease-out',
          }}
          className="relative shadow-2xl"
        >
          {/* Split Screen Mode (Before / After Comparison) */}
          {showSplitView ? (
            <div className="relative overflow-hidden" style={{ width: image.naturalWidth, height: image.naturalHeight }}>
              {/* Original Photo Background */}
              <img
                src={image.src}
                alt="Original"
                className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              />

              {/* Rendered Halftone Sticker Overlay with clip path */}
              <div
                className="absolute inset-0 overflow-hidden"
                style={{
                  clipPath: `polygon(0 0, ${splitPosition * 100}% 0, ${splitPosition * 100}% 100%, 0 100%)`,
                }}
              >
                <canvas ref={displayCanvasRef} className="w-full h-full" />
              </div>

              {/* Split Line Divider */}
              <div
                style={{ left: `${splitPosition * 100}%` }}
                className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg pointer-events-none z-20 flex items-center justify-center"
              >
                <div className="w-6 h-6 rounded-full bg-slate-900 border-2 border-white text-[10px] text-white flex items-center justify-center font-bold shadow-md">
                  ||
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Normal Rendered Halftone Asset Canvas */}
              <canvas
                ref={displayCanvasRef}
                className="block pointer-events-none"
              />
            </>
          )}

          {/* Interactive Selection Overlay Canvas */}
          <canvas
            ref={overlayCanvasRef}
            className="absolute inset-0 pointer-events-none z-10"
          />

          {/* Brush Circle Cursor indicator */}
          {mousePos && (activeTool === 'brush' || activeTool === 'eraser') && !isPanning && (
            <div
              style={{
                left: mousePos.x,
                top: mousePos.y,
                width: brushSize * 2,
                height: brushSize * 2,
                transform: 'translate(-50%, -50%)',
                borderWidth: `${1.5 / scale}px`,
              }}
              className={`absolute rounded-full pointer-events-none border-dashed ${
                activeTool === 'eraser' ? 'border-rose-400 bg-rose-500/10' : 'border-indigo-400 bg-indigo-500/10'
              }`}
            />
          )}
        </div>
      ) : (
        /* Empty State Dropzone */
        <div className="flex flex-col items-center justify-center p-8 max-w-md text-center bg-[#151922]/90 border border-slate-800/80 rounded-3xl backdrop-blur-xl shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600/20 to-sky-400/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-4 shadow-inner">
            <svg
              className="w-8 h-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.75"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>

          <h3 className="text-base font-semibold text-slate-100 mb-1.5">
            Перетягніть будь-яке фото сюди
          </h3>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            Підтримуються PNG, JPG, WebP або швидка вставка через <span className="font-mono text-slate-300 bg-slate-800 px-1 py-0.5 rounded">Ctrl + V</span>
          </p>

          <div className="flex items-center gap-3 w-full">
            <label className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs text-center cursor-pointer transition shadow-lg shadow-indigo-600/20">
              <span>Обрати файл з диска</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    onDropFile(e.target.files[0]);
                  }
                }}
              />
            </label>

            <button
              onClick={onOpenSamples}
              className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs border border-slate-700 transition"
            >
              Референси проєкту
            </button>
          </div>
        </div>
      )}

      {/* Floating Split Slider Control when split view active */}
      {showSplitView && image && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/90 border border-slate-800 backdrop-blur-md px-4 py-2 rounded-2xl flex items-center gap-3 shadow-2xl z-30">
          <span className="text-xs font-medium text-slate-300">До (Оригінал)</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={splitPosition}
            onChange={(e) => setSplitPosition(Number(e.target.value))}
            className="w-40 accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded"
          />
          <span className="text-xs font-medium text-indigo-400">Після (Асет)</span>
        </div>
      )}
    </div>
  );
};
