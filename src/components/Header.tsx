import React, { useState } from 'react';
import { 
  Upload, 
  Copy, 
  Download, 
  Undo2, 
  Redo2, 
  Check,
  SplitSquareVertical,
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
  showSplitView: boolean;
  onToggleSplitView: () => void;
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
  showSplitView,
  onToggleSplitView,
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
    <header className="h-14 border-b border-slate-800/80 bg-[#12151e]/90 backdrop-blur-md px-4 flex items-center justify-between z-30 select-none">
      {/* Left: Branding & Upload */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 via-indigo-500 to-sky-400 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white font-bold text-sm tracking-wider">
            IA
          </div>
          <div>
            <h1 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5 leading-none">
              ImageToAsset
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Sticker Studio
              </span>
            </h1>
          </div>
        </div>

        <div className="h-5 w-px bg-slate-800 mx-1" />

        <button
          onClick={onUploadClick}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800/80 hover:bg-slate-700/80 hover:text-white border border-slate-700/60 rounded-lg transition-all shadow-sm cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5 text-indigo-400" />
          <span>Завантажити фото</span>
        </button>
      </div>

      {/* Center: Quick Navigation & View Tools */}
      <div className="flex items-center gap-2">
        {hasImage && (
          <>
            <div className="flex items-center gap-1 bg-slate-900/80 border border-slate-800/80 p-0.5 rounded-lg">
              <button
                onClick={onUndo}
                disabled={!canUndo}
                title="Скасувати (Ctrl+Z)"
                className="p-1.5 text-slate-400 hover:text-slate-100 disabled:opacity-30 disabled:cursor-not-allowed rounded hover:bg-slate-800 transition cursor-pointer"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onRedo}
                disabled={!canRedo}
                title="Повторити (Ctrl+Y / Ctrl+Shift+Z)"
                className="p-1.5 text-slate-400 hover:text-slate-100 disabled:opacity-30 disabled:cursor-not-allowed rounded hover:bg-slate-800 transition cursor-pointer"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-1 bg-slate-900/80 border border-slate-800/80 p-0.5 rounded-lg">
              <button
                onClick={onToggleSplitView}
                title="Розділений екран До / Після"
                className={`p-1.5 rounded transition cursor-pointer ${
                  showSplitView
                    ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                }`}
              >
                <SplitSquareVertical className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onResetZoom}
                title="Скинути масштаб (100%)"
                className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Right: Export & Copy Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleCopy}
          disabled={!hasImage}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition shadow-sm cursor-pointer ${
            copied
              ? 'bg-emerald-600 text-white border border-emerald-500'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500/80 disabled:opacity-40 disabled:cursor-not-allowed'
          }`}
          title="Копіювати прозорий PNG асет у буфер обміну (Ctrl+C)"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Скопійовано!' : 'Копіювати PNG'}</span>
        </button>

        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            disabled={!hasImage}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-indigo-400" />
            <span>Експорт</span>
          </button>

          {showExportMenu && (
            <div className="absolute right-0 top-full mt-1.5 w-44 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-1.5 z-50">
              <div className="text-[10px] font-semibold text-slate-400 px-2.5 py-1 uppercase tracking-wider">
                Роздільна здатність
              </div>
              <button
                onClick={() => {
                  onDownload(1);
                  setShowExportMenu(false);
                }}
                className="w-full text-left px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800 rounded-lg flex items-center justify-between cursor-pointer"
              >
                <span>1x (Оригінал)</span>
                <span className="text-[10px] text-slate-400">PNG</span>
              </button>
              <button
                onClick={() => {
                  onDownload(2);
                  setShowExportMenu(false);
                }}
                className="w-full text-left px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800 rounded-lg flex items-center justify-between cursor-pointer"
              >
                <span>2x (Retina HD)</span>
                <span className="text-[10px] text-indigo-400">Рекомендовано</span>
              </button>
              <button
                onClick={() => {
                  onDownload(4);
                  setShowExportMenu(false);
                }}
                className="w-full text-left px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800 rounded-lg flex items-center justify-between cursor-pointer"
              >
                <span>4x (Ultra HD)</span>
                <span className="text-[10px] text-slate-400">Презентації</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
