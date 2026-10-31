import React from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Info,
  AlertTriangle,
  X,
} from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';

export const ToastContainer: React.FC = () => {
  const toasts = useEditorStore((s) => s.toasts);
  const dismissToast = useEditorStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
    >
      {toasts.map((toast) => {
        const Icon =
          toast.kind === 'success'
            ? CheckCircle2
            : toast.kind === 'error'
            ? AlertCircle
            : toast.kind === 'warning'
            ? AlertTriangle
            : Info;

        const iconColor =
          toast.kind === 'success'
            ? 'text-emerald-600 dark:text-emerald-400'
            : toast.kind === 'error'
            ? 'text-red-600 dark:text-red-400'
            : toast.kind === 'warning'
            ? 'text-amber-600 dark:text-amber-400'
            : 'text-blue-600 dark:text-blue-400';

        return (
          <div
            key={toast.id}
            role="status"
            className="pointer-events-auto rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg p-3.5 flex items-start gap-2.5"
          >
            <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${iconColor}`} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-900 dark:text-white">
                {toast.title}
              </p>
              {toast.message && (
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-snug">
                  {toast.message}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
              className="p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
