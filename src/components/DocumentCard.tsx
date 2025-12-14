import { useNavigate } from "react-router-dom";
import { Document } from "@/types";
import { FileTextIcon, SquareIcon, CheckSquareIcon } from "@/components/icons/Icons";

interface DocumentCardProps {
  document: Document;
  isSelected?: boolean;
  onSelectToggle?: (id: string) => void;
  showCheckbox?: boolean;
}

export function DocumentCard({
  document,
  isSelected = false,
  onSelectToggle,
  showCheckbox = false,
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

  return (
    <div
      className={`bg-card rounded-xl card-shadow p-4 sm:p-5 hover:card-shadow-md transition-all cursor-pointer animate-fade-in ${
        isSelected ? "ring-2 ring-accent bg-accent/5" : ""
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
              className="flex-shrink-0 text-muted-foreground hover:text-accent transition-colors mt-0.5"
            >
              {isSelected ? (
                <CheckSquareIcon className="w-5 h-5 text-accent" />
              ) : (
                <SquareIcon className="w-5 h-5" />
              )}
            </button>
          )}
          
          <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <FileTextIcon className="w-5 h-5 text-accent" />
          </div>
          
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-foreground truncate">{document.title}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Uploaded: {document.uploadedAt} · {document.attributeCount} attributes · Confidence: {document.overallConfidence}%
              {document.reviewedBy && ` · Reviewed by ${document.reviewedBy}`}
            </p>
          </div>
        </div>
        
        {/* Right section */}
        <div className="flex items-center gap-3 sm:flex-shrink-0">
          <span className={`status-pill ${getStatusClass(document.status)}`}>
            {document.status}
          </span>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClick();
            }}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              document.status === "Pending Review"
                ? "btn-primary"
                : "btn-secondary"
            }`}
          >
            {getActionLabel(document.status)}
          </button>
        </div>
      </div>
    </div>
  );
}
