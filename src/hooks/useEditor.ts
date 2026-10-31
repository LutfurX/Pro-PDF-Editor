import { useCallback, useMemo } from 'react';
import {
  createOverlayTextObject,
  createReplacementFromExtractedItem,
  normalizeImageFileToObject,
} from '../services/pdfEditor';
import { useEditorStore } from '../store/editorStore';
import type { ExtractedTextItem } from '../types/pdf';
import { getPageDisplayDimensions } from '../utils/coordinateConverter';

/**
 * Hook providing high-level object creation and active selection helpers for the current PDF page.
 */
export function useEditor() {
  const pages = useEditorStore((s) => s.pages);
  const currentPageIndex = useEditorStore((s) => s.currentPageIndex);
  const objectsByPage = useEditorStore((s) => s.objectsByPage);
  const selectedObjectId = useEditorStore((s) => s.selectedObjectId);
  const customFonts = useEditorStore((s) => s.customFonts);
  const addObject = useEditorStore((s) => s.addObject);
  const updateObject = useEditorStore((s) => s.updateObject);
  const deleteObject = useEditorStore((s) => s.deleteObject);
  const duplicateObject = useEditorStore((s) => s.duplicateObject);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);
  const addToast = useEditorStore((s) => s.addToast);

  const currentPage = pages[currentPageIndex] ?? null;

  const currentPageObjects = useMemo(() => {
    if (!currentPage) return [];
    return objectsByPage[currentPage.id] || [];
  }, [currentPage, objectsByPage]);

  const selectedObject = useMemo(() => {
    if (!selectedObjectId) return null;
    return currentPageObjects.find((o) => o.id === selectedObjectId) ?? null;
  }, [currentPageObjects, selectedObjectId]);

  const insertTextAt = useCallback(
    (x: number, y: number, initialText = 'Double-click or edit in panel') => {
      if (!currentPage) return null;
      const obj = createOverlayTextObject({
        pageId: currentPage.id,
        x,
        y,
        text: initialText,
        customFonts,
      });
      addObject(obj);
      setActiveTool('select');
      return obj;
    },
    [currentPage, customFonts, addObject, setActiveTool]
  );

  const commitExtractedTextReplacement = useCallback(
    (
      item: ExtractedTextItem,
      replacementText: string,
      sampledBgColor?: string
    ) => {
      const repObj = createReplacementFromExtractedItem(
        item,
        replacementText,
        sampledBgColor,
        customFonts
      );
      addObject(repObj);
      if (item.isUnsupportedFont) {
        addToast({
          kind: 'info',
          title: 'Fallback Font Applied',
          message: `Original embedded font "${item.rawFontName}" was mapped to "${repObj.fontFamily}" for editing.`,
        });
      }
      return repObj;
    },
    [customFonts, addObject, addToast]
  );

  const insertImageFile = useCallback(
    async (file: File, objectType: 'image' | 'signature' = 'image') => {
      if (!currentPage) return null;
      try {
        const dims = getPageDisplayDimensions(currentPage);
        const imgObj = await normalizeImageFileToObject({
          file,
          pageId: currentPage.id,
          objectType,
          pageWidth: dims.width,
          pageHeight: dims.height,
        });
        addObject(imgObj);
        setActiveTool('select');
        addToast({
          kind: 'success',
          title: objectType === 'signature' ? 'Signature Added' : 'Image Added',
          message: 'Drag or use corner handles to position and resize.',
        });
        return imgObj;
      } catch (err: unknown) {
        addToast({
          kind: 'error',
          title: 'Image Upload Error',
          message:
            (err as { message?: string })?.message ||
            'Failed to load image file.',
        });
        return null;
      }
    },
    [currentPage, addObject, setActiveTool, addToast]
  );

  return {
    currentPage,
    currentPageObjects,
    selectedObject,
    insertTextAt,
    commitExtractedTextReplacement,
    insertImageFile,
    updateObject,
    deleteObject,
    duplicateObject,
  };
}
