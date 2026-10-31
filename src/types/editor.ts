export type ActiveTool =
  | 'select'
  | 'text'
  | 'edit-pdf-text'
  | 'image'
  | 'signature';

export type TextAlignment = 'left' | 'center' | 'right';

export type BuiltInFontFamily =
  | 'Helvetica'
  | 'Arial'
  | 'Times New Roman'
  | 'Courier'
  | 'Roboto'
  | 'Noto Sans Bengali'
  | 'Noto Serif Bengali';

export interface CustomFontAsset {
  id: string;
  familyName: string;
  fileName: string;
  bytes: Uint8Array;
}

export interface CoverRectSpec {
  /** Canonical top-left X in PDF points */
  x: number;
  /** Canonical top-left Y in PDF points */
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface BaseEditorObject {
  id: string;
  pageId: string;
  /** Canonical top-left X in PDF points (scale = 1.0) */
  x: number;
  /** Canonical top-left Y in PDF points (scale = 1.0) */
  y: number;
  /** Unscaled width in PDF points */
  width: number;
  /** Unscaled height in PDF points */
  height: number;
  /** Clockwise rotation in degrees around top-left corner */
  rotation: number;
  /** Opacity from 0 to 1 */
  opacity: number;
}

export interface TextEditorObject extends BaseEditorObject {
  type: 'text' | 'text-replacement';
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  underline: boolean;
  color: string;
  /** 'transparent' or hex color string */
  backgroundColor: string;
  textAlign: TextAlignment;
  lineHeight: number;
  /** Original PDF text if type === 'text-replacement' */
  originalText?: string;
  /** Linked ExtractedTextItem ID if replacing existing PDF text */
  sourceRegionId?: string;
  /** Background cover rectangle used to mask original PDF text cleanly */
  coverRect?: CoverRectSpec;
  /** True when original PDF font was subset/unsupported and mapped to fallback */
  usedFallbackFont?: boolean;
  /** True when created via Tesseract OCR */
  isOcrDerived?: boolean;
}

export interface ImageEditorObject extends BaseEditorObject {
  type: 'image' | 'signature';
  /** Normalized PNG or JPEG data URL */
  src: string;
  mimeType: 'image/png' | 'image/jpeg';
  naturalWidth: number;
  naturalHeight: number;
}

export type EditorObject = TextEditorObject | ImageEditorObject;

export interface ExportOptions {
  fileName: string;
  pageScope: 'all' | 'current' | 'custom';
  customRange: string;
  flattenMetadata?: boolean;
}

export interface ToastNotification {
  id: string;
  kind: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
}
