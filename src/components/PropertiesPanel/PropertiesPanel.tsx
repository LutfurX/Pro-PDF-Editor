import React, { useRef } from 'react';
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Copy,
  Trash2,
  Upload,
  RotateCcw,
  Type,
  Languages,
  PenTool,
} from 'lucide-react';
import { useEditor } from '../../hooks/useEditor';
import { useEditorStore } from '../../store/editorStore';
import {
  BUILT_IN_FONTS,
  containsBengali,
  registerCustomFontFile,
} from '../../utils/fontManager';
import {
  getEffectivePageRotation,
  getPageDisplayDimensions,
} from '../../utils/coordinateConverter';
import type { ImageEditorObject, TextEditorObject } from '../../types/editor';

export const PropertiesPanel: React.FC = () => {
  const fontInputRef = useRef<HTMLInputElement>(null);

  const customFonts = useEditorStore((s) => s.customFonts);
  const addCustomFont = useEditorStore((s) => s.addCustomFont);
  const setSelectedObjectId = useEditorStore((s) => s.setSelectedObjectId);
  const setSignatureModalOpen = useEditorStore((s) => s.setSignatureModalOpen);
  const addToast = useEditorStore((s) => s.addToast);

  const {
    currentPage,
    currentPageObjects,
    selectedObject,
    insertTextAt,
    updateObject,
    deleteObject,
    duplicateObject,
  } = useEditor();

  const handleUploadCustomFont = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    try {
      const asset = await registerCustomFontFile(file);
      addCustomFont(asset);
      if (
        selectedObject &&
        (selectedObject.type === 'text' ||
          selectedObject.type === 'text-replacement')
      ) {
        updateObject(selectedObject.id, { fontFamily: asset.familyName });
      }
      addToast({
        kind: 'success',
        title: 'Custom Font Registered',
        message: `"${asset.familyName}" is ready for editing and PDF embedding.`,
      });
    } catch (err: unknown) {
      addToast({
        kind: 'error',
        title: 'Font Registration Error',
        message:
          (err as { message?: string })?.message ||
          'Unable to load custom font file.',
      });
    }
  };

  if (!currentPage) {
    return null;
  }

  const pageDims = getPageDisplayDimensions(currentPage);
  const effectiveRotation = getEffectivePageRotation(currentPage);

  return (
    <aside
      aria-label="Object Properties Panel"
      className="w-72 lg:w-80 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col shrink-0 overflow-y-auto"
    >
      <input
        ref={fontInputRef}
        type="file"
        accept=".ttf,.otf"
        onChange={handleUploadCustomFont}
        className="sr-only"
        aria-label="Upload custom TTF or OTF font"
      />

      {!selectedObject ? (
        <div className="p-4 space-y-6">
          <div className="space-y-1">
            <h2 className="text-xs font-semibold text-slate-900 dark:text-white">
              Page & Document Inspector
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select an object on the canvas or insert an element below.
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Dimensions</span>
              <span className="font-mono font-medium text-slate-800 dark:text-slate-200 tabular-nums">
                {Math.round(pageDims.width)} × {Math.round(pageDims.height)} pt
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Rotation</span>
              <span className="font-mono font-medium text-slate-800 dark:text-slate-200 tabular-nums">
                {effectiveRotation}°
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">
                Edited Elements
              </span>
              <span className="font-mono font-medium text-slate-800 dark:text-slate-200 tabular-nums">
                {currentPageObjects.length}
              </span>
            </div>
          </div>

          {/* Quick Insert Helpers */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Quick Insert on Current Page
            </h3>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() =>
                  insertTextAt(
                    48,
                    Math.min(
                      pageDims.height - 80,
                      510 + currentPageObjects.length * 28
                    ),
                    'Sample English Annotation'
                  )
                }
                className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                <Type className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>Insert English Text Box</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  insertTextAt(
                    48,
                    Math.min(
                      pageDims.height - 60,
                      542 + currentPageObjects.length * 28
                    ),
                    'অনুমোদিত নথি — বাংলা সম্পাদনা'
                  )
                }
                className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                <Languages className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>Insert Bengali Text (বাংলা)</span>
              </button>
              <button
                type="button"
                onClick={() => setSignatureModalOpen(true)}
                className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                <PenTool className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>Add Handwritten Signature</span>
              </button>
            </div>
          </div>

          {/* Custom Font Uploader */}
          <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Embedded Font Library
              </h3>
              <button
                type="button"
                onClick={() => fontInputRef.current?.click()}
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                <Upload className="w-3 h-3" />
                <span>Upload TTF/OTF</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Built-in: Helvetica, Arial, Times New Roman, Courier, Roboto, Noto
              Sans Bengali, Noto Serif Bengali
              {customFonts.length > 0
                ? `, plus ${customFonts.length} custom font(s).`
                : '.'}
            </p>
          </div>

          {/* Layer list for current page */}
          {currentPageObjects.length > 0 && (
            <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Page Layers ({currentPageObjects.length})
              </h3>
              <div className="space-y-1">
                {currentPageObjects.map((obj) => {
                  const label =
                    obj.type === 'text' || obj.type === 'text-replacement'
                      ? obj.text || '(Removed text)'
                      : obj.type === 'signature'
                      ? 'Handwritten Signature'
                      : 'Inserted Image';
                  return (
                    <button
                      key={obj.id}
                      type="button"
                      onClick={() => setSelectedObjectId(obj.id)}
                      className="w-full px-2.5 py-1.5 rounded-md text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <span className="truncate">{label}</span>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {obj.type}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : selectedObject.type === 'text' ||
        selectedObject.type === 'text-replacement' ? (
        <TextObjectInspector
          object={selectedObject}
          customFontNames={customFonts.map((f) => f.familyName)}
          onUploadFontClick={() => fontInputRef.current?.click()}
          onUpdate={(patch, coalesceKey) =>
            updateObject(selectedObject.id, patch, coalesceKey)
          }
          onDuplicate={() => duplicateObject(selectedObject.id)}
          onDelete={() => deleteObject(selectedObject.id)}
        />
      ) : (
        <ImageObjectInspector
          object={selectedObject as ImageEditorObject}
          onUpdate={(patch, coalesceKey) =>
            updateObject(selectedObject.id, patch, coalesceKey)
          }
          onDuplicate={() => duplicateObject(selectedObject.id)}
          onDelete={() => deleteObject(selectedObject.id)}
        />
      )}
    </aside>
  );
};

interface TextObjectInspectorProps {
  object: TextEditorObject;
  customFontNames: string[];
  onUploadFontClick: () => void;
  onUpdate: (patch: Partial<TextEditorObject>, coalesceKey?: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

const TextObjectInspector: React.FC<TextObjectInspectorProps> = ({
  object,
  customFontNames,
  onUploadFontClick,
  onUpdate,
  onDuplicate,
  onDelete,
}) => {
  const hasBengali = containsBengali(object.text);

  return (
    <div className="p-4 space-y-4 text-xs">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <h2 className="text-xs font-semibold text-slate-900 dark:text-white">
            {object.type === 'text-replacement'
              ? 'Existing Text Replacement'
              : 'Overlay Text Properties'}
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {object.isOcrDerived
              ? 'Recognized via OCR · Editable'
              : object.type === 'text-replacement'
              ? 'Covers original region & embeds replacement'
              : 'Vector PDF text element'}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onDuplicate}
            aria-label="Duplicate text object"
            title="Duplicate"
            className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={
              object.type === 'text-replacement'
                ? 'Restore original PDF text'
                : 'Delete text object'
            }
            title={
              object.type === 'text-replacement'
                ? 'Restore Original PDF Text'
                : 'Delete Object'
            }
            className="p-1.5 rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
          >
            {object.type === 'text-replacement' ? (
              <RotateCcw className="w-3.5 h-3.5" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Text Content Editor */}
      <div className="space-y-1.5">
        <label
          htmlFor="prop-text-content"
          className="block font-medium text-slate-700 dark:text-slate-300"
        >
          Text Content
        </label>
        <textarea
          id="prop-text-content"
          rows={3}
          value={object.text}
          onChange={(e) => onUpdate({ text: e.target.value }, 'panel-text')}
          placeholder="Enter English or বাংলা text..."
          className="w-full px-2.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
        />
        {hasBengali && (
          <p className="text-[11px] text-blue-600 dark:text-blue-400">
            Bengali script detected — OpenType font embedding active via fontkit.
          </p>
        )}
      </div>

      {/* Font Family + Custom Font Upload */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor="prop-font-family"
            className="font-medium text-slate-700 dark:text-slate-300"
          >
            Font Family
          </label>
          <button
            type="button"
            onClick={onUploadFontClick}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
          >
            <Upload className="w-3 h-3" />
            <span>Custom .TTF/.OTF</span>
          </button>
        </div>
        <select
          id="prop-font-family"
          value={object.fontFamily}
          onChange={(e) => onUpdate({ fontFamily: e.target.value })}
          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
        >
          {BUILT_IN_FONTS.map((f) => (
            <option key={f.family} value={f.family}>
              {f.label}
            </option>
          ))}
          {customFontNames.map((name) => (
            <option key={name} value={name}>
              {name} (Custom Embedded)
            </option>
          ))}
        </select>
      </div>

      {/* Font Size & Weight/Style/Underline */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label
            htmlFor="prop-font-size"
            className="block font-medium text-slate-700 dark:text-slate-300"
          >
            Font Size (pt)
          </label>
          <input
            id="prop-font-size"
            type="number"
            min={6}
            max={144}
            step={0.5}
            value={object.fontSize}
            onChange={(e) =>
              onUpdate(
                { fontSize: Math.max(6, Number(e.target.value) || 12) },
                'font-size'
              )
            }
            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono tabular-nums text-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="space-y-1">
          <span className="block font-medium text-slate-700 dark:text-slate-300">
            Style
          </span>
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800">
            <button
              type="button"
              aria-label="Bold"
              aria-pressed={object.fontWeight === 'bold'}
              onClick={() =>
                onUpdate({
                  fontWeight: object.fontWeight === 'bold' ? 'normal' : 'bold',
                })
              }
              className={`flex-1 py-1.5 rounded-md flex items-center justify-center cursor-pointer ${
                object.fontWeight === 'bold'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              aria-label="Italic"
              aria-pressed={object.fontStyle === 'italic'}
              onClick={() =>
                onUpdate({
                  fontStyle:
                    object.fontStyle === 'italic' ? 'normal' : 'italic',
                })
              }
              className={`flex-1 py-1.5 rounded-md flex items-center justify-center cursor-pointer ${
                object.fontStyle === 'italic'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              aria-label="Underline"
              aria-pressed={object.underline}
              onClick={() => onUpdate({ underline: !object.underline })}
              className={`flex-1 py-1.5 rounded-md flex items-center justify-center cursor-pointer ${
                object.underline
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <Underline className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Alignment */}
      <div className="space-y-1">
        <span className="block font-medium text-slate-700 dark:text-slate-300">
          Alignment
        </span>
        <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800">
          {(
            [
              { val: 'left', icon: AlignLeft, label: 'Align Left' },
              { val: 'center', icon: AlignCenter, label: 'Align Center' },
              { val: 'right', icon: AlignRight, label: 'Align Right' },
            ] as const
          ).map(({ val, icon: Icon, label }) => (
            <button
              key={val}
              type="button"
              aria-label={label}
              aria-pressed={object.textAlign === val}
              onClick={() => onUpdate({ textAlign: val })}
              className={`py-1.5 rounded-md flex items-center justify-center cursor-pointer ${
                object.textAlign === val
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>
      </div>

      {/* Text Color & Background Color */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label
            htmlFor="prop-text-color"
            className="block font-medium text-slate-700 dark:text-slate-300"
          >
            Text Color
          </label>
          <div className="flex items-center gap-2">
            <input
              id="prop-text-color"
              type="color"
              value={object.color}
              onChange={(e) => onUpdate({ color: e.target.value }, 'text-color')}
              className="w-8 h-8 rounded border border-slate-300 dark:border-slate-700 cursor-pointer bg-transparent shrink-0"
            />
            <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300 uppercase">
              {object.color}
            </span>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label
              htmlFor="prop-bg-color"
              className="font-medium text-slate-700 dark:text-slate-300"
            >
              Background
            </label>
            <button
              type="button"
              onClick={() =>
                onUpdate({
                  backgroundColor:
                    object.backgroundColor === 'transparent'
                      ? '#FEF08A'
                      : 'transparent',
                })
              }
              className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              {object.backgroundColor === 'transparent' ? 'Add Fill' : 'Clear'}
            </button>
          </div>
          {object.backgroundColor === 'transparent' ? (
            <div className="h-8 px-2.5 rounded border border-dashed border-slate-300 dark:border-slate-700 flex items-center text-[11px] text-slate-400">
              Transparent
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                id="prop-bg-color"
                type="color"
                value={object.backgroundColor}
                onChange={(e) =>
                  onUpdate({ backgroundColor: e.target.value }, 'bg-color')
                }
                className="w-8 h-8 rounded border border-slate-300 dark:border-slate-700 cursor-pointer bg-transparent shrink-0"
              />
              <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300 uppercase">
                {object.backgroundColor}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Opacity & Rotation */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <div className="flex justify-between">
            <label
              htmlFor="prop-text-opacity"
              className="font-medium text-slate-700 dark:text-slate-300"
            >
              Opacity
            </label>
            <span className="font-mono tabular-nums text-slate-500">
              {Math.round(object.opacity * 100)}%
            </span>
          </div>
          <input
            id="prop-text-opacity"
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={object.opacity}
            onChange={(e) =>
              onUpdate({ opacity: Number(e.target.value) }, 'opacity')
            }
            className="w-full accent-blue-600"
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="prop-text-rotation"
            className="block font-medium text-slate-700 dark:text-slate-300"
          >
            Rotation (°)
          </label>
          <input
            id="prop-text-rotation"
            type="number"
            min={-180}
            max={360}
            step={5}
            value={object.rotation}
            onChange={(e) =>
              onUpdate({ rotation: Number(e.target.value) || 0 }, 'rotation')
            }
            className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono tabular-nums text-slate-900 dark:text-slate-100"
          />
        </div>
      </div>

      {/* Position X/Y & Width/Height */}
      <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
        <span className="block font-medium text-slate-700 dark:text-slate-300">
          Geometry (PDF Points)
        </span>
        <div className="grid grid-cols-2 gap-2.5">
          <label className="space-y-1">
            <span className="text-[11px] text-slate-500">Position X</span>
            <input
              type="number"
              value={Math.round(object.x)}
              onChange={(e) =>
                onUpdate({ x: Number(e.target.value) || 0 }, 'pos-x')
              }
              className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono tabular-nums"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] text-slate-500">Position Y</span>
            <input
              type="number"
              value={Math.round(object.y)}
              onChange={(e) =>
                onUpdate({ y: Number(e.target.value) || 0 }, 'pos-y')
              }
              className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono tabular-nums"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] text-slate-500">Width</span>
            <input
              type="number"
              min={24}
              value={Math.round(object.width)}
              onChange={(e) =>
                onUpdate(
                  { width: Math.max(24, Number(e.target.value) || 40) },
                  'width'
                )
              }
              className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono tabular-nums"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] text-slate-500">Height</span>
            <input
              type="number"
              min={10}
              value={Math.round(object.height)}
              onChange={(e) =>
                onUpdate(
                  { height: Math.max(10, Number(e.target.value) || 16) },
                  'height'
                )
              }
              className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono tabular-nums"
            />
          </label>
        </div>
      </div>

      {object.type === 'text-replacement' && object.originalText && (
        <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
              Original PDF Text
            </span>
            {object.coverRect && (
              <input
                type="color"
                value={object.coverRect.color}
                aria-label="Replacement mask color"
                title="Adjust mask background color"
                onChange={(e) =>
                  onUpdate(
                    {
                      coverRect: {
                        ...object.coverRect!,
                        color: e.target.value,
                      },
                    },
                    'cover-color'
                  )
                }
                className="w-5 h-5 rounded border border-slate-300 cursor-pointer"
              />
            )}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 break-words">
            “{object.originalText}”
          </p>
        </div>
      )}
    </div>
  );
};

interface ImageObjectInspectorProps {
  object: ImageEditorObject;
  onUpdate: (patch: Partial<ImageEditorObject>, coalesceKey?: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

const ImageObjectInspector: React.FC<ImageObjectInspectorProps> = ({
  object,
  onUpdate,
  onDuplicate,
  onDelete,
}) => {
  return (
    <div className="p-4 space-y-4 text-xs">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <h2 className="text-xs font-semibold text-slate-900 dark:text-white">
            {object.type === 'signature'
              ? 'Signature Properties'
              : 'Image Properties'}
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            Source: {object.naturalWidth} × {object.naturalHeight} px
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onDuplicate}
            aria-label="Duplicate image object"
            className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete image object"
            className="p-1.5 rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 flex items-center justify-center h-28 overflow-hidden">
        <img
          src={object.src}
          alt={object.type === 'signature' ? 'Signature preview' : 'Inserted image preview'}
          referrerPolicy="no-referrer"
          className="max-h-full max-w-full object-contain"
        />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <label className="space-y-1">
          <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
            Width (pt)
          </span>
          <input
            type="number"
            min={16}
            value={Math.round(object.width)}
            onChange={(e) =>
              onUpdate(
                { width: Math.max(16, Number(e.target.value) || 24) },
                'img-w'
              )
            }
            className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono tabular-nums"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
            Height (pt)
          </span>
          <input
            type="number"
            min={16}
            value={Math.round(object.height)}
            onChange={(e) =>
              onUpdate(
                { height: Math.max(16, Number(e.target.value) || 24) },
                'img-h'
              )
            }
            className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono tabular-nums"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
            Position X (pt)
          </span>
          <input
            type="number"
            value={Math.round(object.x)}
            onChange={(e) =>
              onUpdate({ x: Number(e.target.value) || 0 }, 'img-x')
            }
            className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono tabular-nums"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
            Position Y (pt)
          </span>
          <input
            type="number"
            value={Math.round(object.y)}
            onChange={(e) =>
              onUpdate({ y: Number(e.target.value) || 0 }, 'img-y')
            }
            className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono tabular-nums"
          />
        </label>
      </div>

      <div className="space-y-1">
        <label
          htmlFor="prop-img-rotation"
          className="block font-medium text-slate-700 dark:text-slate-300"
        >
          Rotation (°)
        </label>
        <input
          id="prop-img-rotation"
          type="number"
          min={-180}
          max={360}
          step={5}
          value={object.rotation}
          onChange={(e) =>
            onUpdate({ rotation: Number(e.target.value) || 0 }, 'img-rot')
          }
          className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono tabular-nums"
        />
      </div>

      <div className="space-y-1">
        <div className="flex justify-between">
          <label
            htmlFor="prop-img-opacity"
            className="font-medium text-slate-700 dark:text-slate-300"
          >
            Opacity / Transparency
          </label>
          <span className="font-mono tabular-nums text-slate-500">
            {Math.round(object.opacity * 100)}%
          </span>
        </div>
        <input
          id="prop-img-opacity"
          type="range"
          min={0.1}
          max={1}
          step={0.05}
          value={object.opacity}
          onChange={(e) =>
            onUpdate({ opacity: Number(e.target.value) }, 'img-opacity')
          }
          className="w-full accent-blue-600"
        />
      </div>
    </div>
  );
};
