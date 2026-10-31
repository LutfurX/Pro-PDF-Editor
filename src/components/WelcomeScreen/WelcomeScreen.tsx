import React, { useRef, useState } from 'react';
import {
  FileText,
  Upload,
  ScanLine,
  ShieldCheck,
  Clock,
  Trash2,
  Sun,
  Moon,
  Languages,
  Layers,
  PenTool,
} from 'lucide-react';
import { usePDF } from '../../hooks/usePDF';
import { useEditorStore } from '../../store/editorStore';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export const WelcomeScreen: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const { openPdfFile, loadSampleMultiPage, loadSampleScanned } = usePDF();
  const recentDocuments = useEditorStore((s) => s.recentDocuments);
  const clearRecentDocuments = useEditorStore((s) => s.clearRecentDocuments);
  const isLoading = useEditorStore((s) => s.isLoadingDocument);
  const loadingProgress = useEditorStore((s) => s.loadingProgress);
  const loadingMessage = useEditorStore((s) => s.loadingMessage);
  const theme = useEditorStore((s) => s.theme);
  const toggleTheme = useEditorStore((s) => s.toggleTheme);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void openPdfFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void openPdfFile(file);
      e.target.value = '';
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Top Bar Contract: 3 zones */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <a
          href="#top"
          className="text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
        >
          ProPDF Studio
        </a>

        <nav
          aria-label="Workspace features"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300"
        >
          <a
            href="#upload-workspace"
            className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Open Document
          </a>
          <a
            href="#sample-documents"
            className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Sample Files
          </a>
          <a
            href="#recent-files"
            className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Recent History
          </a>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={
              theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'
            }
            className="inline-flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {theme === 'light' ? (
              <>
                <Moon className="w-4 h-4" />
                <span>Dark Mode</span>
              </>
            ) : (
              <>
                <Sun className="w-4 h-4" />
                <span>Light Mode</span>
              </>
            )}
          </button>
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <Upload className="w-4 h-4" />
            <span>Upload PDF</span>
          </button>
        </div>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleFileChange}
        className="sr-only"
        aria-label="Upload PDF file"
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 space-y-10">
        {/* Hero + Primary Dropzone */}
        <section id="upload-workspace" className="grid lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-5 flex flex-col justify-between py-2 space-y-6">
            <div className="space-y-4">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Local Browser PDF Engine · Zero Cloud Transmission · True Vector Export
              </p>
              <h1
                className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight"
                style={{ textWrap: 'balance' }}
              >
                Precision PDF Editing, Typography & Page Control
              </h1>
              <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                Inspect and replace existing PDF text, position English and Bengali
                typography with embedded OpenType fonts, add handwritten signatures,
                run optical character recognition on scans, and export genuine PDFs.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  <Languages className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>English & Bengali</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Embedded Noto Sans/Serif Bengali & custom TTF/OTF support.
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>100% On-Device</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Documents stay strictly inside browser memory.
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>Page Operations</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Add, duplicate, rotate, reorder, and merge PDF pages.
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  <PenTool className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>Sign & Export</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Draw signatures, insert images, and export via pdf-lib.
                </p>
              </div>
            </div>
          </div>

          {/* Interactive Dropzone */}
          <div className="lg:col-span-7 flex">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`w-full rounded-xl border-2 border-dashed p-8 flex flex-col items-center justify-center text-center transition-colors ${
                isDragging
                  ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/30'
                  : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-400 dark:hover:border-slate-600'
              }`}
            >
              {isLoading ? (
                <div className="w-full max-w-sm space-y-4 py-6">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
                    <FileText className="w-6 h-6 animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {loadingMessage || 'Loading PDF...'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {loadingProgress}% complete
                    </p>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-transform duration-150 origin-left"
                      style={{
                        transform: `scaleX(${Math.max(0.05, loadingProgress / 100)})`,
                      }}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center mb-4">
                    <Upload className="w-6 h-6" />
                  </div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Drop a PDF file here, or browse from your device
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md">
                    Supports multi-page vector PDFs, forms, and scanned documents (.pdf).
                    Processed locally in your browser.
                  </p>
                  <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Choose PDF File</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void loadSampleMultiPage()}
                      className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Open Sample Proposal (3 Pages)</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Quick-Start Sample Documents */}
        <section id="sample-documents" className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Interactive Verification Samples
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Generated locally with pdf-lib
            </span>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Vector PDF · 3 Pages · Selectable Text
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  Northstar Consulting Proposal & Schedule
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Ideal for testing existing PDF text replacement, English and Bengali
                  text insertion, signatures, and page reordering.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadSampleMultiPage()}
                className="px-3.5 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Open PDF
              </button>
            </div>

            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Raster Image PDF · 1 Page · Zero Vector Text
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  Scanned Archival Dispatch Notice (OCR Demo)
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Contains a flat-bed raster scan with no embedded text layer to test
                  automatic scan detection and Tesseract.js OCR.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadSampleScanned()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ScanLine className="w-3.5 h-3.5" />
                <span>Test Scan & OCR</span>
              </button>
            </div>
          </div>
        </section>

        {/* Recent Documents (Local Metadata Only) */}
        <section id="recent-files" className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Recent Documents
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                · Local metadata only
              </span>
            </div>
            {recentDocuments.length > 0 && (
              <button
                type="button"
                onClick={clearRecentDocuments}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear History</span>
              </button>
            )}
          </div>

          {recentDocuments.length === 0 ? (
            <div className="py-8 px-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No recent documents opened in this browser yet. Upload a PDF or open a
                sample above to start editing.
              </p>
            </div>
          ) : (
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <th className="py-2.5 px-4">Document Name</th>
                    <th className="py-2.5 px-4 text-right">Pages</th>
                    <th className="py-2.5 px-4 text-right">File Size</th>
                    <th className="py-2.5 px-4 text-right">Last Opened</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  {recentDocuments.map((doc) => (
                    <tr
                      key={doc.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-slate-100">
                        {doc.name}
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-600 dark:text-slate-300 tabular-nums font-mono text-xs">
                        {doc.pageCount}
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-600 dark:text-slate-300 tabular-nums font-mono text-xs">
                        {formatBytes(doc.fileSizeBytes)}
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-500 dark:text-slate-400 tabular-nums text-xs">
                        {formatDate(doc.lastOpenedIso)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      <footer className="py-4 px-6 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-4">
        <span>ProPDF Studio — Client-Side PDF Editing Workspace</span>
        <span>All PDF parsing, OCR, font embedding, and exporting run locally in your browser.</span>
      </footer>
    </div>
  );
};
