import React, { useState } from 'react';
import { 
  Upload, 
  Copy, 
  Download, 
  Undo2, 
  Redo2, 
  Check,
  Maximize2
} from 'lucide-react';

interface HeaderProps {
  onUploadClick: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onCopyToClipboard: () => Promise<boolean>;
  onDownload: (scale: number) => void;
  onResetZoom: () => void;
  hasImage: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onUploadClick,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onCopyToClipboard,
  onDownload,
  onResetZoom,
  hasImage,
}) => {
  const [copied, setCopied] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const handleCopy = async () => {
    const success = await onCopyToClipboard();
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <header className="h-13 border-b border-[#262626] bg-[#0a0a0a] px-4 flex items-center justify-between z-30 select-none font-mono">
      {/* Left: Branding only */}
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded bg-white flex items-center justify-center text-black font-bold text-xs tracking-wider">
          IA
        </div>
        <h1 className="text-xs font-semibold text-white tracking-wide">
          ImageToAsset
        </h1>
      </div>

      {/* Right: All Actions & Controls */}
      <div className="flex items-center gap-3">
        {/* Upload Button */}
        <button
          onClick={onUploadClick}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-neutral-300 bg-[#141414] hover:bg-[#1f1f1f] hover:text-white border border-[#262626] hover:border-[#404040] rounded transition cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5 text-neutral-400" />
          <span>Завантажити фото</span>
        </button>

        {/* Quick Navigation & View Tools */}
        {hasImage && (
          <>
            <div className="h-4 w-px bg-[#262626]" />

            <div className="flex items-center gap-1 bg-[#141414] border border-[#262626] p-0.5 rounded">
              <button
                onClick={onUndo}
                disabled={!canUndo}
                title="Скасувати (Ctrl+Z)"
                className="p-1.5 text-neutral-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed rounded hover:bg-[#222222] transition cursor-pointer"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onRedo}
                disabled={!canRedo}
                title="Повторити (Ctrl+Y / Ctrl+Shift+Z)"
                className="p-1.5 text-neutral-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed rounded hover:bg-[#222222] transition cursor-pointer"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
              <div className="h-3.5 w-px bg-[#262626] mx-0.5" />
              <button
                onClick={onResetZoom}
                title="Скинути масштаб (100%)"
                className="p-1.5 text-neutral-400 hover:text-white hover:bg-[#222222] rounded transition cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        )}

        {hasImage && <div className="h-4 w-px bg-[#262626]" />}

        {/* Export & Copy Actions */}
        <button
          onClick={handleCopy}
          disabled={!hasImage}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded transition cursor-pointer ${
            copied
              ? 'bg-white text-black border border-white font-semibold'
              : 'bg-[#141414] hover:bg-[#1f1f1f] text-neutral-200 border border-[#262626] hover:border-[#404040] disabled:opacity-30 disabled:cursor-not-allowed'
          }`}
          title="Копіювати прозорий PNG асет у буфер обміну (Ctrl+C)"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5 text-neutral-400" />}
          <span>{copied ? 'Скопійовано!' : 'Копіювати PNG'}</span>
        </button>

        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            disabled={!hasImage}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-black bg-white hover:bg-neutral-200 border border-white rounded transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-black" />
            <span>Експорт</span>
          </button>

          {showExportMenu && (
            <div className="absolute right-0 top-full mt-1.5 w-44 bg-[#0a0a0a] border border-[#262626] rounded shadow-2xl p-1 z-50">
              <div className="text-[10px] font-semibold text-neutral-500 px-2 py-1 uppercase tracking-wider">
                Роздільна здатність
              </div>
              <button
                onClick={() => {
                  onDownload(1);
                  setShowExportMenu(false);
                }}
                className="w-full text-left px-2 py-1.5 text-xs text-neutral-300 hover:bg-[#181818] hover:text-white rounded flex items-center justify-between cursor-pointer"
              >
                <span>1x (Оригінал)</span>
                <span className="text-[10px] text-neutral-500">PNG</span>
              </button>
              <button
                onClick={() => {
                  onDownload(2);
                  setShowExportMenu(false);
                }}
                className="w-full text-left px-2 py-1.5 text-xs text-neutral-300 hover:bg-[#181818] hover:text-white rounded flex items-center justify-between cursor-pointer"
              >
                <span>2x (Retina HD)</span>
                <span className="text-[10px] text-white">Рекомендовано</span>
              </button>
              <button
                onClick={() => {
                  onDownload(4);
                  setShowExportMenu(false);
                }}
                className="w-full text-left px-2 py-1.5 text-xs text-neutral-300 hover:bg-[#181818] hover:text-white rounded flex items-center justify-between cursor-pointer"
              >
                <span>4x (Ultra HD)</span>
                <span className="text-[10px] text-neutral-500">Презентації</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
