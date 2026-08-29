import React from 'react';
import { 
  Sliders, 
  Scissors, 
  CircleDot, 
  Hash, 
  AlignJustify, 
  Activity, 
  Grid3X3,
  SunMedium,
  Contrast,
  Eye,
  Layers,
  Image as ImageIcon,
  Gauge
} from 'lucide-react';
import { HalftoneSettings, TornEdgeSettings, GraphicMode } from '../types';

interface SettingsPanelProps {
  halftone: HalftoneSettings;
  onChangeHalftone: (settings: Partial<HalftoneSettings>) => void;
  tornEdge: TornEdgeSettings;
  onChangeTornEdge: (settings: Partial<TornEdgeSettings>) => void;
  canvasBg: 'dark-check' | 'light-check' | 'dark-solid' | 'light-solid';
  onChangeCanvasBg: (bg: 'dark-check' | 'light-check' | 'dark-solid' | 'light-solid') => void;
  hasImage: boolean;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  halftone,
  onChangeHalftone,
  tornEdge,
  onChangeTornEdge,
  canvasBg,
  onChangeCanvasBg,
  hasImage,
}) => {
  if (!hasImage) return null;

  const modes: { id: GraphicMode; name: string; icon: React.ReactNode }[] = [
    { id: 'grayscale-contrast', name: 'Контрастне ч/б', icon: <ImageIcon className="w-3.5 h-3.5" /> },
    { id: 'hybrid', name: 'Фото + Растр', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'dots', name: 'Крапки', icon: <CircleDot className="w-3.5 h-3.5" /> },
    { id: 'crosshatch', name: 'Сітка', icon: <Hash className="w-3.5 h-3.5" /> },
    { id: 'lines', name: 'Штрихи', icon: <AlignJustify className="w-3.5 h-3.5" /> },
    { id: 'engraving', name: 'Гравюра', icon: <Activity className="w-3.5 h-3.5" /> },
    { id: 'dither', name: 'Дитер', icon: <Grid3X3 className="w-3.5 h-3.5" /> },
  ];

  const paperColors = [
    { name: 'Pure White', value: '#ffffff' },
    { name: 'Warm Cream', value: '#fcf8f2' },
    { name: 'Craft Paper', value: '#e8dcce' },
    { name: 'Dark Ink', value: '#12141c' },
  ];

  const isRasterActive = halftone.mode !== 'grayscale-contrast';

  return (
    <aside className="w-80 border-l border-slate-800/80 bg-[#12151e]/95 backdrop-blur-md flex flex-col h-full overflow-y-auto z-20 select-none">
      {/* Mode & Tonal Section */}
      <div className="p-4 border-b border-slate-800/80">
        <div className="flex items-center gap-2 mb-3">
          <Sliders className="w-4 h-4 text-indigo-400" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
            Стиль та тональність
          </h2>
        </div>

        {/* Graphic Mode Selection */}
        <div className="mb-4">
          <label className="text-[11px] font-medium text-slate-400 mb-1.5 block">
            Графічний режим
          </label>
          <div className="grid grid-cols-2 gap-1.5 bg-slate-900/90 p-1.5 rounded-xl border border-slate-800">
            {modes.map((m) => {
              const active = halftone.mode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => onChangeHalftone({ mode: m.id })}
                  className={`flex items-center justify-start gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-medium transition ${
                    active
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  {m.icon}
                  <span className="truncate">{m.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tonal Controls (Grayscale, Contrast, Levels) */}
        <div className="space-y-3.5">
          {/* Contrast */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400 flex items-center gap-1">
                <Contrast className="w-3 h-3 text-slate-500" />
                Контраст відтінків
              </span>
              <span className="font-mono text-indigo-400">{halftone.contrast > 0 ? `+${halftone.contrast}` : halftone.contrast}</span>
            </div>
            <input
              type="range"
              min="-40"
              max="90"
              value={halftone.contrast}
              onChange={(e) => onChangeHalftone({ contrast: Number(e.target.value) })}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          {/* Brightness */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400 flex items-center gap-1">
                <SunMedium className="w-3 h-3 text-slate-500" />
                Яскравість
              </span>
              <span className="font-mono text-indigo-400">{halftone.brightness > 0 ? `+${halftone.brightness}` : halftone.brightness}</span>
            </div>
            <input
              type="range"
              min="-50"
              max="50"
              value={halftone.brightness}
              onChange={(e) => onChangeHalftone({ brightness: Number(e.target.value) })}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          {/* Gamma / Midtones */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400 flex items-center gap-1">
                <Gauge className="w-3 h-3 text-slate-500" />
                Півтони (Gamma)
              </span>
              <span className="font-mono text-indigo-400">{halftone.gamma?.toFixed(2) || '1.00'}</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="1.8"
              step="0.05"
              value={halftone.gamma || 1.0}
              onChange={(e) => onChangeHalftone({ gamma: Number(e.target.value) })}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          {/* Deep Black Threshold */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">Глибина чорного кольору</span>
              <span className="font-mono text-indigo-400">{halftone.blackThreshold}</span>
            </div>
            <input
              type="range"
              min="0"
              max="80"
              value={halftone.blackThreshold}
              onChange={(e) => onChangeHalftone({ blackThreshold: Number(e.target.value) })}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          {/* Film Grain */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">Зернистість фото (Grain)</span>
              <span className="font-mono text-indigo-400">{halftone.grain || 0}</span>
            </div>
            <input
              type="range"
              min="0"
              max="30"
              value={halftone.grain || 0}
              onChange={(e) => onChangeHalftone({ grain: Number(e.target.value) })}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          {/* Hybrid Mode: Halftone Texture Blend */}
          {halftone.mode === 'hybrid' && (
            <div className="p-2.5 rounded-xl bg-indigo-950/30 border border-indigo-500/30">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-indigo-200 font-medium">Інтенсивність растру на фото</span>
                <span className="font-mono text-indigo-400">{halftone.halftoneBlend}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                value={halftone.halftoneBlend}
                onChange={(e) => onChangeHalftone({ halftoneBlend: Number(e.target.value) })}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>
          )}

          {/* Raster Parameters (when raster active) */}
          {isRasterActive && (
            <>
              {/* Dot Size */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Розмір елемента растру</span>
                  <span className="font-mono text-indigo-400">{halftone.dotSize}px</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="20"
                  step="0.5"
                  value={halftone.dotSize}
                  onChange={(e) => onChangeHalftone({ dotSize: Number(e.target.value) })}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>

              {/* Angle */}
              {halftone.mode !== 'dither' && (
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">Кут нахилу сітки</span>
                    <span className="font-mono text-indigo-400">{halftone.angle}°</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="90"
                    value={halftone.angle}
                    onChange={(e) => onChangeHalftone({ angle: Number(e.target.value) })}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>
              )}
            </>
          )}

          {/* Invert */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-slate-300">Інвертувати кольори (Негатив)</span>
            <button
              onClick={() => onChangeHalftone({ invert: !halftone.invert })}
              className={`w-9 h-5 rounded-full transition relative p-0.5 ${
                halftone.invert ? 'bg-indigo-600' : 'bg-slate-800'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition transform ${
                  halftone.invert ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Torn Edge Section */}
      <div className="p-4 border-b border-slate-800/80">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Scissors className="w-4 h-4 text-sky-400" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
              Рваний паперовий край
            </h2>
          </div>
          <button
            onClick={() => onChangeTornEdge({ enabled: !tornEdge.enabled })}
            className={`w-9 h-5 rounded-full transition relative p-0.5 ${
              tornEdge.enabled ? 'bg-sky-500' : 'bg-slate-800'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition transform ${
                tornEdge.enabled ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {tornEdge.enabled && (
          <div className="space-y-3.5">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Ширина білої обвідки</span>
                <span className="font-mono text-sky-400">{tornEdge.padding}px</span>
              </div>
              <input
                type="range"
                min="6"
                max="60"
                value={tornEdge.padding}
                onChange={(e) => onChangeTornEdge({ padding: Number(e.target.value) })}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Ступінь «рваності» краю</span>
                <span className="font-mono text-sky-400">{tornEdge.roughness}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="35"
                value={tornEdge.roughness}
                onChange={(e) => onChangeTornEdge({ roughness: Number(e.target.value) })}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Частота волокон розриву</span>
                <span className="font-mono text-sky-400">{Math.round(tornEdge.frequency * 1000)}</span>
              </div>
              <input
                type="range"
                min="0.02"
                max="0.15"
                step="0.005"
                value={tornEdge.frequency}
                onChange={(e) => onChangeTornEdge({ frequency: Number(e.target.value) })}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-slate-400 mb-1.5 block">
                Колір підкладки паперу
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {paperColors.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => onChangeTornEdge({ paperColor: c.value })}
                    className={`h-7 rounded-lg border flex items-center justify-center transition ${
                      tornEdge.paperColor.toLowerCase() === c.value.toLowerCase()
                        ? 'border-sky-400 ring-2 ring-sky-400/30'
                        : 'border-slate-700 hover:border-slate-500'
                    }`}
                    style={{ backgroundColor: c.value }}
                    title={c.name}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-slate-300">Текстура волокон паперу</span>
              <button
                onClick={() => onChangeTornEdge({ paperTexture: !tornEdge.paperTexture })}
                className={`w-9 h-5 rounded-full transition relative p-0.5 ${
                  tornEdge.paperTexture ? 'bg-sky-500' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition transform ${
                    tornEdge.paperTexture ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Canvas View Options */}
      <div className="p-4 mt-auto">
        <div className="flex items-center gap-2 mb-2.5">
          <Eye className="w-4 h-4 text-slate-400" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Фон попереднього перегляду
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => onChangeCanvasBg('dark-check')}
            className={`py-1.5 px-2 rounded-lg text-xs font-medium border text-center transition ${
              canvasBg === 'dark-check'
                ? 'bg-slate-800 text-slate-100 border-indigo-500/80'
                : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            Темна сітка
          </button>
          <button
            onClick={() => onChangeCanvasBg('light-check')}
            className={`py-1.5 px-2 rounded-lg text-xs font-medium border text-center transition ${
              canvasBg === 'light-check'
                ? 'bg-slate-800 text-slate-100 border-indigo-500/80'
                : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            Світла сітка
          </button>
          <button
            onClick={() => onChangeCanvasBg('dark-solid')}
            className={`py-1.5 px-2 rounded-lg text-xs font-medium border text-center transition ${
              canvasBg === 'dark-solid'
                ? 'bg-slate-800 text-slate-100 border-indigo-500/80'
                : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            Слайд (Темний)
          </button>
          <button
            onClick={() => onChangeCanvasBg('light-solid')}
            className={`py-1.5 px-2 rounded-lg text-xs font-medium border text-center transition ${
              canvasBg === 'light-solid'
                ? 'bg-slate-800 text-slate-100 border-indigo-500/80'
                : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            Слайд (Світлий)
          </button>
        </div>
      </div>
    </aside>
  );
};
