import { create } from 'zustand';
import type {
  ActiveTool,
  CustomFontAsset,
  EditorObject,
  ToastNotification,
} from '../types/editor';
import type {
  ExtractedTextItem,
  PageDescriptor,
  RecentDocumentMeta,
} from '../types/pdf';
import {
  createBlankPageDescriptor,
  duplicateEditorObject,
  duplicatePageWithObjects,
  reorderPagesList,
  rotatePageDescriptor,
} from '../services/pdfEditor';
import { resolveFontForText } from '../utils/fontManager';

export interface HistorySnapshot {
  pages: PageDescriptor[];
  objectsByPage: Record<string, EditorObject[]>;
  currentPageIndex: number;
}

const MAX_HISTORY_STEPS = 50;
const RECENT_DOCS_STORAGE_KEY = 'propdf_studio_recent_docs_v1';

function cloneObjectsByPage(
  map: Record<string, EditorObject[]>
): Record<string, EditorObject[]> {
  const out: Record<string, EditorObject[]> = {};
  for (const [pageId, list] of Object.entries(map)) {
    out[pageId] = list.map((obj) => ({
      ...obj,
      ...(obj.type === 'text-replacement' && obj.coverRect
        ? { coverRect: { ...obj.coverRect } }
        : {}),
    }));
  }
  return out;
}

function cloneSnapshot(
  pages: PageDescriptor[],
  objectsByPage: Record<string, EditorObject[]>,
  currentPageIndex: number
): HistorySnapshot {
  return {
    pages: pages.map((p) => ({ ...p })),
    objectsByPage: cloneObjectsByPage(objectsByPage),
    currentPageIndex,
  };
}

function loadRecentDocsFromStorage(): RecentDocumentMeta[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_DOCS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 8) : [];
  } catch {
    return [];
  }
}

function persistRecentDocsToStorage(docs: RecentDocumentMeta[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      RECENT_DOCS_STORAGE_KEY,
      JSON.stringify(docs.slice(0, 8))
    );
  } catch {
    // Ignore storage quota errors
  }
}

export interface EditorState {
  // Document & source buffers
  documentLoaded: boolean;
  documentName: string;
  sourceBytesMap: Record<string, Uint8Array>;
  pages: PageDescriptor[];
  currentPageIndex: number;

  // Extracted existing PDF text per pageId
  extractedTextByPage: Record<string, ExtractedTextItem[]>;
  showExtractedTextRegions: boolean;

  // Interactive overlay & replacement objects per pageId
  objectsByPage: Record<string, EditorObject[]>;
  selectedObjectId: string | null;

  // Undo / Redo stacks
  past: HistorySnapshot[];
  future: HistorySnapshot[];
  lastCoalesceKey: string | null;
  lastCoalesceTimestamp: number;
  hasUnsavedChanges: boolean;
  lastSavedAtIso: string | null;

  // Tool & viewport state
  activeTool: ActiveTool;
  zoom: number;
  theme: 'light' | 'dark';
  customFonts: CustomFontAsset[];

  // Loading, modals & notifications
  isLoadingDocument: boolean;
  loadingProgress: number;
  loadingMessage: string;
  isSignatureModalOpen: boolean;
  isExportDialogOpen: boolean;
  editingExtractedItem: ExtractedTextItem | null;
  recentDocuments: RecentDocumentMeta[];
  toasts: ToastNotification[];

  // Actions
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  setActiveTool: (tool: ActiveTool) => void;
  setZoom: (zoom: number) => void;
  setCurrentPageIndex: (index: number) => void;
  setShowExtractedTextRegions: (show: boolean) => void;
  setSelectedObjectId: (id: string | null) => void;
  setEditingExtractedItem: (item: ExtractedTextItem | null) => void;
  setSignatureModalOpen: (open: boolean) => void;
  setExportDialogOpen: (open: boolean) => void;

  setLoadingState: (loading: boolean, progress?: number, message?: string) => void;
  addToast: (toast: Omit<ToastNotification, 'id'>) => void;
  dismissToast: (id: string) => void;

  initializeDocument: (params: {
    name: string;
    sourceId: string;
    bytes: Uint8Array;
    pages: PageDescriptor[];
    fileSizeBytes: number;
  }) => void;
  closeDocument: () => void;
  clearRecentDocuments: () => void;

  setPageThumbnail: (pageId: string, dataUrl: string) => void;
  setExtractedTextForPage: (
    pageId: string,
    items: ExtractedTextItem[],
    isScannedCandidate: boolean
  ) => void;

  addCustomFont: (font: CustomFontAsset) => void;

  // History-tracked editing mutations
  addObject: (obj: EditorObject) => void;
  updateObject: (
    objectId: string,
    patch: Partial<EditorObject>,
    coalesceKey?: string
  ) => void;
  deleteObject: (objectId: string) => void;
  duplicateObject: (objectId: string) => void;

  // Page management mutations (all history-tracked)
  addBlankPage: (afterIndex?: number) => void;
  duplicatePage: (pageIndex: number) => void;
  deletePage: (pageIndex: number) => void;
  rotatePage: (pageIndex: number, deltaDegrees?: 90 | -90) => void;
  reorderPages: (fromIndex: number, toIndex: number) => void;
  importPdfPages: (params: {
    sourceId: string;
    bytes: Uint8Array;
    importedPages: PageDescriptor[];
  }) => void;
  applyOcrResultsToPage: (pageId: string, ocrObjects: EditorObject[]) => void;

  // Undo / Redo / Save checkpoint
  undo: () => void;
  redo: () => void;
  markSavedCheckpoint: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  documentLoaded: false,
  documentName: 'Untitled.pdf',
  sourceBytesMap: {},
  pages: [],
  currentPageIndex: 0,

  extractedTextByPage: {},
  showExtractedTextRegions: true,

  objectsByPage: {},
  selectedObjectId: null,

  past: [],
  future: [],
  lastCoalesceKey: null,
  lastCoalesceTimestamp: 0,
  hasUnsavedChanges: false,
  lastSavedAtIso: null,

  activeTool: 'select',
  zoom: 1.0,
  theme: 'light',
  customFonts: [],

  isLoadingDocument: false,
  loadingProgress: 0,
  loadingMessage: '',
  isSignatureModalOpen: false,
  isExportDialogOpen: false,
  editingExtractedItem: null,
  recentDocuments: loadRecentDocsFromStorage(),
  toasts: [],

  setTheme: (theme) => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }
    set({ theme });
  },

  toggleTheme: () => {
    const next = get().theme === 'light' ? 'dark' : 'light';
    get().setTheme(next);
  },

  setActiveTool: (tool) =>
    set((state) => ({
      activeTool: tool,
      showExtractedTextRegions:
        tool === 'edit-pdf-text' ? true : state.showExtractedTextRegions,
      editingExtractedItem:
        tool === 'edit-pdf-text' || tool === 'select'
          ? state.editingExtractedItem
          : null,
    })),

  setZoom: (zoom) => {
    const clamped = Math.max(0.35, Math.min(3.0, Number(zoom.toFixed(2))));
    set({ zoom: clamped });
  },

  setCurrentPageIndex: (index) =>
    set((state) => {
      if (state.pages.length === 0) return {};
      const safeIdx = Math.max(0, Math.min(state.pages.length - 1, index));
      return {
        currentPageIndex: safeIdx,
        selectedObjectId: null,
        editingExtractedItem: null,
      };
    }),

  setShowExtractedTextRegions: (show) => set({ showExtractedTextRegions: show }),

  setSelectedObjectId: (id) => set({ selectedObjectId: id }),

  setEditingExtractedItem: (item) => set({ editingExtractedItem: item }),

  setSignatureModalOpen: (open) => set({ isSignatureModalOpen: open }),

  setExportDialogOpen: (open) => set({ isExportDialogOpen: open }),

  setLoadingState: (loading, progress = 0, message = '') =>
    set({
      isLoadingDocument: loading,
      loadingProgress: progress,
      loadingMessage: message,
    }),

  addToast: (toast) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    set((state) => ({
      toasts: [...state.toasts.slice(-3), { ...toast, id }],
    }));
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        get().dismissToast(id);
      }, 4500);
    }
  },

  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  initializeDocument: ({ name, sourceId, bytes, pages, fileSizeBytes }) => {
    const initialObjects: Record<string, EditorObject[]> = {};
    for (const p of pages) {
      initialObjects[p.id] = [];
    }

    const meta: RecentDocumentMeta = {
      id: `rec_${Date.now()}`,
      name,
      pageCount: pages.length,
      fileSizeBytes,
      lastOpenedIso: new Date().toISOString(),
    };

    const existingRecent = get().recentDocuments.filter((d) => d.name !== name);
    const updatedRecent = [meta, ...existingRecent].slice(0, 8);
    persistRecentDocsToStorage(updatedRecent);

    set({
      documentLoaded: true,
      documentName: name,
      sourceBytesMap: { [sourceId]: bytes },
      pages,
      currentPageIndex: 0,
      extractedTextByPage: {},
      objectsByPage: initialObjects,
      selectedObjectId: null,
      editingExtractedItem: null,
      past: [],
      future: [],
      lastCoalesceKey: null,
      lastCoalesceTimestamp: 0,
      hasUnsavedChanges: false,
      lastSavedAtIso: null,
      activeTool: 'select',
      zoom: 1.0,
      recentDocuments: updatedRecent,
    });
  },

  closeDocument: () =>
    set({
      documentLoaded: false,
      documentName: 'Untitled.pdf',
      sourceBytesMap: {},
      pages: [],
      currentPageIndex: 0,
      extractedTextByPage: {},
      objectsByPage: {},
      selectedObjectId: null,
      editingExtractedItem: null,
      past: [],
      future: [],
      hasUnsavedChanges: false,
    }),

  clearRecentDocuments: () => {
    persistRecentDocsToStorage([]);
    set({ recentDocuments: [] });
  },

  setPageThumbnail: (pageId, dataUrl) =>
    set((state) => ({
      pages: state.pages.map((p) =>
        p.id === pageId ? { ...p, thumbnailDataUrl: dataUrl } : p
      ),
    })),

  setExtractedTextForPage: (pageId, items, isScannedCandidate) =>
    set((state) => ({
      extractedTextByPage: {
        ...state.extractedTextByPage,
        [pageId]: items,
      },
      pages: state.pages.map((p) =>
        p.id === pageId ? { ...p, isScannedCandidate } : p
      ),
    })),

  addCustomFont: (font) =>
    set((state) => ({
      customFonts: [
        ...state.customFonts.filter((f) => f.familyName !== font.familyName),
        font,
      ],
    })),

  addObject: (obj) =>
    set((state) => {
      const snap = cloneSnapshot(
        state.pages,
        state.objectsByPage,
        state.currentPageIndex
      );
      const currentList = state.objectsByPage[obj.pageId] || [];

      // If replacing an existing sourceRegionId that already had a replacement, replace that replacement
      const filteredList =
        obj.type === 'text-replacement' && obj.sourceRegionId
          ? currentList.filter(
              (existing) =>
                !(
                  existing.type === 'text-replacement' &&
                  existing.sourceRegionId === obj.sourceRegionId
                )
            )
          : currentList;

      return {
        past: [...state.past.slice(-(MAX_HISTORY_STEPS - 1)), snap],
        future: [],
        lastCoalesceKey: null,
        objectsByPage: {
          ...state.objectsByPage,
          [obj.pageId]: [...filteredList, obj],
        },
        selectedObjectId: obj.id,
        hasUnsavedChanges: true,
      };
    }),

  updateObject: (objectId, patch, coalesceKey) =>
    set((state) => {
      let targetPageId: string | null = null;
      let existingObj: EditorObject | null = null;

      for (const [pId, list] of Object.entries(state.objectsByPage)) {
        const found = list.find((o) => o.id === objectId);
        if (found) {
          targetPageId = pId;
          existingObj = found;
          break;
        }
      }

      if (!targetPageId || !existingObj) return {};

      let mergedObj = { ...existingObj, ...patch } as EditorObject;

      // Auto-resolve Bengali font if text or fontFamily changed and lacks Bengali glyphs
      if (
        (mergedObj.type === 'text' || mergedObj.type === 'text-replacement') &&
        ('text' in patch || 'fontFamily' in patch)
      ) {
        const { resolvedFamily } = resolveFontForText(
          mergedObj.fontFamily,
          mergedObj.text,
          state.customFonts
        );
        mergedObj = {
          ...mergedObj,
          fontFamily: resolvedFamily,
        };
      }

      const now = Date.now();
      const shouldCoalesce =
        Boolean(coalesceKey) &&
        state.lastCoalesceKey === `${objectId}:${coalesceKey}` &&
        now - state.lastCoalesceTimestamp < 600 &&
        state.past.length > 0;

      const nextPast = shouldCoalesce
        ? state.past
        : [
            ...state.past.slice(-(MAX_HISTORY_STEPS - 1)),
            cloneSnapshot(state.pages, state.objectsByPage, state.currentPageIndex),
          ];

      return {
        past: nextPast,
        future: [],
        lastCoalesceKey: coalesceKey ? `${objectId}:${coalesceKey}` : null,
        lastCoalesceTimestamp: now,
        objectsByPage: {
          ...state.objectsByPage,
          [targetPageId]: state.objectsByPage[targetPageId].map((o) =>
            o.id === objectId ? mergedObj : o
          ),
        },
        hasUnsavedChanges: true,
      };
    }),

  deleteObject: (objectId) =>
    set((state) => {
      let targetPageId: string | null = null;
      for (const [pId, list] of Object.entries(state.objectsByPage)) {
        if (list.some((o) => o.id === objectId)) {
          targetPageId = pId;
          break;
        }
      }
      if (!targetPageId) return {};

      const snap = cloneSnapshot(
        state.pages,
        state.objectsByPage,
        state.currentPageIndex
      );

      return {
        past: [...state.past.slice(-(MAX_HISTORY_STEPS - 1)), snap],
        future: [],
        lastCoalesceKey: null,
        objectsByPage: {
          ...state.objectsByPage,
          [targetPageId]: state.objectsByPage[targetPageId].filter(
            (o) => o.id !== objectId
          ),
        },
        selectedObjectId:
          state.selectedObjectId === objectId ? null : state.selectedObjectId,
        hasUnsavedChanges: true,
      };
    }),

  duplicateObject: (objectId) =>
    set((state) => {
      let targetPageId: string | null = null;
      let sourceObj: EditorObject | null = null;
      for (const [pId, list] of Object.entries(state.objectsByPage)) {
        const found = list.find((o) => o.id === objectId);
        if (found) {
          targetPageId = pId;
          sourceObj = found;
          break;
        }
      }
      if (!targetPageId || !sourceObj) return {};

      const snap = cloneSnapshot(
        state.pages,
        state.objectsByPage,
        state.currentPageIndex
      );
      const dup = duplicateEditorObject(sourceObj);

      return {
        past: [...state.past.slice(-(MAX_HISTORY_STEPS - 1)), snap],
        future: [],
        lastCoalesceKey: null,
        objectsByPage: {
          ...state.objectsByPage,
          [targetPageId]: [...state.objectsByPage[targetPageId], dup],
        },
        selectedObjectId: dup.id,
        hasUnsavedChanges: true,
      };
    }),

  addBlankPage: (afterIndex) =>
    set((state) => {
      const snap = cloneSnapshot(
        state.pages,
        state.objectsByPage,
        state.currentPageIndex
      );
      const insertAfter =
        afterIndex !== undefined ? afterIndex : state.currentPageIndex;
      const refPage = state.pages[insertAfter] || state.pages[0];
      const blankPage = createBlankPageDescriptor(refPage);

      const nextPages = [...state.pages];
      const targetIndex = Math.min(nextPages.length, Math.max(0, insertAfter + 1));
      nextPages.splice(targetIndex, 0, blankPage);

      return {
        past: [...state.past.slice(-(MAX_HISTORY_STEPS - 1)), snap],
        future: [],
        lastCoalesceKey: null,
        pages: nextPages,
        objectsByPage: {
          ...state.objectsByPage,
          [blankPage.id]: [],
        },
        currentPageIndex: targetIndex,
        selectedObjectId: null,
        editingExtractedItem: null,
        hasUnsavedChanges: true,
      };
    }),

  duplicatePage: (pageIndex) =>
    set((state) => {
      if (pageIndex < 0 || pageIndex >= state.pages.length) return {};
      const snap = cloneSnapshot(
        state.pages,
        state.objectsByPage,
        state.currentPageIndex
      );
      const result = duplicatePageWithObjects(
        state.pages,
        state.objectsByPage,
        pageIndex
      );

      // Copy extracted text items for the duplicated page as well so existing text remains editable
      const origPage = state.pages[pageIndex];
      const origExtracted = state.extractedTextByPage[origPage.id] || [];
      const clonedExtracted = origExtracted.map((item, idx) => ({
        ...item,
        id: `txt_${result.newPageId}_${idx}`,
        pageId: result.newPageId,
      }));

      return {
        past: [...state.past.slice(-(MAX_HISTORY_STEPS - 1)), snap],
        future: [],
        lastCoalesceKey: null,
        pages: result.pages,
        objectsByPage: result.objectsByPage,
        extractedTextByPage: {
          ...state.extractedTextByPage,
          [result.newPageId]: clonedExtracted,
        },
        currentPageIndex: pageIndex + 1,
        selectedObjectId: null,
        editingExtractedItem: null,
        hasUnsavedChanges: true,
      };
    }),

  deletePage: (pageIndex) =>
    set((state) => {
      if (state.pages.length <= 1) {
        return {};
      }
      if (pageIndex < 0 || pageIndex >= state.pages.length) return {};

      const snap = cloneSnapshot(
        state.pages,
        state.objectsByPage,
        state.currentPageIndex
      );
      const removed = state.pages[pageIndex];
      const nextPages = state.pages.filter((_, i) => i !== pageIndex);
      const nextObjects = { ...state.objectsByPage };
      delete nextObjects[removed.id];

      const nextIndex = Math.min(
        nextPages.length - 1,
        state.currentPageIndex >= pageIndex
          ? Math.max(0, state.currentPageIndex - (state.currentPageIndex > pageIndex ? 1 : 0))
          : state.currentPageIndex
      );

      return {
        past: [...state.past.slice(-(MAX_HISTORY_STEPS - 1)), snap],
        future: [],
        lastCoalesceKey: null,
        pages: nextPages,
        objectsByPage: nextObjects,
        currentPageIndex: nextIndex,
        selectedObjectId: null,
        editingExtractedItem: null,
        hasUnsavedChanges: true,
      };
    }),

  rotatePage: (pageIndex, deltaDegrees = 90) =>
    set((state) => {
      const target = state.pages[pageIndex];
      if (!target) return {};
      const snap = cloneSnapshot(
        state.pages,
        state.objectsByPage,
        state.currentPageIndex
      );
      const rotated = rotatePageDescriptor(target, deltaDegrees);
      // Clear cached thumbnail & extracted text for this page so they re-compute at the new rotation
      rotated.thumbnailDataUrl = undefined;
      const nextExtracted = { ...state.extractedTextByPage };
      delete nextExtracted[target.id];

      return {
        past: [...state.past.slice(-(MAX_HISTORY_STEPS - 1)), snap],
        future: [],
        lastCoalesceKey: null,
        pages: state.pages.map((p, i) => (i === pageIndex ? rotated : p)),
        extractedTextByPage: nextExtracted,
        selectedObjectId: null,
        editingExtractedItem: null,
        hasUnsavedChanges: true,
      };
    }),

  reorderPages: (fromIndex, toIndex) =>
    set((state) => {
      const nextPages = reorderPagesList(state.pages, fromIndex, toIndex);
      if (nextPages === state.pages) return {};

      const snap = cloneSnapshot(
        state.pages,
        state.objectsByPage,
        state.currentPageIndex
      );
      const currentActivePageId = state.pages[state.currentPageIndex]?.id;
      const newActiveIndex = Math.max(
        0,
        nextPages.findIndex((p) => p.id === currentActivePageId)
      );

      return {
        past: [...state.past.slice(-(MAX_HISTORY_STEPS - 1)), snap],
        future: [],
        lastCoalesceKey: null,
        pages: nextPages,
        currentPageIndex: newActiveIndex,
        hasUnsavedChanges: true,
      };
    }),

  importPdfPages: ({ sourceId, bytes, importedPages }) =>
    set((state) => {
      const snap = cloneSnapshot(
        state.pages,
        state.objectsByPage,
        state.currentPageIndex
      );
      const nextObjects = { ...state.objectsByPage };
      for (const p of importedPages) {
        nextObjects[p.id] = [];
      }

      const insertAt = state.currentPageIndex + 1;
      const nextPages = [...state.pages];
      nextPages.splice(insertAt, 0, ...importedPages);

      return {
        past: [...state.past.slice(-(MAX_HISTORY_STEPS - 1)), snap],
        future: [],
        lastCoalesceKey: null,
        sourceBytesMap: {
          ...state.sourceBytesMap,
          [sourceId]: bytes,
        },
        pages: nextPages,
        objectsByPage: nextObjects,
        currentPageIndex: insertAt,
        selectedObjectId: null,
        hasUnsavedChanges: true,
      };
    }),

  applyOcrResultsToPage: (pageId, ocrObjects) =>
    set((state) => {
      const snap = cloneSnapshot(
        state.pages,
        state.objectsByPage,
        state.currentPageIndex
      );
      const existing = state.objectsByPage[pageId] || [];
      return {
        past: [...state.past.slice(-(MAX_HISTORY_STEPS - 1)), snap],
        future: [],
        lastCoalesceKey: null,
        pages: state.pages.map((p) =>
          p.id === pageId ? { ...p, ocrCompleted: true } : p
        ),
        objectsByPage: {
          ...state.objectsByPage,
          [pageId]: [...existing, ...ocrObjects],
        },
        selectedObjectId: ocrObjects[0]?.id ?? null,
        hasUnsavedChanges: true,
      };
    }),

  undo: () =>
    set((state) => {
      if (state.past.length === 0) return {};
      const previous = state.past[state.past.length - 1];
      const currentSnap = cloneSnapshot(
        state.pages,
        state.objectsByPage,
        state.currentPageIndex
      );

      // Preserve generated thumbnails across undo so sidebar doesn't flicker
      const thumbById = new Map(
        state.pages
          .filter((p) => p.thumbnailDataUrl)
          .map((p) => [p.id, p.thumbnailDataUrl!])
      );
      const restoredPages = previous.pages.map((p) => ({
        ...p,
        thumbnailDataUrl: p.thumbnailDataUrl || thumbById.get(p.id),
      }));

      return {
        past: state.past.slice(0, -1),
        future: [currentSnap, ...state.future.slice(0, MAX_HISTORY_STEPS - 1)],
        lastCoalesceKey: null,
        pages: restoredPages,
        objectsByPage: cloneObjectsByPage(previous.objectsByPage),
        currentPageIndex: Math.min(
          Math.max(0, previous.currentPageIndex),
          Math.max(0, restoredPages.length - 1)
        ),
        selectedObjectId: null,
        editingExtractedItem: null,
        hasUnsavedChanges: true,
      };
    }),

  redo: () =>
    set((state) => {
      if (state.future.length === 0) return {};
      const next = state.future[0];
      const currentSnap = cloneSnapshot(
        state.pages,
        state.objectsByPage,
        state.currentPageIndex
      );

      const thumbById = new Map(
        state.pages
          .filter((p) => p.thumbnailDataUrl)
          .map((p) => [p.id, p.thumbnailDataUrl!])
      );
      const restoredPages = next.pages.map((p) => ({
        ...p,
        thumbnailDataUrl: p.thumbnailDataUrl || thumbById.get(p.id),
      }));

      return {
        past: [...state.past, currentSnap],
        future: state.future.slice(1),
        lastCoalesceKey: null,
        pages: restoredPages,
        objectsByPage: cloneObjectsByPage(next.objectsByPage),
        currentPageIndex: Math.min(
          Math.max(0, next.currentPageIndex),
          Math.max(0, restoredPages.length - 1)
        ),
        selectedObjectId: null,
        editingExtractedItem: null,
        hasUnsavedChanges: true,
      };
    }),

  markSavedCheckpoint: () =>
    set({
      hasUnsavedChanges: false,
      lastSavedAtIso: new Date().toISOString(),
    }),
}));
