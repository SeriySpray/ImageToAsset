export type ToolType = 
  | 'box-select'
  | 'lasso'
  | 'polygon'
  | 'brush'
  | 'eraser'
  | 'magic-wand'
  | 'auto-cutout'
  | 'pan';

export type HalftonePattern = 'dots' | 'crosshatch' | 'lines' | 'engraving' | 'dither';

export interface HalftoneSettings {
  dotSize: number;        // 2 to 30, default 6
  spacing: number;        // 0.8 to 2.0, default 1.0
  angle: number;          // 0 to 90 degrees, default 45
  contrast: number;       // -100 to 100, default 35
  brightness: number;     // -100 to 100, default 0
  blackThreshold: number; // 0 to 255, default 20
  whiteThreshold: number; // 0 to 255, default 235
  pattern: HalftonePattern;
  invert: boolean;
  dotSharpness: number;   // 0 (soft) to 1 (hard vector dot)
}

export interface TornEdgeSettings {
  enabled: boolean;
  padding: number;        // white border width in px (4 to 80, default 24)
  roughness: number;      // amplitude of noise (0 to 40, default 14)
  frequency: number;      // noise scale (0.01 to 0.2, default 0.06)
  octaves: number;        // detail layers (1 to 4, default 3)
  paperColor: string;     // default '#ffffff'
  paperTexture: boolean;  // subtle paper grain
  dropShadow: boolean;    // display preview shadow
  shadowBlur: number;
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
