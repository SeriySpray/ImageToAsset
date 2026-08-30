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
import { Translations } from '../i18n';

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
  t: Translations['toolbar'];
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
  t,
}) => {
  const tools: { id: ToolType; name: string; icon: React.ReactNode; shortcut: string }[] = [
    { id: 'magic-wand', name: t.tools.magicWand, icon: <Wand2 className="w-4 h-4" />, shortcut: 'W' },
    { id: 'brush', name: t.tools.brush, icon: <Paintbrush className="w-4 h-4" />, shortcut: 'B' },
    { id: 'eraser', name: t.tools.eraser, icon: <Eraser className="w-4 h-4" />, shortcut: 'E' },
    { id: 'box-select', name: t.tools.boxSelect, icon: <Square className="w-4 h-4" />, shortcut: 'M' },
    { id: 'lasso', name: t.tools.lasso, icon: <Lasso className="w-4 h-4" />, shortcut: 'L' },
    { id: 'pan', name: t.tools.pan, icon: <Hand className="w-4 h-4" />, shortcut: 'H' },
  ];

  if (!hasImage) return null;

  return (
    <>
      {/* Mobile Floating Brush Size Slider Pill (Visible only on < lg when brush or eraser is active) */}
      {(activeTool === 'brush' || activeTool === 'eraser') && (
        <div className="lg:hidden fixed bottom-18 left-1/2 -translate-x-1/2 bg-[#0a0a0a]/95 backdrop-blur-md border border-[#262626] rounded-xl px-3 py-2 flex items-center gap-2.5 shadow-2xl z-30 whitespace-nowrap">
          <span className="text-[10px] font-mono text-neutral-300 font-bold min-w-[32px]">{brushSize}px</span>
          <input
            type="range"
            min="4"
            max="120"
            value={brushSize}
            onChange={(e) => onChangeBrushSize(Number(e.target.value))}
            title={t.brushSize}
            className="w-32 accent-white cursor-pointer h-1.5 bg-[#262626] rounded appearance-none"
          />
        </div>
      )}

      {/* Main ToolBar: Desktop Left Sidebar + Mobile Bottom Floating Dock */}
      <aside className="fixed bottom-3 left-1/2 -translate-x-1/2 lg:static lg:translate-x-0 z-30 lg:z-20 w-auto max-w-[96vw] lg:w-16 lg:h-full border border-[#262626] lg:border-t-0 lg:border-b-0 lg:border-l-0 lg:border-r bg-[#0a0a0a]/95 lg:bg-[#0a0a0a] backdrop-blur-md lg:backdrop-blur-none rounded-2xl lg:rounded-none p-1.5 lg:py-3 lg:px-2 flex flex-row lg:flex-col items-center justify-between shadow-2xl lg:shadow-none select-none font-mono shrink-0">
        {/* Primary Selection Tools */}
        <div className="flex flex-row lg:flex-col items-center gap-1.5 w-auto lg:w-full">
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
                title={tool.name}
                aria-label={tool.name}
                className={`w-9 h-9 rounded flex items-center justify-center transition relative group cursor-pointer ${buttonStyle}`}
              >
                {tool.icon}

                {/* Desktop Tooltip */}
                <div className="hidden lg:block absolute left-full ml-2.5 px-2.5 py-1 bg-[#0a0a0a] border border-[#262626] text-neutral-200 text-[11px] rounded whitespace-nowrap shadow-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition duration-150 z-50">
                  {tool.name}
                </div>
              </button>
            );
          })}
        </div>

        {/* Divider: Vertical on mobile, Horizontal on desktop */}
        <div className="h-5 w-px bg-[#262626] mx-0.5 lg:hidden" />

        {/* Secondary Quick Operations */}
        <div className="flex flex-row lg:flex-col items-center gap-1.5 lg:gap-2 w-auto lg:w-full lg:pt-3 lg:border-t lg:border-[#262626]">
          {/* Desktop-only Brush Size Slider */}
          {(activeTool === 'brush' || activeTool === 'eraser') && (
            <div className="hidden lg:flex flex-col items-center gap-1.5 w-full px-0.5 mb-1">
              <span className="text-[10px] font-mono text-neutral-300 font-bold">{brushSize}px</span>
              <input
                type="range"
                min="4"
                max="120"
                value={brushSize}
                onChange={(e) => onChangeBrushSize(Number(e.target.value))}
                title={t.brushSize}
                className="w-full accent-white cursor-pointer h-1.5 bg-[#262626] rounded appearance-none"
              />
            </div>
          )}

          {/* Select All */}
          <button
            onClick={onFillAllMask}
            title={t.selectAllTooltip}
            aria-label={t.selectAll}
            className="w-8 h-8 rounded flex items-center justify-center text-neutral-400 hover:text-white hover:bg-[#181818] transition relative group cursor-pointer"
          >
            <Maximize className="w-3.5 h-3.5" />
            <div className="hidden lg:block absolute left-full ml-2.5 px-2.5 py-1 bg-[#0a0a0a] border border-[#262626] text-neutral-200 text-[11px] rounded whitespace-nowrap shadow-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition duration-150 z-50">
              {t.selectAll}
            </div>
          </button>

          {/* Invert Mask */}
          <button
            onClick={onInvertMask}
            title={t.invertMaskTooltip}
            aria-label={t.invertMask}
            className="w-8 h-8 rounded flex items-center justify-center text-neutral-400 hover:text-white hover:bg-[#181818] transition relative group cursor-pointer"
          >
            <FlipHorizontal className="w-3.5 h-3.5" />
            <div className="hidden lg:block absolute left-full ml-2.5 px-2.5 py-1 bg-[#0a0a0a] border border-[#262626] text-neutral-200 text-[11px] rounded whitespace-nowrap shadow-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition duration-150 z-50">
              {t.invertMask}
            </div>
          </button>

          {/* Clear Mask */}
          <button
            onClick={onClearMask}
            title={t.clearAllTooltip}
            aria-label={t.clearAll}
            className="w-8 h-8 rounded flex items-center justify-center text-neutral-400 hover:text-white hover:bg-[#181818] transition relative group cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <div className="hidden lg:block absolute left-full ml-2.5 px-2.5 py-1 bg-[#0a0a0a] border border-[#262626] text-white text-[11px] rounded whitespace-nowrap shadow-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition duration-150 z-50">
              {t.clearAll}
            </div>
          </button>
        </div>
      </aside>
    </>
  );
};
