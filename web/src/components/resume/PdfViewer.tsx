"use client";

import { useMemo, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { PAGE_WIDTH_PX, PAGE_HEIGHT_PX } from "@/lib/resume-preview";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Configure local worker
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface PdfViewerProps {
  pdfData: Uint8Array | null;
  scale?: number;
  onPageCountChange?: (numPages: number) => void;
}

/**
 * Authentic, clean multi-page PDF viewer matching standard document readers
 * (Adobe Acrobat, Chrome PDF Viewer, macOS Preview).
 *
 * Each page is rendered as an individual paper sheet with clean drop shadows
 * and natural spacing, with zero distracting construction lines or dashed banners.
 */
export default function PdfViewer({
  pdfData,
  scale = 1.0,
  onPageCountChange,
}: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(1);

  // Memoize file object to prevent react-pdf from re-parsing on unrelated re-renders.
  // Using .slice() ensures that if pdfjs transfers the underlying buffer to its Web Worker,
  // the parent component's pdfData remains completely intact and un-detached.
  const fileSource = useMemo(() => {
    if (!pdfData || pdfData.byteLength === 0) return null;
    return { data: pdfData.slice() };
  }, [pdfData]);

  const handleDocumentLoadSuccess = ({ numPages: count }: { numPages: number }) => {
    setNumPages(count);
    onPageCountChange?.(count);
  };

  const pageWidth = PAGE_WIDTH_PX * scale;
  const pageHeight = PAGE_HEIGHT_PX * scale;

  if (!fileSource) return null;

  return (
    <div className="flex flex-col items-center w-full">
      <Document
        file={fileSource}
        onLoadSuccess={handleDocumentLoadSuccess}
        loading={null}
        className="flex flex-col items-center w-full"
      >
        {Array.from({ length: numPages }, (_, index) => {
          const pageNum = index + 1;
          return (
            <div
              key={`pdf_sheet_${pageNum}`}
              className="flex flex-col items-center w-full mb-8 last:mb-2"
            >
              {/* Paper Sheet (Standard US Letter with realistic shadow) */}
              <div
                className="bg-white shadow-xl sm:shadow-2xl rounded-xs border border-slate-300/80 overflow-hidden relative transition-all"
                style={{
                  width: `${pageWidth}px`,
                  minHeight: `${pageHeight}px`,
                }}
              >
                <Page
                  pageNumber={pageNum}
                  width={pageWidth}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  loading={null}
                  className="overflow-hidden"
                />
              </div>

              {/* Clean, subtle page number */}
              <div className="mt-2 text-center select-none">
                <span className="text-[11px] text-slate-400 font-medium tracking-wide">
                  Page {pageNum} of {numPages}
                </span>
              </div>
            </div>
          );
        })}
      </Document>
    </div>
  );
}
