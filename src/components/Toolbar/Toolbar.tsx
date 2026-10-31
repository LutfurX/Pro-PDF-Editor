import React, { useRef } from 'react';
import {
  FileUp,
  Undo2,
  Redo2,
  MousePointer2,
  Type,
  FilePenLine,
  ImagePlus,
  PenTool,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Save,
  Download,
  Sun,
  Moon,
  Home,
} from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import { useHistory } from '../../hooks/useHistory';
import { usePDF } from '../../hooks/usePDF';
import { useEditor } from '../../hooks/useEditor';
import type { ActiveTool } from '../../types/editor';

interface ToolbarProps {
  onFitPage: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ onFitPage }) => {
  const openPdfInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const documentName = useEditorStore((s) => s.documentName);
  const activeTool = useEditorStore((s) => s.activeTool);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);
  const zoom = useEditorStore((s) => s.zoom);
  const setZoom = useEditorStore((s) => s.setZoom);
  const theme = useEditorStore((s) => s.theme);
  const toggleTheme = useEditorStore((s) => s.toggleTheme);
  const hasUnsavedChanges = useEditorStore((s) => s.hasUnsavedChanges);
  const markSavedCheckpoint = useEditorStore((s) => s.markSavedCheckpoint);
  const setSignatureModalOpen = useEditorStore((s) => s.setSignatureModalOpen);
  const setExportDialogOpen = useEditorStore((s) => s.setExportDialogOpen);
  const closeDocument = useEditorStore((s) => s.closeDocument);
  const addToast = useEditorStore((s) => s.addToast);

  const { canUndo, canRedo, undo, redo } = useHistory();
  const { openPdfFile } = usePDF();
  const { insertImageFile } = useEditor();

  const handleOpenFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void openPdfFile(file);
      e.target.value = '';
    }
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void insertImageFile(file, 'image');
      e.target.value = '';
    }
  };

  const handleSelectTool = (tool: ActiveTool) => {
    if (tool === 'image') {
      setActiveTool('image');
      imageInputRef.current?.click();
      return;
    }
    if (tool === 'signature') {
      setActiveTool('signature');
      setSignatureModalOpen(true);
      return;
    }
    setActiveTool(tool);
  };

  const handleSaveSession = () => {
    markSavedCheckpoint();
    addToast({
      kind: 'success',
      title: 'Changes Committed',
      message:
        'All page and text edits are committed in workspace memory. Click Download PDF to save to disk.',
    });
  };

  const toolButtons: Array<{
    id: ActiveTool;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'select', label: 'Select', icon: MousePointer2 },
    { id: 'edit-pdf-text', label: 'Edit PDF Text', icon: FilePenLine },
    { id: 'text', label: 'Text Tool', icon: Type },
    { id: 'image', label: 'Image', icon: ImagePlus },
    { id: 'signature', label: 'Signature', icon: PenTool },
  ];

  return (
    <header className="h-14 px-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 select-none shrink-0 z-20">
      {/* Hidden native file inputs */}
      <input
        ref={openPdfInputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleOpenFileChange}
        className="sr-only"
        aria-label="Open PDF file"
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleImageFileChange}
        className="sr-only"
        aria-label="Insert image file"
      />

      {/* Left: Brand + Document Title + Open PDF + Undo/Redo */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={closeDocument}
          title="Return to Welcome Screen"
          aria-label="Return to Welcome Screen"
          className="inline-flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
        >
          <Home className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
            ProPDF Studio
          </span>
        </button>

        <span
          className="hidden xl:inline-block text-xs text-slate-500 dark:text-slate-400 truncate max-w-[170px]"
          title={documentName}
        >
          / {documentName}
          {hasUnsavedChanges ? ' *' : ''}
        </span>

        <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 mx-0.5 shrink-0" />

        <button
          type="button"
          onClick={() => openPdfInputRef.current?.click()}
          aria-label="Open PDF"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <FileUp className="w-4 h-4" />
          <span className="hidden sm:inline">Open PDF</span>
        </button>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            aria-label="Undo"
            title="Undo (Ctrl+Z)"
            className="p-1.5 rounded-md text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            aria-label="Redo"
            title="Redo (Ctrl+Y)"
            className="p-1.5 rounded-md text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Center: Editing Tools */}
      <div
        role="toolbar"
        aria-label="PDF Editing Tools"
        className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-lg overflow-x-auto"
      >
        {toolButtons.map(({ id, label, icon: Icon }) => {
          const isActive = activeTool === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => handleSelectTool(id)}
              aria-pressed={isActive}
              aria-label={label}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden md:inline">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Right: Zoom + Theme + Save + Download PDF */}
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="hidden sm:flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800/80 rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => setZoom(zoom - 0.15)}
            aria-label="Zoom Out"
            title="Zoom Out"
            className="p-1.5 rounded-md text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-900 transition-colors cursor-pointer"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="px-2 text-xs font-mono font-medium text-slate-700 dark:text-slate-200 tabular-nums whitespace-nowrap">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom(zoom + 0.15)}
            aria-label="Zoom In"
            title="Zoom In"
            className="p-1.5 rounded-md text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-900 transition-colors cursor-pointer"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onFitPage}
            aria-label="Fit Page"
            title="Fit Page to Workspace"
            className="p-1.5 rounded-md text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-900 transition-colors cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={
            theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'
          }
          title="Toggle Light/Dark Theme"
          className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          {theme === 'light' ? (
            <Moon className="w-4 h-4" />
          ) : (
            <Sun className="w-4 h-4" />
          )}
        </button>

        <button
          type="button"
          onClick={handleSaveSession}
          aria-label="Save"
          title="Commit edits in workspace"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Save className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">Save</span>
        </button>

        <button
          type="button"
          onClick={() => setExportDialogOpen(true)}
          aria-label="Download PDF"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download PDF</span>
        </button>
      </div>
    </header>
  );
};
