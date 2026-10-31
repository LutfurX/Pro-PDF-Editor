import type { BuiltInFontFamily, CustomFontAsset } from '../types/editor';

export interface FontOption {
  family: string;
  label: string;
  category: 'sans' | 'serif' | 'mono' | 'bengali' | 'custom';
  supportsBengali: boolean;
  supportsFullUnicode: boolean;
  cssStack: string;
  regularUrl?: string;
  boldUrl?: string;
  italicUrl?: string;
  boldItalicUrl?: string;
}

export const BUILT_IN_FONTS: FontOption[] = [
  {
    family: 'Helvetica',
    label: 'Helvetica (Standard PDF)',
    category: 'sans',
    supportsBengali: false,
    supportsFullUnicode: false,
    cssStack: 'Helvetica, Arial, sans-serif',
  },
  {
    family: 'Arial',
    label: 'Arial',
    category: 'sans',
    supportsBengali: false,
    supportsFullUnicode: true,
    cssStack: 'Arial, Helvetica, sans-serif',
    regularUrl: '/fonts/NotoSans-Regular.ttf',
    boldUrl: '/fonts/NotoSans-Bold.ttf',
    italicUrl: '/fonts/NotoSans-Italic.ttf',
    boldItalicUrl: '/fonts/NotoSans-BoldItalic.ttf',
  },
  {
    family: 'Times New Roman',
    label: 'Times New Roman',
    category: 'serif',
    supportsBengali: false,
    supportsFullUnicode: true,
    cssStack: '"Times New Roman", Times, serif',
    regularUrl: '/fonts/NotoSerif-Regular.ttf',
    boldUrl: '/fonts/NotoSerif-Bold.ttf',
  },
  {
    family: 'Courier',
    label: 'Courier',
    category: 'mono',
    supportsBengali: false,
    supportsFullUnicode: false,
    cssStack: '"Courier New", Courier, monospace',
  },
  {
    family: 'Roboto',
    label: 'Roboto',
    category: 'sans',
    supportsBengali: false,
    supportsFullUnicode: true,
    cssStack: 'Roboto, sans-serif',
    regularUrl: '/fonts/NotoSans-Regular.ttf',
    boldUrl: '/fonts/NotoSans-Bold.ttf',
    italicUrl: '/fonts/NotoSans-Italic.ttf',
    boldItalicUrl: '/fonts/NotoSans-BoldItalic.ttf',
  },
  {
    family: 'Noto Sans Bengali',
    label: 'Noto Sans Bengali (বাংলা স্যান্স)',
    category: 'bengali',
    supportsBengali: true,
    supportsFullUnicode: true,
    cssStack: '"Noto Sans Bengali", Roboto, sans-serif',
    regularUrl: '/fonts/NotoSansBengali-Regular.ttf',
    boldUrl: '/fonts/NotoSansBengali-Bold.ttf',
  },
  {
    family: 'Noto Serif Bengali',
    label: 'Noto Serif Bengali (বাংলা সেরিফ)',
    category: 'bengali',
    supportsBengali: true,
    supportsFullUnicode: true,
    cssStack: '"Noto Serif Bengali", "Times New Roman", serif',
    regularUrl: '/fonts/NotoSerifBengali-Regular.ttf',
    boldUrl: '/fonts/NotoSerifBengali-Bold.ttf',
  },
];

const BENGALI_REGEX = /[\u0980-\u09FF]/;
// WinAnsi supports standard ASCII + Latin-1 supplement (roughly <= 0x00FF plus select punctuation)
const NON_WINANSI_REGEX = /[^\x00-\xFF\u2013\u2014\u2018\u2019\u201C\u201D\u2022\u2026\u20AC\u2122]/;

const fontBytesCache = new Map<string, Uint8Array>();

export function containsBengali(text: string): boolean {
  return BENGALI_REGEX.test(text);
}

export function containsNonWinAnsi(text: string): boolean {
  return NON_WINANSI_REGEX.test(text);
}

/**
 * Resolves the appropriate font family when text contains Bengali characters
 * and the currently chosen font lacks Bengali glyphs.
 */
export function resolveFontForText(
  requestedFamily: string,
  text: string,
  customFonts: CustomFontAsset[] = []
): { resolvedFamily: string; switchedForBengali: boolean } {
  if (!containsBengali(text)) {
    return { resolvedFamily: requestedFamily, switchedForBengali: false };
  }

  if (
    requestedFamily === 'Noto Sans Bengali' ||
    requestedFamily === 'Noto Serif Bengali'
  ) {
    return { resolvedFamily: requestedFamily, switchedForBengali: false };
  }

  // If the user explicitly selected a custom uploaded TTF/OTF font, keep it first;
  // pdfExporter will still validate glyph support and fall back to Noto Sans Bengali if needed.
  const isCustom = customFonts.some((f) => f.familyName === requestedFamily);
  if (isCustom) {
    return { resolvedFamily: requestedFamily, switchedForBengali: false };
  }

  const fallback: BuiltInFontFamily =
    requestedFamily === 'Times New Roman'
      ? 'Noto Serif Bengali'
      : 'Noto Sans Bengali';

  return { resolvedFamily: fallback, switchedForBengali: true };
}

/**
 * Maps a raw PDF.js font identifier (such as "BCDFEE+TimesNewRomanPS-BoldMT" or "g_d0_f1")
 * to a clean ProPDF Studio font family, weight, style, and fallback indicator.
 */
export function mapPdfFontName(rawFontName: string, sampleText = ''): {
  family: BuiltInFontFamily;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  isUnsupportedFont: boolean;
} {
  const cleaned = (rawFontName || '').replace(/^[A-Z]{6}\+/, '');
  const lower = cleaned.toLowerCase();

  const fontWeight: 'normal' | 'bold' =
    lower.includes('bold') || lower.includes('black') || lower.includes('semibold') || lower.includes('-bd')
      ? 'bold'
      : 'normal';

  const fontStyle: 'normal' | 'italic' =
    lower.includes('italic') || lower.includes('oblique') || lower.includes('-it')
      ? 'italic'
      : 'normal';

  if (containsBengali(sampleText) || lower.includes('bengali') || lower.includes('kalpurush') || lower.includes('solaiman') || lower.includes('nikosh') || lower.includes('vrinda')) {
    const isSerif = lower.includes('serif');
    const isExactNoto = lower.includes('notosansbengali') || lower.includes('notoserifbengali');
    return {
      family: isSerif ? 'Noto Serif Bengali' : 'Noto Sans Bengali',
      fontWeight,
      fontStyle,
      isUnsupportedFont: !isExactNoto,
    };
  }

  if (lower.includes('courier') || lower.includes('mono') || lower.includes('consolas')) {
    return { family: 'Courier', fontWeight, fontStyle, isUnsupportedFont: false };
  }

  if (lower.includes('roboto')) {
    return { family: 'Roboto', fontWeight, fontStyle, isUnsupportedFont: false };
  }

  if (lower.includes('arial')) {
    return { family: 'Arial', fontWeight, fontStyle, isUnsupportedFont: false };
  }

  if (lower.includes('helvetica') || lower.includes('sans-serif') || lower.includes('sans')) {
    const isStandardSans = lower.includes('helvetica') || lower.includes('sans-serif');
    return {
      family: 'Helvetica',
      fontWeight,
      fontStyle,
      isUnsupportedFont: !isStandardSans,
    };
  }

  if (
    lower.includes('times') ||
    lower.includes('georgia') ||
    lower.includes('garamond') ||
    lower.includes('cambria') ||
    lower.includes('serif')
  ) {
    const isStandardSerif = lower.includes('times') || lower.includes('serif');
    return {
      family: 'Times New Roman',
      fontWeight,
      fontStyle,
      isUnsupportedFont: !isStandardSerif,
    };
  }

  // Generic PDF.js internal name like "g_d0_f1" or custom embedded font
  return {
    family: 'Helvetica',
    fontWeight,
    fontStyle,
    isUnsupportedFont: true,
  };
}

/**
 * Fetches and caches a local font file from `/fonts/...` (browser fetch or Node fs fallback for tests).
 */
export async function loadBuiltInFontBytes(urlPath: string): Promise<Uint8Array> {
  const cached = fontBytesCache.get(urlPath);
  if (cached) {
    return cached;
  }

  if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
    const res = await fetch(urlPath);
    if (!res.ok) {
      throw new Error(`Failed to load font asset "${urlPath}" (${res.status})`);
    }
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    fontBytesCache.set(urlPath, bytes);
    return bytes;
  }

  // Node.js fallback for fast unit testing with node:test
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const diskPath = path.join(process.cwd(), 'public', urlPath.replace(/^\//, ''));
  const buf = await fs.readFile(diskPath);
  const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  fontBytesCache.set(urlPath, bytes);
  return bytes;
}

/**
 * Registers a user-uploaded .ttf or .otf file into the browser's FontFaceSet
 * and returns a CustomFontAsset for state & pdf-lib embedding.
 */
export async function registerCustomFontFile(file: File): Promise<CustomFontAsset> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext !== 'ttf' && ext !== 'otf') {
    throw new Error('Unsupported font format. Please upload a .ttf or .otf font file.');
  }

  const buffer = await file.arrayBuffer();
  if (buffer.byteLength < 64) {
    throw new Error('The uploaded font file appears corrupted or empty.');
  }

  const rawBaseName = file.name.replace(/\.(ttf|otf)$/i, '').replace(/[-_]+/g, ' ').trim();
  const familyName = rawBaseName || `CustomFont_${Date.now()}`;

  if (typeof window !== 'undefined' && 'FontFace' in window && document?.fonts) {
    const fontFace = new FontFace(familyName, buffer.slice(0));
    await fontFace.load();
    document.fonts.add(fontFace);
  }

  return {
    id: `font_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    familyName,
    fileName: file.name,
    bytes: new Uint8Array(buffer),
  };
}

export function getCssFontStack(family: string, customFonts: CustomFontAsset[] = []): string {
  const builtIn = BUILT_IN_FONTS.find((f) => f.family === family);
  if (builtIn) {
    return builtIn.cssStack;
  }
  const custom = customFonts.find((f) => f.familyName === family);
  if (custom) {
    return `"${custom.familyName}", "Noto Sans Bengali", sans-serif`;
  }
  return `"${family}", "Noto Sans Bengali", sans-serif`;
}
