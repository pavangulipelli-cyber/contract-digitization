import { Attribute } from "@/types";
import { FileTextIcon } from "@/components/icons/Icons";

interface DocumentViewerProps {
  selectedAttribute: Attribute | null;
  documentTitle: string;
}

export function DocumentViewer({ selectedAttribute, documentTitle }: DocumentViewerProps) {
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
            PDF viewer placeholder – in production this will display the contract PDF with the relevant section highlighted.
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
