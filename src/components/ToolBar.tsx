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
    <aside className="w-13 border-r border-[#262626] bg-[#0a0a0a] flex flex-col items-center py-3 justify-between z-20 select-none font-mono">
      {/* Primary Selection Tools */}
      <div className="flex flex-col items-center gap-1.5 w-full px-1.5">
        {tools.map((tool) => {
          const isActive = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              onClick={() => onSelectTool(tool.id)}
              title={`${tool.name}`}
              className={`w-9 h-9 rounded flex items-center justify-center transition relative group cursor-pointer ${
                isActive
                  ? 'bg-white text-black font-bold shadow-none'
                  : 'text-neutral-400 hover:text-white hover:bg-[#181818]'
              }`}
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
      <div className="flex flex-col items-center gap-2 w-full px-1.5 pt-3 border-t border-[#262626]">
        {/* Brush Size Indicator */}
        {(activeTool === 'brush' || activeTool === 'eraser') && (
          <div className="flex flex-col items-center gap-1 w-full mb-1">
            <span className="text-[9px] font-mono text-neutral-400">{brushSize}px</span>
            <input
              type="range"
              min="4"
              max="120"
              value={brushSize}
              onChange={(e) => onChangeBrushSize(Number(e.target.value))}
              title="Розмір пензля ([ / ])"
              className="w-7 accent-white cursor-pointer h-1 bg-[#262626] rounded"
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
