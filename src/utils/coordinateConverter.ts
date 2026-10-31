import type { PageDescriptor, PageRotation } from '../types/pdf';

export interface Point2D {
  x: number;
  y: number;
}

export interface Box2D {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfPlacement {
  x: number;
  y: number;
  angleDegrees: number;
}

/**
 * Normalizes any rotation angle in degrees to 0 | 90 | 180 | 270.
 */
export function normalizePageRotation(deg: number): PageRotation {
  const mod = ((Math.round(deg) % 360) + 360) % 360;
  if (mod === 90 || mod === 180 || mod === 270) {
    return mod;
  }
  return 0;
}

/**
 * Computes the effective clockwise rotation of a page descriptor.
 */
export function getEffectivePageRotation(
  page: Pick<PageDescriptor, 'originalRotation' | 'userRotation'>
): PageRotation {
  return normalizePageRotation(page.originalRotation + page.userRotation);
}

/**
 * Returns the visual (display) width and height of a page in PDF points (scale = 1.0)
 * after applying effective page rotation.
 */
export function getPageDisplayDimensions(
  page: Pick<PageDescriptor, 'rawWidth' | 'rawHeight' | 'originalRotation' | 'userRotation'>
): { width: number; height: number } {
  const rot = getEffectivePageRotation(page);
  if (rot === 90 || rot === 270) {
    return { width: page.rawHeight, height: page.rawWidth };
  }
  return { width: page.rawWidth, height: page.rawHeight };
}

/**
 * Converts canonical unscaled PDF points (top-left origin) to zoomed canvas pixels.
 */
export function canonicalToCanvasBox(box: Box2D, zoom: number): Box2D {
  return {
    x: box.x * zoom,
    y: box.y * zoom,
    width: box.width * zoom,
    height: box.height * zoom,
  };
}

/**
 * Converts zoomed canvas pixels back to canonical unscaled PDF points (top-left origin).
 */
export function canvasToCanonicalBox(box: Box2D, zoom: number): Box2D {
  const safeZoom = zoom > 0 ? zoom : 1;
  return {
    x: box.x / safeZoom,
    y: box.y / safeZoom,
    width: box.width / safeZoom,
    height: box.height / safeZoom,
  };
}

/**
 * Rotates a local vector (lx, ly) clockwise in screen/canonical coordinates (Y down)
 * around origin (ox, oy) by `angleDeg`.
 */
export function rotateVisualOffset(
  ox: number,
  oy: number,
  lx: number,
  ly: number,
  angleDeg: number
): Point2D {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: ox + lx * cos - ly * sin,
    y: oy + lx * sin + ly * cos,
  };
}

/**
 * Maps a point (vx, vy) in canonical visual page space (top-left origin, Y down,
 * after `totalRotation` clockwise) into raw PDF MediaBox coordinates (bottom-left
 * origin, Y up) along with the base counter-clockwise angle in PDF space.
 */
export function visualPointToRawPdf(
  vx: number,
  vy: number,
  rawWidth: number,
  rawHeight: number,
  totalRotation: PageRotation,
  mediaBoxX = 0,
  mediaBoxY = 0
): PdfPlacement {
  switch (totalRotation) {
    case 90:
      return {
        x: mediaBoxX + vy,
        y: mediaBoxY + vx,
        angleDegrees: 90,
      };
    case 180:
      return {
        x: mediaBoxX + (rawWidth - vx),
        y: mediaBoxY + vy,
        angleDegrees: 180,
      };
    case 270:
      return {
        x: mediaBoxX + (rawWidth - vy),
        y: mediaBoxY + (rawHeight - vx),
        angleDegrees: -90,
      };
    case 0:
    default:
      return {
        x: mediaBoxX + vx,
        y: mediaBoxY + (rawHeight - vy),
        angleDegrees: 0,
      };
  }
}

/**
 * Computes the exact pdf-lib anchor point (local bottom-left corner) and CCW rotation
 * angle in degrees for a rectangular element (image, signature, or background box)
 * defined by canonical top-left `(x, y)`, `(width, height)`, and clockwise `rotation`.
 */
export function canonicalBoxToPdfPlacement(
  box: Box2D,
  objectRotationDeg: number,
  page: Pick<
    PageDescriptor,
    'rawWidth' | 'rawHeight' | 'originalRotation' | 'userRotation' | 'mediaBoxX' | 'mediaBoxY'
  >
): PdfPlacement {
  const totalRotation = getEffectivePageRotation(page);
  // Local bottom-left corner of the box is at (0, height) relative to its top-left (x, y)
  const visualBottomLeft = rotateVisualOffset(
    box.x,
    box.y,
    0,
    box.height,
    objectRotationDeg
  );
  const raw = visualPointToRawPdf(
    visualBottomLeft.x,
    visualBottomLeft.y,
    page.rawWidth,
    page.rawHeight,
    totalRotation,
    page.mediaBoxX,
    page.mediaBoxY
  );
  return {
    x: raw.x,
    y: raw.y,
    angleDegrees: raw.angleDegrees - objectRotationDeg,
  };
}

/**
 * Computes the exact pdf-lib text baseline anchor and CCW rotation angle for a single
 * line of text located at local offset `(localX, baselineOffsetY)` inside a text box
 * whose canonical top-left is `(boxX, boxY)` rotated clockwise by `objectRotationDeg`.
 */
export function canonicalTextLineToPdfPlacement(
  boxX: number,
  boxY: number,
  localX: number,
  baselineOffsetY: number,
  objectRotationDeg: number,
  page: Pick<
    PageDescriptor,
    'rawWidth' | 'rawHeight' | 'originalRotation' | 'userRotation' | 'mediaBoxX' | 'mediaBoxY'
  >
): PdfPlacement {
  const totalRotation = getEffectivePageRotation(page);
  const visualBaselineStart = rotateVisualOffset(
    boxX,
    boxY,
    localX,
    baselineOffsetY,
    objectRotationDeg
  );
  const raw = visualPointToRawPdf(
    visualBaselineStart.x,
    visualBaselineStart.y,
    page.rawWidth,
    page.rawHeight,
    totalRotation,
    page.mediaBoxX,
    page.mediaBoxY
  );
  return {
    x: raw.x,
    y: raw.y,
    angleDegrees: raw.angleDegrees - objectRotationDeg,
  };
}

/**
 * Parses a human page range string (e.g. "1-3, 5") into 0-based page indices.
 * Returns null with an error string if invalid.
 */
export function parsePageRange(
  rangeInput: string,
  totalPages: number
): { indices: number[]; error?: string } {
  const trimmed = rangeInput.trim();
  if (!trimmed) {
    return { indices: [], error: 'Please enter at least one page number (e.g., 1-3, 5).' };
  }

  const indicesSet = new Set<number>();
  const parts = trimmed.split(',').map((p) => p.trim()).filter(Boolean);

  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr, extra] = part.split('-').map((s) => s.trim());
      if (extra !== undefined || !startStr || !endStr) {
        return { indices: [], error: `Invalid range segment "${part}".` };
      }
      const start = Number(startStr);
      const end = Number(endStr);
      if (
        !Number.isInteger(start) ||
        !Number.isInteger(end) ||
        start < 1 ||
        end < start ||
        end > totalPages
      ) {
        return {
          indices: [],
          error: `Range "${part}" must be between 1 and ${totalPages}.`,
        };
      }
      for (let p = start; p <= end; p++) {
        indicesSet.add(p - 1);
      }
    } else {
      const pageNum = Number(part);
      if (!Number.isInteger(pageNum) || pageNum < 1 || pageNum > totalPages) {
        return {
          indices: [],
          error: `Page "${part}" must be an integer between 1 and ${totalPages}.`,
        };
      }
      indicesSet.add(pageNum - 1);
    }
  }

  const sorted = Array.from(indicesSet).sort((a, b) => a - b);
  return { indices: sorted };
}
