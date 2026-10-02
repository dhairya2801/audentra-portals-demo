"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

/** Use the board's PDF renderer instead of depending on a browser PDF plugin. */
export function DocumentPdfPreview({ url, name, onError }: {
  url: string;
  name: string;
  onError: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let destroy: (() => void) | undefined;
    void import("pdfjs-dist").then(async library => {
      if (cancelled) return;
      library.GlobalWorkerOptions.workerSrc = "/document-viewer/build/pdf.worker.min.mjs";
      const task = library.getDocument({ url,
        cMapUrl: "/document-viewer/cmaps/", cMapPacked: true,
        standardFontDataUrl: "/document-viewer/standard_fonts/", wasmUrl: "/document-viewer/wasm/" });
      destroy = () => { void task.destroy(); };
      const document = await task.promise;
      if (!cancelled) setPdf(document);
    }).catch(() => { if (!cancelled) onError(); });
    return () => { cancelled = true; destroy?.(); };
  }, [url, onError]);

  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    let cancelRender: (() => void) | undefined;
    void pdf.getPage(page).then(async source => {
      const target = canvas.current;
      if (cancelled || !target) return;
      const viewport = source.getViewport({ scale: 1.5 });
      target.width = Math.ceil(viewport.width);
      target.height = Math.ceil(viewport.height);
      const task = source.render({ canvas: target, viewport });
      cancelRender = () => task.cancel();
      await task.promise;
      if (!cancelled) setLoading(false);
    }).catch(() => { if (!cancelled) onError(); });
    return () => { cancelled = true; cancelRender?.(); };
  }, [pdf, page, onError]);

  return <div style={{ width: "100%", minWidth: 0 }}>
    {loading && <p role="status">Loading document page…</p>}
    <canvas ref={canvas} role="img" aria-label={`${name} · Page ${page} of ${pdf?.numPages ?? "…"}`}
      style={{ display: loading ? "none" : "block", width: "100%", height: "auto", background: "white" }} />
    {pdf && pdf.numPages > 1 && <nav aria-label="Document pages" style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 12 }}>
      <button type="button" className="link-button" disabled={page === 1 || loading} onClick={() => { setLoading(true); setPage(value => value - 1); }}>Previous page</button>
      <span>Page {page} of {pdf.numPages}</span>
      <button type="button" className="link-button" disabled={page === pdf.numPages || loading} onClick={() => { setLoading(true); setPage(value => value + 1); }}>Next page</button>
    </nav>}
  </div>;
}
