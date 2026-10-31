import { useEffect } from 'react';
import { useEditorStore } from '../store/editorStore';

/**
 * Provides Undo/Redo controls and binds standard desktop keyboard shortcuts
 * (Ctrl/Cmd+Z, Ctrl/Cmd+Y, Ctrl/Cmd+Shift+Z, Delete/Backspace on selected canvas objects).
 */
export function useHistory() {
  const canUndo = useEditorStore((s) => s.past.length > 0);
  const canRedo = useEditorStore((s) => s.future.length > 0);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const selectedObjectId = useEditorStore((s) => s.selectedObjectId);
  const deleteObject = useEditorStore((s) => s.deleteObject);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditableInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && !isEditableInput) {
        if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
          e.preventDefault();
          undo();
          return;
        }
        if (
          e.key.toLowerCase() === 'y' ||
          (e.key.toLowerCase() === 'z' && e.shiftKey)
        ) {
          e.preventDefault();
          redo();
          return;
        }
      }

      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        !isEditableInput &&
        selectedObjectId
      ) {
        e.preventDefault();
        deleteObject(selectedObjectId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, selectedObjectId, deleteObject]);

  return {
    canUndo,
    canRedo,
    undo,
    redo,
  };
}
