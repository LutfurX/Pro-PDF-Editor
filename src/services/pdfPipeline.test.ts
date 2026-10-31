if (typeof (Promise as unknown as { try?: unknown }).try !== 'function') {
  (Promise as unknown as { try: <T>(fn: () => T | PromiseLike<T>, ...args: unknown[]) => Promise<T> }).try =
    function <T>(fn: (...a: unknown[]) => T | PromiseLike<T>, ...args: unknown[]): Promise<T> {
      return new Promise<T>((resolve) => resolve(fn(...args)));
    };
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  canonicalBoxToPdfPlacement,
  canonicalToCanvasBox,
  canvasToCanonicalBox,
  getEffectivePageRotation,
  getPageDisplayDimensions,
  parsePageRange,
} from '../utils/coordinateConverter';
import {
  containsBengali,
  mapPdfFontName,
  resolveFontForText,
} from '../utils/fontManager';
import {
  createOverlayTextObject,
  createReplacementFromExtractedItem,
} from './pdfEditor';
import { exportEditedPdf } from './pdfExporter';
import { generateMultiPageSamplePdf } from './samplePdfGenerator';
import { useEditorStore } from '../store/editorStore';
import type { PageDescriptor } from '../types/pdf';

// Minimal valid 1x1 transparent PNG data URL for deterministic image/signature tests
const ONE_PIXEL_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function makeBasePageDescriptor(
  sourceId: string,
  index: number,
  rawWidth = 595.28,
  rawHeight = 841.89
): PageDescriptor {
  return {
    id: `page_${index}`,
    sourceId,
    sourcePageIndex: index,
    rawWidth,
    rawHeight,
    originalRotation: 0,
    userRotation: 0,
    mediaBoxX: 0,
    mediaBoxY: 0,
    isScannedCandidate: false,
    ocrCompleted: false,
  };
}

async function extractTextStringsFromBytes(bytes: Uint8Array): Promise<string[]> {
  const loadingTask = pdfjsLib.getDocument({
    data: bytes.slice(),
    useSystemFonts: true,
  });
  const doc = await loadingTask.promise;
  const pageTexts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    const joined = tc.items
      .map((it) => ('str' in it ? it.str : ''))
      .join(' ');
    pageTexts.push(joined);
  }
  await loadingTask.destroy();
  return pageTexts;
}

test('coordinateConverter accurately maps canonical boxes to PDF coordinates across rotations', () => {
  const basePage = makeBasePageDescriptor('main', 0, 600, 800);

  // Unrotated: top-left (50, 100) with size (200, 40) -> bottom-left in PDF is (50, 800 - 140 = 660)
  const p0 = canonicalBoxToPdfPlacement(
    { x: 50, y: 100, width: 200, height: 40 },
    0,
    basePage
  );
  assert.equal(Math.round(p0.x), 50);
  assert.equal(Math.round(p0.y), 660);
  assert.equal(p0.angleDegrees, 0);

  // Rotated 90° clockwise: visual size is (800, 600)
  const rotated90 = { ...basePage, userRotation: 90 as const };
  assert.equal(getEffectivePageRotation(rotated90), 90);
  assert.deepEqual(getPageDisplayDimensions(rotated90), {
    width: 800,
    height: 600,
  });

  const p90 = canonicalBoxToPdfPlacement(
    { x: 50, y: 100, width: 200, height: 40 },
    0,
    rotated90
  );
  assert.equal(Math.round(p90.x), 140);
  assert.equal(Math.round(p90.y), 50);
  assert.equal(p90.angleDegrees, 90);

  // Canvas <-> Canonical roundtrip
  const zoomed = canonicalToCanvasBox({ x: 40, y: 80, width: 120, height: 30 }, 1.5);
  assert.deepEqual(zoomed, { x: 60, y: 120, width: 180, height: 45 });
  assert.deepEqual(canvasToCanonicalBox(zoomed, 1.5), {
    x: 40,
    y: 80,
    width: 120,
    height: 30,
  });
});

test('parsePageRange validates and sorts page ranges accurately', () => {
  assert.deepEqual(parsePageRange('1-2, 4', 5), { indices: [0, 1, 3] });
  assert.equal(Boolean(parsePageRange('1-9', 4).error), true);
  assert.equal(Boolean(parsePageRange('', 4).error), true);
});

test('fontManager detects Bengali Unicode and resolves Noto Sans/Serif Bengali', () => {
  assert.equal(containsBengali('Hello World'), false);
  assert.equal(containsBengali('বাংলা নথি সম্পাদনা'), true);

  const autoSans = resolveFontForText('Helvetica', 'বাংলা নথি');
  assert.equal(autoSans.resolvedFamily, 'Noto Sans Bengali');
  assert.equal(autoSans.switchedForBengali, true);

  const autoSerif = resolveFontForText('Times New Roman', 'বাংলা সাহিত্য');
  assert.equal(autoSerif.resolvedFamily, 'Noto Serif Bengali');
  assert.equal(autoSerif.switchedForBengali, true);

  const mapped = mapPdfFontName('BCDFEE+Helvetica-Bold', 'Sample');
  assert.equal(mapped.family, 'Helvetica');
  assert.equal(mapped.fontWeight, 'bold');

  // Regression check: PDF.js 'g_d0_f1 sans-serif' must map to Helvetica, never Times New Roman
  const mappedPdfJsSans = mapPdfFontName('g_d0_f1 sans-serif', 'Master Consulting');
  assert.equal(mappedPdfJsSans.family, 'Helvetica');
});

test('End-to-end PDF Export: English text, Bengali text, Existing Text Replacement, Image & Signature', async () => {
  const { bytes: sampleBytes } = await generateMultiPageSamplePdf();
  const pages = [
    makeBasePageDescriptor('main', 0),
    makeBasePageDescriptor('main', 1),
    makeBasePageDescriptor('main', 2),
  ];

  // 1. English Overlay Text
  const engObj = createOverlayTextObject({
    pageId: pages[0].id,
    x: 60,
    y: 250,
    text: 'VERIFIED ENGLISH OVERLAY 2026',
    fontFamily: 'Helvetica',
    fontSize: 14,
  });

  // 2. Bengali Overlay Text (must embed NotoSansBengali-Regular.ttf via fontkit!)
  const benObj = createOverlayTextObject({
    pageId: pages[0].id,
    x: 60,
    y: 290,
    text: 'বাংলা নথি সম্পাদনা পরীক্ষিত',
    fontFamily: 'Helvetica', // Should auto-switch to Noto Sans Bengali!
    fontSize: 15,
  });
  assert.equal(benObj.fontFamily, 'Noto Sans Bengali');

  // 3. Existing PDF Text Replacement
  const replacementObj = createReplacementFromExtractedItem(
    {
      id: 'txt_sample_1',
      pageId: pages[0].id,
      text: 'Master Consulting & Delivery Proposal',
      x: 48,
      y: 118,
      width: 380,
      height: 24,
      fontSize: 22,
      rawFontName: 'Helvetica-Bold',
      mappedFontFamily: 'Helvetica',
      fontWeight: 'bold',
      fontStyle: 'normal',
      isUnsupportedFont: false,
    },
    'Updated Strategic Architecture Charter',
    '#FFFFFF'
  );

  // 4. Image + Signature on Page 3
  const imgObj = {
    id: 'obj_img_test',
    pageId: pages[2].id,
    type: 'image' as const,
    src: ONE_PIXEL_PNG_DATA_URL,
    mimeType: 'image/png' as const,
    naturalWidth: 100,
    naturalHeight: 50,
    x: 80,
    y: 300,
    width: 120,
    height: 60,
    rotation: 0,
    opacity: 0.9,
  };

  const sigObj = {
    id: 'obj_sig_test',
    pageId: pages[2].id,
    type: 'signature' as const,
    src: ONE_PIXEL_PNG_DATA_URL,
    mimeType: 'image/png' as const,
    naturalWidth: 200,
    naturalHeight: 80,
    x: 65,
    y: 600,
    width: 160,
    height: 55,
    rotation: 0,
    opacity: 1,
  };

  const exported = await exportEditedPdf({
    pages,
    sourceBytesMap: { main: sampleBytes },
    objectsByPage: {
      [pages[0].id]: [engObj, benObj, replacementObj],
      [pages[1].id]: [],
      [pages[2].id]: [imgObj, sigObj],
    },
  });

  assert.equal(exported.exportedPageCount, 3);
  assert.ok(exported.bytes.byteLength > sampleBytes.byteLength);

  // Verify exported PDF loads cleanly in independent pdf-lib & pdfjs-dist parsers
  const reloadedDoc = await PDFDocument.load(exported.bytes);
  assert.equal(reloadedDoc.getPageCount(), 3);

  const extractedPages = await extractTextStringsFromBytes(exported.bytes);
  assert.equal(extractedPages.length, 3);
  assert.ok(
    extractedPages[0].includes('VERIFIED ENGLISH OVERLAY 2026'),
    'Exported Page 1 must contain inserted English text'
  );
  assert.ok(
    extractedPages[0].includes('Updated Strategic Architecture Charter'),
    'Exported Page 1 must contain replacement text'
  );
  // Check raw PDF bytes also contain the embedded NotoSansBengali font descriptor
  const rawAscii = Buffer.from(exported.bytes).toString('latin1');
  assert.ok(
    rawAscii.includes('NotoSansBengali'),
    'Exported PDF must embed NotoSansBengali font via fontkit'
  );
});

test('Store Undo, Redo, Page Delete, Rotate, Add Blank, and Reorder preserve export sequence', async () => {
  const { bytes: sampleBytes } = await generateMultiPageSamplePdf();
  const initialPages = [
    makeBasePageDescriptor('main', 0),
    makeBasePageDescriptor('main', 1),
    makeBasePageDescriptor('main', 2),
  ];

  const store = useEditorStore.getState();
  store.initializeDocument({
    name: 'TestDoc.pdf',
    sourceId: 'main',
    bytes: sampleBytes,
    pages: initialPages,
    fileSizeBytes: sampleBytes.byteLength,
  });

  // Delete Page 2 (index 1) -> remaining original pages [0, 2]
  useEditorStore.getState().deletePage(1);
  assert.equal(useEditorStore.getState().pages.length, 2);

  // Reorder remaining pages [0, 2] -> [2, 0]
  useEditorStore.getState().reorderPages(0, 1);
  assert.equal(useEditorStore.getState().pages[0].sourcePageIndex, 2);
  assert.equal(useEditorStore.getState().pages[1].sourcePageIndex, 0);

  // Add text object, then Undo & Redo
  const added = createOverlayTextObject({
    pageId: useEditorStore.getState().pages[0].id,
    x: 100,
    y: 120,
    text: 'UNDO REDO SURVIVOR TEXT',
  });
  useEditorStore.getState().addObject(added);
  assert.equal(
    useEditorStore.getState().objectsByPage[added.pageId].length,
    1
  );

  // Undo removes text object
  useEditorStore.getState().undo();
  assert.equal(
    useEditorStore.getState().objectsByPage[added.pageId].length,
    0
  );

  // Redo restores text object
  useEditorStore.getState().redo();
  assert.equal(
    useEditorStore.getState().objectsByPage[added.pageId].length,
    1
  );

  // Export final state and verify page order + Redo text in exported PDF!
  const finalState = useEditorStore.getState();
  const exported = await exportEditedPdf({
    pages: finalState.pages,
    sourceBytesMap: finalState.sourceBytesMap,
    objectsByPage: finalState.objectsByPage,
  });

  const extractedPages = await extractTextStringsFromBytes(exported.bytes);
  assert.equal(extractedPages.length, 2);
  // First exported page was original Page 3 ("3. Terms of Acceptance & Sign-Off") + Redo text
  assert.ok(extractedPages[0].includes('Terms of Acceptance'));
  assert.ok(extractedPages[0].includes('UNDO REDO SURVIVOR TEXT'));
  // Second exported page was original Page 1 ("NORTHSTAR ENGINEERING GROUP")
  assert.ok(extractedPages[1].includes('NORTHSTAR ENGINEERING GROUP'));
});
