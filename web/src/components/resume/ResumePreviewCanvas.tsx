"use client";

import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  useCallback,
  useImperativeHandle,
} from "react";
import dynamic from "next/dynamic";
import { Resume, ResumeThemeConfig } from "@/types";
import { PAGE_WIDTH_PX, PAGE_HEIGHT_PX } from "@/lib/resume-preview";
import { Loader2, AlertTriangle } from "lucide-react";

// Dynamically import PdfViewer with ssr: false to completely prevent
// Node.js SSR evaluation of pdfjs-dist ("ReferenceError: DOMMatrix is not defined").
const PdfViewer = dynamic(() => import("./PdfViewer"), {
  ssr: false,
  loading: () => null,
});

export interface ResumePreviewCanvasHandle {
  downloadPdf: (filename?: string) => void;
  getPdfData: () => Uint8Array | null;
}

export interface ResumePreviewCanvasProps {
  resume: Resume;
  theme: ResumeThemeConfig;
  className?: string;
  scale?: number;
  onPageCountChange?: (numPages: number) => void;
  onSyncingChange?: (isSyncing: boolean) => void;
  onPdfReady?: (pdfData: Uint8Array | null) => void;
  onPdfBlobReady?: (blobUrl: string | null) => void; // Backward compatibility
}

/**
 * 1:1 Live ATS Resume Preview Canvas.
 *
 * Compiles the exact ATS PDF on the server in ~30ms and renders it cleanly
 * like a standard multi-page PDF viewer (Adobe Acrobat, Chrome PDF Viewer).
 *
 * Key guarantees:
 * 1. Client-only dynamic loading to eliminate Next.js/Turbopack SSR DOMMatrix errors.
 * 2. In-memory Uint8Array streaming to eliminate blob URL response (0) exceptions.
 * 3. Deep data hashing to eliminate re-render loops and canvas flickering.
 * 4. Clean, natural paper sheet separation with zero distracting lines or banners.
 */
const ResumePreviewCanvas = forwardRef<
  HTMLDivElement,
  ResumePreviewCanvasProps
>(function ResumePreviewCanvas(
  {
    resume,
    theme,
    className = "",
    scale = 1.0,
    onPageCountChange,
    onSyncingChange,
    onPdfReady,
    onPdfBlobReady,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => containerRef.current as HTMLDivElement);

  // Stable callback refs to prevent dependency loops
  const onPageCountChangeRef = useRef(onPageCountChange);
  onPageCountChangeRef.current = onPageCountChange;

  const onSyncingChangeRef = useRef(onSyncingChange);
  onSyncingChangeRef.current = onSyncingChange;

  const onPdfReadyRef = useRef(onPdfReady);
  onPdfReadyRef.current = onPdfReady;

  const onPdfBlobReadyRef = useRef(onPdfBlobReady);
  onPdfBlobReadyRef.current = onPdfBlobReady;

  // In-memory PDF byte stream (Uint8Array)
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Lifecycle references
  const lastCompiledHashRef = useRef<string>("");
  const abortControllerRef = useRef<AbortController | null>(null);
  const prevThemeJsonRef = useRef<string>(JSON.stringify(theme));
  const activeBlobUrlRef = useRef<string | null>(null);

  // Extract clean data without internal DB metadata
  const getCleanResumeData = useCallback((data: Resume) => {
    const { id, created_at, parsed_at, last_updated, resume_link, ...rest } =
      data;
    return rest;
  }, []);

  const compilePdf = useCallback(
    async (
      resumeData: Resume,
      themeConfig: ResumeThemeConfig,
      dataHash: string
    ) => {
      // Abort any prior in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      onSyncingChangeRef.current?.(true);

      try {
        const cleanData = getCleanResumeData(resumeData);
        const res = await fetch("/api/generate-resume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resumeData: cleanData,
            styleConfig: themeConfig,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(
            errData?.error || `Failed to compile PDF (HTTP ${res.status})`
          );
        }

        const headerPageCount = res.headers.get("X-Page-Count");
        if (headerPageCount) {
          const count = parseInt(headerPageCount, 10);
          if (!isNaN(count) && count > 0) {
            onPageCountChangeRef.current?.(count);
          }
        }

        // Read raw in-memory bytes directly — eliminates all blob URL revocation errors
        const arrayBuffer = await res.arrayBuffer();
        // Clone the buffer slice so the download copy has its own independent ArrayBuffer
        // that will NEVER be transferred or neutered by pdf.js Web Worker
        const downloadCopy = new Uint8Array(arrayBuffer.slice(0));
        const renderCopy = new Uint8Array(arrayBuffer);

        lastCompiledHashRef.current = dataHash;
        setPdfData(renderCopy);
        setIsInitialLoading(false);
        setError(null);

        // Notify ready callbacks with independent un-detached clone
        onPdfReadyRef.current?.(downloadCopy);

        // Optional blob URL for components expecting a URL string
        if (onPdfBlobReadyRef.current) {
          if (activeBlobUrlRef.current) {
            URL.revokeObjectURL(activeBlobUrlRef.current);
          }
          const blob = new Blob([downloadCopy], { type: "application/pdf" });
          const url = URL.createObjectURL(blob);
          activeBlobUrlRef.current = url;
          onPdfBlobReadyRef.current(url);
        }
      } catch (err: any) {
        if (err.name === "AbortError") return;
        console.error("ResumePreviewCanvas compile error:", err);
        setError(err.message || "Failed to render PDF preview");
      } finally {
        onSyncingChangeRef.current?.(false);
      }
    },
    [getCleanResumeData]
  );

  // Monitor changes to resume and theme with deep hash comparison
  useEffect(() => {
    const cleanData = getCleanResumeData(resume);
    const currentThemeJson = JSON.stringify(theme);
    const dataHash = JSON.stringify({ resume: cleanData, theme });

    // Skip if data has not changed (prevents re-render loops from parent updates)
    if (dataHash === lastCompiledHashRef.current) {
      return;
    }

    const isStyleChange = currentThemeJson !== prevThemeJsonRef.current;
    prevThemeJsonRef.current = currentThemeJson;

    // Fast debounce (50ms) for design & style clicks; 350ms for text input typing
    const delay = !pdfData ? 0 : isStyleChange ? 50 : 350;

    const timer = setTimeout(() => {
      compilePdf(resume, theme, dataHash);
    }, delay);

    return () => clearTimeout(timer);
  }, [resume, theme, pdfData, compilePdf, getCleanResumeData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const pageWidth = PAGE_WIDTH_PX * scale;
  const pageHeight = PAGE_HEIGHT_PX * scale;

  return (
    <div
      ref={containerRef}
      className={`w-full flex flex-col items-center select-text relative ${className}`}
    >
      {/* INITIAL LOADING SKELETON (only shown before the first PDF is ready) */}
      {isInitialLoading && !pdfData && (
        <div
          className="bg-white rounded-xs shadow-2xl border border-slate-300/80 flex flex-col items-center justify-center p-8 transition-all animate-pulse"
          style={{ width: `${pageWidth}px`, minHeight: `${pageHeight}px` }}
        >
          <div className="w-10 h-10 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
          <p className="text-xs font-semibold text-slate-700 tracking-wide uppercase">
            Loading Document Preview...
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Standard US Letter (8.5&quot; &times; 11&quot;) &bull; 1:1 ATS Engine
          </p>
        </div>
      )}

      {/* ERROR FALLBACK */}
      {error && !pdfData && (
        <div
          className="bg-white rounded-xs shadow-xl border border-rose-200 p-8 flex flex-col items-center justify-center text-center max-w-md"
          style={{ width: `${pageWidth}px`, minHeight: "400px" }}
        >
          <AlertTriangle className="w-10 h-10 text-rose-500 mb-3" />
          <h3 className="text-sm font-bold text-slate-900">Preview Error</h3>
          <p className="text-xs text-slate-600 mt-1 mb-4">{error}</p>
          <button
            type="button"
            onClick={() => {
              const currentHash = JSON.stringify({
                resume: getCleanResumeData(resume),
                theme,
              });
              compilePdf(resume, theme, currentHash);
            }}
            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Loader2 className="w-3.5 h-3.5" />
            <span>Retry Rendering</span>
          </button>
        </div>
      )}

      {/* CLEAN MULTI-PAGE PDF VIEWER (Client-only, no SSR) */}
      {pdfData && (
        <PdfViewer
          pdfData={pdfData}
          scale={scale}
          onPageCountChange={(count) => {
            onPageCountChangeRef.current?.(count);
          }}
        />
      )}
    </div>
  );
});

export default ResumePreviewCanvas;
