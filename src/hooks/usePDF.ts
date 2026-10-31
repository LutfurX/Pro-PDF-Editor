import { useCallback } from 'react';
import {
  clearPdfProxyCache,
  generatePageThumbnail,
  inspectPdfPages,
  PDFOpenError,
} from '../services/pdfRenderer';
import {
  generateMultiPageSamplePdf,
  generateScannedSamplePdf,
} from '../services/samplePdfGenerator';
import { useEditorStore } from '../store/editorStore';

/**
 * Hook encapsulating local PDF upload, validation, thumbnail generation,
 * external PDF page importing, and sample PDF loading.
 */
export function usePDF() {
  const initializeDocument = useEditorStore((s) => s.initializeDocument);
  const importPdfPages = useEditorStore((s) => s.importPdfPages);
  const setLoadingState = useEditorStore((s) => s.setLoadingState);
  const setPageThumbnail = useEditorStore((s) => s.setPageThumbnail);
  const addToast = useEditorStore((s) => s.addToast);

  const loadPdfFromBytes = useCallback(
    async (name: string, bytes: Uint8Array) => {
      try {
        setLoadingState(true, 10, `Opening "${name}"...`);
        await clearPdfProxyCache();

        const sourceId = `src_main_${Date.now()}`;
        const { pages } = await inspectPdfPages(sourceId, bytes, (pct) => {
          setLoadingState(true, pct, `Reading PDF pages (${pct}%)...`);
        });

        initializeDocument({
          name,
          sourceId,
          bytes,
          pages,
          fileSizeBytes: bytes.byteLength,
        });

        setLoadingState(false, 100, '');
        addToast({
          kind: 'success',
          title: 'Document Loaded',
          message: `Opened "${name}" (${pages.length} ${
            pages.length === 1 ? 'page' : 'pages'
          }) locally.`,
        });

        // Asynchronously render page thumbnails without blocking main workspace interaction
        const sourceMap = { [sourceId]: bytes };
        for (const page of pages) {
          generatePageThumbnail(page, sourceMap, 148)
            .then((dataUrl) => {
              if (dataUrl) {
                setPageThumbnail(page.id, dataUrl);
              }
            })
            .catch(() => undefined);
        }
      } catch (err: unknown) {
        setLoadingState(false, 0, '');
        const message =
          err instanceof PDFOpenError
            ? err.message
            : (err as { message?: string })?.message ||
              'Unable to open PDF file.';
        addToast({
          kind: 'error',
          title: 'Failed to Open PDF',
          message,
        });
      }
    },
    [initializeDocument, setLoadingState, setPageThumbnail, addToast]
  );

  const openPdfFile = useCallback(
    async (file: File) => {
      const isPdf =
        file.type === 'application/pdf' ||
        file.name.toLowerCase().endsWith('.pdf');
      if (!isPdf) {
        addToast({
          kind: 'error',
          title: 'Unsupported File Format',
          message: 'Please select a valid .pdf document.',
        });
        return;
      }

      if (file.size === 0) {
        addToast({
          kind: 'error',
          title: 'Empty File',
          message: 'The selected PDF file contains 0 bytes.',
        });
        return;
      }

      if (file.size > 120 * 1024 * 1024) {
        addToast({
          kind: 'warning',
          title: 'Large PDF Document',
          message: 'Processing large PDFs locally may take a few extra seconds.',
        });
      }

      setLoadingState(true, 5, 'Reading local file...');
      const arrayBuf = await file.arrayBuffer();
      await loadPdfFromBytes(file.name, new Uint8Array(arrayBuf));
    },
    [loadPdfFromBytes, addToast, setLoadingState]
  );

  const importPagesFromFile = useCallback(
    async (file: File) => {
      const isPdf =
        file.type === 'application/pdf' ||
        file.name.toLowerCase().endsWith('.pdf');
      if (!isPdf) {
        addToast({
          kind: 'error',
          title: 'Invalid Import File',
          message: 'Please choose a valid .pdf file to import pages from.',
        });
        return;
      }

      try {
        setLoadingState(true, 15, `Importing pages from "${file.name}"...`);
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);
        const sourceId = `src_imp_${Date.now()}`;
        const { pages: importedPages } = await inspectPdfPages(sourceId, bytes);

        importPdfPages({
          sourceId,
          bytes,
          importedPages,
        });

        setLoadingState(false, 100, '');
        addToast({
          kind: 'success',
          title: 'Pages Imported',
          message: `Inserted ${importedPages.length} ${
            importedPages.length === 1 ? 'page' : 'pages'
          } from "${file.name}".`,
        });

        const updatedSourceMap = useEditorStore.getState().sourceBytesMap;
        for (const p of importedPages) {
          generatePageThumbnail(p, updatedSourceMap, 148)
            .then((url) => {
              if (url) setPageThumbnail(p.id, url);
            })
            .catch(() => undefined);
        }
      } catch (err: unknown) {
        setLoadingState(false, 0, '');
        addToast({
          kind: 'error',
          title: 'Import Failed',
          message:
            (err as { message?: string })?.message ||
            'Could not import pages from the selected PDF.',
        });
      }
    },
    [importPdfPages, setLoadingState, setPageThumbnail, addToast]
  );

  const loadSampleMultiPage = useCallback(async () => {
    const { name, bytes } = await generateMultiPageSamplePdf();
    await loadPdfFromBytes(name, bytes);
  }, [loadPdfFromBytes]);

  const loadSampleScanned = useCallback(async () => {
    const { name, bytes } = await generateScannedSamplePdf();
    await loadPdfFromBytes(name, bytes);
  }, [loadPdfFromBytes]);

  return {
    openPdfFile,
    loadPdfFromBytes,
    importPagesFromFile,
    loadSampleMultiPage,
    loadSampleScanned,
  };
}
