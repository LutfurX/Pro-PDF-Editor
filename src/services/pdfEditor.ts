import type {
  CustomFontAsset,
  EditorObject,
  ImageEditorObject,
  TextEditorObject,
} from '../types/editor';
import type { ExtractedTextItem, PageDescriptor } from '../types/pdf';
import { normalizePageRotation } from '../utils/coordinateConverter';
import { resolveFontForText } from '../utils/fontManager';

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Creates a brand-new overlay text box at canonical PDF coordinates `(x, y)`.
 */
export function createOverlayTextObject(params: {
  pageId: string;
  x: number;
  y: number;
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  customFonts?: CustomFontAsset[];
}): TextEditorObject {
  const initialText = params.text ?? 'Type here';
  const requestedFamily = params.fontFamily ?? 'Helvetica';
  const { resolvedFamily } = resolveFontForText(
    requestedFamily,
    initialText,
    params.customFonts
  );
  const fontSize = params.fontSize ?? 14;

  return {
    id: makeId('obj_txt'),
    pageId: params.pageId,
    type: 'text',
    text: initialText,
    x: Math.max(4, Math.round(params.x * 10) / 10),
    y: Math.max(4, Math.round(params.y * 10) / 10),
    width: Math.max(120, Math.round(initialText.length * fontSize * 0.62)),
    height: Math.round(fontSize * 1.45),
    rotation: 0,
    opacity: 1,
    fontFamily: resolvedFamily,
    fontSize,
    fontWeight: 'normal',
    fontStyle: 'normal',
    underline: false,
    color: params.color ?? '#0F172A',
    backgroundColor: 'transparent',
    textAlign: 'left',
    lineHeight: 1.22,
  };
}

/**
 * Creates an existing-text replacement object from an `ExtractedTextItem`.
 * Uses tight padding on `coverRect` so adjacent text/lines are never masked,
 * and applies the sampled background color from the PDF page.
 */
export function createReplacementFromExtractedItem(
  item: ExtractedTextItem,
  replacementText?: string,
  sampledBgColor = '#FFFFFF',
  customFonts: CustomFontAsset[] = []
): TextEditorObject {
  const nextText = replacementText !== undefined ? replacementText : item.text;
  const { resolvedFamily } = resolveFontForText(
    item.mappedFontFamily,
    nextText,
    customFonts
  );

  // Tight cover box over original glyph bounds (+1pt horizontal, +0.8pt vertical)
  // to cleanly cover anti-aliased glyph edges without touching neighboring lines/columns.
  const padX = 1.2;
  const padY = 0.8;

  return {
    id: makeId('obj_rep'),
    pageId: item.pageId,
    type: 'text-replacement',
    text: nextText,
    originalText: item.text,
    sourceRegionId: item.id,
    usedFallbackFont: item.isUnsupportedFont,
    x: Number(item.x.toFixed(2)),
    y: Number(item.y.toFixed(2)),
    width: Number(Math.max(item.width + 16, 48).toFixed(2)),
    height: Number(Math.max(item.height, item.fontSize * 1.2).toFixed(2)),
    coverRect: {
      x: Number(Math.max(0, item.x - padX).toFixed(2)),
      y: Number(Math.max(0, item.y - padY).toFixed(2)),
      width: Number((item.width + padX * 2).toFixed(2)),
      height: Number((item.height + padY * 2).toFixed(2)),
      color: sampledBgColor || item.sampledBgColor || '#FFFFFF',
    },
    rotation: 0,
    opacity: 1,
    fontFamily: resolvedFamily,
    fontSize: item.fontSize,
    fontWeight: item.fontWeight,
    fontStyle: item.fontStyle,
    underline: false,
    color: '#0F172A',
    backgroundColor: 'transparent',
    textAlign: 'left',
    lineHeight: 1.18,
  };
}

/**
 * Duplicates any EditorObject with a slight diagonal offset (+14pt, +14pt).
 * Note: duplicating a `text-replacement` converts the duplicate to a standalone `'text'`
 * overlay so it doesn't carry over an unrelated `coverRect`.
 */
export function duplicateEditorObject(obj: EditorObject): EditorObject {
  if (obj.type === 'text' || obj.type === 'text-replacement') {
    return {
      ...obj,
      id: makeId('obj_txt'),
      type: 'text',
      sourceRegionId: undefined,
      originalText: undefined,
      coverRect: undefined,
      x: Number((obj.x + 14).toFixed(2)),
      y: Number((obj.y + 14).toFixed(2)),
    };
  }
  return {
    ...obj,
    id: makeId(obj.type === 'signature' ? 'obj_sig' : 'obj_img'),
    x: Number((obj.x + 14).toFixed(2)),
    y: Number((obj.y + 14).toFixed(2)),
  };
}

/**
 * Reads an uploaded PNG, JPG, or WebP File and normalizes it into a PNG or JPEG
 * data URL (converting WebP via canvas to PNG so pdf-lib embeds it cleanly).
 */
export async function normalizeImageFileToObject(params: {
  file: File;
  pageId: string;
  objectType: 'image' | 'signature';
  pageWidth: number;
  pageHeight: number;
}): Promise<ImageEditorObject> {
  const { file, pageId, objectType, pageWidth, pageHeight } = params;
  const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  if (!validTypes.includes(file.type.toLowerCase())) {
    throw new Error('Unsupported image format. Please upload a PNG, JPG, or WebP file.');
  }

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Invalid or corrupted image file.'));
    el.src = rawDataUrl;
  });

  const naturalWidth = Math.max(1, img.naturalWidth || img.width);
  const naturalHeight = Math.max(1, img.naturalHeight || img.height);

  let finalSrc = rawDataUrl;
  let mimeType: 'image/png' | 'image/jpeg' =
    file.type.toLowerCase() === 'image/jpeg' || file.type.toLowerCase() === 'image/jpg'
      ? 'image/jpeg'
      : 'image/png';

  // Convert WebP (or ensure clean PNG encoding) via offscreen canvas so pdf-lib can embed it directly
  if (file.type.toLowerCase() === 'image/webp') {
    const canvas = document.createElement('canvas');
    canvas.width = naturalWidth;
    canvas.height = naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to initialize canvas for WebP image conversion.');
    }
    ctx.drawImage(img, 0, 0);
    finalSrc = canvas.toDataURL('image/png');
    mimeType = 'image/png';
  }

  const maxTargetW = objectType === 'signature' ? Math.min(200, pageWidth * 0.4) : Math.min(260, pageWidth * 0.5);
  const scale = Math.min(1, maxTargetW / naturalWidth);
  const width = Number(Math.max(36, naturalWidth * scale).toFixed(2));
  const height = Number(Math.max(20, naturalHeight * scale).toFixed(2));

  return {
    id: makeId(objectType === 'signature' ? 'obj_sig' : 'obj_img'),
    pageId,
    type: objectType,
    src: finalSrc,
    mimeType,
    naturalWidth,
    naturalHeight,
    x: Number(Math.max(24, (pageWidth - width) / 2).toFixed(2)),
    y: Number(Math.max(24, (pageHeight - height) / 2).toFixed(2)),
    width,
    height,
    rotation: 0,
    opacity: 1,
  };
}

/**
 * Pure page management helpers (fully unit-testable).
 */
export function createBlankPageDescriptor(
  referencePage?: Pick<PageDescriptor, 'rawWidth' | 'rawHeight'>
): PageDescriptor {
  return {
    id: makeId('page_blank'),
    sourceId: 'blank',
    sourcePageIndex: 0,
    rawWidth: referencePage?.rawWidth ?? 595.28, // Standard A4 points
    rawHeight: referencePage?.rawHeight ?? 841.89,
    originalRotation: 0,
    userRotation: 0,
    mediaBoxX: 0,
    mediaBoxY: 0,
    isScannedCandidate: false,
    ocrCompleted: false,
  };
}

export function rotatePageDescriptor(
  page: PageDescriptor,
  deltaDegrees: 90 | -90 = 90
): PageDescriptor {
  return {
    ...page,
    userRotation: normalizePageRotation(page.userRotation + deltaDegrees),
  };
}

export function reorderPagesList(
  pages: PageDescriptor[],
  fromIndex: number,
  toIndex: number
): PageDescriptor[] {
  if (
    fromIndex < 0 ||
    fromIndex >= pages.length ||
    toIndex < 0 ||
    toIndex >= pages.length ||
    fromIndex === toIndex
  ) {
    return pages;
  }
  const copy = [...pages];
  const [moved] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, moved);
  return copy;
}

export function duplicatePageWithObjects(
  pages: PageDescriptor[],
  objectsByPage: Record<string, EditorObject[]>,
  pageIndex: number
): { pages: PageDescriptor[]; objectsByPage: Record<string, EditorObject[]>; newPageId: string } {
  const sourcePage = pages[pageIndex];
  if (!sourcePage) {
    throw new Error(`Invalid page index ${pageIndex}`);
  }
  const newPageId = makeId('page_dup');
  const duplicatedPage: PageDescriptor = {
    ...sourcePage,
    id: newPageId,
  };

  const nextPages = [...pages];
  nextPages.splice(pageIndex + 1, 0, duplicatedPage);

  const sourceObjs = objectsByPage[sourcePage.id] || [];
  const clonedObjs: EditorObject[] = sourceObjs.map((obj) => ({
    ...obj,
    id: makeId(`obj_${obj.type === 'signature' ? 'sig' : 'dup'}`),
    pageId: newPageId,
    ...(obj.type === 'text-replacement' && obj.coverRect
      ? { coverRect: { ...obj.coverRect } }
      : {}),
  }));

  return {
    pages: nextPages,
    objectsByPage: {
      ...objectsByPage,
      [newPageId]: clonedObjs,
    },
    newPageId,
  };
}
