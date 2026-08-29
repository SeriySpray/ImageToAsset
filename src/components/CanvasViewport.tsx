import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ToolType, Point, HalftoneSettings, TornEdgeSettings } from '../types';
import { renderHalftone } from '../engine/halftone';
import { renderPaperBacking, renderTornPaperAsset } from '../engine/torn-edge';
import { smartLassoCutout } from '../engine/segmentation';

interface CanvasViewportProps {
  image: HTMLImageElement | HTMLCanvasElement | null;
  mask: Uint8ClampedArray | null;
  onUpdateMask: (newMask: Uint8ClampedArray) => void;
  activeTool: ToolType;
  brushSize: number;
  wandTolerance: number;
  halftone: HalftoneSettings;
  tornEdge: TornEdgeSettings;
  canvasBg: 'dark-check' | 'light-check' | 'dark-solid' | 'light-solid';
  onDropFile: (file: File) => void;
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
  halftone,
  tornEdge,
  canvasBg,
  onDropFile,
  scale,
  pan,
  onUpdateView,
  renderedCanvasRef,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
  const halftoneCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const paperCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  const [isInteracting, setIsInteracting] = useState(false);
  const isInteractingRef = useRef(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const lastPointRef = useRef<Point | null>(null);
  const dragStartRef = useRef<Point | null>(null);

  const [boxSelection, setBoxSelection] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const boxSelectionRef = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  useEffect(() => { boxSelectionRef.current = boxSelection; }, [boxSelection]);

  const [freehandPoints, setFreehandPoints] = useState<Point[]>([]);
  const freehandPointsRef = useRef<Point[]>([]);
  useEffect(() => { freehandPointsRef.current = freehandPoints; }, [freehandPoints]);

  const mousePosRef = useRef<Point | null>(null);

  const scaleRef = useRef(scale);
  const panRef = useRef(pan);
  useEffect(() => { scaleRef.current = scale; }, [scale]);
  useEffect(() => { panRef.current = pan; }, [pan]);

  // Buffer padding around image
  const pad = 60;
  const rawW = image ? ((image as HTMLImageElement).naturalWidth || image.width) : 0;
  const rawH = image ? ((image as HTMLImageElement).naturalHeight || image.height) : 0;
  const totalW = rawW > 0 ? rawW + pad * 2 : 0;
  const totalH = rawH > 0 ? rawH + pad * 2 : 0;

  // Space key for panning
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
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

  // Smooth Zoom with Ctrl/Wheel lock
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = container.getBoundingClientRect();
      const mouseScreenX = e.clientX - rect.left;
      const mouseScreenY = e.clientY - rect.top;

      const currentScale = scaleRef.current;
      const currentPan = panRef.current;

      const zoomFactor = e.deltaY < 0 ? 1.14 : 0.88;
      const newScale = Math.max(0.1, Math.min(16, currentScale * zoomFactor));

      const newPanX = mouseScreenX - (mouseScreenX - currentPan.x) * (newScale / currentScale);
      const newPanY = mouseScreenY - (mouseScreenY - currentPan.y) * (newScale / currentScale);

      onUpdateView(newScale, { x: newPanX, y: newPanY });
    };

    container.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheelNative);
    };
  }, [onUpdateView]);

  // Sync Source Image to Source Canvas with Buffer Padding
  useEffect(() => {
    if (!image || !sourceCanvasRef.current || totalW === 0 || totalH === 0) return;
    const srcCanvas = sourceCanvasRef.current;
    srcCanvas.width = totalW;
    srcCanvas.height = totalH;
    const ctx = srcCanvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.clearRect(0, 0, totalW, totalH);
      ctx.drawImage(image, pad, pad, rawW, rawH);
    }
  }, [image, pad, rawW, rawH, totalW, totalH]);

  // Sync Mask to Offscreen Mask Canvas
  useEffect(() => {
    if (!image || !mask || totalW === 0 || totalH === 0) return;

    if (!maskCanvasRef.current) {
      maskCanvasRef.current = document.createElement('canvas');
    }
    const maskCanvas = maskCanvasRef.current;
    maskCanvas.width = totalW;
    maskCanvas.height = totalH;
    const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
    if (!maskCtx) return;

    const imgData = maskCtx.createImageData(totalW, totalH);
    const pixels = imgData.data;

    for (let i = 0; i < totalW * totalH; i++) {
      const v = mask[i] || 0;
      const idx = i * 4;
      pixels[idx] = 255;
      pixels[idx + 1] = 255;
      pixels[idx + 2] = 255;
      pixels[idx + 3] = v;
    }
    maskCtx.putImageData(imgData, 0, 0);
  }, [image, mask, totalW, totalH]);

  // Fast GPU Composite of cached Paper + cached Halftone
  const compositeRef = useRef<() => void>(() => {});
  compositeRef.current = () => {
    if (!image || !halftoneCanvasRef.current || !maskCanvasRef.current || !displayCanvasRef.current || totalW === 0 || totalH === 0) return;

    const dispCanvas = displayCanvasRef.current;
    dispCanvas.width = totalW;
    dispCanvas.height = totalH;
    const dispCtx = dispCanvas.getContext('2d');
    if (!dispCtx) return;

    renderTornPaperAsset(
      halftoneCanvasRef.current,
      dispCtx,
      maskCanvasRef.current,
      totalW,
      totalH,
      tornEdge,
      paperCanvasRef.current
    );

    if (renderedCanvasRef.current) {
      renderedCanvasRef.current.width = totalW;
      renderedCanvasRef.current.height = totalH;
      const refCtx = renderedCanvasRef.current.getContext('2d');
      if (refCtx) {
        refCtx.clearRect(0, 0, totalW, totalH);
        refCtx.drawImage(dispCanvas, 0, 0);
      }
    }
  };

  // Layer 1: Halftone Layer (Re-renders on halftone settings or source change)
  useEffect(() => {
    if (!image || !sourceCanvasRef.current || totalW === 0 || totalH === 0) return;

    const srcCtx = sourceCanvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!srcCtx) return;

    if (!halftoneCanvasRef.current) {
      halftoneCanvasRef.current = document.createElement('canvas');
    }
    const hCanvas = halftoneCanvasRef.current;
    hCanvas.width = totalW;
    hCanvas.height = totalH;
    const hCtx = hCanvas.getContext('2d');
    if (!hCtx) return;

    renderHalftone(srcCtx, hCtx, totalW, totalH, halftone);
    compositeRef.current();
  }, [image, halftone, totalW, totalH]);

  // Layer 2: Paper Backing Layer (Re-renders on tornEdge settings or mask change)
  useEffect(() => {
    if (!image || !maskCanvasRef.current || totalW === 0 || totalH === 0) return;

    if (!paperCanvasRef.current) {
      paperCanvasRef.current = document.createElement('canvas');
    }
    const pCanvas = paperCanvasRef.current;
    if (mask) {
      renderPaperBacking(pCanvas, mask, totalW, totalH, tornEdge);
      compositeRef.current();
    }
  }, [image, mask, tornEdge, totalW, totalH]);

  // Read mask from offscreen canvas and propagate to App state
  const commitMaskCanvas = useCallback(() => {
    if (!maskCanvasRef.current || totalW === 0 || totalH === 0) return;
    const maskCtx = maskCanvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!maskCtx) return;

    const imgData = maskCtx.getImageData(0, 0, totalW, totalH);
    const data = imgData.data;
    const newMask = new Uint8ClampedArray(totalW * totalH);

    for (let i = 0; i < totalW * totalH; i++) {
      newMask[i] = data[i * 4 + 3];
    }
    onUpdateMask(newMask);
  }, [totalW, totalH, onUpdateMask]);

  const liveClipCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Live Stroke Preview for instant, smooth 60 FPS real-time drawing/erasing
  const renderLiveStrokePreview = useCallback(() => {
    if (!displayCanvasRef.current || !halftoneCanvasRef.current || !maskCanvasRef.current || totalW === 0 || totalH === 0) return;
    const dispCtx = displayCanvasRef.current.getContext('2d');
    if (!dispCtx) return;

    if (!liveClipCanvasRef.current) {
      liveClipCanvasRef.current = document.createElement('canvas');
    }
    const clipCanvas = liveClipCanvasRef.current;
    if (clipCanvas.width !== totalW || clipCanvas.height !== totalH) {
      clipCanvas.width = totalW;
      clipCanvas.height = totalH;
    }
    const clipCtx = clipCanvas.getContext('2d');
    if (!clipCtx) return;

    // 1. Clip halftone inside current mask
    clipCtx.save();
    clipCtx.globalCompositeOperation = 'source-over';
    clipCtx.clearRect(0, 0, totalW, totalH);
    clipCtx.drawImage(halftoneCanvasRef.current, 0, 0);
    clipCtx.globalCompositeOperation = 'destination-in';
    clipCtx.drawImage(maskCanvasRef.current, 0, 0);
    clipCtx.restore();

    // 2. Render onto display canvas
    dispCtx.save();
    dispCtx.globalCompositeOperation = 'source-over';
    dispCtx.clearRect(0, 0, totalW, totalH);
    if (tornEdge.enabled && paperCanvasRef.current) {
      dispCtx.save();
      dispCtx.drawImage(paperCanvasRef.current, 0, 0);
      // Immediately clip paper canvas with mask canvas so eraser cuts through paper in REAL TIME!
      dispCtx.globalCompositeOperation = 'destination-in';
      dispCtx.drawImage(maskCanvasRef.current, 0, 0);
      dispCtx.restore();
    }
    dispCtx.drawImage(clipCanvas, 0, 0);
    dispCtx.restore();
  }, [totalW, totalH, tornEdge.enabled]);

  // Screen to Image coordinates conversion (Unclamped for smooth cross-border painting)
  const screenToImage = useCallback(
    (clientX: number, clientY: number): Point | null => {
      const container = containerRef.current;
      if (!container || !image || totalW === 0 || totalH === 0) return null;

      const rect = container.getBoundingClientRect();
      const mouseX = clientX - rect.left;
      const mouseY = clientY - rect.top;

      const stageW = totalW * scale;
      const stageH = totalH * scale;
      const stageX = (rect.width - stageW) / 2 + pan.x;
      const stageY = (rect.height - stageH) / 2 + pan.y;

      const imgX = (mouseX - stageX) / scale;
      const imgY = (mouseY - stageY) / scale;

      return {
        x: Math.round(imgX),
        y: Math.round(imgY),
      };
    },
    [image, scale, pan, totalW, totalH]
  );

  const mouseScreenPosRef = useRef<{ x: number; y: number } | null>(null);

  // Mouse Down
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!image || !maskCanvasRef.current || totalW === 0 || totalH === 0) return;

    if (e.button === 1 || isSpacePressed || activeTool === 'pan') {
      isInteractingRef.current = true;
      setIsInteracting(true);
      dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      return;
    }

    if (e.button !== 0) return;

    const pt = screenToImage(e.clientX, e.clientY);
    if (!pt) return;

    const container = containerRef.current;
    const sPt = container
      ? { x: e.clientX - container.getBoundingClientRect().left, y: e.clientY - container.getBoundingClientRect().top }
      : null;

    isInteractingRef.current = true;
    setIsInteracting(true);
    lastPointRef.current = pt;
    mousePosRef.current = pt;
    mouseScreenPosRef.current = sPt;

    const maskCtx = maskCanvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!maskCtx) return;

    if (activeTool === 'brush' || activeTool === 'eraser') {
      maskCtx.lineCap = 'round';
      maskCtx.lineJoin = 'round';
      maskCtx.lineWidth = brushSize * 2;

      if (activeTool === 'eraser') {
        maskCtx.globalCompositeOperation = 'destination-out';
      } else {
        maskCtx.globalCompositeOperation = 'source-over';
        maskCtx.fillStyle = '#ffffff';
        maskCtx.strokeStyle = '#ffffff';
      }

      maskCtx.beginPath();
      maskCtx.arc(pt.x, pt.y, brushSize, 0, Math.PI * 2);
      maskCtx.fill();

      renderLiveStrokePreview();
      drawOverlay(sPt);
    } else if (activeTool === 'box-select') {
      const initialBox = { x0: pt.x, y0: pt.y, x1: pt.x, y1: pt.y };
      setBoxSelection(initialBox);
      boxSelectionRef.current = initialBox;
      drawOverlay(sPt);
    } else if (activeTool === 'lasso' || activeTool === 'magic-wand') {
      const initialLasso = [pt];
      setFreehandPoints(initialLasso);
      freehandPointsRef.current = initialLasso;
      drawOverlay(sPt);
    }
  };

  // Mouse Move
  const handleMouseMove = (e: React.MouseEvent) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const sX = e.clientX - rect.left;
    const sY = e.clientY - rect.top;
    const sPt = { x: sX, y: sY };
    mouseScreenPosRef.current = sPt;

    const pt = screenToImage(e.clientX, e.clientY);
    mousePosRef.current = pt;

    if (!isInteractingRef.current) {
      drawOverlay(sPt);
      return;
    }

    if (dragStartRef.current && (isSpacePressed || activeTool === 'pan' || e.buttons === 4)) {
      onUpdateView(scale, {
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y,
      });
      return;
    }

    if (!pt || !maskCanvasRef.current) return;

    const maskCtx = maskCanvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!maskCtx) return;

    if (activeTool === 'brush' || activeTool === 'eraser') {
      if (!lastPointRef.current) {
        lastPointRef.current = pt;
        return;
      }

      maskCtx.lineCap = 'round';
      maskCtx.lineJoin = 'round';
      maskCtx.lineWidth = brushSize * 2;

      if (activeTool === 'eraser') {
        maskCtx.globalCompositeOperation = 'destination-out';
      } else {
        maskCtx.globalCompositeOperation = 'source-over';
        maskCtx.strokeStyle = '#ffffff';
      }

      maskCtx.beginPath();
      maskCtx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
      maskCtx.lineTo(pt.x, pt.y);
      maskCtx.stroke();

      lastPointRef.current = pt;
      renderLiveStrokePreview();
      drawOverlay(sPt);
    } else if (activeTool === 'box-select' && boxSelectionRef.current) {
      const updatedBox = { ...boxSelectionRef.current, x1: pt.x, y1: pt.y };
      setBoxSelection(updatedBox);
      boxSelectionRef.current = updatedBox;
      drawOverlay(sPt);
    } else if ((activeTool === 'lasso' || activeTool === 'magic-wand') && freehandPointsRef.current.length > 0) {
      const updatedLasso = [...freehandPointsRef.current, pt];
      setFreehandPoints(updatedLasso);
      freehandPointsRef.current = updatedLasso;
      drawOverlay(sPt);
    }
  };

  // Mouse Up
  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isInteractingRef.current) return;
    isInteractingRef.current = false;
    setIsInteracting(false);
    dragStartRef.current = null;
    lastPointRef.current = null;

    if (!maskCanvasRef.current || totalW === 0 || totalH === 0) return;
    const maskCtx = maskCanvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!maskCtx) return;

    const curBox = boxSelectionRef.current;
    const curLasso = freehandPointsRef.current;

    if (activeTool === 'brush' || activeTool === 'eraser') {
      commitMaskCanvas();
      drawOverlay(mouseScreenPosRef.current);
    } else if (activeTool === 'box-select' && curBox) {
      const x = Math.min(curBox.x0, curBox.x1);
      const y = Math.min(curBox.y0, curBox.y1);
      const w = Math.abs(curBox.x1 - curBox.x0);
      const h = Math.abs(curBox.y1 - curBox.y0);

      if (w > 2 && h > 2) {
        if (e.altKey) {
          maskCtx.globalCompositeOperation = 'destination-out';
          maskCtx.fillRect(x, y, w, h);
        } else if (e.shiftKey) {
          maskCtx.globalCompositeOperation = 'source-over';
          maskCtx.fillStyle = '#ffffff';
          maskCtx.fillRect(x, y, w, h);
        } else {
          // Default: ISOLATE SELECTION
          maskCtx.clearRect(0, 0, totalW, totalH);
          maskCtx.globalCompositeOperation = 'source-over';
          maskCtx.fillStyle = '#ffffff';
          maskCtx.fillRect(x, y, w, h);
        }
      }

      setBoxSelection(null);
      boxSelectionRef.current = null;
      commitMaskCanvas();
      drawOverlay(mouseScreenPosRef.current);
    } else if (activeTool === 'magic-wand' && curLasso.length > 0 && sourceCanvasRef.current) {
      // Intelligent Smart Lasso Object Cutout
      const mode = e.altKey ? 'subtract' : (e.shiftKey ? 'add' : 'replace');
      const targetMask = mask ? new Uint8ClampedArray(mask) : new Uint8ClampedArray(totalW * totalH);

      smartLassoCutout(
        sourceCanvasRef.current.getContext('2d')!,
        targetMask,
        totalW,
        totalH,
        curLasso,
        mode,
        mask
      );

      setFreehandPoints([]);
      freehandPointsRef.current = [];
      onUpdateMask(targetMask);
      drawOverlay(mouseScreenPosRef.current);
    } else if (activeTool === 'lasso' && curLasso.length > 2) {
      if (e.altKey) {
        maskCtx.globalCompositeOperation = 'destination-out';
        maskCtx.beginPath();
        maskCtx.moveTo(curLasso[0].x, curLasso[0].y);
        for (let i = 1; i < curLasso.length; i++) {
          maskCtx.lineTo(curLasso[i].x, curLasso[i].y);
        }
        maskCtx.closePath();
        maskCtx.fill();
      } else if (e.shiftKey) {
        maskCtx.globalCompositeOperation = 'source-over';
        maskCtx.fillStyle = '#ffffff';
        maskCtx.beginPath();
        maskCtx.moveTo(curLasso[0].x, curLasso[0].y);
        for (let i = 1; i < curLasso.length; i++) {
          maskCtx.lineTo(curLasso[i].x, curLasso[i].y);
        }
        maskCtx.closePath();
        maskCtx.fill();
      } else {
        // Default: ISOLATE SELECTION
        maskCtx.clearRect(0, 0, totalW, totalH);
        maskCtx.globalCompositeOperation = 'source-over';
        maskCtx.fillStyle = '#ffffff';
        maskCtx.beginPath();
        maskCtx.moveTo(curLasso[0].x, curLasso[0].y);
        for (let i = 1; i < curLasso.length; i++) {
          maskCtx.lineTo(curLasso[i].x, curLasso[i].y);
        }
        maskCtx.closePath();
        maskCtx.fill();
      }

      setFreehandPoints([]);
      freehandPointsRef.current = [];
      commitMaskCanvas();
      drawOverlay(mouseScreenPosRef.current);
    } else {
      setFreehandPoints([]);
      freehandPointsRef.current = [];
      drawOverlay(mouseScreenPosRef.current);
    }
  };

  // Synchronous Direct Viewport Overlay Renderer (60+ FPS across full canvas)
  const drawOverlay = useCallback((overrideScreenPt?: { x: number; y: number } | null) => {
    const overlay = overlayCanvasRef.current;
    const container = containerRef.current;
    if (!overlay || !container) return;

    const contW = container.clientWidth;
    const contH = container.clientHeight;
    if (contW === 0 || contH === 0) return;

    if (overlay.width !== contW || overlay.height !== contH) {
      overlay.width = contW;
      overlay.height = contH;
    }

    const ctx = overlay.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, contW, contH);

    const sPt = overrideScreenPt !== undefined ? overrideScreenPt : mouseScreenPosRef.current;
    const curScale = scaleRef.current;
    const curPan = panRef.current;

    const stageW = totalW * curScale;
    const stageH = totalH * curScale;
    const stageX = (contW - stageW) / 2 + curPan.x;
    const stageY = (contH - stageH) / 2 + curPan.y;

    const toScreen = (imgX: number, imgY: number) => ({
      x: stageX + imgX * curScale,
      y: stageY + imgY * curScale,
    });

    // 1. Box Selection
    const curBox = boxSelectionRef.current;
    if (curBox) {
      ctx.save();
      const p0 = toScreen(Math.min(curBox.x0, curBox.x1), Math.min(curBox.y0, curBox.y1));
      const p1 = toScreen(Math.max(curBox.x0, curBox.x1), Math.max(curBox.y0, curBox.y1));
      const w = p1.x - p0.x;
      const h = p1.y - p0.y;

      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(p0.x, p0.y, w, h);
      ctx.fillStyle = 'rgba(245, 158, 11, 0.18)';
      ctx.fillRect(p0.x, p0.y, w, h);
      ctx.restore();
    }

    // 2. Freehand / Lasso Points
    const curPoints = freehandPointsRef.current;
    if (curPoints.length > 1) {
      ctx.save();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      const first = toScreen(curPoints[0].x, curPoints[0].y);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < curPoints.length; i++) {
        const p = toScreen(curPoints[i].x, curPoints[i].y);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();

      if (curPoints.length > 3) {
        ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // 3. Interactive Circular Cursor for Brush & Eraser (Orange, Full Viewport Tracking)
    if (sPt && (activeTool === 'brush' || activeTool === 'eraser')) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(sPt.x, sPt.y, brushSize * curScale, 0, Math.PI * 2);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.fillStyle = 'rgba(245, 158, 11, 0.18)';
      ctx.fill();
      ctx.stroke();

      // Precision Center Crosshair Dot
      ctx.beginPath();
      ctx.arc(sPt.x, sPt.y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();
      ctx.restore();
    }
  }, [totalW, totalH, activeTool, brushSize]);

  // Sync Overlay Canvas on state/props changes
  useEffect(() => {
    const overlay = overlayCanvasRef.current;
    const container = containerRef.current;
    if (!overlay || !container || !image) return;
    overlay.width = container.clientWidth;
    overlay.height = container.clientHeight;
    drawOverlay();
  }, [image, boxSelection, freehandPoints, activeTool, brushSize, scale, pan, totalW, totalH, drawOverlay]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onDropFile(e.dataTransfer.files[0]);
    }
  };

  // Canvas background style mapping
  const getBgStyle = () => {
    switch (canvasBg) {
      case 'light-check':
        return 'bg-checkerboard-light';
      case 'dark-solid':
        return 'bg-[#000000]';
      case 'light-solid':
        return 'bg-[#ffffff]';
      case 'dark-check':
      default:
        return 'bg-checkerboard';
    }
  };

  const getCursorStyle = () => {
    if (isSpacePressed || activeTool === 'pan') {
      return isInteracting ? 'cursor-grabbing' : 'cursor-grab';
    }
    if (activeTool === 'brush' || activeTool === 'eraser') {
      return 'cursor-none';
    }
    return 'cursor-crosshair';
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        isInteractingRef.current = false;
        setIsInteracting(false);
        mousePosRef.current = null;
        mouseScreenPosRef.current = null;
        drawOverlay(null);
      }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`relative flex-1 h-full overflow-hidden select-none outline-none ${getBgStyle()} ${getCursorStyle()}`}
    >
      {/* Hidden Offscreen Canvases */}
      <canvas ref={sourceCanvasRef} className="hidden" />

      {/* Full Viewport Interactive Overlay Canvas (Cursor & Selections everywhere) */}
      <canvas
        ref={overlayCanvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-30"
      />

      {/* Main Interactive Stage */}
      {image && totalW > 0 && totalH > 0 && (
        <div
          className="absolute origin-top-left transition-transform ease-out duration-75"
          style={{
            width: `${totalW}px`,
            height: `${totalH}px`,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            left: `calc(50% - ${(totalW * scale) / 2}px)`,
            top: `calc(50% - ${(totalH * scale) / 2}px)`,
          }}
        >
          {/* Display Rendered Canvas */}
          <canvas
            ref={displayCanvasRef}
            width={totalW}
            height={totalH}
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
          />
        </div>
      )}

      {/* Empty State Upload Dropzone */}
      {!image && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center font-mono">
          <div className="max-w-md w-full p-8 rounded border border-[#262626] bg-[#0a0a0a] shadow-2xl flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded bg-[#141414] border border-[#262626] flex items-center justify-center text-white font-bold text-sm">
              IA
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white mb-1">
                Перетягніть фото сюди або вставте з буфера (Ctrl+V)
              </h3>
              <p className="text-xs text-neutral-400">
                Підтримуються будь-які PNG, JPG, WebP або мобільні фотографії
              </p>
            </div>

            <label className="py-2 px-4 rounded bg-white text-black font-semibold text-xs transition cursor-pointer hover:bg-neutral-200">
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
          </div>
        </div>
      )}
    </div>
  );
};
