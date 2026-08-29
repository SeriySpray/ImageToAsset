export type ToolType = 
  | 'box-select'
  | 'lasso'
  | 'polygon'
  | 'brush'
  | 'eraser'
  | 'magic-wand'
  | 'auto-cutout'
  | 'pan';

export type GraphicMode = 
  | 'grayscale-contrast' // Rich Grayscale with full tonal shades of gray & contrast
  | 'hybrid'             // Grayscale with Halftone dot texture overlay
  | 'dots'               // Pure Halftone dot matrix
  | 'crosshatch'         // Vintage crosshatch sketch
  | 'lines'              // Linear engraving raster
  | 'engraving'          // Wavy woodcut / linocut engraving
  | 'dither';            // Atkinson retro dithering

export interface HalftoneSettings {
  mode: GraphicMode;
  // Grayscale & Tonality parameters
  contrast: number;        // -50 to 100, default 40
  brightness: number;      // -50 to 50, default 0
  blackThreshold: number;  // 0 to 100, default 20 (deep blacks level)
  whiteThreshold: number;  // 150 to 255, default 240 (crisp highlights level)
  gamma: number;           // 0.4 to 2.2, default 1.0 (midtones curve)
  grain: number;           // 0 to 40, default 8 (subtle photo film grain)
  
  // Halftone Raster parameters (for hybrid, dots, crosshatch, lines, engraving)
  dotSize: number;         // 2 to 30, default 6.5
  spacing: number;         // 0.8 to 2.0, default 1.0
  angle: number;           // 0 to 90 degrees, default 45
  halftoneBlend: number;   // 0 to 100%, default 45% for hybrid
  invert: boolean;         // Invert tones / negative
}

export interface TornEdgeSettings {
  enabled: boolean;
  padding: number;         // white border width in px (4 to 80, default 24)
  roughness: number;       // amplitude of noise (0 to 40, default 14)
  frequency: number;       // noise scale (0.01 to 0.2, default 0.06)
  octaves: number;         // detail layers (1 to 4, default 3)
  paperColor: string;      // default '#ffffff'
  paperTexture: boolean;   // subtle paper grain
  dropShadow: boolean;     // display preview shadow
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
