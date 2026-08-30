export type ToolType = 
  | 'magic-wand'
  | 'brush'
  | 'eraser'
  | 'box-select'
  | 'lasso'
  | 'pan';

export type GraphicMode = 
  | 'dots'          // Photo Halftone (Classic Newspaper Dot Matrix for Photos)
  | 'graphic-dots'  // Graphic / Line-Art Halftone (Isolated Dots for Solid Blacks & Graphics)
  | 'hybrid'        // Grayscale + Halftone dots overlay
  | 'engraving';    // Retro engraving hatching

export interface HalftoneSettings {
  mode: GraphicMode;
  contrast: number;        // 0 to 100 (Master Smart Contrast)
  dotSize: number;         // 2 to 20 (Dot/Stroke size)
}

export interface TornEdgeSettings {
  enabled: boolean;
  padding: number;         // white border width in px (4 to 60, default 20)
  roughness: number;       // amplitude of noise (0 to 30, default 3)
  canvasPadding: number;   // buffer pixels around image for border expansion (20 to 120, default 60)
  paperColor: string;      // default '#ffffff'
  paperTexture: boolean;   // subtle paper grain
  dropShadow: boolean;     // display preview shadow
  frequency: number;
  octaves: number;
  shadowBlur: number;      // default 48
  shadowOpacity: number;
}

export interface Preset {
  id: string;
  name: string;
  description: string;
  halftone: HalftoneSettings;
  tornEdge: TornEdgeSettings;
}

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}
