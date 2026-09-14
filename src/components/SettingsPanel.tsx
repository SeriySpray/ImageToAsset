import React, { useRef, useCallback, useEffect } from 'react';
import { 
  Sliders, 
  Scissors, 
  CircleDot, 
  Stamp, 
  Contrast, 
  Eye, 
  X,
  Grid,
  Palette,
  Pipette
} from 'lucide-react';
import { HalftoneSettings, TornEdgeSettings, GraphicMode } from '../types';
import { Translations } from '../i18n';

interface SettingsPanelProps {
  halftone: HalftoneSettings;
  onChangeHalftone: (settings: Partial<HalftoneSettings>) => void;
  tornEdge: TornEdgeSettings;
  onChangeTornEdge: (settings: Partial<TornEdgeSettings>) => void;
  onToggleBufferPadding?: (enabled: boolean) => void;
  canvasBg: 'dark-check' | 'light-check' | 'dark-solid' | 'light-solid';
  onChangeCanvasBg: (bg: 'dark-check' | 'light-check' | 'dark-solid' | 'light-solid') => void;
  hasImage: boolean;
  isOpen?: boolean;
  onClose?: () => void;
  t: Translations['settings'];
}

function ensureHex6(hex: string): string {
  let h = (hex || '').replace('#', '').trim();
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  if (h.length === 6 && /^[0-9a-fA-F]{6}$/.test(h)) {
    return `#${h.toLowerCase()}`;
  }
  return '#ffffff';
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  halftone,
  onChangeHalftone,
  tornEdge,
  onChangeTornEdge,
  onToggleBufferPadding,
  canvasBg,
  onChangeCanvasBg,
  hasImage,
  isOpen = false,
  onClose,
  t,
}) => {
  const colorInputRef = useRef<HTMLInputElement>(null);
  const pendingColorRef = useRef<string | null>(null);
  const rafColorRef = useRef<number | null>(null);

  const handleColorInput = useCallback((newColor: string) => {
    pendingColorRef.current = newColor;
    if (rafColorRef.current === null) {
      rafColorRef.current = requestAnimationFrame(() => {
        if (pendingColorRef.current !== null) {
          onChangeTornEdge({ paperColor: pendingColorRef.current });
          pendingColorRef.current = null;
        }
        rafColorRef.current = null;
      });
    }
  }, [onChangeTornEdge]);

  useEffect(() => {
    return () => {
      if (rafColorRef.current !== null) {
        cancelAnimationFrame(rafColorRef.current);
        rafColorRef.current = null;
      }
    };
  }, []);

  if (!hasImage) return null;

  const modes: { id: GraphicMode; name: string; icon: React.ReactNode }[] = [
    { id: 'dots', name: t.modes.dots, icon: <CircleDot className="w-3.5 h-3.5" /> },
    { id: 'color-halftone', name: t.modes.colorHalftone, icon: <Palette className="w-3.5 h-3.5" /> },
    { id: 'graphic-dots', name: t.modes.graphicDots, icon: <Grid className="w-3.5 h-3.5" /> },
    { id: 'paper-halftone', name: t.modes.paperHalftone, icon: <Stamp className="w-3.5 h-3.5" /> },
  ];

  const paperColors = [
    { name: t.paperColors['#ffffff'] || 'White', value: '#ffffff' },
    { name: t.paperColors['#f6f0db'] || 'Cream', value: '#f6f0db' },
    { name: t.paperColors['#eee6d3'] || 'Parchment', value: '#eee6d3' },
    { name: t.paperColors['#d8d8d8'] || 'Gray', value: '#d8d8d8' },
    { name: t.paperColors['#1a1a1a'] || 'Graphite', value: '#1a1a1a' },
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden transition-opacity"
        />
      )}

      {/* Main Settings Panel: Desktop Sidebar + Mobile Slide-Over Drawer */}
      <aside
        className={`${
          isOpen ? 'fixed inset-y-0 right-0 z-50 flex' : 'hidden lg:flex'
        } w-80 max-w-[88vw] lg:w-72 xl:w-80 lg:static border-l border-[#262626] bg-[#0a0a0a] flex-col h-full overflow-y-auto z-20 select-none font-mono text-xs shadow-2xl lg:shadow-none shrink-0`}
      >
        {/* Mobile Header with Close Button */}
        <div className="lg:hidden p-4 border-b border-[#262626] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-white" />
            <span className="font-semibold text-xs text-white uppercase tracking-wider">{t.title}</span>
          </div>
          <button
            onClick={onClose}
            title={t.close}
            className="p-1 rounded text-neutral-400 hover:text-white hover:bg-[#1f1f1f] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 1. Graphic Style & Tone */}
        <div className="p-4 border-b border-[#262626]">
          <div className="flex items-center gap-2 mb-3">
            <Sliders className="w-3.5 h-3.5 text-white" />
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-300">
              {t.styleAndTone}
            </h2>
          </div>

          {/* Mode Grid (2x2) */}
          <div className="grid grid-cols-2 gap-1.5 mb-4 bg-[#121212] p-1.5 rounded border border-[#262626]">
            {modes.map((m) => {
              const active = halftone.mode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => onChangeHalftone({ mode: m.id })}
                  className={`flex items-center justify-start gap-1.5 py-1.5 px-2 rounded text-[11px] font-medium transition cursor-pointer ${
                    active
                      ? 'bg-white text-black font-semibold'
                      : 'text-neutral-400 hover:text-white hover:bg-[#1c1c1c]'
                  }`}
                >
                  {m.icon}
                  <span className="truncate">{m.name}</span>
                </button>
              );
            })}
          </div>

          {/* Essential Sliders */}
          <div className="space-y-3.5">
            {/* Master Smart Contrast */}
            <div>
              <div className="flex justify-between text-[11px] mb-1.5">
                <span className="text-neutral-300 flex items-center gap-1.5 font-medium">
                  <Contrast className="w-3 h-3 text-neutral-400" />
                  {t.contrast}
                </span>
                <span className="font-mono text-white font-bold">{halftone.contrast}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={halftone.contrast}
                onChange={(e) => onChangeHalftone({ contrast: Number(e.target.value) })}
                className="w-full h-1.5 bg-[#262626] rounded appearance-none cursor-pointer accent-white"
              />
            </div>

            {/* Dot Size */}
            <div>
              <div className="flex justify-between text-[11px] mb-1.5">
                <span className="text-neutral-300 flex items-center gap-1.5 font-medium">
                  <CircleDot className="w-3 h-3 text-neutral-400" />
                  {t.dotSize}
                </span>
                <span className="font-mono text-white font-bold">{halftone.dotSize}px</span>
              </div>
              <input
                type="range"
                min="2"
                max="18"
                step="0.5"
                value={halftone.dotSize}
                onChange={(e) => onChangeHalftone({ dotSize: Number(e.target.value) })}
                className="w-full h-1.5 bg-[#262626] rounded appearance-none cursor-pointer accent-white"
              />
            </div>
          </div>
        </div>

        {/* 2. Torn Paper Sticker Border */}
        <div className="p-4 border-b border-[#262626]">
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2">
              <Scissors className="w-3.5 h-3.5 text-white" />
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-300">
                {t.tornBorderTitle}
              </h2>
            </div>
            <button
              onClick={() => onChangeTornEdge({ 
                enabled: !tornEdge.enabled,
                padding: tornEdge.padding || 20,
                roughness: tornEdge.roughness || 3,
                shadowBlur: tornEdge.shadowBlur || 50
              })}
              className={`w-8 h-4 rounded-full transition relative p-0.5 cursor-pointer ${
                tornEdge.enabled ? 'bg-white' : 'bg-[#262626]'
              }`}
            >
              <div
                className={`w-3 h-3 rounded-full transition transform ${
                  tornEdge.enabled ? 'bg-black translate-x-4' : 'bg-neutral-400 translate-x-0'
                }`}
              />
            </button>
          </div>

          {tornEdge.enabled && (
            <div className="space-y-3.5">
              {/* Border Width */}
              <div>
                <div className="flex justify-between text-[11px] mb-1.5">
                  <span className="text-neutral-300 font-medium">{t.borderWidth}</span>
                  <span className="font-mono text-white font-bold">{tornEdge.padding}px</span>
                </div>
                <input
                  type="range"
                  min="6"
                  max="60"
                  value={tornEdge.padding}
                  onChange={(e) => onChangeTornEdge({ padding: Number(e.target.value) })}
                  className="w-full h-1.5 bg-[#262626] rounded appearance-none cursor-pointer accent-white"
                />
              </div>

              {/* Roughness */}
              <div>
                <div className="flex justify-between text-[11px] mb-1.5">
                  <span className="text-neutral-300 font-medium">{t.roughness}</span>
                  <span className="font-mono text-white font-bold">{tornEdge.roughness}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="30"
                  value={tornEdge.roughness}
                  onChange={(e) => onChangeTornEdge({ roughness: Number(e.target.value) })}
                  className="w-full h-1.5 bg-[#262626] rounded appearance-none cursor-pointer accent-white"
                />
              </div>

              {/* Paper / Outline Color with Stylized Color Picker */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-[10px] font-medium text-neutral-400 block uppercase tracking-wider">
                    {t.paperColor}
                  </label>
                  <span className="font-mono text-[10px] text-neutral-400 font-semibold">
                    {tornEdge.paperColor.toUpperCase()}
                  </span>
                </div>

                {/* Quick Presets Swatches */}
                <div className="grid grid-cols-5 gap-1.5 mb-2">
                  {paperColors.map((c) => {
                    const isSelected = tornEdge.paperColor.toLowerCase() === c.value.toLowerCase();
                    return (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => onChangeTornEdge({ paperColor: c.value })}
                        className={`h-6 rounded border flex items-center justify-center transition cursor-pointer relative ${
                          isSelected
                            ? 'border-white ring-1 ring-white'
                            : 'border-[#262626] hover:border-[#555555]'
                        }`}
                        style={{ backgroundColor: c.value }}
                        title={c.name}
                      >
                        {isSelected && (
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{
                              backgroundColor: c.value === '#ffffff' || c.value === '#f6f0db' || c.value === '#eee6d3' ? '#000000' : '#ffffff'
                            }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Stylized Custom Color Picker & Hex Input */}
                <div className="flex items-center gap-1.5 bg-[#121212] p-1.5 rounded border border-[#262626] hover:border-[#333333] transition">
                  {/* Swatch with embedded native color input */}
                  <label 
                    className="relative w-7 h-7 rounded border border-[#333333] cursor-pointer overflow-hidden flex items-center justify-center shrink-0 shadow-inner group"
                    style={{ backgroundColor: tornEdge.paperColor }}
                    title={t.pickColorTooltip}
                  >
                    <input
                      ref={colorInputRef}
                      type="color"
                      value={ensureHex6(tornEdge.paperColor)}
                      onInput={(e) => handleColorInput((e.target as HTMLInputElement).value)}
                      onChange={(e) => handleColorInput((e.target as HTMLInputElement).value)}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    />
                    <div className="w-2.5 h-2.5 rounded-full border border-black/40 bg-white/30 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                  </label>

                  {/* Hex Text Field */}
                  <div className="flex-1 flex items-center bg-[#1a1a1a] rounded px-2 py-1 border border-transparent focus-within:border-neutral-500 transition">
                    <span className="text-neutral-500 font-mono text-[11px] select-none mr-1">#</span>
                    <input
                      type="text"
                      maxLength={6}
                      value={tornEdge.paperColor.replace('#', '')}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9a-fA-F]/g, '');
                        if (val.length <= 6) {
                          onChangeTornEdge({ paperColor: `#${val}` });
                        }
                      }}
                      placeholder="FFFFFF"
                      className="w-full bg-transparent text-white font-mono text-[11px] uppercase tracking-wider focus:outline-none"
                    />
                  </div>

                  {/* Eyedropper / Pipette Button */}
                  <button
                    type="button"
                    onClick={async () => {
                      if (typeof window !== 'undefined' && 'EyeDropper' in window) {
                        try {
                          const eyeDropper = new (window as any).EyeDropper();
                          const result = await eyeDropper.open();
                          if (result?.sRGBHex) {
                            onChangeTornEdge({ paperColor: result.sRGBHex });
                          }
                        } catch {
                          // User canceled eyedropper
                        }
                      } else {
                        colorInputRef.current?.click();
                      }
                    }}
                    title={t.pickColorTooltip}
                    className="p-1.5 rounded text-neutral-400 hover:text-white hover:bg-[#222222] transition cursor-pointer shrink-0"
                  >
                    <Pipette className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Outer Buffer Margin Toggle (60px) */}
              <div className="flex items-center justify-between pt-2 border-t border-[#1e1e1e]">
                <div>
                  <span className="text-[11px] text-neutral-300 font-medium block">
                    {t.outerPaddingTitle}
                  </span>
                  <span className="text-[10px] text-neutral-500 block">
                    {t.outerPaddingDesc}
                  </span>
                </div>
                <button
                  onClick={() => {
                    const newState = !(tornEdge.canvasPadding && tornEdge.canvasPadding > 0);
                    if (onToggleBufferPadding) {
                      onToggleBufferPadding(newState);
                    } else {
                      onChangeTornEdge({ canvasPadding: newState ? 60 : 0 });
                    }
                  }}
                  className={`w-8 h-4 rounded-full transition relative p-0.5 cursor-pointer ${
                    (tornEdge.canvasPadding && tornEdge.canvasPadding > 0) ? 'bg-white' : 'bg-[#262626]'
                  }`}
                  title={t.outerPaddingTooltip}
                >
                  <div
                    className={`w-3 h-3 rounded-full transition transform ${
                      (tornEdge.canvasPadding && tornEdge.canvasPadding > 0) ? 'bg-black translate-x-4' : 'bg-neutral-400 translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Volumetric Drop Shadow Toggle & Size Slider */}
              <div className="pt-2 border-t border-[#1e1e1e] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-neutral-300 font-medium block">
                      {t.dropShadowTitle}
                    </span>
                    <span className="text-[10px] text-neutral-500 block">
                      {t.dropShadowDesc}
                    </span>
                  </div>
                  <button
                    onClick={() => onChangeTornEdge({ dropShadow: !tornEdge.dropShadow })}
                    className={`w-8 h-4 rounded-full transition relative p-0.5 cursor-pointer ${
                      tornEdge.dropShadow ? 'bg-white' : 'bg-[#262626]'
                    }`}
                    title={t.dropShadowTooltip}
                  >
                    <div
                      className={`w-3 h-3 rounded-full transition transform ${
                        tornEdge.dropShadow ? 'bg-black translate-x-4' : 'bg-neutral-400 translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {tornEdge.dropShadow && (
                  <div>
                    <div className="flex justify-between text-[11px] mb-1.5">
                      <span className="text-neutral-400 font-medium">{t.shadowBlur}</span>
                      <span className="font-mono text-white font-bold">{tornEdge.shadowBlur ?? 50}px</span>
                    </div>
                    <input
                      type="range"
                      min="4"
                      max="100"
                      value={tornEdge.shadowBlur ?? 50}
                      onChange={(e) => onChangeTornEdge({ shadowBlur: Number(e.target.value) })}
                      className="w-full h-1.5 bg-[#262626] rounded appearance-none cursor-pointer accent-white"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 3. Preview Background */}
        <div className="p-4 mt-auto">
          <div className="flex items-center gap-2 mb-2.5">
            <Eye className="w-3.5 h-3.5 text-neutral-400" />
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              {t.canvasBgTitle}
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => onChangeCanvasBg('dark-check')}
              className={`py-1.5 px-2 rounded text-[11px] font-medium border text-center transition cursor-pointer ${
                canvasBg === 'dark-check'
                  ? 'bg-[#1e1e1e] text-white border-white'
                  : 'bg-[#121212] text-neutral-400 border-[#262626] hover:text-white'
              }`}
            >
              {t.canvasBg.darkCheck}
            </button>
            <button
              onClick={() => onChangeCanvasBg('light-check')}
              className={`py-1.5 px-2 rounded text-[11px] font-medium border text-center transition cursor-pointer ${
                canvasBg === 'light-check'
                  ? 'bg-[#1e1e1e] text-white border-white'
                  : 'bg-[#121212] text-neutral-400 border-[#262626] hover:text-white'
              }`}
            >
              {t.canvasBg.lightCheck}
            </button>
            <button
              onClick={() => onChangeCanvasBg('dark-solid')}
              className={`py-1.5 px-2 rounded text-[11px] font-medium border text-center transition cursor-pointer ${
                canvasBg === 'dark-solid'
                  ? 'bg-[#1e1e1e] text-white border-white'
                  : 'bg-[#121212] text-neutral-400 border-[#262626] hover:text-white'
              }`}
            >
              {t.canvasBg.darkSolid}
            </button>
            <button
              onClick={() => onChangeCanvasBg('light-solid')}
              className={`py-1.5 px-2 rounded text-[11px] font-medium border text-center transition cursor-pointer ${
                canvasBg === 'light-solid'
                  ? 'bg-[#1e1e1e] text-white border-white'
                  : 'bg-[#121212] text-neutral-400 border-[#262626] hover:text-white'
              }`}
            >
              {t.canvasBg.lightSolid}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
