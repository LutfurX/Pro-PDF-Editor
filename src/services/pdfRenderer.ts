// Polyfill ES2025 Promise.try for pdfjs-dist v6 compatibility across browsers & runtimes
if (typeof (Promise as unknown as { try?: unknown }).try !== 'function') {
  (Promise as unknown as { try: <T>(fn: () => T | PromiseLike<T>, ...args: unknown[]) => Promise<T> }).try =
    function <T>(fn: (...a: unknown[]) => T | PromiseLike<T>, ...args: unknown[]): Promise<T> {
      return new Promise<T>((resolve) => resolve(fn(...args)));
    };
}

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PDFDocument } from 'pdf-lib';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { PageDescriptor } from '../types/pdf';
import { getEffectivePageRotation, normalizePageRotation } from '../utils/coordinateConverter';

let workerConfigured = false;

export async function ensurePdfJsWorker(): Promise<void> {
  if (workerConfigured) return;
  if (typeof window !== 'undefined') {
    try {
      const workerUrl = new URL(
        'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
        import.meta.url
      ).toString();
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
      workerConfigured = true;
    } catch {
      workerConfigured = true;
    }
  }
}

export class PDFOpenError extends Error {
  code: 'PASSWORD_REQUIRED' | 'INVALID_PDF' | 'EMPTY_FILE' | 'LOAD_FAILED';
  constructor(
    code: 'PASSWORD_REQUIRED' | 'INVALID_PDF' | 'EMPTY_FILE' | 'LOAD_FAILED',
    message: string
  ) {
    super(message);
    this.name = 'PDFOpenError';
    this.code = code;
  }
}

const pdfProxyCache = new Map<
  string,
  { doc: PDFDocumentProxy; destroy: () => Promise<void> }
>();
const activeRenderTasks = new WeakMap<HTMLCanvasElement, { cancel: () => void }>();

export async function getOrLoadPdfProxy(
  sourceId: string,
  bytes: Uint8Array,
  onProgress?: (percent: number) => void
): Promise<PDFDocumentProxy> {
  const existing = pdfProxyCache.get(sourceId);
  if (existing) {
    onProgress?.(100);
    return existing.doc;
  }

  await ensurePdfJsWorker();

  if (!bytes || bytes.byteLength < 8) {
    throw new PDFOpenError('EMPTY_FILE', 'The selected PDF file is empty or unreadable.');
  }

  // Always pass a copy of bytes so PDF.js worker transfer never detaches our master Uint8Array!
  const clonedData = bytes.slice();
  const loadingTask = pdfjsLib.getDocument({
    data: clonedData,
  });

  if (onProgress) {
    loadingTask.onProgress = (progressData: { loaded: number; total: number }) => {
      if (progressData.total > 0) {
        const pct = Math.min(98, Math.round((progressData.loaded / progressData.total) * 100));
        onProgress(pct);
      }
    };
  }

  try {
    const doc = await loadingTask.promise;
    pdfProxyCache.set(sourceId, {
      doc,
      destroy: async () => {
        if (typeof loadingTask.destroy === 'function') {
          await loadingTask.destroy();
        } else if (typeof (doc as unknown as { cleanup?: () => Promise<void> }).cleanup === 'function') {
          await (doc as unknown as { cleanup: () => Promise<void> }).cleanup();
        }
      },
    });
    onProgress?.(100);
    return doc;
  } catch (err: unknown) {
    const anyErr = err as { name?: string; message?: string };
    if (anyErr?.name === 'PasswordException' || anyErr?.message?.toLowerCase().includes('password')) {
      throw new PDFOpenError(
        'PASSWORD_REQUIRED',
        'This PDF is password-protected. Please unlock the document before editing in ProPDF Studio.'
      );
    }
    if (anyErr?.name === 'InvalidPDFException' || anyErr?.message?.toLowerCase().includes('invalid pdf')) {
      throw new PDFOpenError(
        'INVALID_PDF',
        'Invalid or corrupted PDF file. Please verify the file is a valid .pdf document.'
      );
    }
    throw new PDFOpenError(
      'LOAD_FAILED',
      anyErr?.message || 'Failed to read PDF document. The file may be damaged.'
    );
  }
}

export async function clearPdfProxyCache(): Promise<void> {
  const entries = Array.from(pdfProxyCache.values());
  pdfProxyCache.clear();
  await Promise.allSettled(entries.map((entry) => entry.destroy()));
}

/**
 * Inspects a PDF byte buffer using both pdf-lib (for accurate MediaBox & raw dimensions)
 * and PDF.js, returning initial PageDescriptors for all pages.
 */
export async function inspectPdfPages(
  sourceId: string,
  bytes: Uint8Array,
  onProgress?: (percent: number) => void
): Promise<{ pdfProxy: PDFDocumentProxy; pages: PageDescriptor[] }> {
  const pdfProxy = await getOrLoadPdfProxy(sourceId, bytes, onProgress);

  let pdfLibDoc: PDFDocument | null = null;
  try {
    pdfLibDoc = await PDFDocument.load(bytes, { ignoreEncryption: false });
  } catch (err: unknown) {
    const msg = (err as { message?: string })?.message || '';
    if (msg.toLowerCase().includes('encrypted')) {
      throw new PDFOpenError(
        'PASSWORD_REQUIRED',
        'This PDF uses encryption restrictions or password protection and cannot be modified directly.'
      );
    }
  }

  const pages: PageDescriptor[] = [];
  for (let i = 0; i < pdfProxy.numPages; i++) {
    const jsPage = await pdfProxy.getPage(i + 1);
    const unrotatedViewport = jsPage.getViewport({ scale: 1, rotation: 0 });

    let rawWidth = unrotatedViewport.width;
    let rawHeight = unrotatedViewport.height;
    let originalRotation = normalizePageRotation(jsPage.rotate || 0);
    let mediaBoxX = 0;
    let mediaBoxY = 0;

    if (pdfLibDoc && i < pdfLibDoc.getPageCount()) {
      const libPage = pdfLibDoc.getPage(i);
      const mb = libPage.getMediaBox();
      rawWidth = mb.width;
      rawHeight = mb.height;
      mediaBoxX = mb.x;
      mediaBoxY = mb.y;
      originalRotation = normalizePageRotation(libPage.getRotation().angle);
    }

    pages.push({
      id: `page_${sourceId}_${i}_${Math.random().toString(36).slice(2, 7)}`,
      sourceId,
      sourcePageIndex: i,
      rawWidth,
      rawHeight,
      originalRotation,
      userRotation: 0,
      mediaBoxX,
      mediaBoxY,
      isScannedCandidate: false,
      ocrCompleted: false,
    });
  }

  return { pdfProxy, pages };
}

/**
 * Renders a PageDescriptor onto an HTMLCanvasElement at the given `zoom` level,
 * accounting for devicePixelRatio for razor-sharp text & vector graphics.
 */
export async function renderPageToCanvas(
  pageDesc: PageDescriptor,
  sourceBytesMap: Record<string, Uint8Array>,
  canvas: HTMLCanvasElement,
  zoom: number,
  options?: { maxPixelRatio?: number }
): Promise<{ cssWidth: number; cssHeight: number; pixelRatio: number }> {
  const prevTask = activeRenderTasks.get(canvas);
  if (prevTask) {
    try {
      prevTask.cancel();
    } catch {
      // Ignore cancel error
    }
    activeRenderTasks.delete(canvas);
  }

  const effectiveRotation = getEffectivePageRotation(pageDesc);
  const dpr = Math.min(
    options?.maxPixelRatio ?? 2,
    typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  );

  if (pageDesc.sourceId === 'blank') {
    const isSwapped = effectiveRotation === 90 || effectiveRotation === 270;
    const cssWidth = (isSwapped ? pageDesc.rawHeight : pageDesc.rawWidth) * zoom;
    const cssHeight = (isSwapped ? pageDesc.rawWidth : pageDesc.rawHeight) * zoom;

    canvas.width = Math.max(1, Math.round(cssWidth * dpr));
    canvas.height = Math.max(1, Math.round(cssHeight * dpr));
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.save();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
    return { cssWidth, cssHeight, pixelRatio: dpr };
  }

  const bytes = sourceBytesMap[pageDesc.sourceId];
  if (!bytes) {
    throw new Error(`Missing PDF source buffer for "${pageDesc.sourceId}".`);
  }

  const pdfProxy = await getOrLoadPdfProxy(pageDesc.sourceId, bytes);
  const pdfPage = await pdfProxy.getPage(pageDesc.sourcePageIndex + 1);

  const cssViewport = pdfPage.getViewport({
    scale: zoom,
    rotation: effectiveRotation,
  });
  const renderViewport = pdfPage.getViewport({
    scale: zoom * dpr,
    rotation: effectiveRotation,
  });

  canvas.width = Math.max(1, Math.round(renderViewport.width));
  canvas.height = Math.max(1, Math.round(renderViewport.height));
  canvas.style.width = `${cssViewport.width}px`;
  canvas.style.height = `${cssViewport.height}px`;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Unable to acquire 2D rendering context for PDF canvas.');
  }

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const renderTask = pdfPage.render({
    canvasContext: ctx,
    canvas,
    viewport: renderViewport,
  });

  activeRenderTasks.set(canvas, renderTask);

  try {
    await renderTask.promise;
  } catch (err: unknown) {
    const name = (err as { name?: string })?.name;
    if (name !== 'RenderingCancelledException') {
      throw err;
    }
  } finally {
    if (activeRenderTasks.get(canvas) === renderTask) {
      activeRenderTasks.delete(canvas);
    }
  }

  return {
    cssWidth: cssViewport.width,
    cssHeight: cssViewport.height,
    pixelRatio: dpr,
  };
}

/**
 * Generates a compact JPEG/PNG thumbnail Data URL for a page descriptor.
 */
export async function generatePageThumbnail(
  pageDesc: PageDescriptor,
  sourceBytesMap: Record<string, Uint8Array>,
  targetWidthPx = 150
): Promise<string> {
  if (typeof document === 'undefined') return '';
  const offscreen = document.createElement('canvas');
  const effectiveRotation = getEffectivePageRotation(pageDesc);
  const displayWidth =
    effectiveRotation === 90 || effectiveRotation === 270
      ? pageDesc.rawHeight
      : pageDesc.rawWidth;
  const scale = Math.max(0.15, targetWidthPx / Math.max(1, displayWidth));

  await renderPageToCanvas(pageDesc, sourceBytesMap, offscreen, scale, {
    maxPixelRatio: 1,
  });
  return offscreen.toDataURL('image/jpeg', 0.82);
}

/**
 * Samples the perimeter pixels around a canonical text box on the rendered PDF canvas
 * so existing-text cover rectangles blend naturally with white or tinted page backgrounds.
 */
export function sampleCanvasBackgroundHex(
  canvas: HTMLCanvasElement | null,
  canonicalBox: { x: number; y: number; width: number; height: number },
  zoom: number
): string {
  if (!canvas) return '#FFFFFF';
  const ctx = canvas.getContext('2d');
  if (!ctx) return '#FFFFFF';

  const cssWidth = parseFloat(canvas.style.width) || canvas.width;
  const ratio = cssWidth > 0 ? canvas.width / cssWidth : 1;

  const px = Math.round(canonicalBox.x * zoom * ratio);
  const py = Math.round(canonicalBox.y * zoom * ratio);
  const pw = Math.max(2, Math.round(canonicalBox.width * zoom * ratio));
  const ph = Math.max(2, Math.round(canonicalBox.height * zoom * ratio));

  // Sample 6 perimeter points just outside the text glyph strokes
  const sampleCoords = [
    [Math.max(0, px - 3), Math.max(0, py - 3)],
    [Math.min(canvas.width - 1, px + Math.floor(pw / 2)), Math.max(0, py - 3)],
    [Math.min(canvas.width - 1, px + pw + 3), Math.max(0, py - 3)],
    [Math.max(0, px - 3), Math.min(canvas.height - 1, py + ph + 3)],
    [Math.min(canvas.width - 1, px + Math.floor(pw / 2)), Math.min(canvas.height - 1, py + ph + 3)],
    [Math.min(canvas.width - 1, px + pw + 3), Math.min(canvas.height - 1, py + ph + 3)],
  ];

  const rgbSamples: Array<[number, number, number]> = [];
  for (const [sx, sy] of sampleCoords) {
    try {
      const data = ctx.getImageData(sx, sy, 1, 1).data;
      if (data[3] > 200) {
        rgbSamples.push([data[0], data[1], data[2]]);
      }
    } catch {
      return '#FFFFFF';
    }
  }

  if (rgbSamples.length === 0) return '#FFFFFF';

  // Pick median brightness sample to ignore accidental neighboring border pixels
  rgbSamples.sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]));
  const brightest = rgbSamples[rgbSamples.length - 1];
  const toHex = (v: number) => v.toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(brightest[0])}${toHex(brightest[1])}${toHex(brightest[2])}`;
}
