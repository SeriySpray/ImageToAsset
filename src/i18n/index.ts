export type Language = 'uk' | 'en';

export interface Translations {
  header: {
    upload: string;
    uploadShort: string;
    uploadTooltip: string;
    undo: string;
    redo: string;
    resetZoom: string;
    copyPng: string;
    copyPngShort: string;
    copied: string;
    copiedShort: string;
    copyTooltip: string;
    export: string;
    exportTooltip: string;
    openSettings: string;
  };
  toolbar: {
    tools: {
      magicWand: string;
      brush: string;
      eraser: string;
      boxSelect: string;
      lasso: string;
      pan: string;
    };
    brushSize: string;
    selectAll: string;
    selectAllTooltip: string;
    invertMask: string;
    invertMaskTooltip: string;
    clearAll: string;
    clearAllTooltip: string;
  };
  settings: {
    title: string;
    close: string;
    styleAndTone: string;
    modes: {
      dots: string;
      graphicDots: string;
      hybrid: string;
      engraving: string;
    };
    contrast: string;
    dotSize: string;
    tornBorderTitle: string;
    borderWidth: string;
    roughness: string;
    paperColor: string;
    paperColors: {
      [key: string]: string;
    };
    outerPaddingTitle: string;
    outerPaddingDesc: string;
    outerPaddingTooltip: string;
    dropShadowTitle: string;
    dropShadowDesc: string;
    dropShadowTooltip: string;
    shadowBlur: string;
    canvasBgTitle: string;
    canvasBg: {
      darkCheck: string;
      lightCheck: string;
      darkSolid: string;
      lightSolid: string;
    };
  };
  viewport: {
    dropzoneTitle: string;
    dropzoneSubtitle: string;
    browseFiles: string;
  };
}

export const translations: Record<Language, Translations> = {
  uk: {
    header: {
      upload: 'Завантажити фото',
      uploadShort: 'Фото',
      uploadTooltip: 'Завантажити фото або вставити (Ctrl+V)',
      undo: 'Скасувати (Ctrl+Z)',
      redo: 'Повторити (Ctrl+Y / Ctrl+Shift+Z)',
      resetZoom: 'Скинути масштаб (100%)',
      copyPng: 'Копіювати PNG',
      copyPngShort: 'PNG',
      copied: 'Скопійовано!',
      copiedShort: 'ОК',
      copyTooltip: 'Копіювати прозорий PNG асет у буфер обміну (Ctrl+C)',
      export: 'Експорт',
      exportTooltip: 'Експортувати прозорий PNG асет без заднього фону',
      openSettings: 'Відкрити налаштування стилю та контуру',
    },
    toolbar: {
      tools: {
        magicWand: 'Магічне ласо / Авто-вирізання (W)',
        brush: 'Пензель маски (B)',
        eraser: 'Ластик маски (E)',
        boxSelect: 'Виділення прямокутником (M)',
        lasso: 'Довільне ласо (L)',
        pan: 'Панорамування / Зум (H / Space)',
      },
      brushSize: 'Розмір пензля / ластика ([ / ])',
      selectAll: 'Виділити все',
      selectAllTooltip: 'Виділити все полотно',
      invertMask: 'Інвертувати маску',
      invertMaskTooltip: 'Інвертувати маску',
      clearAll: 'Очистити все',
      clearAllTooltip: 'Очистити всю маску',
    },
    settings: {
      title: 'Налаштування',
      close: 'Закрити налаштування',
      styleAndTone: 'Стиль та тональність',
      modes: {
        dots: 'Фото-растр',
        graphicDots: 'Графічний растр',
        hybrid: 'Фото + Растр',
        engraving: 'Гравюра',
      },
      contrast: 'Контрастність',
      dotSize: 'Розмір елемента растру',
      tornBorderTitle: 'Рваний контур наклейки',
      borderWidth: 'Ширина білої обвідки',
      roughness: 'Ступінь «рваності» краю',
      paperColor: 'Колір підкладки',
      paperColors: {
        '#ffffff': 'Чистий білий',
        '#f6f0db': 'Вінтажний кремовий (Жовтуватий)',
        '#eee6d3': 'Світло-бежевий пергамент',
        '#d8d8d8': 'Нейтральний сірий',
        '#1a1a1a': 'Темний графіт',
      },
      outerPaddingTitle: 'Зовнішні поля (60px)',
      outerPaddingDesc: 'Обводка по краях прямокутника',
      outerPaddingTooltip: 'Увімкнути/вимкнути буферні поля 60px для створення зовнішньої обводки прямокутного зображення',
      dropShadowTitle: "Об'ємна тінь наклейки",
      dropShadowDesc: "М'яка 3D тінь для глибини",
      dropShadowTooltip: "Увімкнути/вимкнути об'ємну тінь наклейки",
      shadowBlur: 'Розмір / розмиття тіні',
      canvasBgTitle: 'Фон полотна',
      canvasBg: {
        darkCheck: 'Темна сітка',
        lightCheck: 'Світла сітка',
        darkSolid: 'Чорний',
        lightSolid: 'Білий',
      },
    },
    viewport: {
      dropzoneTitle: 'Перетягніть фото сюди або вставте з буфера (Ctrl+V)',
      dropzoneSubtitle: 'Підтримуються будь-які PNG, JPG, WebP або мобільні фотографії',
      browseFiles: 'Обрати файл з диска',
    },
  },
  en: {
    header: {
      upload: 'Upload Image',
      uploadShort: 'Image',
      uploadTooltip: 'Upload image or paste from clipboard (Ctrl+V)',
      undo: 'Undo (Ctrl+Z)',
      redo: 'Redo (Ctrl+Y / Ctrl+Shift+Z)',
      resetZoom: 'Reset Zoom (100%)',
      copyPng: 'Copy PNG',
      copyPngShort: 'PNG',
      copied: 'Copied!',
      copiedShort: 'OK',
      copyTooltip: 'Copy transparent PNG asset to clipboard (Ctrl+C)',
      export: 'Export',
      exportTooltip: 'Export transparent PNG asset without background',
      openSettings: 'Open style and outline settings',
    },
    toolbar: {
      tools: {
        magicWand: 'Magic Wand / Auto Cutout (W)',
        brush: 'Mask Brush (B)',
        eraser: 'Mask Eraser (E)',
        boxSelect: 'Box Selection (M)',
        lasso: 'Freehand Lasso (L)',
        pan: 'Pan / Zoom (H / Space)',
      },
      brushSize: 'Brush / Eraser Size ([ / ])',
      selectAll: 'Select All',
      selectAllTooltip: 'Select entire canvas',
      invertMask: 'Invert Mask',
      invertMaskTooltip: 'Invert selection mask',
      clearAll: 'Clear All',
      clearAllTooltip: 'Clear entire mask',
    },
    settings: {
      title: 'Settings',
      close: 'Close settings',
      styleAndTone: 'Style & Tone',
      modes: {
        dots: 'Photo Halftone',
        graphicDots: 'Graphic Halftone',
        hybrid: 'Photo + Halftone',
        engraving: 'Engraving',
      },
      contrast: 'Contrast',
      dotSize: 'Dot / Pattern Size',
      tornBorderTitle: 'Torn Sticker Border',
      borderWidth: 'Border Width',
      roughness: 'Edge Roughness',
      paperColor: 'Backing Paper Color',
      paperColors: {
        '#ffffff': 'Pure White',
        '#f6f0db': 'Vintage Cream (Warm)',
        '#eee6d3': 'Light Parchment',
        '#d8d8d8': 'Neutral Gray',
        '#1a1a1a': 'Dark Graphite',
      },
      outerPaddingTitle: 'Outer Padding (60px)',
      outerPaddingDesc: 'Border around image rectangle',
      outerPaddingTooltip: 'Toggle 60px buffer margin to allow outer borders on rectangular images',
      dropShadowTitle: 'Volumetric Drop Shadow',
      dropShadowDesc: 'Soft 3D shadow for depth',
      dropShadowTooltip: 'Toggle volumetric sticker drop shadow',
      shadowBlur: 'Shadow Blur / Size',
      canvasBgTitle: 'Canvas Background',
      canvasBg: {
        darkCheck: 'Dark Grid',
        lightCheck: 'Light Grid',
        darkSolid: 'Black',
        lightSolid: 'White',
      },
    },
    viewport: {
      dropzoneTitle: 'Drag & drop image here or paste from clipboard (Ctrl+V)',
      dropzoneSubtitle: 'Supports any PNG, JPG, WebP or mobile photos',
      browseFiles: 'Choose File from Disk',
    },
  },
};

export const getStoredLanguage = (): Language => {
  try {
    const saved = localStorage.getItem('imagetoasset_lang');
    if (saved === 'uk' || saved === 'en') {
      return saved;
    }
  } catch {
    // Fallback if localStorage is inaccessible
  }
  return 'uk';
};

export const setStoredLanguage = (lang: Language): void => {
  try {
    localStorage.setItem('imagetoasset_lang', lang);
    document.documentElement.lang = lang;
  } catch {
    // Ignore storage errors
  }
};
