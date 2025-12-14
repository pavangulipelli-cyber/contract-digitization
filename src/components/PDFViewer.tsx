import { useState, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";
import { Attribute } from "@/types";
import { FileTextIcon, ChevronDownIcon } from "@/components/icons/Icons";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
  pdfUrl?: string;
  selectedAttribute: Attribute | null;
  documentTitle: string;
}

export function PDFViewer({ pdfUrl, selectedAttribute, documentTitle }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Navigate to the page containing the selected attribute
  useEffect(() => {
    if (selectedAttribute?.page) {
      setCurrentPage(selectedAttribute.page);
    }
  }, [selectedAttribute]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setIsLoading(false);
    setError(null);
  }

  function onDocumentLoadError(err: Error) {
    console.error("PDF load error:", err);
    setError("Failed to load PDF document");
    setIsLoading(false);
  }

  const goToPrevPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1));
  const goToNextPage = () => setCurrentPage((prev) => Math.min(prev + 1, numPages));

  // If no PDF URL provided, show placeholder
  if (!pdfUrl) {
    return (
      <div className="bg-card rounded-xl card-shadow p-6 h-full flex flex-col">
        <h2 className="text-lg font-semibold text-foreground mb-4">Contract Document</h2>
        
        {/* Info Bar */}
        {selectedAttribute ? (
          <div className="bg-muted rounded-lg p-3 mb-4 text-sm">
            <p className="text-foreground font-medium">Viewing: {selectedAttribute.name}</p>
            <p className="text-muted-foreground">
              Section: {selectedAttribute.section} · Page: {selectedAttribute.page}
            </p>
          </div>
        ) : (
          <div className="bg-muted rounded-lg p-3 mb-4 text-sm">
            <p className="text-muted-foreground">Select an attribute to view its location in the document</p>
          </div>
        )}
        
        {/* PDF Placeholder */}
        <div className="flex-1 min-h-[300px] border-2 border-dashed border-border rounded-xl flex items-center justify-center mb-4">
          <div className="text-center p-6">
            <FileTextIcon className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground text-sm max-w-xs">
              PDF viewer ready – provide a PDF URL to display the contract document with section highlighting.
            </p>
            <p className="text-xs text-muted-foreground mt-2">{documentTitle}</p>
          </div>
        </div>
        
        {/* Highlighted Section */}
        {selectedAttribute && (
          <div className="animate-fade-in">
            <h3 className="text-sm font-medium text-foreground mb-2">Highlighted Section Text</h3>
            <div className="bg-warning/5 border border-warning/20 rounded-lg p-4">
              <p className="text-sm text-foreground leading-relaxed">
                {selectedAttribute.highlightedText}
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl card-shadow p-6 h-full flex flex-col">
      <h2 className="text-lg font-semibold text-foreground mb-4">Contract Document</h2>
      
      {/* Info Bar */}
      {selectedAttribute ? (
        <div className="bg-muted rounded-lg p-3 mb-4 text-sm">
          <p className="text-foreground font-medium">Viewing: {selectedAttribute.name}</p>
          <p className="text-muted-foreground">
            Section: {selectedAttribute.section} · Page: {selectedAttribute.page}
          </p>
        </div>
      ) : (
        <div className="bg-muted rounded-lg p-3 mb-4 text-sm">
          <p className="text-muted-foreground">Select an attribute to view its location in the document</p>
        </div>
      )}

      {/* PDF Controls */}
      <div className="flex items-center justify-between mb-4 p-2 bg-muted rounded-lg">
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrevPage}
            disabled={currentPage <= 1}
            className="px-3 py-1 text-sm bg-card rounded border border-border hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {numPages || "..."}
          </span>
          <button
            onClick={goToNextPage}
            disabled={currentPage >= numPages}
            className="px-3 py-1 text-sm bg-card rounded border border-border hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Zoom:</span>
          <select
            value={scale}
            onChange={(e) => setScale(parseFloat(e.target.value))}
            className="px-2 py-1 text-sm bg-card rounded border border-border"
          >
            <option value="0.5">50%</option>
            <option value="0.75">75%</option>
            <option value="1">100%</option>
            <option value="1.25">125%</option>
            <option value="1.5">150%</option>
          </select>
        </div>
      </div>

      {/* PDF Viewer */}
      <div className="flex-1 min-h-[400px] border border-border rounded-xl overflow-auto bg-muted/50 flex justify-center">
        {isLoading && (
          <div className="flex items-center justify-center h-full">
            <div className="animate-pulse text-muted-foreground">Loading PDF...</div>
          </div>
        )}
        
        {error && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-6">
              <FileTextIcon className="w-12 h-12 text-destructive mx-auto mb-4" />
              <p className="text-destructive">{error}</p>
            </div>
          </div>
        )}

        <Document
          file={pdfUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={null}
          className="py-4"
        >
          <Page
            pageNumber={currentPage}
            scale={scale}
            renderTextLayer={true}
            renderAnnotationLayer={true}
            className="shadow-lg"
          />
        </Document>
      </div>

      {/* Highlighted Section */}
      {selectedAttribute && (
        <div className="animate-fade-in mt-4">
          <h3 className="text-sm font-medium text-foreground mb-2">Highlighted Section Text</h3>
          <div className="bg-warning/5 border border-warning/20 rounded-lg p-4 max-h-32 overflow-y-auto">
            <p className="text-sm text-foreground leading-relaxed">
              {selectedAttribute.highlightedText}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
