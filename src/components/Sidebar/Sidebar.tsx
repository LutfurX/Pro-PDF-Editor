import React, { useEffect, useRef, useState } from 'react';
import { FilePlus2, FolderInput } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import { usePDF } from '../../hooks/usePDF';
import { generatePageThumbnail } from '../../services/pdfRenderer';
import { PageThumbnail } from '../PageThumbnail/PageThumbnail';

export const Sidebar: React.FC = () => {
  const importPdfRef = useRef<HTMLInputElement>(null);
  const [dragFromIndex, setDragFromIndex] = useState<number | null>(null);

  const pages = useEditorStore((s) => s.pages);
  const sourceBytesMap = useEditorStore((s) => s.sourceBytesMap);
  const currentPageIndex = useEditorStore((s) => s.currentPageIndex);
  const objectsByPage = useEditorStore((s) => s.objectsByPage);

  const setCurrentPageIndex = useEditorStore((s) => s.setCurrentPageIndex);
  const addBlankPage = useEditorStore((s) => s.addBlankPage);
  const duplicatePage = useEditorStore((s) => s.duplicatePage);
  const deletePage = useEditorStore((s) => s.deletePage);
  const rotatePage = useEditorStore((s) => s.rotatePage);
  const reorderPages = useEditorStore((s) => s.reorderPages);
  const setPageThumbnail = useEditorStore((s) => s.setPageThumbnail);
  const addToast = useEditorStore((s) => s.addToast);

  const { importPagesFromFile } = usePDF();

  // Lazily regenerate missing thumbnails (e.g., after rotating or adding blank page)
  useEffect(() => {
    let cancelled = false;
    for (const page of pages) {
      if (!page.thumbnailDataUrl) {
        generatePageThumbnail(page, sourceBytesMap, 148)
          .then((url) => {
            if (!cancelled && url) {
              setPageThumbnail(page.id, url);
            }
          })
          .catch(() => undefined);
      }
    }
    return () => {
      cancelled = true;
    };
  }, [pages, sourceBytesMap, setPageThumbnail]);

  const handleImportChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void importPagesFromFile(file);
      e.target.value = '';
    }
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, idx: number) => {
    setDragFromIndex(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, toIndex: number) => {
    e.preventDefault();
    if (dragFromIndex !== null && dragFromIndex !== toIndex) {
      reorderPages(dragFromIndex, toIndex);
    }
    setDragFromIndex(null);
  };

  return (
    <aside
      aria-label="Page Thumbnails and Management"
      className="w-56 lg:w-60 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 select-none"
    >
      <input
        ref={importPdfRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleImportChange}
        className="sr-only"
        aria-label="Import pages from PDF"
      />

      <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            Pages
          </h2>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
            {currentPageIndex + 1} / {pages.length}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => {
              addBlankPage(currentPageIndex);
              addToast({
                kind: 'info',
                title: 'Blank Page Added',
                message: `Inserted after Page ${currentPageIndex + 1}.`,
              });
            }}
            aria-label="Add Page"
            className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors whitespace-nowrap cursor-pointer"
          >
            <FilePlus2 className="w-3.5 h-3.5 shrink-0" />
            <span>Add Page</span>
          </button>

          <button
            type="button"
            onClick={() => importPdfRef.current?.click()}
            aria-label="Import PDF Pages"
            className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors whitespace-nowrap cursor-pointer"
          >
            <FolderInput className="w-3.5 h-3.5 shrink-0" />
            <span>Import</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {pages.map((page, idx) => (
          <PageThumbnail
            key={page.id}
            page={page}
            index={idx}
            totalPages={pages.length}
            isActive={idx === currentPageIndex}
            editCount={(objectsByPage[page.id] || []).length}
            onSelect={() => setCurrentPageIndex(idx)}
            onRotate={() => rotatePage(idx, 90)}
            onDuplicate={() => duplicatePage(idx)}
            onDelete={() => deletePage(idx)}
            onMoveUp={() => reorderPages(idx, idx - 1)}
            onMoveDown={() => reorderPages(idx, idx + 1)}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          />
        ))}
      </div>
    </aside>
  );
};
