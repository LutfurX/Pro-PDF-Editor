import React from 'react';
import {
  RotateCw,
  Copy,
  Trash2,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import type { PageDescriptor } from '../../types/pdf';
import { getEffectivePageRotation } from '../../utils/coordinateConverter';

interface PageThumbnailProps {
  page: PageDescriptor;
  index: number;
  totalPages: number;
  isActive: boolean;
  editCount: number;
  onSelect: () => void;
  onRotate: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, index: number) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>, index: number) => void;
}

export const PageThumbnail: React.FC<PageThumbnailProps> = ({
  page,
  index,
  totalPages,
  isActive,
  editCount,
  onSelect,
  onRotate,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragOver,
  onDrop,
}) => {
  const effectiveRotation = getEffectivePageRotation(page);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, index)}
      className={`group rounded-lg border p-2 transition-colors ${
        isActive
          ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 dark:border-blue-500'
          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-label={`Select Page ${index + 1}`}
        aria-current={isActive ? 'page' : undefined}
        className="w-full text-left focus:outline-none cursor-pointer"
      >
        <div className="relative aspect-[1/1.38] w-full bg-slate-100 dark:bg-slate-800 rounded border border-slate-200/80 dark:border-slate-700 overflow-hidden flex items-center justify-center">
          {page.thumbnailDataUrl ? (
            <img
              src={page.thumbnailDataUrl}
              alt={`Page ${index + 1} preview`}
              referrerPolicy="no-referrer"
              className="max-w-full max-h-full object-contain bg-white"
            />
          ) : (
            <div className="w-4/5 h-5/6 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[11px] font-mono text-slate-400 tabular-nums">
              {page.sourceId === 'blank' ? 'Blank Page' : `Page ${index + 1}`}
            </div>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between text-xs">
          <span
            className={`font-mono font-semibold tabular-nums ${
              isActive
                ? 'text-blue-700 dark:text-blue-400'
                : 'text-slate-700 dark:text-slate-200'
            }`}
          >
            Page {index + 1}
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            {effectiveRotation !== 0 ? `${effectiveRotation}°` : ''}
            {effectiveRotation !== 0 && editCount > 0 ? ' · ' : ''}
            {editCount > 0 ? `${editCount} edit${editCount > 1 ? 's' : ''}` : ''}
          </span>
        </div>
      </button>

      {/* Compact per-page action row */}
      <div className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-0.5">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={index === 0}
          aria-label={`Move Page ${index + 1} up`}
          title="Move Page Up"
          className="p-1 rounded text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
        >
          <ArrowUp className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={index === totalPages - 1}
          aria-label={`Move Page ${index + 1} down`}
          title="Move Page Down"
          className="p-1 rounded text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
        >
          <ArrowDown className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onRotate}
          aria-label={`Rotate Page ${index + 1}`}
          title="Rotate 90° Clockwise"
          className="p-1 rounded text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onDuplicate}
          aria-label={`Duplicate Page ${index + 1}`}
          title="Duplicate Page"
          className="p-1 rounded text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={totalPages <= 1}
          aria-label={`Delete Page ${index + 1}`}
          title={
            totalPages <= 1
              ? 'Cannot delete the only page'
              : 'Delete Page'
          }
          className="p-1 rounded text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
