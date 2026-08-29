import React from 'react';
import { X, Image as ImageIcon, ArrowRight } from 'lucide-react';

interface SampleImagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSample: (imagePath: string, presetId?: string) => void;
}

export const SampleImagesModal: React.FC<SampleImagesModalProps> = ({
  isOpen,
  onClose,
  onSelectSample,
}) => {
  if (!isOpen) return null;

  const samples = [
    {
      id: 'books',
      name: 'Референс 1: Книги (Books Stack)',
      desc: 'Класичний газетний растр із товстою рваною паперовою обвідкою',
      path: '/samples/books_reference.jpg',
      presetId: 'high-contrast-books',
      tag: 'Heavy Ink',
    },
    {
      id: 'brain',
      name: 'Референс 2: Мозок (Brain Graphic)',
      desc: 'Дрібні щільні крапки з високим рівнем деталізації та органічним контуром',
      path: '/samples/brain_reference.jpg',
      presetId: 'fine-halftone-brain',
      tag: 'Fine Halftone',
    },
    {
      id: 'camera',
      name: 'Референс 3: Рука з камерою (Hand Camera)',
      desc: 'Півтоновий градієнт тіней на руці та чіткий білий стікерний край',
      path: '/samples/camera_reference.jpg',
      presetId: 'vintage-reference',
      tag: 'Engraving & Dots',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-[#151922] border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                Референсні зразки проєкту
              </h3>
              <p className="text-xs text-slate-400">
                Оберіть будь-який зразок для тестування алгоритму стилізації
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List of samples */}
        <div className="p-6 grid grid-cols-3 gap-4">
          {samples.map((sample) => (
            <div
              key={sample.id}
              onClick={() => {
                onSelectSample(sample.path, sample.presetId);
                onClose();
              }}
              className="group bg-slate-900/60 border border-slate-800/80 hover:border-indigo-500/60 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/10 flex flex-col"
            >
              <div className="relative aspect-square bg-[#1e2330] overflow-hidden flex items-center justify-center p-2">
                <img
                  src={sample.path}
                  alt={sample.name}
                  className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                />
                <span className="absolute top-2 right-2 text-[10px] font-mono px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-slate-200 border border-white/10">
                  {sample.tag}
                </span>
              </div>
              <div className="p-3 flex-1 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-slate-200 group-hover:text-indigo-400 transition mb-1">
                    {sample.name}
                  </h4>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    {sample.desc}
                  </p>
                </div>
                <div className="mt-3 flex items-center gap-1 text-[11px] font-medium text-indigo-400 opacity-0 group-hover:opacity-100 transition">
                  <span>Завантажити у редактор</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
