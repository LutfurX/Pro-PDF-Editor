import React, { useEffect, useState } from 'react';
import { Check, Eraser, X, AlertTriangle } from 'lucide-react';
import type { ExtractedTextItem } from '../../types/pdf';

interface ExistingTextPopoverProps {
  item: ExtractedTextItem;
  zoom: number;
  sampledBgColor: string;
  onCommitReplacement: (replacementText: string, bgColor: string) => void;
  onCancel: () => void;
}

export const ExistingTextPopover: React.FC<ExistingTextPopoverProps> = ({
  item,
  zoom,
  sampledBgColor,
  onCommitReplacement,
  onCancel,
}) => {
  const [value, setValue] = useState(item.text);
  const [coverColor, setCoverColor] = useState(sampledBgColor || '#FFFFFF');

  useEffect(() => {
    setValue(item.text);
    setCoverColor(sampledBgColor || '#FFFFFF');
  }, [item, sampledBgColor]);

  const topPx = Math.max(8, (item.y + item.height) * zoom + 8);
  const leftPx = Math.max(8, item.x * zoom);

  return (
    <div
      role="dialog"
      aria-label="Edit Existing PDF Text"
      style={{ top: `${topPx}px`, left: `${leftPx}px` }}
      className="absolute z-40 w-80 sm:w-96 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-lg p-3.5 space-y-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold text-slate-900 dark:text-white">
            Replace Existing PDF Text
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Overlay replacement mode · Mapped font: {item.mappedFontFamily} (
            {item.fontSize}pt)
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel text edit"
          className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {item.isUnsupportedFont && (
        <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-[11px] text-amber-800 dark:text-amber-300">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            Original PDF font ({item.rawFontName}) is subset-encoded. Using{' '}
            <strong>{item.mappedFontFamily}</strong> fallback for accurate export.
          </span>
        </div>
      )}

      <div className="space-y-1.5">
        <label
          htmlFor="existing-pdf-text-input"
          className="block text-xs font-medium text-slate-700 dark:text-slate-300"
        >
          Replacement Content (English or বাংলা)
        </label>
        <textarea
          id="existing-pdf-text-input"
          rows={2}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Enter replacement text (leave blank to remove)"
          className="w-full px-2.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
          autoFocus
        />
      </div>

      <div className="flex items-center justify-between gap-2 text-xs">
        <label className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <span>Mask Background</span>
          <input
            type="color"
            value={coverColor}
            onChange={(e) => setCoverColor(e.target.value)}
            aria-label="Original text cover color"
            className="w-6 h-6 rounded border border-slate-300 dark:border-slate-700 cursor-pointer bg-transparent"
          />
        </label>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onCommitReplacement('', coverColor)}
            aria-label="Remove Existing Text"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-md transition-colors whitespace-nowrap cursor-pointer"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>Remove Text</span>
          </button>
          <button
            type="button"
            onClick={() => onCommitReplacement(value, coverColor)}
            aria-label="Apply Text Replacement"
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors whitespace-nowrap cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Apply</span>
          </button>
        </div>
      </div>
    </div>
  );
};
