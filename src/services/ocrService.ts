import Tesseract from 'tesseract.js';
import type { TextEditorObject } from '../types/editor';
import type { PageDescriptor } from '../types/pdf';
import { containsBengali } from '../utils/fontManager';
import { renderPageToCanvas } from './pdfRenderer';

export type OcrLanguageOption = 'eng' | 'ben' | 'eng+ben';

export interface OcrProgressUpdate {
  status: string;
  progress: number;
}

export interface OcrRunResult {
  objects: TextEditorObject[];
  fullText: string;
  averageConfidence: number;
}

/**
 * Runs Tesseract.js v7 OCR on a scanned PDF page, returning editable TextEditorObjects
 * positioned accurately in canonical PDF point coordinates while keeping the original
 * scanned page intact underneath.
 */
export async function recognizeScannedPageText(params: {
  pageDesc: PageDescriptor;
  sourceBytesMap: Record<string, Uint8Array>;
  language: OcrLanguageOption;
  onProgress?: (update: OcrProgressUpdate) => void;
}): Promise<OcrRunResult> {
  const { pageDesc, sourceBytesMap, language, onProgress } = params;

  onProgress?.({ status: 'Rendering high-resolution page scan...', progress: 5 });

  // Render at 2.0x scale (144 DPI) for crisp character recognition
  const ocrScale = 2.0;
  const offscreen = document.createElement('canvas');
  await renderPageToCanvas(pageDesc, sourceBytesMap, offscreen, ocrScale, {
    maxPixelRatio: 1,
  });

  let worker: Tesseract.Worker | null = null;
  try {
    onProgress?.({
      status: `Initializing Tesseract (${language})...`,
      progress: 12,
    });

    worker = await Tesseract.createWorker(language, 1, {
      logger: (msg) => {
        if (onProgress && typeof msg.progress === 'number') {
          const pct = Math.min(96, Math.round(15 + msg.progress * 80));
          onProgress({
            status: msg.status || 'Recognizing text...',
            progress: pct,
          });
        }
      },
    });

    // Crucial in Tesseract.js v7: pass `{ blocks: true, text: true }` in output parameter
    const result = await worker.recognize(
      offscreen,
      {},
      { blocks: true, text: true }
    );

    const data = result.data;
    const objects: TextEditorObject[] = [];
    const blocks = data.blocks || [];

    let lineCounter = 0;
    for (const block of blocks) {
      for (const para of block.paragraphs || []) {
        for (const line of para.lines || []) {
          const cleanText = (line.text || '').replace(/\s+/g, ' ').trim();
          if (!cleanText) continue;

          const { x0, y0, x1, y1 } = line.bbox;
          const xPt = Number((x0 / ocrScale).toFixed(2));
          const yPt = Number((y0 / ocrScale).toFixed(2));
          const wPt = Number(Math.max(32, (x1 - x0) / ocrScale + 8).toFixed(2));
          const hPt = Number(Math.max(10, (y1 - y0) / ocrScale).toFixed(2));
          const estimatedFontSize = Number(
            Math.max(8, Math.min(36, hPt * 0.78)).toFixed(1)
          );

          const isBengali = containsBengali(cleanText);

          objects.push({
            id: `obj_ocr_${pageDesc.id}_${Date.now()}_${lineCounter++}`,
            pageId: pageDesc.id,
            type: 'text',
            text: cleanText,
            x: xPt,
            y: yPt,
            width: wPt,
            height: hPt,
            rotation: 0,
            opacity: 1,
            fontFamily: isBengali ? 'Noto Sans Bengali' : 'Helvetica',
            fontSize: estimatedFontSize,
            fontWeight: 'normal',
            fontStyle: 'normal',
            underline: false,
            color: '#0F172A',
            // Semi-opaque white backdrop makes edits immediately readable over the underlying scan
            backgroundColor: '#FFFFFF',
            textAlign: 'left',
            lineHeight: 1.18,
            isOcrDerived: true,
          });
        }
      }
    }

    // Fallback if blocks weren't segmented by layout engine yet data.text is non-empty
    if (objects.length === 0 && data.text && data.text.trim()) {
      const rawLines = data.text
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      rawLines.forEach((lineText, idx) => {
        const isBengali = containsBengali(lineText);
        objects.push({
          id: `obj_ocr_${pageDesc.id}_${Date.now()}_${idx}`,
          pageId: pageDesc.id,
          type: 'text',
          text: lineText,
          x: 48,
          y: 64 + idx * 24,
          width: Math.max(200, Math.min(480, lineText.length * 8)),
          height: 20,
          rotation: 0,
          opacity: 1,
          fontFamily: isBengali ? 'Noto Sans Bengali' : 'Helvetica',
          fontSize: 12,
          fontWeight: 'normal',
          fontStyle: 'normal',
          underline: false,
          color: '#0F172A',
          backgroundColor: '#FFFFFF',
          textAlign: 'left',
          lineHeight: 1.2,
          isOcrDerived: true,
        });
      });
    }

    onProgress?.({ status: 'OCR complete', progress: 100 });

    return {
      objects,
      fullText: (data.text || '').trim(),
      averageConfidence: typeof data.confidence === 'number' ? data.confidence : 0,
    };
  } catch (err: unknown) {
    const msg =
      (err as { message?: string })?.message ||
      'OCR engine encountered an unexpected error.';
    throw new Error(
      `OCR recognition failed: ${msg}. Verify network connectivity for language data or try again.`
    );
  } finally {
    if (worker) {
      await worker.terminate().catch(() => undefined);
    }
  }
}
