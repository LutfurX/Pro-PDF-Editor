import React, { useCallback, useEffect, useRef } from 'react';
import { useEditorStore } from './store/editorStore';
import { usePDF } from './hooks/usePDF';
import { WelcomeScreen } from './components/WelcomeScreen/WelcomeScreen';
import { Toolbar } from './components/Toolbar/Toolbar';
import { Sidebar } from './components/Sidebar/Sidebar';
import { PDFViewer } from './components/PDFViewer/PDFViewer';
import { PropertiesPanel } from './components/PropertiesPanel/PropertiesPanel';
import { SignatureModal } from './components/SignatureEditor/SignatureModal';
import { ExportDialog } from './components/ExportDialog/ExportDialog';
import { ToastContainer } from './components/Notifications/ToastContainer';
import { getPageDisplayDimensions } from './utils/coordinateConverter';

export function App() {
  const workspaceRef = useRef<HTMLDivElement>(null);

  const documentLoaded = useEditorStore((s) => s.documentLoaded);
  const pages = useEditorStore((s) => s.pages);
  const currentPageIndex = useEditorStore((s) => s.currentPageIndex);
  const setZoom = useEditorStore((s) => s.setZoom);

  const { loadSampleMultiPage } = usePDF();

  // Support `?autostart=1` query parameter to open directly into the 3-page PDF workspace
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1' && !useEditorStore.getState().documentLoaded) {
      void loadSampleMultiPage();
    }
  }, [loadSampleMultiPage]);

  const handleFitPage = useCallback(() => {
    const activePage = pages[currentPageIndex];
    const container = workspaceRef.current;
    if (!activePage || !container) {
      setZoom(1.0);
      return;
    }

    const dims = getPageDisplayDimensions(activePage);
    const availW = Math.max(240, container.clientWidth - 72);
    const availH = Math.max(240, container.clientHeight - 110);
    const scale = Math.min(availW / dims.width, availH / dims.height, 2.0);
    setZoom(scale);
  }, [pages, currentPageIndex, setZoom]);

  return (
    <div className="h-full min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {!documentLoaded ? (
        <WelcomeScreen />
      ) : (
        <div className="h-screen flex flex-col overflow-hidden">
          <Toolbar onFitPage={handleFitPage} />
          <div className="flex-1 flex min-h-0 overflow-hidden">
            <Sidebar />
            <PDFViewer workspaceRef={workspaceRef} />
            <PropertiesPanel />
          </div>
          <SignatureModal />
          <ExportDialog />
        </div>
      )}
      <ToastContainer />
    </div>
  );
}

export default App;
