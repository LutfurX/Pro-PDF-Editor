export type PageRotation = 0 | 90 | 180 | 270;

export interface PDFSourceBuffer {
  id: string;
  name: string;
  bytes: Uint8Array;
  pageCount: number;
}

export interface PageDescriptor {
  id: string;
  /** 'blank' for newly inserted blank pages, or key into sourceBuffers */
  sourceId: string;
  /** 0-based page index inside the source PDF (ignored when sourceId === 'blank') */
  sourcePageIndex: number;
  /** Unrotated raw width in PDF points (72 DPI) */
  rawWidth: number;
  /** Unrotated raw height in PDF points (72 DPI) */
  rawHeight: number;
  /** Original /Rotate entry of the PDF page (0, 90, 180, 270) */
  originalRotation: PageRotation;
  /** User-applied additional clockwise rotation (0, 90, 180, 270) */
  userRotation: PageRotation;
  /** MediaBox origin X (usually 0) */
  mediaBoxX: number;
  /** MediaBox origin Y (usually 0) */
  mediaBoxY: number;
  /** Whether text extraction detected 0 extractable characters (scanned page candidate) */
  isScannedCandidate: boolean;
  /** Whether OCR has been executed on this page */
  ocrCompleted: boolean;
  /** Cached thumbnail data URL */
  thumbnailDataUrl?: string;
}

export interface ExtractedTextItem {
  id: string;
  pageId: string;
  text: string;
  /** Canonical top-left X in display PDF points (after page rotation, at scale 1.0) */
  x: number;
  /** Canonical top-left Y in display PDF points (after page rotation, at scale 1.0) */
  y: number;
  /** Width in PDF points */
  width: number;
  /** Height in PDF points */
  height: number;
  /** Estimated font size in PDF points */
  fontSize: number;
  /** Raw PDF font identifier (e.g., 'BCDFEE+Helvetica-Bold') */
  rawFontName: string;
  /** Mapped editor font family */
  mappedFontFamily: string;
  /** Inferred bold weight */
  fontWeight: 'normal' | 'bold';
  /** Inferred italic style */
  fontStyle: 'normal' | 'italic';
  /** True when the original PDF uses an embedded subset/CID font requiring fallback */
  isUnsupportedFont: boolean;
  /** Sampled background hex color beneath this text item (defaults to #FFFFFF) */
  sampledBgColor?: string;
}

export interface RecentDocumentMeta {
  id: string;
  name: string;
  pageCount: number;
  fileSizeBytes: number;
  lastOpenedIso: string;
}
