import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ToolType, Point, HalftoneSettings, TornEdgeSettings } from '../types';
import { renderHalftone } from '../engine/halftone';
import { renderPaperBacking, renderTornPaperAsset } from '../engine/torn-edge';
import { magicWandSelect, smartAutoCutout, createFullMask } from '../engine/segmentation';

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

  const [polygonPoints, setPolygonPoints] = useState<Point[]>([]);
  const polygonPointsRef = useRef<Point[]>([]);
  useEffect(() => { polygonPointsRef.current = polygonPoints; }, [polygonPoints]);

  const [freehandPoints, setFreehandPoints] = useState<Point[]>([]);
  const freehandPointsRef = useRef<Point[]>([]);
  useEffect(() => { freehandPointsRef.current = freehandPoints; }, [freehandPoints]);

  const [mousePos, setMousePos] = useState<Point | null>(null);
  const [splitPosition, setSplitPosition] = useState<number>(0.5);

  const scaleRef = useRef(scale);
  const panRef = useRef(pan);
  useEffect(() => { scaleRef.current = scale; }, [scale]);
  useEffect(() => { panRef.current = pan; }, [pan]);

  // Buffer padding around image
  const pad = tornEdge.canvasPadding || 60;
  const rawW = image ? ((image as HTMLImageElement).naturalWidth || image.width) : 0;
  const rawH = image ? ((image as HTMLImageElement).naturalHeight || image.height) : 0;
  const totalW = rawW > 0 ? rawW + pad * 2 : 0;
  const totalH = rawH > 0 ? rawH + pad * 2 : 0;

  // Space key for panning
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

  // Helper to commit offscreen maskCanvas to Uint8ClampedArray mask state
  const commitMaskCanvas = useCallback(() => {
    if (!maskCanvasRef.current || !image || totalW === 0 || totalH === 0) return;
    const maskCtx = maskCanvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!maskCtx) return;

    const imgData = maskCtx.getImageData(0, 0, totalW, totalH);
    const pixels = imgData.data;
    const newMask = new Uint8ClampedArray(totalW * totalH);

    let hasChange = false;
    for (let i = 0; i < totalW * totalH; i++) {
      const alpha = pixels[i * 4 + 3];
      newMask[i] = alpha;
      if (!mask || mask[i] !== alpha) {
        hasChange = true;
      }
    }

    if (hasChange) {
      onUpdateMask(newMask);
    }
  }, [image, mask, totalW, totalH, onUpdateMask]);

  // Global Mouse Up Listener
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isInteractingRef.current) {
        isInteractingRef.current = false;
        setIsInteracting(false);
        dragStartRef.current = null;
        lastPointRef.current = null;
        commitMaskCanvas();
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [commitMaskCanvas]);

  // Native Non-Passive Wheel Zoom (zooms strictly around cursor)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      const currentScale = scaleRef.current;
      const newScale = Math.max(0.05, Math.min(25, currentScale * zoomFactor));

      const currentPan = panRef.current;
      const viewCenterX = rect.width / 2 + currentPan.x;
      const viewCenterY = rect.height / 2 + currentPan.y;

      const dx = mouseX - viewCenterX;
      const dy = mouseY - viewCenterY;

      const newPanX = currentPan.x - dx * (newScale / currentScale - 1);
      const newPanY = currentPan.y - dy * (newScale / currentScale - 1);

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

  // 1. Layer A: Pre-render Halftone Texture (Runs ONLY when halftone settings or image change)
  useEffect(() => {
    if (!image || !sourceCanvasRef.current || totalW === 0 || totalH === 0) return;

    if (!halftoneCanvasRef.current) {
      halftoneCanvasRef.current = document.createElement('canvas');
    }
    const htCanvas = halftoneCanvasRef.current;
    htCanvas.width = totalW;
    htCanvas.height = totalH;
    const htCtx = htCanvas.getContext('2d', { willReadFrequently: true });
    const srcCtx = sourceCanvasRef.current.getContext('2d', { willReadFrequently: true });

    if (!htCtx || !srcCtx) return;

    renderHalftone(srcCtx, htCtx, totalW, totalH, halftone);
    compositeRef.current();
  }, [image, halftone.mode, halftone.contrast, halftone.dotSize, halftone.invert, pad, totalW, totalH]);

  // 2. Layer B: Pre-render Paper Backing (Runs ONLY when mask/tornEdge settings change)
  useEffect(() => {
    if (!image || !mask || totalW === 0 || totalH === 0 || isInteracting) return;

    if (!paperCanvasRef.current) {
      paperCanvasRef.current = document.createElement('canvas');
    }
    const pCanvas = paperCanvasRef.current;
    pCanvas.width = totalW;
    pCanvas.height = totalH;

    if (tornEdge.enabled) {
      renderPaperBacking(pCanvas, mask, totalW, totalH, tornEdge);
    }
    compositeRef.current();
  }, [
    image, 
    mask, 
    tornEdge.enabled, 
    tornEdge.padding, 
    tornEdge.roughness, 
    tornEdge.paperColor, 
    tornEdge.paperTexture,
    tornEdge.dropShadow,
    tornEdge.canvasPadding,
    pad, 
    totalW, 
    totalH, 
    isInteracting
  ]);

  // Fast 60-FPS Live Preview during Active Brush/Eraser Stroke
  const renderLiveStrokePreview = useCallback(() => {
    if (!displayCanvasRef.current || !halftoneCanvasRef.current || !maskCanvasRef.current || totalW === 0 || totalH === 0) return;
    const dispCtx = displayCanvasRef.current.getContext('2d');
    if (!dispCtx) return;

    dispCtx.clearRect(0, 0, totalW, totalH);
    dispCtx.drawImage(halftoneCanvasRef.current, 0, 0);
    dispCtx.globalCompositeOperation = 'destination-in';
    dispCtx.drawImage(maskCanvasRef.current, 0, 0);
    dispCtx.globalCompositeOperation = 'source-over';
  }, [totalW, totalH]);

  // Convert screen mouse coordinates to image pixel coordinates (within padded total bounds)
  const screenToImage = useCallback(
    (clientX: number, clientY: number): Point | null => {
      if (!containerRef.current || !image || totalW === 0 || totalH === 0) return null;
      const rect = containerRef.current.getBoundingClientRect();
      const cx = clientX - rect.left;
      const cy = clientY - rect.top;

      const viewCenterX = rect.width / 2 + pan.x;
      const viewCenterY = rect.height / 2 + pan.y;

      const imgLeft = viewCenterX - (totalW * scale) / 2;
      const imgTop = viewCenterY - (totalH * scale) / 2;

      const x = (cx - imgLeft) / scale;
      const y = (cy - imgTop) / scale;

      return { x, y };
    },
    [image, scale, pan, totalW, totalH]
  );

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

    isInteractingRef.current = true;
    setIsInteracting(true);
    lastPointRef.current = pt;

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
    } else if (activeTool === 'box-select' || activeTool === 'auto-cutout') {
      const initialBox = { x0: pt.x, y0: pt.y, x1: pt.x, y1: pt.y };
      setBoxSelection(initialBox);
      boxSelectionRef.current = initialBox;
    } else if (activeTool === 'lasso') {
      const initialLasso = [pt];
      setFreehandPoints(initialLasso);
      freehandPointsRef.current = initialLasso;
    } else if (activeTool === 'polygon') {
      if (polygonPointsRef.current.length >= 3) {
        const first = polygonPointsRef.current[0];
        const dist = Math.hypot(pt.x - first.x, pt.y - first.y);
        if (dist < 14 / scale) {
          if (e.altKey) {
            maskCtx.globalCompositeOperation = 'destination-out';
          } else if (e.shiftKey) {
            maskCtx.globalCompositeOperation = 'source-over';
            maskCtx.fillStyle = '#ffffff';
          } else {
            // Default Isolate mode: clear everything outside polygon
            maskCtx.clearRect(0, 0, totalW, totalH);
            maskCtx.globalCompositeOperation = 'source-over';
            maskCtx.fillStyle = '#ffffff';
          }

          maskCtx.beginPath();
          maskCtx.moveTo(polygonPointsRef.current[0].x, polygonPoints[0].y);
          for (let i = 1; i < polygonPoints.length; i++) {
            maskCtx.lineTo(polygonPoints[i].x, polygonPoints[i].y);
          }
          maskCtx.closePath();
          maskCtx.fill();

          setPolygonPoints([]);
          polygonPointsRef.current = [];
          isInteractingRef.current = false;
          setIsInteracting(false);
          commitMaskCanvas();
          return;
        }
      }
      const updatedPoly = [...polygonPointsRef.current, pt];
      setPolygonPoints(updatedPoly);
      polygonPointsRef.current = updatedPoly;
    } else if (activeTool === 'magic-wand' && sourceCanvasRef.current) {
      const targetMask = mask ? new Uint8ClampedArray(mask) : createFullMask(totalW, totalH);
      const mode = e.altKey ? 'subtract' : (e.shiftKey ? 'add' : 'replace');

      magicWandSelect(
        sourceCanvasRef.current.getContext('2d', { willReadFrequently: true })!,
        targetMask,
        totalW,
        totalH,
        pt.x,
        pt.y,
        wandTolerance,
        true,
        mode
      );

      onUpdateMask(targetMask);
      isInteractingRef.current = false;
      setIsInteracting(false);
    }
  };

  // Mouse Move
  const handleMouseMove = (e: React.MouseEvent) => {
    const pt = screenToImage(e.clientX, e.clientY);
    if (pt) setMousePos(pt);

    if (!isInteractingRef.current) return;

    if (dragStartRef.current && (isSpacePressed || activeTool === 'pan' || e.buttons === 4)) {
      onUpdateView(scale, {
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y,
      });
      return;
    }

    if (!image || !maskCanvasRef.current || !pt) return;

    if ((activeTool === 'brush' || activeTool === 'eraser') && lastPointRef.current) {
      const maskCtx = maskCanvasRef.current.getContext('2d', { willReadFrequently: true });
      if (!maskCtx) return;

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
      maskCtx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
      maskCtx.lineTo(pt.x, pt.y);
      maskCtx.stroke();

      lastPointRef.current = pt;
      renderLiveStrokePreview();
    } else if (activeTool === 'box-select' || activeTool === 'auto-cutout') {
      if (boxSelectionRef.current) {
        const updated = { ...boxSelectionRef.current, x1: pt.x, y1: pt.y };
        setBoxSelection(updated);
        boxSelectionRef.current = updated;
      }
    } else if (activeTool === 'lasso') {
      const updated = [...freehandPointsRef.current, pt];
      setFreehandPoints(updated);
      freehandPointsRef.current = updated;
    }
  };

  // Mouse Up
  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isInteractingRef.current && !isInteracting) return;
    isInteractingRef.current = false;
    setIsInteracting(false);
    dragStartRef.current = null;
    lastPointRef.current = null;

    if (!image || !maskCanvasRef.current || totalW === 0 || totalH === 0) return;
    const maskCtx = maskCanvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!maskCtx) return;

    const curBox = boxSelectionRef.current || boxSelection;
    const curLasso = freehandPointsRef.current.length > 2 ? freehandPointsRef.current : freehandPoints;

    if (activeTool === 'brush' || activeTool === 'eraser') {
      commitMaskCanvas();
    } else if (activeTool === 'box-select' && curBox) {
      const minX = Math.min(curBox.x0, curBox.x1);
      const minY = Math.min(curBox.y0, curBox.y1);
      const w = Math.abs(curBox.x1 - curBox.x0);
      const h = Math.abs(curBox.y1 - curBox.y0);

      if (w > 4 && h > 4) {
        if (e.altKey) {
          // Alt: Subtract from mask
          maskCtx.globalCompositeOperation = 'destination-out';
          maskCtx.fillRect(minX, minY, w, h);
        } else if (e.shiftKey) {
          // Shift: Add to mask
          maskCtx.globalCompositeOperation = 'source-over';
          maskCtx.fillStyle = '#ffffff';
          maskCtx.fillRect(minX, minY, w, h);
        } else {
          // Default: ISOLATE SELECTION (erase everything outside)
          maskCtx.clearRect(0, 0, totalW, totalH);
          maskCtx.globalCompositeOperation = 'source-over';
          maskCtx.fillStyle = '#ffffff';
          maskCtx.fillRect(minX, minY, w, h);
        }
      }

      setBoxSelection(null);
      boxSelectionRef.current = null;
      commitMaskCanvas();
    } else if (activeTool === 'auto-cutout' && curBox && sourceCanvasRef.current) {
      const autoMask = new Uint8ClampedArray(totalW * totalH);

      smartAutoCutout(
        sourceCanvasRef.current.getContext('2d')!,
        autoMask,
        totalW,
        totalH,
        curBox
      );

      // Isolate auto-cutout subject by replacing mask
      maskCtx.clearRect(0, 0, totalW, totalH);
      maskCtx.globalCompositeOperation = 'source-over';

      const autoCanvas = document.createElement('canvas');
      autoCanvas.width = totalW;
      autoCanvas.height = totalH;
      const autoCtx = autoCanvas.getContext('2d');
      if (autoCtx) {
        const imgD = autoCtx.createImageData(totalW, totalH);
        for (let i = 0; i < totalW * totalH; i++) {
          if (autoMask[i] > 0) {
            imgD.data[i * 4] = 255;
            imgD.data[i * 4 + 1] = 255;
            imgD.data[i * 4 + 2] = 255;
            imgD.data[i * 4 + 3] = 255;
          }
        }
        autoCtx.putImageData(imgD, 0, 0);
        maskCtx.drawImage(autoCanvas, 0, 0);
      }

      setBoxSelection(null);
      boxSelectionRef.current = null;
      commitMaskCanvas();
    } else if (activeTool === 'lasso' && curLasso.length > 2) {
      if (e.altKey) {
        // Alt: Subtract from mask
        maskCtx.globalCompositeOperation = 'destination-out';
        maskCtx.beginPath();
        maskCtx.moveTo(curLasso[0].x, curLasso[0].y);
        for (let i = 1; i < curLasso.length; i++) {
          maskCtx.lineTo(curLasso[i].x, curLasso[i].y);
        }
        maskCtx.closePath();
        maskCtx.fill();
      } else if (e.shiftKey) {
        // Shift: Add to mask
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
        // Default: ISOLATE SELECTION (erase everything outside)
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
    }
  };

  // Render Vector Selection Overlay
  useEffect(() => {
    if (!image || !overlayCanvasRef.current || totalW === 0 || totalH === 0) return;
    const canvas = overlayCanvasRef.current;
    canvas.width = totalW;
    canvas.height = totalH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, totalW, totalH);

    if (boxSelection && (activeTool === 'box-select' || activeTool === 'auto-cutout')) {
      const minX = Math.min(boxSelection.x0, boxSelection.x1);
      const minY = Math.min(boxSelection.y0, boxSelection.y1);
      const w = Math.abs(boxSelection.x1 - boxSelection.x0);
      const h = Math.abs(boxSelection.y1 - boxSelection.y0);

      ctx.save();
      ctx.strokeStyle = activeTool === 'auto-cutout' ? '#f59e0b' : '#6366f1';
      ctx.lineWidth = 2 / scale;
      ctx.setLineDash([4 / scale, 4 / scale]);
      ctx.strokeRect(minX, minY, w, h);
      ctx.fillStyle = activeTool === 'auto-cutout' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(99, 102, 241, 0.12)';
      ctx.fillRect(minX, minY, w, h);
      ctx.restore();
    }

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
  }, [image, boxSelection, polygonPoints, freehandPoints, mousePos, activeTool, scale, totalW, totalH]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (activeTool === 'polygon' && polygonPoints.length >= 3 && maskCanvasRef.current) {
      const maskCtx = maskCanvasRef.current.getContext('2d');
      if (maskCtx) {
        if (e.altKey) {
          maskCtx.globalCompositeOperation = 'destination-out';
        } else if (e.shiftKey) {
          maskCtx.globalCompositeOperation = 'source-over';
          maskCtx.fillStyle = '#ffffff';
        } else {
          // Default Isolate mode: clear outside
          maskCtx.clearRect(0, 0, totalW, totalH);
          maskCtx.globalCompositeOperation = 'source-over';
          maskCtx.fillStyle = '#ffffff';
        }

        maskCtx.beginPath();
        maskCtx.moveTo(polygonPoints[0].x, polygonPoints[0].y);
        for (let i = 1; i < polygonPoints.length; i++) {
          maskCtx.lineTo(polygonPoints[i].x, polygonPoints[i].y);
        }
        maskCtx.closePath();
        maskCtx.fill();

        setPolygonPoints([]);
        polygonPointsRef.current = [];
        isInteractingRef.current = false;
        setIsInteracting(false);
        commitMaskCanvas();
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onDropFile(e.dataTransfer.files[0]);
    }
  };

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
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDoubleClick={handleDoubleClick}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`relative flex-1 h-full overflow-hidden flex items-center justify-center select-none touch-none ${getCanvasBgClass()} ${
        isPanning ? (isInteracting ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-crosshair'
      }`}
    >
      {/* Hidden Offscreen Source Canvas */}
      <canvas ref={sourceCanvasRef} className="hidden" />

      {/* Main Interactive Stage */}
      {image && totalW > 0 && totalH > 0 ? (
        <div
          style={{
            width: totalW,
            height: totalH,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: isInteracting ? 'none' : 'transform 0.05s ease-out',
          }}
          className="relative shadow-2xl"
        >
          {/* Split Screen Mode */}
          {showSplitView ? (
            <div className="relative overflow-hidden w-full h-full">
              <div className="absolute inset-0 flex items-center justify-center">
                <img
                  src={(image as HTMLImageElement).src || ''}
                  alt="Original"
                  style={{ width: rawW, height: rawH, left: pad, top: pad }}
                  className="absolute object-contain pointer-events-none"
                />
              </div>
              <div
                className="absolute inset-0 overflow-hidden"
                style={{
                  clipPath: `polygon(0 0, ${splitPosition * 100}% 0, ${splitPosition * 100}% 100%, 0 100%)`,
                }}
              >
                <canvas ref={displayCanvasRef} className="w-full h-full" />
              </div>
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
            <canvas
              ref={displayCanvasRef}
              className="block pointer-events-none w-full h-full"
            />
          )}

          {/* Interactive Selection Overlay */}
          <canvas
            ref={overlayCanvasRef}
            className="absolute inset-0 pointer-events-none z-10 w-full h-full"
          />

          {/* High-Visibility Brush & Eraser Circle Cursor */}
          {mousePos && (activeTool === 'brush' || activeTool === 'eraser') && !isPanning && (
            <div
              style={{
                left: mousePos.x,
                top: mousePos.y,
                width: brushSize * 2,
                height: brushSize * 2,
                transform: 'translate(-50%, -50%)',
                borderWidth: `${Math.max(1, 1.5 / scale)}px`,
              }}
              className={`absolute rounded-full pointer-events-none flex items-center justify-center shadow-sm ${
                activeTool === 'eraser'
                  ? 'border-rose-400 bg-rose-500/20 ring-1 ring-rose-500/40'
                  : 'border-emerald-400 bg-emerald-500/20 ring-1 ring-emerald-500/40'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${activeTool === 'eraser' ? 'bg-rose-400' : 'bg-emerald-400'}`} />
            </div>
          )}
        </div>
      ) : (
        /* Empty State */
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

      {/* Floating Split Slider */}
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
