import { XIcon, CheckCircleIcon, CheckIcon, TrashIcon, DownloadIcon } from "@/components/icons/Icons";

interface BulkActionBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBulkApprove: () => void;
  onBulkReview: () => void;
  onExport: (format: "csv" | "json") => void;
  isProcessing: boolean;
}

export function BulkActionBar({
  selectedCount,
  onClearSelection,
  onBulkApprove,
  onBulkReview,
  onExport,
  isProcessing,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
      <div className="bg-primary text-primary-foreground rounded-xl card-shadow-lg px-4 py-3 flex items-center gap-4">
        {/* Selection count */}
        <div className="flex items-center gap-2">
          <span className="bg-primary-foreground/20 px-2 py-1 rounded text-sm font-medium">
            {selectedCount} selected
          </span>
          <button
            onClick={onClearSelection}
            className="p-1 hover:bg-primary-foreground/10 rounded transition-colors"
            title="Clear selection"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="w-px h-6 bg-primary-foreground/20" />

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onBulkReview}
            disabled={isProcessing}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-primary-foreground/10 hover:bg-primary-foreground/20 rounded-lg transition-colors disabled:opacity-50"
          >
            <CheckIcon className="w-4 h-4" />
            Mark Reviewed
          </button>
          
          <button
            onClick={onBulkApprove}
            disabled={isProcessing}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-success text-success-foreground hover:bg-success/90 rounded-lg transition-colors disabled:opacity-50"
          >
            <CheckCircleIcon className="w-4 h-4" />
            Approve All
          </button>

          <div className="w-px h-6 bg-primary-foreground/20" />

          {/* Export dropdown */}
          <div className="relative group">
            <button
              disabled={isProcessing}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-primary-foreground/10 hover:bg-primary-foreground/20 rounded-lg transition-colors disabled:opacity-50"
            >
              <DownloadIcon className="w-4 h-4" />
              Export
            </button>
            
            <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block">
              <div className="bg-card text-card-foreground rounded-lg card-shadow-lg border border-border overflow-hidden">
                <button
                  onClick={() => onExport("csv")}
                  className="w-full px-4 py-2 text-sm text-left hover:bg-muted transition-colors"
                >
                  Export as CSV
                </button>
                <button
                  onClick={() => onExport("json")}
                  className="w-full px-4 py-2 text-sm text-left hover:bg-muted transition-colors"
                >
                  Export as JSON
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
