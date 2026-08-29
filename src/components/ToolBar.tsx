import React from 'react';
import {
  Hand,
  Square,
  Lasso,
  Pentagon,
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
  const tools: { id: ToolType; name: string; icon: React.ReactNode; shortcut: string; highlight?: boolean }[] = [
    { id: 'magic-wand', name: 'Магічне ласо / Авто-вирізання (W)', icon: <Wand2 className="w-4 h-4" />, shortcut: 'W', highlight: true },
    { id: 'brush', name: 'Пензель маски (B)', icon: <Paintbrush className="w-4 h-4" />, shortcut: 'B' },
    { id: 'eraser', name: 'Ластик маски (E)', icon: <Eraser className="w-4 h-4" />, shortcut: 'E' },
    { id: 'box-select', name: 'Виділення прямокутником (M)', icon: <Square className="w-4 h-4" />, shortcut: 'M' },
    { id: 'lasso', name: 'Довільне ласо (L)', icon: <Lasso className="w-4 h-4" />, shortcut: 'L' },
    { id: 'polygon', name: 'Полігональне ласо (P)', icon: <Pentagon className="w-4 h-4" />, shortcut: 'P' },
    { id: 'pan', name: 'Панорамування / Зум (H / Space)', icon: <Hand className="w-4 h-4" />, shortcut: 'H' },
  ];

  if (!hasImage) return null;

  return (
    <aside className="w-14 border-r border-slate-800/80 bg-[#12151e]/90 backdrop-blur-md flex flex-col items-center py-3 justify-between z-20 select-none">
      {/* Primary Selection Tools */}
      <div className="flex flex-col items-center gap-1.5 w-full px-2">
        {tools.map((tool) => {
          const isActive = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              onClick={() => onSelectTool(tool.id)}
              title={`${tool.name}`}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition relative group ${
                isActive
                  ? tool.highlight
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/30'
                    : 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : tool.highlight
                  ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 hover:text-amber-300'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/80'
              }`}
            >
              {tool.icon}

              {/* Tooltip */}
              <div className="absolute left-full ml-2.5 px-2.5 py-1 bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-md whitespace-nowrap shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition duration-150 z-50">
                {tool.name}
              </div>
            </button>
          );
        })}
      </div>

      {/* Secondary Quick Operations */}
      <div className="flex flex-col items-center gap-2 w-full px-2 pt-3 border-t border-slate-800/80">
        {/* Brush Size Indicator */}
        {(activeTool === 'brush' || activeTool === 'eraser') && (
          <div className="flex flex-col items-center gap-1 w-full mb-1">
            <span className="text-[10px] font-mono text-slate-400">{brushSize}px</span>
            <input
              type="range"
              min="4"
              max="120"
              value={brushSize}
              onChange={(e) => onChangeBrushSize(Number(e.target.value))}
              title="Розмір пензля ([ / ])"
              className="w-8 accent-indigo-500 cursor-pointer h-1 bg-slate-800 rounded"
            />
          </div>
        )}

        {/* Select All */}
        <button
          onClick={onFillAllMask}
          title="Виділити все полотно"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 transition relative group"
        >
          <Maximize className="w-4 h-4" />
          <div className="absolute left-full ml-2.5 px-2.5 py-1 bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-md whitespace-nowrap shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition duration-150 z-50">
            Виділити все
          </div>
        </button>

        {/* Invert Mask */}
        <button
          onClick={onInvertMask}
          title="Інвертувати маску"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 transition relative group"
        >
          <FlipHorizontal className="w-4 h-4" />
          <div className="absolute left-full ml-2.5 px-2.5 py-1 bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-md whitespace-nowrap shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition duration-150 z-50">
            Інвертувати маску
          </div>
        </button>

        {/* Clear Mask */}
        <button
          onClick={onClearMask}
          title="Очистити всю маску"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 transition relative group"
        >
          <Trash2 className="w-4 h-4" />
          <div className="absolute left-full ml-2.5 px-2.5 py-1 bg-slate-900 border border-slate-800 text-rose-300 text-xs rounded-md whitespace-nowrap shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition duration-150 z-50">
            Очистити все
          </div>
        </button>
      </div>
    </aside>
  );
};
