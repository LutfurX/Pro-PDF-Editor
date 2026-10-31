import 'regenerator-runtime/runtime';
import {
  PDFDocument,
  PDFFont,
  PDFPage,
  StandardFonts,
  degrees,
  rgb,
} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type {
  CustomFontAsset,
  EditorObject,
  ImageEditorObject,
  TextEditorObject,
} from '../types/editor';
import type { PageDescriptor } from '../types/pdf';
import {
  canonicalBoxToPdfPlacement,
  canonicalTextLineToPdfPlacement,
  getEffectivePageRotation,
  rotateVisualOffset,
  visualPointToRawPdf,
} from '../utils/coordinateConverter';
import {
  BUILT_IN_FONTS,
  containsBengali,
  containsNonWinAnsi,
  loadBuiltInFontBytes,
} from '../utils/fontManager';

export interface ExportDocumentInput {
  pages: PageDescriptor[];
  pageIndicesToExport?: number[];
  sourceBytesMap: Record<string, Uint8Array>;
  objectsByPage: Record<string, EditorObject[]>;
  customFonts?: CustomFontAsset[];
  onProgress?: (percent: number, stage: string) => void;
}

export interface ExportDocumentResult {
  bytes: Uint8Array;
  exportedPageCount: number;
  warnings: string[];
}

function hexToRgbColor(hex: string): ReturnType<typeof rgb> {
  const clean = (hex || '#000000').replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) / 255;
    const g = parseInt(clean[1] + clean[1], 16) / 255;
    const b = parseInt(clean[2] + clean[2], 16) / 255;
    return rgb(
      Number.isFinite(r) ? r : 0,
      Number.isFinite(g) ? g : 0,
      Number.isFinite(b) ? b : 0
    );
  }
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return rgb(
    Number.isFinite(r) ? r : 0,
    Number.isFinite(g) ? g : 0,
    Number.isFinite(b) ? b : 0
  );
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const commaIdx = dataUrl.indexOf(',');
  const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  if (typeof atob === 'function') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

function selectStandardFont(
  family: string,
  bold: boolean,
  italic: boolean
): StandardFonts {
  const lower = family.toLowerCase();
  if (lower.includes('courier')) {
    if (bold && italic) return StandardFonts.CourierBoldOblique;
    if (bold) return StandardFonts.CourierBold;
    if (italic) return StandardFonts.CourierOblique;
    return StandardFonts.Courier;
  }
  if (lower.includes('times')) {
    if (bold && italic) return StandardFonts.TimesRomanBoldItalic;
    if (bold) return StandardFonts.TimesRomanBold;
    if (italic) return StandardFonts.TimesRomanItalic;
    return StandardFonts.TimesRoman;
  }
  if (bold && italic) return StandardFonts.HelveticaBoldOblique;
  if (bold) return StandardFonts.HelveticaBold;
  if (italic) return StandardFonts.HelveticaOblique;
  return StandardFonts.Helvetica;
}

/**
 * Checks whether `pdfFont` can encode `text` without throwing or producing missing-glyph errors.
 */
function canFontEncodeText(pdfFont: PDFFont, text: string): boolean {
  try {
    pdfFont.encodeText(text);
    pdfFont.widthOfTextAtSize(text, 12);
    return true;
  } catch {
    return false;
  }
}

/**
 * Word-wraps a text block to fit within `maxWidth` points using the embedded `PDFFont` metrics.
 */
function wrapTextLines(
  text: string,
  pdfFont: PDFFont,
  fontSize: number,
  maxWidth: number
): string[] {
  const paragraphs = (text || '').replace(/\r\n/g, '\n').split('\n');
  const lines: string[] = [];
  const effectiveMaxWidth = Math.max(fontSize * 1.2, maxWidth);

  for (const para of paragraphs) {
    if (para.length === 0) {
      lines.push('');
      continue;
    }

    const words = para.split(' ');
    let currentLine = '';

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      let candidateWidth = 0;
      try {
        candidateWidth = pdfFont.widthOfTextAtSize(candidate, fontSize);
      } catch {
        candidateWidth = candidate.length * fontSize * 0.55;
      }

      if (candidateWidth <= effectiveMaxWidth || !currentLine) {
        currentLine = candidate;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines.length > 0 ? lines : [''];
}

/**
 * Exports the edited PDF document (all pages or selected page indices) into real,
 * standards-compliant PDF bytes using `pdf-lib` + `@pdf-lib/fontkit`.
 */
export async function exportEditedPdf(
  input: ExportDocumentInput
): Promise<ExportDocumentResult> {
  const {
    pages,
    pageIndicesToExport,
    sourceBytesMap,
    objectsByPage,
    customFonts = [],
    onProgress,
  } = input;

  if (!pages.length) {
    throw new Error('Cannot export an empty document.');
  }

  const indices =
    pageIndicesToExport && pageIndicesToExport.length > 0
      ? pageIndicesToExport
      : pages.map((_, i) => i);

  const warnings: string[] = [];
  onProgress?.(8, 'Initializing PDF output document...');

  const outDoc = await PDFDocument.create();
  outDoc.registerFontkit(fontkit);

  // Cache loaded source PDFDocuments so we only parse each source PDF once
  const sourceDocsCache = new Map<string, PDFDocument>();
  const embeddedFontCache = new Map<string, PDFFont>();

  async function resolveEmbeddedFont(
    obj: TextEditorObject
  ): Promise<PDFFont> {
    const isBold = obj.fontWeight === 'bold';
    const isItalic = obj.fontStyle === 'italic';
    const hasBengali = containsBengali(obj.text);
    const hasUnicode = containsNonWinAnsi(obj.text);

    // 1. Check custom uploaded fonts first if selected
    const customAsset = customFonts.find((f) => f.familyName === obj.fontFamily);
    if (customAsset) {
      const cacheKey = `custom:${customAsset.id}`;
      let customPdfFont = embeddedFontCache.get(cacheKey);
      if (!customPdfFont) {
        // subset: false preserves complete OpenType GSUB/ToUnicode tables cleanly
        customPdfFont = await outDoc.embedFont(customAsset.bytes, { subset: false });
        embeddedFontCache.set(cacheKey, customPdfFont);
      }
      if (canFontEncodeText(customPdfFont, obj.text)) {
        return customPdfFont;
      }
      warnings.push(
        `Custom font "${customAsset.familyName}" lacked glyphs for "${obj.text.slice(0, 20)}"; used Unicode fallback font.`
      );
    }

    // 2. If text contains Bengali, always embed Noto Sans Bengali or Noto Serif Bengali TTF
    if (
      hasBengali ||
      obj.fontFamily === 'Noto Sans Bengali' ||
      obj.fontFamily === 'Noto Serif Bengali'
    ) {
      const targetFamily =
        obj.fontFamily === 'Noto Serif Bengali'
          ? 'Noto Serif Bengali'
          : 'Noto Sans Bengali';
      const fontMeta = BUILT_IN_FONTS.find((f) => f.family === targetFamily)!;
      const urlPath =
        isBold && fontMeta.boldUrl ? fontMeta.boldUrl : fontMeta.regularUrl!;
      const cacheKey = `ttf:${urlPath}`;

      let bengaliFont = embeddedFontCache.get(cacheKey);
      if (!bengaliFont) {
        const fontBytes = await loadBuiltInFontBytes(urlPath);
        bengaliFont = await outDoc.embedFont(fontBytes, { subset: false });
        embeddedFontCache.set(cacheKey, bengaliFont);
      }
      return bengaliFont;
    }

    // 3. Roboto or Unicode text requiring embedded TTF
    const builtInMeta = BUILT_IN_FONTS.find((f) => f.family === obj.fontFamily);
    if (obj.fontFamily === 'Roboto' || hasUnicode) {
      const meta =
        builtInMeta && builtInMeta.regularUrl
          ? builtInMeta
          : BUILT_IN_FONTS.find((f) => f.family === 'Roboto')!;

      let urlPath = meta.regularUrl!;
      if (isBold && isItalic && meta.boldItalicUrl) {
        urlPath = meta.boldItalicUrl;
      } else if (isBold && meta.boldUrl) {
        urlPath = meta.boldUrl;
      } else if (isItalic && meta.italicUrl) {
        urlPath = meta.italicUrl;
      }

      const cacheKey = `ttf:${urlPath}`;
      let ttfFont = embeddedFontCache.get(cacheKey);
      if (!ttfFont) {
        const fontBytes = await loadBuiltInFontBytes(urlPath);
        ttfFont = await outDoc.embedFont(fontBytes, { subset: false });
        embeddedFontCache.set(cacheKey, ttfFont);
      }
      if (canFontEncodeText(ttfFont, obj.text)) {
        return ttfFont;
      }
    }

    // 4. Standard 14 PDF Font (Helvetica / Arial / Times New Roman / Courier) for pure WinAnsi text
    const stdEnum = selectStandardFont(obj.fontFamily, isBold, isItalic);
    const stdKey = `std:${stdEnum}`;
    let stdFont = embeddedFontCache.get(stdKey);
    if (!stdFont) {
      stdFont = await outDoc.embedFont(stdEnum);
      embeddedFontCache.set(stdKey, stdFont);
    }
    if (canFontEncodeText(stdFont, obj.text)) {
      return stdFont;
    }

    // Final safety fallback to embedded NotoSans TTF
    const fallbackUrl = '/fonts/NotoSans-Regular.ttf';
    let fallbackFont = embeddedFontCache.get(`ttf:${fallbackUrl}`);
    if (!fallbackFont) {
      const bytes = await loadBuiltInFontBytes(fallbackUrl);
      fallbackFont = await outDoc.embedFont(bytes, { subset: false });
      embeddedFontCache.set(`ttf:${fallbackUrl}`, fallbackFont);
    }
    return fallbackFont;
  }

  for (let idx = 0; idx < indices.length; idx++) {
    const pageIndex = indices[idx];
    const pageDesc = pages[pageIndex];
    if (!pageDesc) continue;

    const pct = 15 + Math.round(((idx + 1) / indices.length) * 70);
    onProgress?.(pct, `Processing page ${idx + 1} of ${indices.length}...`);

    let outPage: PDFPage;

    if (pageDesc.sourceId === 'blank') {
      outPage = outDoc.addPage([pageDesc.rawWidth, pageDesc.rawHeight]);
    } else {
      let srcDoc = sourceDocsCache.get(pageDesc.sourceId);
      if (!srcDoc) {
        const srcBytes = sourceBytesMap[pageDesc.sourceId];
        if (!srcBytes) {
          throw new Error(`Missing source PDF bytes for "${pageDesc.sourceId}".`);
        }
        srcDoc = await PDFDocument.load(srcBytes);
        sourceDocsCache.set(pageDesc.sourceId, srcDoc);
      }
      const [copiedPage] = await outDoc.copyPages(srcDoc, [pageDesc.sourcePageIndex]);
      outPage = outDoc.addPage(copiedPage);
    }

    // Apply total effective page rotation
    const effectiveRotation = getEffectivePageRotation(pageDesc);
    outPage.setRotation(degrees(effectiveRotation));

    // Refresh actual MediaBox from outPage to guarantee 100% coordinate alignment
    const mb = outPage.getMediaBox();
    const pageCoordRef = {
      rawWidth: mb.width,
      rawHeight: mb.height,
      originalRotation: pageDesc.originalRotation,
      userRotation: pageDesc.userRotation,
      mediaBoxX: mb.x,
      mediaBoxY: mb.y,
    };

    const pageObjects = objectsByPage[pageDesc.id] || [];

    // Pass 1: Draw all cover rectangles for `text-replacement` objects first
    // so replacement masks never obscure newly overlaid text!
    for (const obj of pageObjects) {
      if (obj.type === 'text-replacement' && obj.coverRect) {
        const coverPlacement = canonicalBoxToPdfPlacement(
          obj.coverRect,
          0,
          pageCoordRef
        );
        outPage.drawRectangle({
          x: coverPlacement.x,
          y: coverPlacement.y,
          width: obj.coverRect.width,
          height: obj.coverRect.height,
          color: hexToRgbColor(obj.coverRect.color || '#FFFFFF'),
          rotate: degrees(coverPlacement.angleDegrees),
          opacity: 1,
        });
      }
    }

    // Pass 2: Draw all objects in z-order
    for (const obj of pageObjects) {
      if (obj.type === 'text' || obj.type === 'text-replacement') {
        await drawTextEditorObjectOnPage(
          outPage,
          obj,
          pageCoordRef,
          resolveEmbeddedFont
        );
      } else if (obj.type === 'image' || obj.type === 'signature') {
        await drawImageEditorObjectOnPage(outDoc, outPage, obj, pageCoordRef);
      }
    }
  }

  onProgress?.(92, 'Serializing PDF binary stream...');
  const finalBytes = await outDoc.save({ useObjectStreams: false });
  onProgress?.(100, 'Export complete');

  return {
    bytes: finalBytes,
    exportedPageCount: indices.length,
    warnings,
  };
}

async function drawTextEditorObjectOnPage(
  outPage: PDFPage,
  obj: TextEditorObject,
  pageCoordRef: {
    rawWidth: number;
    rawHeight: number;
    originalRotation: 0 | 90 | 180 | 270;
    userRotation: 0 | 90 | 180 | 270;
    mediaBoxX: number;
    mediaBoxY: number;
  },
  resolveEmbeddedFont: (o: TextEditorObject) => Promise<PDFFont>
): Promise<void> {
  // Optional background highlight box
  if (obj.backgroundColor && obj.backgroundColor !== 'transparent') {
    const bgPlacement = canonicalBoxToPdfPlacement(
      {
        x: obj.x,
        y: obj.y,
        width: obj.width,
        height: obj.height,
      },
      obj.rotation,
      pageCoordRef
    );
    outPage.drawRectangle({
      x: bgPlacement.x,
      y: bgPlacement.y,
      width: obj.width,
      height: obj.height,
      color: hexToRgbColor(obj.backgroundColor),
      opacity: obj.opacity,
      rotate: degrees(bgPlacement.angleDegrees),
    });
  }

  if (!obj.text) return;

  const pdfFont = await resolveEmbeddedFont(obj);
  const lines = wrapTextLines(obj.text, pdfFont, obj.fontSize, obj.width);
  const textColor = hexToRgbColor(obj.color || '#0F172A');
  const lineStep = obj.fontSize * (obj.lineHeight || 1.2);
  const firstBaselineY = obj.fontSize * 0.84;

  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i];
    if (!lineText) continue;

    let lineWidth = 0;
    try {
      lineWidth = pdfFont.widthOfTextAtSize(lineText, obj.fontSize);
    } catch {
      lineWidth = lineText.length * obj.fontSize * 0.55;
    }

    let localX = 0;
    if (obj.textAlign === 'center') {
      localX = Math.max(0, (obj.width - lineWidth) / 2);
    } else if (obj.textAlign === 'right') {
      localX = Math.max(0, obj.width - lineWidth);
    }

    const baselineOffsetY = firstBaselineY + i * lineStep;
    const placement = canonicalTextLineToPdfPlacement(
      obj.x,
      obj.y,
      localX,
      baselineOffsetY,
      obj.rotation,
      pageCoordRef
    );

    outPage.drawText(lineText, {
      x: placement.x,
      y: placement.y,
      size: obj.fontSize,
      font: pdfFont,
      color: textColor,
      opacity: obj.opacity,
      rotate: degrees(placement.angleDegrees),
    });

    if (obj.underline && lineWidth > 0) {
      const totalRot = getEffectivePageRotation(pageCoordRef);
      const underOffsetY = baselineOffsetY + obj.fontSize * 0.1;
      const vStart = rotateVisualOffset(
        obj.x,
        obj.y,
        localX,
        underOffsetY,
        obj.rotation
      );
      const vEnd = rotateVisualOffset(
        obj.x,
        obj.y,
        localX + lineWidth,
        underOffsetY,
        obj.rotation
      );
      const pStart = visualPointToRawPdf(
        vStart.x,
        vStart.y,
        pageCoordRef.rawWidth,
        pageCoordRef.rawHeight,
        totalRot,
        pageCoordRef.mediaBoxX,
        pageCoordRef.mediaBoxY
      );
      const pEnd = visualPointToRawPdf(
        vEnd.x,
        vEnd.y,
        pageCoordRef.rawWidth,
        pageCoordRef.rawHeight,
        totalRot,
        pageCoordRef.mediaBoxX,
        pageCoordRef.mediaBoxY
      );
      outPage.drawLine({
        start: { x: pStart.x, y: pStart.y },
        end: { x: pEnd.x, y: pEnd.y },
        thickness: Math.max(0.75, obj.fontSize * 0.06),
        color: textColor,
        opacity: obj.opacity,
      });
    }
  }
}

async function drawImageEditorObjectOnPage(
  outDoc: PDFDocument,
  outPage: PDFPage,
  obj: ImageEditorObject,
  pageCoordRef: {
    rawWidth: number;
    rawHeight: number;
    originalRotation: 0 | 90 | 180 | 270;
    userRotation: 0 | 90 | 180 | 270;
    mediaBoxX: number;
    mediaBoxY: number;
  }
): Promise<void> {
  const imgBytes = dataUrlToUint8Array(obj.src);
  const embedded =
    obj.mimeType === 'image/jpeg'
      ? await outDoc.embedJpg(imgBytes)
      : await outDoc.embedPng(imgBytes);

  const placement = canonicalBoxToPdfPlacement(
    {
      x: obj.x,
      y: obj.y,
      width: obj.width,
      height: obj.height,
    },
    obj.rotation,
    pageCoordRef
  );

  outPage.drawImage(embedded, {
    x: placement.x,
    y: placement.y,
    width: obj.width,
    height: obj.height,
    opacity: obj.opacity,
    rotate: degrees(placement.angleDegrees),
  });
}

/**
 * Triggers a genuine browser file download using Blob & URL.createObjectURL,
 * cleaning up the object URL right afterward.
 */
export function triggerPdfBlobDownload(bytes: Uint8Array, fileName: string): void {
  const safeName = fileName.toLowerCase().endsWith('.pdf')
    ? fileName
    : `${fileName}.pdf`;
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = safeName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
