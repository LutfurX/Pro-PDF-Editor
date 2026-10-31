import React, { useEffect, useState } from 'react';
import { Download, X, Loader2, FileCheck2, AlertTriangle } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import {
  exportEditedPdf,
  triggerPdfBlobDownload,
} from '../../services/pdfExporter';
import { parsePageRange } from '../../utils/coordinateConverter';

export const ExportDialog: React.FC = () => {
  const isOpen = useEditorStore((s) => s.isExportDialogOpen);
  const setExportDialogOpen = useEditorStore((s) => s.setExportDialogOpen);
  const documentName = useEditorStore((s) => s.documentName);
  const pages = useEditorStore((s) => s.pages);
  const currentPageIndex = useEditorStore((s) => s.currentPageIndex);
  const sourceBytesMap = useEditorStore((s) => s.sourceBytesMap);
  const objectsByPage = useEditorStore((s) => s.objectsByPage);
  const customFonts = useEditorStore((s) => s.customFonts);
  const markSavedCheckpoint = useEditorStore((s) => s.markSavedCheckpoint);
  const addToast = useEditorStore((s) => s.addToast);

  const [fileName, setFileName] = useState('');
  const [scope, setScope] = useState<'all' | 'current' | 'custom'>('all');
  const [customRange, setCustomRange] = useState('1');
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stageText, setStageText] = useState('');
  const [exportWarnings, setExportWarnings] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      const base = documentName.replace(/\.pdf$/i, '');
      setFileName(`${base}-edited.pdf`);
      setScope('all');
      setCustomRange(`1-${pages.length}`);
      setRangeError(null);
      setExportWarnings([]);
      setProgress(0);
      setStageText('');
    }
  }, [isOpen, documentName, pages.length]);

  if (!isOpen) return null;

  const totalEditsCount = Object.values(objectsByPage).reduce(
    (sum, list) => sum + list.length,
    0
  );

  const handleRunExport = async () => {
    setRangeError(null);
    let pageIndices: number[] | undefined;

    if (scope === 'current') {
      pageIndices = [currentPageIndex];
    } else if (scope === 'custom') {
      const parsed = parsePageRange(customRange, pages.length);
      if (parsed.error || parsed.indices.length === 0) {
        setRangeError(parsed.error || 'Invalid page selection.');
        return;
      }
      pageIndices = parsed.indices;
    }

    const trimmedName = fileName.trim() || 'ProPDF-Edited.pdf';
    setIsExporting(true);
    setProgress(5);
    setStageText('Starting export pipeline...');

    try {
      const result = await exportEditedPdf({
        pages,
        pageIndicesToExport: pageIndices,
        sourceBytesMap,
        objectsByPage,
        customFonts,
        onProgress: (pct, stage) => {
          setProgress(pct);
          setStageText(stage);
        },
      });

      setExportWarnings(result.warnings);
      triggerPdfBlobDownload(result.bytes, trimmedName);
      markSavedCheckpoint();

      addToast({
        kind: 'success',
        title: 'PDF Exported Successfully',
        message: `Downloaded "${trimmedName}" (${result.exportedPageCount} page${
          result.exportedPageCount === 1 ? '' : 's'
        }).`,
      });

      if (result.warnings.length === 0) {
        setExportDialogOpen(false);
      }
    } catch (err: unknown) {
      addToast({
        kind: 'error',
        title: 'PDF Export Failed',
        message:
          (err as { message?: string })?.message ||
          'An unexpected error occurred while building the PDF.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Export and Download PDF"
      className="fixed inset-0 z-50 bg-slate-950/55 flex items-center justify-center p-4"
    >
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCheck2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Save As & Export PDF
            </h2>
          </div>
          <button
            type="button"
            disabled={isExporting}
            onClick={() => setExportDialogOpen(false)}
            aria-label="Close export dialog"
            className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {/* Output Filename */}
          <div className="space-y-1.5">
            <label
              htmlFor="export-filename-input"
              className="block font-medium text-slate-700 dark:text-slate-300"
            >
              Output Filename
            </label>
            <input
              id="export-filename-input"
              type="text"
              value={fileName}
              disabled={isExporting}
              onChange={(e) => setFileName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {/* Page Selection Scope */}
          <fieldset className="space-y-2">
            <legend className="font-medium text-slate-700 dark:text-slate-300">
              Pages to Export
            </legend>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2.5 p-2 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer">
                <input
                  type="radio"
                  name="export-scope"
                  checked={scope === 'all'}
                  onChange={() => setScope('all')}
                  className="accent-blue-600"
                />
                <span className="text-slate-800 dark:text-slate-200">
                  All Pages ({pages.length} {pages.length === 1 ? 'page' : 'pages'})
                </span>
              </label>

              <label className="flex items-center gap-2.5 p-2 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer">
                <input
                  type="radio"
                  name="export-scope"
                  checked={scope === 'current'}
                  onChange={() => setScope('current')}
                  className="accent-blue-600"
                />
                <span className="text-slate-800 dark:text-slate-200">
                  Current Page Only (Page {currentPageIndex + 1})
                </span>
              </label>

              <label className="flex items-center gap-2.5 p-2 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer">
                <input
                  type="radio"
                  name="export-scope"
                  checked={scope === 'custom'}
                  onChange={() => setScope('custom')}
                  className="accent-blue-600"
                />
                <span className="text-slate-800 dark:text-slate-200">
                  Selected Page Range
                </span>
              </label>
            </div>

            {scope === 'custom' && (
              <div className="pt-1 space-y-1">
                <input
                  type="text"
                  value={customRange}
                  onChange={(e) => {
                    setCustomRange(e.target.value);
                    setRangeError(null);
                  }}
                  placeholder="e.g. 1-2, 4"
                  aria-label="Custom page range"
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono tabular-nums"
                />
                {rangeError && (
                  <p className="text-red-600 dark:text-red-400 text-[11px]">
                    {rangeError}
                  </p>
                )}
              </div>
            )}
          </fieldset>

          {/* Summary metadata */}
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 p-3 text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
            <div>
              Committed elements across document:{' '}
              <strong className="font-mono tabular-nums">{totalEditsCount}</strong>
            </div>
            <div>
              Preserves original page dimensions, rotations, embedded fonts
              (English & Bengali), images, and signatures via pdf-lib.
            </div>
          </div>

          {exportWarnings.length > 0 && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-3 space-y-1 text-[11px] text-amber-800 dark:text-amber-300">
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Font Fallback Notes</span>
              </div>
              {exportWarnings.map((w, i) => (
                <p key={i}>{w}</p>
              ))}
            </div>
          )}

          {isExporting && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-300">
                <span>{stageText}</span>
                <span className="font-mono tabular-nums">{progress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-transform duration-150 origin-left"
                  style={{
                    transform: `scaleX(${Math.max(0.05, progress / 100)})`,
                  }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={isExporting}
              onClick={() => setExportDialogOpen(false)}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isExporting}
              onClick={() => void handleRunExport()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Building PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Export & Download PDF</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
