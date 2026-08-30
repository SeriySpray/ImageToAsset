import React, { useState } from 'react';
import { 
  Upload, 
  Copy, 
  Download, 
  Undo2, 
  Redo2, 
  Check,
  Maximize2,
  Sliders
} from 'lucide-react';
import { Language, Translations } from '../i18n';

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
  onToggleMobileSettings?: () => void;
  isMobileSettingsOpen?: boolean;
  currentLang: Language;
  onSelectLanguage: (lang: Language) => void;
  t: Translations['header'];
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
  onToggleMobileSettings,
  isMobileSettingsOpen,
  currentLang,
  onSelectLanguage,
  t,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const success = await onCopyToClipboard();
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <header className="h-13 border-b border-[#262626] bg-[#0a0a0a] px-2.5 sm:px-4 flex items-center justify-between z-30 select-none font-mono shrink-0">
      {/* Left: Branding */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        <div className="w-7 h-7 rounded bg-white flex items-center justify-center text-black font-bold text-xs tracking-wider">
          IA
        </div>
        <h1 className="text-xs font-semibold text-white tracking-wide hidden sm:block">
          ImageToAsset
        </h1>
      </div>

      {/* Right: All Actions & Controls */}
      <div className="flex items-center gap-1 sm:gap-2 md:gap-2.5">
        {/* Language Switcher [ UA | EN ] */}
        <div className="flex items-center bg-[#141414] border border-[#262626] p-0.5 rounded text-[11px] font-mono">
          <button
            onClick={() => onSelectLanguage('uk')}
            className={`px-1.5 py-0.5 rounded transition cursor-pointer text-[11px] leading-tight ${
              currentLang === 'uk'
                ? 'bg-white text-black font-bold shadow-xs'
                : 'text-neutral-400 hover:text-white'
            }`}
            title="Українська мова"
            aria-label="Українська мова"
          >
            UA
          </button>
          <div className="h-3 w-px bg-[#262626] mx-0.5" />
          <button
            onClick={() => onSelectLanguage('en')}
            className={`px-1.5 py-0.5 rounded transition cursor-pointer text-[11px] leading-tight ${
              currentLang === 'en'
                ? 'bg-white text-black font-bold shadow-xs'
                : 'text-neutral-400 hover:text-white'
            }`}
            title="English language"
            aria-label="English language"
          >
            EN
          </button>
        </div>

        <div className="h-4 w-px bg-[#262626] hidden xs:block" />

        {/* Upload Button */}
        <button
          onClick={onUploadClick}
          className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 text-xs font-medium text-neutral-300 bg-[#141414] hover:bg-[#1f1f1f] hover:text-white border border-[#262626] hover:border-[#404040] rounded transition cursor-pointer shrink-0"
          title={t.uploadTooltip}
        >
          <Upload className="w-3.5 h-3.5 text-neutral-400" />
          <span className="hidden md:inline">{t.upload}</span>
          <span className="inline md:hidden text-[11px]">{t.uploadShort}</span>
        </button>

        {/* Quick Navigation & View Tools */}
        {hasImage && (
          <>
            <div className="h-4 w-px bg-[#262626] hidden sm:block" />

            <div className="flex items-center gap-0.5 sm:gap-1 bg-[#141414] border border-[#262626] p-0.5 rounded shrink-0">
              <button
                onClick={onUndo}
                disabled={!canUndo}
                title={t.undo}
                className="p-1.5 text-neutral-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed rounded hover:bg-[#222222] transition cursor-pointer"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onRedo}
                disabled={!canRedo}
                title={t.redo}
                className="p-1.5 text-neutral-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed rounded hover:bg-[#222222] transition cursor-pointer"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
              <div className="h-3.5 w-px bg-[#262626] mx-0.5 hidden sm:block" />
              <button
                onClick={onResetZoom}
                title={t.resetZoom}
                className="p-1.5 text-neutral-400 hover:text-white hover:bg-[#222222] rounded transition cursor-pointer hidden sm:block"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        )}

        {hasImage && <div className="h-4 w-px bg-[#262626] hidden sm:block" />}

        {/* Export & Copy Actions */}
        <button
          onClick={handleCopy}
          disabled={!hasImage}
          className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 text-xs font-medium rounded transition cursor-pointer shrink-0 ${
            copied
              ? 'bg-white text-black border border-white font-semibold'
              : 'bg-[#141414] hover:bg-[#1f1f1f] text-neutral-200 border border-[#262626] hover:border-[#404040] disabled:opacity-30 disabled:cursor-not-allowed'
          }`}
          title={t.copyTooltip}
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5 text-neutral-400" />}
          <span className="hidden sm:inline">{copied ? t.copied : t.copyPng}</span>
          <span className="inline sm:hidden text-[11px]">{copied ? t.copiedShort : t.copyPngShort}</span>
        </button>

        {/* Export Button */}
        <button
          onClick={() => onDownload(1)}
          disabled={!hasImage}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-black bg-white hover:bg-neutral-200 border border-white rounded transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shrink-0"
          title={t.exportTooltip}
        >
          <Download className="w-3.5 h-3.5 text-black" />
          <span className="hidden sm:inline">{t.export}</span>
        </button>

        {/* Mobile Settings Toggle Button (Visible only on < lg screens) */}
        {hasImage && onToggleMobileSettings && (
          <button
            onClick={onToggleMobileSettings}
            className={`lg:hidden flex items-center justify-center p-1.5 rounded border transition cursor-pointer shrink-0 ${
              isMobileSettingsOpen
                ? 'bg-white text-black border-white'
                : 'bg-[#141414] text-neutral-300 border-[#262626] hover:border-[#404040]'
            }`}
            title={t.openSettings}
          >
            <Sliders className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
};
