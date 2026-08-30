import React from 'react';
import { 
  Sliders, 
  Scissors, 
  CircleDot, 
  Activity, 
  Contrast, 
  Eye, 
  Layers, 
  X,
  Grid
} from 'lucide-react';
import { HalftoneSettings, TornEdgeSettings, GraphicMode } from '../types';

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
}) => {
  if (!hasImage) return null;

  const modes: { id: GraphicMode; name: string; icon: React.ReactNode }[] = [
    { id: 'dots', name: 'Фото-растр', icon: <CircleDot className="w-3.5 h-3.5" /> },
    { id: 'graphic-dots', name: 'Графічний растр', icon: <Grid className="w-3.5 h-3.5" /> },
    { id: 'hybrid', name: 'Фото + Растр', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'engraving', name: 'Гравюра', icon: <Activity className="w-3.5 h-3.5" /> },
  ];

  const paperColors = [
    { name: 'Чистий білий', value: '#ffffff' },
    { name: 'Вінтажний кремовий (Жовтуватий)', value: '#f6f0db' },
    { name: 'Світло-бежевий пергамент', value: '#eee6d3' },
    { name: 'Нейтральний сірий', value: '#d8d8d8' },
    { name: 'Темний графіт', value: '#1a1a1a' },
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
        } w-80 max-w-[88vw] lg:w-72 lg:static border-l border-[#262626] bg-[#0a0a0a] flex-col h-full overflow-y-auto z-20 select-none font-mono text-xs shadow-2xl lg:shadow-none`}
      >
        {/* Mobile Header with Close Button */}
        <div className="lg:hidden p-4 border-b border-[#262626] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-white" />
            <span className="font-semibold text-xs text-white uppercase tracking-wider">Налаштування</span>
          </div>
          <button
            onClick={onClose}
            title="Закрити налаштування"
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
            Стиль та тональність
          </h2>
        </div>

        {/* Mode Grid */}
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
                Контрастність
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
                Розмір елемента растру
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
              Рваний контур наклейки
            </h2>
          </div>
          <button
            onClick={() => onChangeTornEdge({ 
              enabled: !tornEdge.enabled,
              padding: tornEdge.padding || 20,
              roughness: tornEdge.roughness || 3,
              shadowBlur: tornEdge.shadowBlur || 48
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
                <span className="text-neutral-300 font-medium">Ширина білої обвідки</span>
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
                <span className="text-neutral-300 font-medium">Ступінь «рваності» краю</span>
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

            {/* Paper Color */}
            <div>
              <label className="text-[10px] font-medium text-neutral-400 mb-1.5 block uppercase tracking-wider">
                Колір підкладки
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {paperColors.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => onChangeTornEdge({ paperColor: c.value })}
                    className={`h-6 rounded border flex items-center justify-center transition cursor-pointer ${
                      tornEdge.paperColor.toLowerCase() === c.value.toLowerCase()
                        ? 'border-white ring-1 ring-white'
                        : 'border-[#262626] hover:border-[#555555]'
                    }`}
                    style={{ backgroundColor: c.value }}
                    title={c.name}
                  />
                ))}
              </div>
            </div>

            {/* Outer Buffer Margin Toggle (60px) */}
            <div className="flex items-center justify-between pt-2 border-t border-[#1e1e1e]">
              <div>
                <span className="text-[11px] text-neutral-300 font-medium block">
                  Зовнішні поля (60px)
                </span>
                <span className="text-[10px] text-neutral-500 block">
                  Обводка по краях прямокутника
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
                title="Увімкнути/вимкнути буферні поля 60px для створення зовнішньої обводки прямокутного зображення"
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
                    Об'ємна тінь наклейки
                  </span>
                  <span className="text-[10px] text-neutral-500 block">
                    М'яка 3D тінь для глибини
                  </span>
                </div>
                <button
                  onClick={() => onChangeTornEdge({ dropShadow: !tornEdge.dropShadow })}
                  className={`w-8 h-4 rounded-full transition relative p-0.5 cursor-pointer ${
                    tornEdge.dropShadow ? 'bg-white' : 'bg-[#262626]'
                  }`}
                  title="Увімкнути/вимкнути об'ємну тінь наклейки"
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
                    <span className="text-neutral-400 font-medium">Розмір / розмиття тіні</span>
                    <span className="font-mono text-white font-bold">{tornEdge.shadowBlur ?? 48}px</span>
                  </div>
                  <input
                    type="range"
                    min="4"
                    max="48"
                    value={tornEdge.shadowBlur ?? 48}
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
            Фон полотна
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
            Темна сітка
          </button>
          <button
            onClick={() => onChangeCanvasBg('light-check')}
            className={`py-1.5 px-2 rounded text-[11px] font-medium border text-center transition cursor-pointer ${
              canvasBg === 'light-check'
                ? 'bg-[#1e1e1e] text-white border-white'
                : 'bg-[#121212] text-neutral-400 border-[#262626] hover:text-white'
            }`}
          >
            Світла сітка
          </button>
          <button
            onClick={() => onChangeCanvasBg('dark-solid')}
            className={`py-1.5 px-2 rounded text-[11px] font-medium border text-center transition cursor-pointer ${
              canvasBg === 'dark-solid'
                ? 'bg-[#1e1e1e] text-white border-white'
                : 'bg-[#121212] text-neutral-400 border-[#262626] hover:text-white'
            }`}
          >
            Чорний
          </button>
          <button
            onClick={() => onChangeCanvasBg('light-solid')}
            className={`py-1.5 px-2 rounded text-[11px] font-medium border text-center transition cursor-pointer ${
              canvasBg === 'light-solid'
                ? 'bg-[#1e1e1e] text-white border-white'
                : 'bg-[#121212] text-neutral-400 border-[#262626] hover:text-white'
            }`}
          >
            Білий
          </button>
        </div>
      </div>
    </aside>
  </>
);
};
