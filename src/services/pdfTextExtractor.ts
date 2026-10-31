import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { ExtractedTextItem, PageDescriptor } from '../types/pdf';
import { getEffectivePageRotation } from '../utils/coordinateConverter';
import { mapPdfFontName } from '../utils/fontManager';
import { getOrLoadPdfProxy } from './pdfRenderer';

interface RawPdfTextSpan {
  str: string;
  transform: number[];
  width: number;
  height: number;
  fontName: string;
  hasEOL?: boolean;
}

/**
 * Extracts selectable text regions and positional/font metadata for a page in
 * canonical top-left PDF points (scale = 1.0, accounting for effective page rotation).
 * Also identifies whether the page has zero extractable text (scanned PDF candidate).
 */
export async function extractPageTextRegions(
  pageDesc: PageDescriptor,
  sourceBytesMap: Record<string, Uint8Array>
): Promise<{ items: ExtractedTextItem[]; isScannedCandidate: boolean }> {
  if (pageDesc.sourceId === 'blank') {
    return { items: [], isScannedCandidate: false };
  }

  const bytes = sourceBytesMap[pageDesc.sourceId];
  if (!bytes) {
    return { items: [], isScannedCandidate: false };
  }

  const pdfProxy = await getOrLoadPdfProxy(pageDesc.sourceId, bytes);
  const pdfPage = await pdfProxy.getPage(pageDesc.sourcePageIndex + 1);
  const effectiveRotation = getEffectivePageRotation(pageDesc);
  const viewport = pdfPage.getViewport({ scale: 1.0, rotation: effectiveRotation });

  const textContent = await pdfPage.getTextContent();
  const stylesMap = (textContent.styles || {}) as Record<
    string,
    { fontFamily?: string }
  >;

  const rawItems: ExtractedTextItem[] = [];

  for (let idx = 0; idx < textContent.items.length; idx++) {
    const raw = textContent.items[idx] as unknown as RawPdfTextSpan;
    if (!raw || typeof raw.str !== 'string') continue;
    const trimmed = raw.str.trim();
    if (!trimmed) continue;

    // Combine viewport transform and text item transform
    const tx = pdfjsLib.Util.transform(viewport.transform, raw.transform);
    const fontHeight = Math.max(6, Math.hypot(tx[2], tx[3]));

    // Depending on rotation, width along baseline in viewport space:
    const isRotatedSideways = Math.abs(tx[1]) > Math.abs(tx[0]) * 1.5;
    const spanAdvance = Math.max(fontHeight * 0.5, raw.width || trimmed.length * fontHeight * 0.5);

    let x = tx[4];
    let y = tx[5] - fontHeight * 0.84;
    let width = spanAdvance;
    let height = Math.max(fontHeight * 1.14, raw.height ? raw.height * 1.08 : fontHeight * 1.14);

    if (isRotatedSideways) {
      x = tx[4] - fontHeight * 0.84;
      y = tx[5] - spanAdvance;
      width = height;
      height = spanAdvance;
    }

    // Clamp cleanly within viewport bounds
    x = Math.max(0, Math.min(viewport.width - 4, x));
    y = Math.max(0, Math.min(viewport.height - 4, y));

    const styleHint = stylesMap[raw.fontName]?.fontFamily || '';
    const combinedFontIdentifier = `${raw.fontName || ''} ${styleHint}`.trim();
    const mapped = mapPdfFontName(combinedFontIdentifier, raw.str);

    rawItems.push({
      id: `txt_${pageDesc.id}_${idx}`,
      pageId: pageDesc.id,
      text: raw.str,
      x: Number(x.toFixed(2)),
      y: Number(y.toFixed(2)),
      width: Number(width.toFixed(2)),
      height: Number(height.toFixed(2)),
      fontSize: Number(fontHeight.toFixed(1)),
      rawFontName: combinedFontIdentifier || 'UnknownFont',
      mappedFontFamily: mapped.family,
      fontWeight: mapped.fontWeight,
      fontStyle: mapped.fontStyle,
      isUnsupportedFont: mapped.isUnsupportedFont,
    });
  }

  // Merge adjacent fragments that lie on the exact same line & font with tiny kerning gaps
  // while keeping distinct table columns (gap > fontSize * 0.75) separate!
  const merged: ExtractedTextItem[] = [];
  for (const item of rawItems) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      Math.abs(prev.y - item.y) <= Math.max(2, prev.fontSize * 0.2) &&
      Math.abs(prev.fontSize - item.fontSize) <= 1.5 &&
      prev.mappedFontFamily === item.mappedFontFamily &&
      prev.fontWeight === item.fontWeight &&
      item.x >= prev.x + prev.width - 4 &&
      item.x - (prev.x + prev.width) <= prev.fontSize * 0.65
    ) {
      const gap = item.x - (prev.x + prev.width);
      const needsSpace =
        gap > prev.fontSize * 0.16 &&
        !prev.text.endsWith(' ') &&
        !item.text.startsWith(' ');
      prev.text = `${prev.text}${needsSpace ? ' ' : ''}${item.text}`;
      const rightEdge = Math.max(prev.x + prev.width, item.x + item.width);
      prev.width = Number((rightEdge - prev.x).toFixed(2));
      prev.height = Number(Math.max(prev.height, item.height).toFixed(2));
      prev.isUnsupportedFont = prev.isUnsupportedFont || item.isUnsupportedFont;
    } else {
      merged.push({ ...item });
    }
  }

  return {
    items: merged,
    isScannedCandidate: merged.length === 0,
  };
}
