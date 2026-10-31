import React, { useEffect, useRef } from 'react';
import { Canvas, FabricImage, FabricObject, Rect, Textbox } from 'fabric';
import type {
  ActiveTool,
  CustomFontAsset,
  EditorObject,
  ImageEditorObject,
  TextEditorObject,
} from '../../types/editor';
import { getCssFontStack } from '../../utils/fontManager';

interface FabricTaggedObject extends FabricObject {
  editorObjectId?: string;
  editorObjectType?: EditorObject['type'];
  isCoverMask?: boolean;
  isEditing?: boolean;
}

interface FabricOverlayCanvasProps {
  widthPx: number;
  heightPx: number;
  zoom: number;
  activeTool: ActiveTool;
  objects: EditorObject[];
  selectedObjectId: string | null;
  customFonts: CustomFontAsset[];
  pointerPassthrough?: boolean;
  onSelectObject: (id: string | null) => void;
  onUpdateObject: (
    id: string,
    patch: Partial<EditorObject>,
    coalesceKey?: string
  ) => void;
  onCanvasClickInsertText: (canonicalX: number, canonicalY: number) => void;
}

export const FabricOverlayCanvas: React.FC<FabricOverlayCanvasProps> = ({
  widthPx,
  heightPx,
  zoom,
  activeTool,
  objects,
  selectedObjectId,
  customFonts,
  pointerPassthrough = false,
  onSelectObject,
  onUpdateObject,
  onCanvasClickInsertText,
}) => {
  const htmlCanvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<Canvas | null>(null);
  const isInternalSyncRef = useRef(false);

  // Keep latest callbacks/props in refs so Fabric event listeners never go stale
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const activeToolRef = useRef(activeTool);
  activeToolRef.current = activeTool;
  const objectsRef = useRef(objects);
  objectsRef.current = objects;
  const onSelectRef = useRef(onSelectObject);
  onSelectRef.current = onSelectObject;
  const onUpdateRef = useRef(onUpdateObject);
  onUpdateRef.current = onUpdateObject;
  const onInsertTextRef = useRef(onCanvasClickInsertText);
  onInsertTextRef.current = onCanvasClickInsertText;

  // 1. Mount Fabric.js Canvas once
  useEffect(() => {
    const el = htmlCanvasRef.current;
    if (!el) return;

    const fc = new Canvas(el, {
      width: Math.max(1, widthPx),
      height: Math.max(1, heightPx),
      selection: true,
      preserveObjectStacking: true,
    });
    fabricCanvasRef.current = fc;

    fc.on('selection:created', (ev) => {
      if (isInternalSyncRef.current) return;
      const first = ev.selected?.[0] as FabricTaggedObject | undefined;
      onSelectRef.current(first?.editorObjectId ?? null);
    });

    fc.on('selection:updated', (ev) => {
      if (isInternalSyncRef.current) return;
      const first = ev.selected?.[0] as FabricTaggedObject | undefined;
      onSelectRef.current(first?.editorObjectId ?? null);
    });

    fc.on('selection:cleared', () => {
      if (isInternalSyncRef.current) return;
      onSelectRef.current(null);
    });

    fc.on('mouse:down', (opt) => {
      if (activeToolRef.current === 'text' && !opt.target) {
        const pt = fc.getScenePoint(opt.e);
        const currentZoom = zoomRef.current || 1;
        onInsertTextRef.current(pt.x / currentZoom, pt.y / currentZoom);
      }
    });

    fc.on('object:modified', (ev) => {
      const target = ev.target as FabricTaggedObject | undefined;
      if (!target || !target.editorObjectId) return;

      const currentZoom = zoomRef.current || 1;
      const objId = target.editorObjectId;
      const storeObj = objectsRef.current.find((o) => o.id === objId);
      if (!storeObj) return;

      if (target instanceof Textbox) {
        const scaleX = target.scaleX || 1;
        const scaleY = target.scaleY || 1;
        const baseFontSize =
          storeObj.type === 'text' || storeObj.type === 'text-replacement'
            ? storeObj.fontSize
            : 14;

        const nextFontSize =
          Math.abs(scaleY - 1) > 0.02
            ? Number(Math.max(6, baseFontSize * scaleY).toFixed(1))
            : baseFontSize;

        const nextWidth = Number(
          Math.max(24, ((target.width || 80) * scaleX) / currentZoom).toFixed(2)
        );
        const nextHeight = Number(
          Math.max(12, ((target.height || 20) * scaleY) / currentZoom).toFixed(2)
        );

        target.set({
          scaleX: 1,
          scaleY: 1,
          width: nextWidth * currentZoom,
          fontSize: nextFontSize * currentZoom,
        });
        fc.requestRenderAll();

        onUpdateRef.current(objId, {
          x: Number(((target.left || 0) / currentZoom).toFixed(2)),
          y: Number(((target.top || 0) / currentZoom).toFixed(2)),
          width: nextWidth,
          height: nextHeight,
          fontSize: nextFontSize,
          rotation: Number((target.angle || 0).toFixed(1)),
        });
      } else {
        const scaledWidth = target.getScaledWidth();
        const scaledHeight = target.getScaledHeight();
        onUpdateRef.current(objId, {
          x: Number(((target.left || 0) / currentZoom).toFixed(2)),
          y: Number(((target.top || 0) / currentZoom).toFixed(2)),
          width: Number(Math.max(16, scaledWidth / currentZoom).toFixed(2)),
          height: Number(Math.max(16, scaledHeight / currentZoom).toFixed(2)),
          rotation: Number((target.angle || 0).toFixed(1)),
        });
      }
    });

    fc.on('text:changed', (ev) => {
      const target = ev.target as (Textbox & FabricTaggedObject) | undefined;
      if (!target || !target.editorObjectId) return;
      const currentZoom = zoomRef.current || 1;
      onUpdateRef.current(
        target.editorObjectId,
        {
          text: target.text || '',
          height: Number(
            Math.max(12, (target.height || 20) / currentZoom).toFixed(2)
          ),
        },
        'inline-typing'
      );
    });

    return () => {
      fabricCanvasRef.current = null;
      void fc.dispose();
    };
  }, []);

  // 2. Sync canvas dimensions when zoom or page size changes
  useEffect(() => {
    const fc = fabricCanvasRef.current;
    if (!fc) return;
    fc.setDimensions({
      width: Math.max(1, Math.round(widthPx)),
      height: Math.max(1, Math.round(heightPx)),
    });
    fc.requestRenderAll();
  }, [widthPx, heightPx]);

  // 3. Sync store EditorObjects -> Fabric objects cleanly
  useEffect(() => {
    const fc = fabricCanvasRef.current;
    if (!fc) return;

    let cancelled = false;

    const syncObjects = async () => {
      const activeFabricObj = fc.getActiveObject() as
        | (Textbox & FabricTaggedObject)
        | undefined;

      // If the user is actively typing inline inside a Textbox on the canvas,
      // update its styling properties in place without destroying focus/cursor!
      if (
        activeFabricObj &&
        activeFabricObj.isEditing &&
        activeFabricObj.editorObjectId
      ) {
        const matching = objects.find(
          (o) => o.id === activeFabricObj.editorObjectId
        );
        if (
          matching &&
          (matching.type === 'text' || matching.type === 'text-replacement')
        ) {
          activeFabricObj.set({
            fontFamily: getCssFontStack(matching.fontFamily, customFonts),
            fontSize: matching.fontSize * zoom,
            fontWeight: matching.fontWeight,
            fontStyle: matching.fontStyle,
            underline: matching.underline,
            fill: matching.color,
            backgroundColor:
              matching.backgroundColor === 'transparent'
                ? ''
                : matching.backgroundColor,
            textAlign: matching.textAlign,
            opacity: matching.opacity,
          });
          fc.requestRenderAll();
          return;
        }
      }

      isInternalSyncRef.current = true;
      fc.clear();

      // Pass 1: Add non-interactive coverRect masks for `text-replacement` objects
      for (const obj of objects) {
        if (obj.type === 'text-replacement' && obj.coverRect) {
          const mask = new Rect({
            originX: 'left',
            originY: 'top',
            left: obj.coverRect.x * zoom,
            top: obj.coverRect.y * zoom,
            width: obj.coverRect.width * zoom,
            height: obj.coverRect.height * zoom,
            fill: obj.coverRect.color || '#FFFFFF',
            selectable: false,
            evented: false,
            hoverCursor: 'default',
          }) as Rect & FabricTaggedObject;
          mask.isCoverMask = true;
          fc.add(mask);
        }
      }

      // Pass 2: Add interactive text, replacement text, images, and signatures
      const createdById = new Map<string, FabricTaggedObject>();

      for (const obj of objects) {
        if (cancelled) return;

        if (obj.type === 'text' || obj.type === 'text-replacement') {
          const tb = buildFabricTextbox(obj, zoom, customFonts);
          fc.add(tb);
          createdById.set(obj.id, tb);
        } else if (obj.type === 'image' || obj.type === 'signature') {
          try {
            const fImg = await buildFabricImage(obj, zoom);
            if (cancelled) return;
            fc.add(fImg);
            createdById.set(obj.id, fImg);
          } catch {
            // Skip broken image gracefully
          }
        }
      }

      if (selectedObjectId) {
        const toSelect = createdById.get(selectedObjectId);
        if (toSelect) {
          fc.setActiveObject(toSelect);
        }
      }

      fc.requestRenderAll();
      isInternalSyncRef.current = false;
    };

    void syncObjects();

    return () => {
      cancelled = true;
    };
  }, [objects, zoom, selectedObjectId, customFonts]);

  return (
    <div
      data-testid="fabric-overlay-wrapper"
      style={{ width: `${widthPx}px`, height: `${heightPx}px` }}
      className={`absolute inset-0 z-20 ${
        pointerPassthrough
          ? 'pointer-events-none'
          : activeTool === 'text'
          ? 'cursor-text'
          : 'cursor-default'
      }`}
    >
      <canvas ref={htmlCanvasRef} />
    </div>
  );
};

function buildFabricTextbox(
  obj: TextEditorObject,
  zoom: number,
  customFonts: CustomFontAsset[]
): Textbox & FabricTaggedObject {
  const tb = new Textbox(obj.text, {
    originX: 'left',
    originY: 'top',
    left: obj.x * zoom,
    top: obj.y * zoom,
    width: Math.max(24, obj.width * zoom),
    fontSize: obj.fontSize * zoom,
    fontFamily: getCssFontStack(obj.fontFamily, customFonts),
    fontWeight: obj.fontWeight,
    fontStyle: obj.fontStyle,
    underline: obj.underline,
    fill: obj.color || '#0F172A',
    backgroundColor:
      obj.backgroundColor && obj.backgroundColor !== 'transparent'
        ? obj.backgroundColor
        : '',
    textAlign: obj.textAlign,
    lineHeight: obj.lineHeight || 1.2,
    opacity: obj.opacity,
    angle: obj.rotation || 0,
    cornerColor: '#2563EB',
    cornerStyle: 'circle',
    cornerSize: 8,
    transparentCorners: false,
    borderColor: '#2563EB',
    padding: 2,
    splitByGrapheme: false,
  }) as Textbox & FabricTaggedObject;

  tb.editorObjectId = obj.id;
  tb.editorObjectType = obj.type;
  return tb;
}

async function buildFabricImage(
  obj: ImageEditorObject,
  zoom: number
): Promise<FabricImage & FabricTaggedObject> {
  const fImg = (await FabricImage.fromURL(obj.src, {
    crossOrigin: 'anonymous',
  })) as FabricImage & FabricTaggedObject;

  const natW = Math.max(1, fImg.width || obj.naturalWidth || 100);
  const natH = Math.max(1, fImg.height || obj.naturalHeight || 100);

  fImg.set({
    originX: 'left',
    originY: 'top',
    left: obj.x * zoom,
    top: obj.y * zoom,
    scaleX: (obj.width * zoom) / natW,
    scaleY: (obj.height * zoom) / natH,
    angle: obj.rotation || 0,
    opacity: obj.opacity,
    cornerColor: '#2563EB',
    cornerStyle: 'circle',
    cornerSize: 8,
    transparentCorners: false,
    borderColor: '#2563EB',
  });

  fImg.editorObjectId = obj.id;
  fImg.editorObjectType = obj.type;
  return fImg;
}
