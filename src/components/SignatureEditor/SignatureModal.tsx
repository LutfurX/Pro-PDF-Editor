import React, { useEffect, useRef, useState } from 'react';
import { X, Eraser, Check, Upload, PenTool } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import { useEditor } from '../../hooks/useEditor';
import { getPageDisplayDimensions } from '../../utils/coordinateConverter';

export const SignatureModal: React.FC = () => {
  const isOpen = useEditorStore((s) => s.isSignatureModalOpen);
  const setSignatureModalOpen = useEditorStore((s) => s.setSignatureModalOpen);
  const addObject = useEditorStore((s) => s.addObject);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);
  const addToast = useEditorStore((s) => s.addToast);

  const { currentPage, insertImageFile } = useEditor();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<'draw' | 'upload'>('draw');
  const [inkColor, setInkColor] = useState('#0F172A');
  const [strokeWidth, setStrokeWidth] = useState(2.6);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!isOpen || tab !== 'draw') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStrokes(false);
  }, [isOpen, tab]);

  if (!isOpen || !currentPage) return null;

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = getCanvasPoint(e);
    lastPointRef.current = pt;
    setIsDrawing(true);
    setHasStrokes(true);

    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.fillStyle = inkColor;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, strokeWidth / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !lastPointRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const pt = getCanvasPoint(e);
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = strokeWidth * 1.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    lastPointRef.current = pt;
  };

  const handlePointerUp = () => {
    setIsDrawing(false);
    lastPointRef.current = null;
  };

  const handleClearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStrokes(false);
  };

  const handleInsertDrawnSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasStrokes) {
      addToast({
        kind: 'warning',
        title: 'Empty Signature Pad',
        message: 'Please draw your signature before inserting.',
      });
      return;
    }

    const dataUrl = canvas.toDataURL('image/png');
    const dims = getPageDisplayDimensions(currentPage);
    const targetW = 175;
    const targetH = Math.round((canvas.height / canvas.width) * targetW);

    addObject({
      id: `obj_sig_${Date.now()}`,
      pageId: currentPage.id,
      type: 'signature',
      src: dataUrl,
      mimeType: 'image/png',
      naturalWidth: canvas.width,
      naturalHeight: canvas.height,
      x: Math.round((dims.width - targetW) / 2),
      y: Math.round(dims.height * 0.65),
      width: targetW,
      height: targetH,
      rotation: 0,
      opacity: 1,
    });

    setSignatureModalOpen(false);
    setActiveTool('select');
    addToast({
      kind: 'success',
      title: 'Signature Placed on Page',
      message: 'Drag to position your signature anywhere on the PDF.',
    });
  };

  const handleUploadSignatureImage = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const inserted = await insertImageFile(file, 'signature');
    if (inserted) {
      setSignatureModalOpen(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add Signature"
      className="fixed inset-0 z-50 bg-slate-950/55 flex items-center justify-center p-4"
    >
      <div className="w-full max-w-lg rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PenTool className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Add Handwritten or Image Signature
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              setSignatureModalOpen(false);
              setActiveTool('select');
            }}
            aria-label="Close signature dialog"
            className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Segmented Mode Control */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setTab('draw')}
              className={`py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                tab === 'draw'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              Draw Signature
            </button>
            <button
              type="button"
              onClick={() => setTab('upload')}
              className={`py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                tab === 'upload'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              Upload Signature Image
            </button>
          </div>

          {tab === 'draw' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-600 dark:text-slate-300">Ink:</span>
                  {(
                    [
                      { hex: '#0F172A', name: 'Black Ink' },
                      { hex: '#1D4ED8', name: 'Blue Ink' },
                      { hex: '#991B1B', name: 'Crimson Ink' },
                    ] as const
                  ).map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      aria-label={c.name}
                      onClick={() => setInkColor(c.hex)}
                      style={{ backgroundColor: c.hex }}
                      className={`w-5 h-5 rounded-full cursor-pointer ${
                        inkColor === c.hex
                          ? 'ring-2 ring-offset-2 ring-blue-600 dark:ring-offset-slate-900'
                          : ''
                      }`}
                    />
                  ))}
                </div>

                <label className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <span>Stroke</span>
                  <input
                    type="range"
                    min={1.5}
                    max={5}
                    step={0.5}
                    value={strokeWidth}
                    onChange={(e) => setStrokeWidth(Number(e.target.value))}
                    className="w-20 accent-blue-600"
                  />
                </label>
              </div>

              <div className="rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white overflow-hidden relative">
                <canvas
                  ref={canvasRef}
                  data-testid="signature-draw-canvas"
                  width={680}
                  height={240}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  className="w-full h-44 touch-none cursor-crosshair block"
                />
                <div className="pointer-events-none absolute inset-x-8 bottom-8 border-b border-slate-200 text-[10px] text-slate-400 pb-1">
                  Sign above baseline (transparent PNG background)
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={handleClearCanvas}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  <span>Clear Pad</span>
                </button>

                <button
                  type="button"
                  onClick={handleInsertDrawnSignature}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Insert Signature</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center space-y-4">
              <input
                ref={uploadInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleUploadSignatureImage}
                className="sr-only"
                aria-label="Upload signature image"
              />
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Upload a transparent PNG, JPG, or WebP image of your handwritten
                signature or company stamp.
              </p>
              <button
                type="button"
                onClick={() => uploadInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Choose Signature Image</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
