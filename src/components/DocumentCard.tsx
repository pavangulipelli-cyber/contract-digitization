import { useNavigate } from "react-router-dom";
import { Document } from "@/types";
import { FileTextIcon, SquareIcon, CheckSquareIcon } from "@/components/icons/Icons";

interface DocumentCardProps {
  document: Document;
  isSelected?: boolean;
  onSelectToggle?: (id: string) => void;
  showCheckbox?: boolean;
  viewMode?: "grid" | "list";
}

export function DocumentCard({
  document,
  isSelected = false,
  onSelectToggle,
  showCheckbox = false,
  viewMode = "list",
}: DocumentCardProps) {
  const navigate = useNavigate();

  const getStatusClass = (status: Document["status"]) => {
    switch (status) {
      case "Pending Review":
        return "status-pending";
      case "Reviewed":
        return "status-reviewed";
      case "Approved":
        return "status-approved";
    }
  };

  const getActionLabel = (status: Document["status"]) => {
    return status === "Pending Review" ? "Review" : "View";
  };

  const handleClick = () => {
    navigate(`/documents/${document.id}`);
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectToggle?.(document.id);
  };

  // Grid view card
  if (viewMode === "grid") {
    return (
      <div
        className={`group bg-card rounded-lg border border-border shadow-sm hover:shadow-lg transition-all cursor-pointer overflow-hidden ${
          isSelected ? "ring-2 ring-primary bg-primary/5 border-primary" : ""
        }`}
        onClick={handleClick}
      >
        {/* Header with hover actions */}
        <div className="relative p-4 pb-3">
          {/* Checkbox (top-left corner) */}
          {showCheckbox && (
            <button
              onClick={handleCheckboxClick}
              className="absolute top-2 left-2 z-10 text-muted-foreground hover:text-primary transition-colors"
            >
              {isSelected ? (
                <CheckSquareIcon className="w-5 h-5 text-primary" />
              ) : (
                <SquareIcon className="w-5 h-5" />
              )}
            </button>
          )}

          {/* Hover action buttons (top-right corner) */}
          <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClick();
              }}
              className="p-1.5 bg-background/95 backdrop-blur-sm rounded-md border border-border shadow-sm hover:bg-muted transition-colors"
              title={getActionLabel(document.status)}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
          </div>

          {/* Document Icon */}
          <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-3">
            <FileTextIcon className="w-6 h-6 text-primary" />
          </div>

          {/* Title */}
          <h3 className="font-medium text-foreground text-sm mb-1 line-clamp-2 min-h-[2.5rem]">
            {document.title}
          </h3>

          {/* Meta info */}
          <p className="text-xs text-muted-foreground mb-3">
            {document.uploadedAt}
          </p>

          {/* Stats */}
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
            <span>{document.attributeCount} attributes</span>
            <span className="font-medium">{document.overallConfidence}%</span>
          </div>

          {/* Status Badge */}
          <div className="mb-3">
            <span className={`status-pill ${getStatusClass(document.status)} text-xs`}>
              {document.status}
            </span>
          </div>

          {/* Reviewed by */}
          {document.reviewedBy && (
            <p className="text-xs text-muted-foreground">
              Reviewed by {document.reviewedBy}
            </p>
          )}
        </div>

        {/* Footer action button */}
        <div className="border-t border-border p-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClick();
            }}
            className={`w-full px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              document.status === "Pending Review"
                ? "btn-primary"
                : "btn-outline"
            }`}
          >
            {getActionLabel(document.status)}
          </button>
        </div>
      </div>
    );
  }

  // List view (original design)
  return (
    <div
      className={`bg-card rounded-lg border border-border shadow-sm p-4 hover:shadow-md transition-all cursor-pointer ${
        isSelected ? "ring-2 ring-primary bg-primary/5 border-primary" : ""
      }`}
      onClick={handleClick}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Left section */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Checkbox */}
          {showCheckbox && (
            <button
              onClick={handleCheckboxClick}
              className="flex-shrink-0 text-muted-foreground hover:text-primary transition-colors mt-0.5"
            >
              {isSelected ? (
                <CheckSquareIcon className="w-5 h-5 text-primary" />
              ) : (
                <SquareIcon className="w-5 h-5" />
              )}
            </button>
          )}
          
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <FileTextIcon className="w-5 h-5 text-primary" />
          </div>
          
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-foreground truncate text-sm">{document.title}</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-tight">
              Uploaded: {document.uploadedAt} · {document.attributeCount} attributes · Confidence: {document.overallConfidence}%
              {document.reviewedBy && ` · Reviewed by ${document.reviewedBy}`}
            </p>
          </div>
        </div>
        
        {/* Right section */}
        <div className="flex items-center gap-2 sm:flex-shrink-0">
          <span className={`status-pill ${getStatusClass(document.status)}`}>
            {document.status}
          </span>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClick();
            }}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              document.status === "Pending Review"
                ? "btn-primary"
                : "btn-outline"
            }`}
          >
            {getActionLabel(document.status)}
          </button>
        </div>
      </div>
    </div>
  );
}
