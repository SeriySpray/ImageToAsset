import React from 'react';
import { 
  Sliders, 
  Scissors, 
  CircleDot, 
  Activity, 
  Contrast,
  Eye,
  Layers,
  Image as ImageIcon,
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
    { id: 'dots', name: 'Газетний растр', icon: <CircleDot className="w-3.5 h-3.5" /> },
    { id: 'hybrid', name: 'Фото + Растр', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'engraving', name: 'Гравюра', icon: <Activity className="w-3.5 h-3.5" /> },
  ];

  const paperColors = [
    { name: 'Pure White', value: '#ffffff' },
    { name: 'Warm Cream', value: '#fcf8f2' },
    { name: 'Craft Paper', value: '#e8dcce' },
    { name: 'Dark Ink', value: '#12141c' },
  ];

  const showDotSize = halftone.mode !== 'grayscale-contrast';

  return (
    <aside className="w-76 border-l border-slate-800/80 bg-[#12151e]/95 backdrop-blur-md flex flex-col h-full overflow-y-auto z-20 select-none">
      {/* 1. Graphic Style & Tone */}
      <div className="p-4 border-b border-slate-800/80">
        <div className="flex items-center gap-2 mb-3">
          <Sliders className="w-4 h-4 text-indigo-400" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
            Стиль та тональність
          </h2>
        </div>

        {/* Mode Grid */}
        <div className="grid grid-cols-2 gap-1.5 mb-4 bg-slate-900/90 p-1.5 rounded-xl border border-slate-800">
          {modes.map((m) => {
            const active = halftone.mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => onChangeHalftone({ mode: m.id })}
                className={`flex items-center justify-start gap-1.5 py-2 px-2.5 rounded-lg text-xs font-medium transition cursor-pointer ${
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

        {/* Essential Sliders */}
        <div className="space-y-4">
          {/* Master Smart Contrast */}
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-300 flex items-center gap-1.5 font-medium">
                <Contrast className="w-3.5 h-3.5 text-indigo-400" />
                Контрастність
              </span>
              <span className="font-mono text-indigo-400 font-bold">{halftone.contrast}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={halftone.contrast}
              onChange={(e) => onChangeHalftone({ contrast: Number(e.target.value) })}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          {/* Dot Size (Only when raster is active) */}
          {showDotSize && (
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-300 flex items-center gap-1.5 font-medium">
                  <CircleDot className="w-3.5 h-3.5 text-indigo-400" />
                  Розмір елемента растру
                </span>
                <span className="font-mono text-indigo-400 font-bold">{halftone.dotSize}px</span>
              </div>
              <input
                type="range"
                min="2"
                max="18"
                step="0.5"
                value={halftone.dotSize}
                onChange={(e) => onChangeHalftone({ dotSize: Number(e.target.value) })}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>
          )}

          {/* Invert */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-slate-300 font-medium">Інвертувати кольори (Негатив)</span>
            <button
              onClick={() => onChangeHalftone({ invert: !halftone.invert })}
              className={`w-9 h-5 rounded-full transition relative p-0.5 cursor-pointer ${
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

      {/* 2. Torn Paper Sticker Border */}
      <div className="p-4 border-b border-slate-800/80">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <Scissors className="w-4 h-4 text-sky-400" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
              Рваний контур наклейки
            </h2>
          </div>
          <button
            onClick={() => onChangeTornEdge({ enabled: !tornEdge.enabled })}
            className={`w-9 h-5 rounded-full transition relative p-0.5 cursor-pointer ${
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
          <div className="space-y-4">
            {/* Border Width */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-300 font-medium">Ширина білої обвідки</span>
                <span className="font-mono text-sky-400 font-bold">{tornEdge.padding}px</span>
              </div>
              <input
                type="range"
                min="6"
                max="60"
                value={tornEdge.padding}
                onChange={(e) => onChangeTornEdge({ padding: Number(e.target.value) })}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
            </div>

            {/* Roughness */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-300 font-medium">Ступінь «рваності» краю</span>
                <span className="font-mono text-sky-400 font-bold">{tornEdge.roughness}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="30"
                value={tornEdge.roughness}
                onChange={(e) => onChangeTornEdge({ roughness: Number(e.target.value) })}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
            </div>

            {/* Paper Color */}
            <div>
              <label className="text-[11px] font-medium text-slate-400 mb-1.5 block">
                Колір підкладки наклейки
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {paperColors.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => onChangeTornEdge({ paperColor: c.value })}
                    className={`h-7 rounded-lg border flex items-center justify-center transition cursor-pointer ${
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
          </div>
        )}
      </div>

      {/* 3. Preview Background */}
      <div className="p-4 mt-auto">
        <div className="flex items-center gap-2 mb-2.5">
          <Eye className="w-4 h-4 text-slate-400" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Фон полотна
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => onChangeCanvasBg('dark-check')}
            className={`py-2 px-2 rounded-lg text-xs font-medium border text-center transition cursor-pointer ${
              canvasBg === 'dark-check'
                ? 'bg-slate-800 text-slate-100 border-indigo-500/80 shadow-sm'
                : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            Темна сітка
          </button>
          <button
            onClick={() => onChangeCanvasBg('light-check')}
            className={`py-2 px-2 rounded-lg text-xs font-medium border text-center transition cursor-pointer ${
              canvasBg === 'light-check'
                ? 'bg-slate-800 text-slate-100 border-indigo-500/80 shadow-sm'
                : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            Світла сітка
          </button>
          <button
            onClick={() => onChangeCanvasBg('dark-solid')}
            className={`py-2 px-2 rounded-lg text-xs font-medium border text-center transition cursor-pointer ${
              canvasBg === 'dark-solid'
                ? 'bg-slate-800 text-slate-100 border-indigo-500/80 shadow-sm'
                : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            Слайд (Темний)
          </button>
          <button
            onClick={() => onChangeCanvasBg('light-solid')}
            className={`py-2 px-2 rounded-lg text-xs font-medium border text-center transition cursor-pointer ${
              canvasBg === 'light-solid'
                ? 'bg-slate-800 text-slate-100 border-indigo-500/80 shadow-sm'
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
