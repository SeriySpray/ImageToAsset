import React from 'react';
import {
  Hand,
  Square,
  Lasso,
  Paintbrush,
  Eraser,
  Wand2,
  Maximize,
  FlipHorizontal,
  Trash2,
} from 'lucide-react';
import { ToolType } from '../types';

interface ToolBarProps {
  activeTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  brushSize: number;
  onChangeBrushSize: (size: number) => void;
  wandTolerance: number;
  onChangeWandTolerance: (tol: number) => void;
  onInvertMask: () => void;
  onClearMask: () => void;
  onFillAllMask: () => void;
  hasImage: boolean;
}

export const ToolBar: React.FC<ToolBarProps> = ({
  activeTool,
  onSelectTool,
  brushSize,
  onChangeBrushSize,
  onInvertMask,
  onClearMask,
  onFillAllMask,
  hasImage,
}) => {
  const tools: { id: ToolType; name: string; icon: React.ReactNode; shortcut: string }[] = [
    { id: 'magic-wand', name: 'Магічне ласо / Авто-вирізання (W)', icon: <Wand2 className="w-4 h-4" />, shortcut: 'W' },
    { id: 'brush', name: 'Пензель маски (B)', icon: <Paintbrush className="w-4 h-4" />, shortcut: 'B' },
    { id: 'eraser', name: 'Ластик маски (E)', icon: <Eraser className="w-4 h-4" />, shortcut: 'E' },
    { id: 'box-select', name: 'Виділення прямокутником (M)', icon: <Square className="w-4 h-4" />, shortcut: 'M' },
    { id: 'lasso', name: 'Довільне ласо (L)', icon: <Lasso className="w-4 h-4" />, shortcut: 'L' },
    { id: 'pan', name: 'Панорамування / Зум (H / Space)', icon: <Hand className="w-4 h-4" />, shortcut: 'H' },
  ];

  if (!hasImage) return null;

  return (
    <aside className="w-16 border-r border-[#262626] bg-[#0a0a0a] flex flex-col items-center py-3 justify-between z-20 select-none font-mono">
      {/* Primary Selection Tools */}
      <div className="flex flex-col items-center gap-1.5 w-full px-2">
        {tools.map((tool) => {
          const isActive = activeTool === tool.id;
          const isMagic = tool.id === 'magic-wand';

          let buttonStyle = 'text-neutral-400 hover:text-white hover:bg-[#181818]';
          if (isMagic) {
            buttonStyle = isActive
              ? 'bg-[#f59e0b] text-black font-bold border border-[#f59e0b] shadow-sm'
              : 'text-[#f59e0b] border border-[#f59e0b]/30 bg-[#f59e0b]/5 hover:bg-[#f59e0b]/15 hover:border-[#f59e0b]/60';
          } else if (isActive) {
            buttonStyle = 'bg-white text-black font-bold shadow-none';
          }

          return (
            <button
              key={tool.id}
              onClick={() => onSelectTool(tool.id)}
              title={`${tool.name}`}
              className={`w-9 h-9 rounded flex items-center justify-center transition relative group cursor-pointer ${buttonStyle}`}
            >
              {tool.icon}

              {/* Tooltip */}
              <div className="absolute left-full ml-2.5 px-2.5 py-1 bg-[#0a0a0a] border border-[#262626] text-neutral-200 text-[11px] rounded whitespace-nowrap shadow-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition duration-150 z-50">
                {tool.name}
              </div>
            </button>
          );
        })}
      </div>

      {/* Secondary Quick Operations */}
      <div className="flex flex-col items-center gap-2 w-full px-2 pt-3 border-t border-[#262626]">
        {/* Brush Size Indicator & Slider */}
        {(activeTool === 'brush' || activeTool === 'eraser') && (
          <div className="flex flex-col items-center gap-1.5 w-full px-0.5 mb-1">
            <span className="text-[10px] font-mono text-neutral-300 font-bold">{brushSize}px</span>
            <input
              type="range"
              min="4"
              max="120"
              value={brushSize}
              onChange={(e) => onChangeBrushSize(Number(e.target.value))}
              title="Розмір пензля / ластика ([ / ])"
              className="w-full accent-white cursor-pointer h-1.5 bg-[#262626] rounded appearance-none"
            />
          </div>
        )}

        {/* Select All */}
        <button
          onClick={onFillAllMask}
          title="Виділити все полотно"
          className="w-8 h-8 rounded flex items-center justify-center text-neutral-400 hover:text-white hover:bg-[#181818] transition relative group cursor-pointer"
        >
          <Maximize className="w-3.5 h-3.5" />
          <div className="absolute left-full ml-2.5 px-2.5 py-1 bg-[#0a0a0a] border border-[#262626] text-neutral-200 text-[11px] rounded whitespace-nowrap shadow-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition duration-150 z-50">
            Виділити все
          </div>
        </button>

        {/* Invert Mask */}
        <button
          onClick={onInvertMask}
          title="Інвертувати маску"
          className="w-8 h-8 rounded flex items-center justify-center text-neutral-400 hover:text-white hover:bg-[#181818] transition relative group cursor-pointer"
        >
          <FlipHorizontal className="w-3.5 h-3.5" />
          <div className="absolute left-full ml-2.5 px-2.5 py-1 bg-[#0a0a0a] border border-[#262626] text-neutral-200 text-[11px] rounded whitespace-nowrap shadow-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition duration-150 z-50">
            Інвертувати маску
          </div>
        </button>

        {/* Clear Mask */}
        <button
          onClick={onClearMask}
          title="Очистити всю маску"
          className="w-8 h-8 rounded flex items-center justify-center text-neutral-400 hover:text-white hover:bg-[#181818] transition relative group cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <div className="absolute left-full ml-2.5 px-2.5 py-1 bg-[#0a0a0a] border border-[#262626] text-white text-[11px] rounded whitespace-nowrap shadow-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition duration-150 z-50">
            Очистити все
          </div>
        </button>
      </div>
    </aside>
  );
};
