import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ScanLine,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import { useEditor } from '../../hooks/useEditor';
import {
  renderPageToCanvas,
  sampleCanvasBackgroundHex,
} from '../../services/pdfRenderer';
import { extractPageTextRegions } from '../../services/pdfTextExtractor';
import {
  recognizeScannedPageText,
  type OcrLanguageOption,
} from '../../services/ocrService';
import { getPageDisplayDimensions } from '../../utils/coordinateConverter';
import { FabricOverlayCanvas } from '../TextEditor/FabricOverlayCanvas';
import { ExistingTextPopover } from '../TextEditor/ExistingTextPopover';

interface PDFViewerProps {
  workspaceRef: React.RefObject<HTMLDivElement | null>;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({ workspaceRef }) => {
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);

  const [ocrLang, setOcrLang] = useState<OcrLanguageOption>('eng');
  const [isRunningOcr, setIsRunningOcr] = useState(false);
  const [ocrProgressText, setOcrProgressText] = useState('');
  const [ocrPercent, setOcrPercent] = useState(0);
  const [sampledBgForPopover, setSampledBgForPopover] = useState('#FFFFFF');

  const pages = useEditorStore((s) => s.pages);
  const currentPageIndex = useEditorStore((s) => s.currentPageIndex);
  const sourceBytesMap = useEditorStore((s) => s.sourceBytesMap);
  const zoom = useEditorStore((s) => s.zoom);
  const activeTool = useEditorStore((s) => s.activeTool);
  const extractedTextByPage = useEditorStore((s) => s.extractedTextByPage);
  const showExtractedTextRegions = useEditorStore(
    (s) => s.showExtractedTextRegions
  );
  const setShowExtractedTextRegions = useEditorStore(
    (s) => s.setShowExtractedTextRegions
  );
  const selectedObjectId = useEditorStore((s) => s.selectedObjectId);
  const setSelectedObjectId = useEditorStore((s) => s.setSelectedObjectId);
  const editingExtractedItem = useEditorStore((s) => s.editingExtractedItem);
  const setEditingExtractedItem = useEditorStore(
    (s) => s.setEditingExtractedItem
  );
  const setCurrentPageIndex = useEditorStore((s) => s.setCurrentPageIndex);
  const setExtractedTextForPage = useEditorStore(
    (s) => s.setExtractedTextForPage
  );
  const applyOcrResultsToPage = useEditorStore((s) => s.applyOcrResultsToPage);
  const customFonts = useEditorStore((s) => s.customFonts);
  const addToast = useEditorStore((s) => s.addToast);

  const {
    currentPage,
    currentPageObjects,
    insertTextAt,
    commitExtractedTextReplacement,
    updateObject,
  } = useEditor();

  // 1. Render PDF page onto background canvas whenever page, rotation, or zoom changes
  useEffect(() => {
    const canvas = pdfCanvasRef.current;
    if (!currentPage || !canvas) return;

    let cancelled = false;
    renderPageToCanvas(currentPage, sourceBytesMap, canvas, zoom).catch(
      (err: unknown) => {
        if (!cancelled) {
          addToast({
            kind: 'error',
            title: 'Page Render Error',
            message:
              (err as { message?: string })?.message ||
              'Failed to render PDF page.',
          });
        }
      }
    );

    return () => {
      cancelled = true;
    };
  }, [currentPage, sourceBytesMap, zoom, addToast]);

  // 2. Extract selectable text regions for current page if not yet cached
  useEffect(() => {
    if (!currentPage) return;
    if (extractedTextByPage[currentPage.id] !== undefined) return;

    let cancelled = false;
    extractPageTextRegions(currentPage, sourceBytesMap)
      .then(({ items, isScannedCandidate }) => {
        if (!cancelled) {
          setExtractedTextForPage(currentPage.id, items, isScannedCandidate);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setExtractedTextForPage(currentPage.id, [], false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentPage, sourceBytesMap, extractedTextByPage, setExtractedTextForPage]);

  if (!currentPage) {
    return (
      <main className="flex-1 flex items-center justify-center bg-slate-100 dark:bg-slate-950 text-slate-500">
        No page selected.
      </main>
    );
  }

  const displayDims = getPageDisplayDimensions(currentPage);
  const canvasWidthPx = Math.round(displayDims.width * zoom);
  const canvasHeightPx = Math.round(displayDims.height * zoom);
  const extractedItems = extractedTextByPage[currentPage.id] || [];

  const replacedRegionIds = new Set(
    currentPageObjects
      .filter((o) => o.type === 'text-replacement' && o.sourceRegionId)
      .map((o) =>
        o.type === 'text-replacement' ? o.sourceRegionId! : ''
      )
  );

  const handleRunOcr = async () => {
    if (isRunningOcr) return;
    setIsRunningOcr(true);
    setOcrPercent(5);
    setOcrProgressText('Preparing scanned page...');

    try {
      const result = await recognizeScannedPageText({
        pageDesc: currentPage,
        sourceBytesMap,
        language: ocrLang,
        onProgress: ({ status, progress }) => {
          setOcrProgressText(status);
          setOcrPercent(progress);
        },
      });

      if (result.objects.length === 0) {
        addToast({
          kind: 'warning',
          title: 'No Text Detected by OCR',
          message:
            'Tesseract completed, but no recognizable text regions were found on this page.',
        });
      } else {
        applyOcrResultsToPage(currentPage.id, result.objects);
        addToast({
          kind: 'success',
          title: 'OCR Completed',
          message: `Extracted ${result.objects.length} editable text line${
            result.objects.length === 1 ? '' : 's'
          } (avg confidence ${Math.round(result.averageConfidence)}%).`,
        });
      }
    } catch (err: unknown) {
      addToast({
        kind: 'error',
        title: 'OCR Failed',
        message:
          (err as { message?: string })?.message ||
          'Optical character recognition encountered an error.',
      });
    } finally {
      setIsRunningOcr(false);
    }
  };

  const isEditPdfTextMode = activeTool === 'edit-pdf-text';

  return (
    <main
      ref={workspaceRef}
      aria-label="PDF Document Workspace"
      className="flex-1 relative overflow-auto bg-slate-200/75 dark:bg-slate-950 flex flex-col items-center p-6"
    >
      {/* Contextual Mode / Scanned OCR Banner */}
      <div className="w-full max-w-4xl mb-4 space-y-2 shrink-0">
        {currentPage.isScannedCandidate && (
          <div
            role="region"
            aria-label="Scanned PDF OCR Notice"
            className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 px-4 py-3 flex flex-wrap items-center justify-between gap-3"
          >
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-950 dark:text-amber-200">
                <ScanLine className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
                <span>
                  This page appears to contain scanned content. OCR is required to recognize its text.
                </span>
              </div>
              <p className="text-xs text-amber-800/90 dark:text-amber-300/80">
                OCR is optional and keeps your original scanned page intact as background. Recognition accuracy may vary depending on scan quality.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <label htmlFor="ocr-language-select" className="sr-only">
                OCR Language
              </label>
              <select
                id="ocr-language-select"
                value={ocrLang}
                disabled={isRunningOcr}
                onChange={(e) => setOcrLang(e.target.value as OcrLanguageOption)}
                className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
              >
                <option value="eng">English (eng)</option>
                <option value="ben">Bengali / বাংলা (ben)</option>
                <option value="eng+ben">English + Bengali</option>
              </select>

              <button
                type="button"
                disabled={isRunningOcr}
                onClick={() => void handleRunOcr()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                {isRunningOcr ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span className="tabular-nums">{ocrPercent}%</span>
                  </>
                ) : (
                  <>
                    <ScanLine className="w-3.5 h-3.5" />
                    <span>Run OCR</span>
                  </>
                )}
              </button>
            </div>

            {isRunningOcr && (
              <div className="w-full pt-1 space-y-1">
                <div className="flex justify-between text-[11px] text-amber-800 dark:text-amber-300">
                  <span>{ocrProgressText}</span>
                  <span className="font-mono tabular-nums">{ocrPercent}%</span>
                </div>
                <div className="w-full h-1.5 bg-amber-200/70 dark:bg-amber-900/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-600 transition-transform duration-150 origin-left"
                    style={{
                      transform: `scaleX(${Math.max(0.04, ocrPercent / 100)})`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Helpful Existing-Text Region Toggle Bar when vector text exists */}
        {extractedItems.length > 0 && (
          <div className="rounded-lg bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-slate-600 dark:text-slate-300">
              {isEditPdfTextMode ? (
                <>
                  <strong>Edit PDF Text Mode:</strong> Click any highlighted text region below to modify or remove original PDF text.
                </>
              ) : (
                <>
                  Detected <strong className="font-mono tabular-nums">{extractedItems.length}</strong> selectable PDF text regions on this page. Switch to <strong>Edit PDF Text</strong> to replace existing text.
                </>
              )}
            </span>

            <button
              type="button"
              onClick={() => setShowExtractedTextRegions(!showExtractedTextRegions)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
            >
              {showExtractedTextRegions ? (
                <>
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Hide Regions</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  <span>Show Regions</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Centered PDF Page Stage */}
      <div className="my-auto flex items-center justify-center">
        <div
          data-testid="pdf-page-stage"
          style={{
            width: `${canvasWidthPx}px`,
            height: `${canvasHeightPx}px`,
          }}
          className="relative bg-white shadow-md ring-1 ring-slate-300 dark:ring-slate-700 select-none shrink-0"
        >
          {/* Layer 1: Crisp PDF.js Background Canvas */}
          <canvas
            ref={pdfCanvasRef}
            data-testid="pdf-render-canvas"
            className="block absolute inset-0 z-0"
          />

          {/* Layer 2: Selectable Existing PDF Text Regions */}
          {showExtractedTextRegions && extractedItems.length > 0 && (
            <div
              aria-label="Extracted PDF Text Regions"
              className={`absolute inset-0 ${
                isEditPdfTextMode ? 'z-30 pointer-events-auto' : 'z-10 pointer-events-none'
              }`}
            >
              {extractedItems.map((item) => {
                const isAlreadyReplaced = replacedRegionIds.has(item.id);
                if (isAlreadyReplaced) return null;

                const isSelectedForPopover =
                  editingExtractedItem?.id === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-label={`Edit PDF text: ${item.text.slice(0, 60)}`}
                    title={
                      isEditPdfTextMode
                        ? `Click to edit "${item.text}"`
                        : item.text
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      const bgHex = sampleCanvasBackgroundHex(
                        pdfCanvasRef.current,
                        item,
                        zoom
                      );
                      setSampledBgForPopover(bgHex);
                      setEditingExtractedItem(item);
                      setSelectedObjectId(null);
                    }}
                    style={{
                      left: `${item.x * zoom}px`,
                      top: `${item.y * zoom}px`,
                      width: `${Math.max(12, item.width * zoom)}px`,
                      height: `${Math.max(10, item.height * zoom)}px`,
                    }}
                    className={`absolute text-left rounded-[2px] transition-colors cursor-pointer ${
                      isSelectedForPopover
                        ? 'ring-2 ring-blue-600 bg-blue-500/15'
                        : isEditPdfTextMode
                        ? 'border border-dashed border-blue-500/60 bg-blue-500/5 hover:bg-blue-500/15 hover:border-blue-600'
                        : 'border border-dashed border-slate-400/35'
                    }`}
                  />
                );
              })}
            </div>
          )}

          {/* Layer 3: Interactive Fabric.js Overlay Canvas */}
          <FabricOverlayCanvas
            widthPx={canvasWidthPx}
            heightPx={canvasHeightPx}
            zoom={zoom}
            activeTool={activeTool}
            objects={currentPageObjects}
            selectedObjectId={selectedObjectId}
            customFonts={customFonts}
            pointerPassthrough={isEditPdfTextMode}
            onSelectObject={setSelectedObjectId}
            onUpdateObject={updateObject}
            onCanvasClickInsertText={(cx, cy) => {
              insertTextAt(cx, cy, 'New Text');
            }}
          />

          {/* Layer 4: Contextual Popover for Replacing Existing PDF Text */}
          {editingExtractedItem &&
            editingExtractedItem.pageId === currentPage.id && (
              <ExistingTextPopover
                item={editingExtractedItem}
                zoom={zoom}
                sampledBgColor={sampledBgForPopover}
                onCancel={() => setEditingExtractedItem(null)}
                onCommitReplacement={(replacementText, bgColor) => {
                  commitExtractedTextReplacement(
                    editingExtractedItem,
                    replacementText,
                    bgColor
                  );
                  setEditingExtractedItem(null);
                  useEditorStore.getState().setActiveTool('select');
                }}
              />
            )}
        </div>
      </div>

      {/* Bottom Floating Page Navigation Bar */}
      <div className="sticky bottom-2 mt-6 z-30 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-sm text-xs">
        <button
          type="button"
          onClick={() => setCurrentPageIndex(currentPageIndex - 1)}
          disabled={currentPageIndex <= 0}
          aria-label="Previous Page"
          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <span className="font-mono font-medium text-slate-700 dark:text-slate-200 tabular-nums px-1 whitespace-nowrap">
          Page {currentPageIndex + 1} of {pages.length}
        </span>

        <button
          type="button"
          onClick={() => setCurrentPageIndex(currentPageIndex + 1)}
          disabled={currentPageIndex >= pages.length - 1}
          aria-label="Next Page"
          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </main>
  );
};
