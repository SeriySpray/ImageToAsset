import React from 'react';
import {
  Hand,
  Sparkles,
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
  onAutoCutout: () => void;
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
  onAutoCutout,
  brushSize,
  onChangeBrushSize,
  wandTolerance,
  onChangeWandTolerance,
  onInvertMask,
  onClearMask,
  onFillAllMask,
  hasImage,
}) => {
  const tools: { id: ToolType; name: string; icon: React.ReactNode; shortcut: string }[] = [
    { id: 'brush', name: 'Пензель маски (B)', icon: <Paintbrush className="w-4 h-4" />, shortcut: 'B' },
    { id: 'eraser', name: 'Ластик маски (E)', icon: <Eraser className="w-4 h-4" />, shortcut: 'E' },
    { id: 'magic-wand', name: 'Чарівна паличка (W)', icon: <Wand2 className="w-4 h-4" />, shortcut: 'W' },
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
        {/* On-Demand AI Smart Auto Cutout Button */}
        <button
          onClick={onAutoCutout}
          title="Авто-вирізання фону (ШІ / Edge Detection)"
          className="w-10 h-10 rounded-xl flex items-center justify-center transition bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 hover:text-amber-300 shadow-sm relative group mb-1"
        >
          <Sparkles className="w-4 h-4" />
          <div className="absolute left-full ml-2.5 px-2.5 py-1 bg-slate-900 border border-slate-800 text-amber-300 text-xs rounded-md whitespace-nowrap shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition duration-150 z-50">
            Розумне авто-вирізання
          </div>
        </button>

        <div className="w-6 h-px bg-slate-800 my-0.5" />

        {tools.map((tool) => {
          const isActive = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              onClick={() => onSelectTool(tool.id)}
              title={`${tool.name}`}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition relative group ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
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

        {/* Dynamic Tool Adjusters (Brush Size / Wand Tolerance) */}
        {(activeTool === 'brush' || activeTool === 'eraser') && (
          <div className="mt-2 w-full flex flex-col items-center gap-1 pt-2 border-t border-slate-800">
            <span className="text-[10px] font-mono text-slate-400">{brushSize}px</span>
            <input
              type="range"
              min="2"
              max="120"
              value={brushSize}
              onChange={(e) => onChangeBrushSize(Number(e.target.value))}
              title="Розмір пензля"
              className="w-8 accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded"
            />
          </div>
        )}

        {activeTool === 'magic-wand' && (
          <div className="mt-2 w-full flex flex-col items-center gap-1 pt-2 border-t border-slate-800">
            <span className="text-[10px] font-mono text-slate-400">±{wandTolerance}</span>
            <input
              type="range"
              min="2"
              max="80"
              value={wandTolerance}
              onChange={(e) => onChangeWandTolerance(Number(e.target.value))}
              title="Чутливість виділення"
              className="w-8 accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded"
            />
          </div>
        )}
      </div>

      {/* Mask Actions (Fill / Invert / Clear) */}
      <div className="flex flex-col items-center gap-1.5 w-full px-2 pt-3 border-t border-slate-800/80">
        <button
          onClick={onFillAllMask}
          title="Виділити все зображення"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 transition relative group"
        >
          <Maximize className="w-4 h-4" />
          <div className="absolute left-full ml-2.5 px-2.5 py-1 bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-md whitespace-nowrap shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition duration-150 z-50">
            Виділити все зображення
          </div>
        </button>

        <button
          onClick={onInvertMask}
          title="Інвертувати виділення"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 transition relative group"
        >
          <FlipHorizontal className="w-4 h-4" />
          <div className="absolute left-full ml-2.5 px-2.5 py-1 bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-md whitespace-nowrap shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition duration-150 z-50">
            Інвертувати виділення
          </div>
        </button>

        <button
          onClick={onClearMask}
          title="Очистити виділення"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition relative group"
        >
          <Trash2 className="w-4 h-4" />
          <div className="absolute left-full ml-2.5 px-2.5 py-1 bg-slate-900 border border-slate-800 text-rose-300 text-xs rounded-md whitespace-nowrap shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition duration-150 z-50">
            Очистити виділення
          </div>
        </button>
      </div>
    </aside>
  );
};
