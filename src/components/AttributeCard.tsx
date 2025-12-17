import { Attribute } from "@/types";

interface AttributeCardProps {
  attribute: Attribute;
  isSelected: boolean;
  onSelect: () => void;
  correctedValue: string;
  onCorrectedValueChange: (value: string) => void;
  saveHint?: string;
}

export function AttributeCard({
  attribute,
  isSelected,
  onSelect,
  correctedValue,
  onCorrectedValueChange,
  saveHint,
}: AttributeCardProps) {
  const getConfidenceClass = (level: Attribute["confidenceLevel"]) => {
    switch (level) {
      case "high":
        return "confidence-high";
      case "medium":
        return "confidence-medium";
      case "low":
        return "confidence-low";
    }
  };

  const getConfidenceLabel = (level: Attribute["confidenceLevel"], score: number) => {
    const levelLabel = level.charAt(0).toUpperCase() + level.slice(1);
    return `${levelLabel} (${score}%)`;
  };

  return (
    <div
      onClick={onSelect}
      className={`attribute-card ${isSelected ? "attribute-card-selected" : ""}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="font-medium text-foreground text-sm">{attribute.name}</h4>
        <div className="flex items-center gap-1">
          {attribute.changedInVersionNumber ? (
            <span className="status-pill text-xs flex-shrink-0">
              Changed in v{attribute.changedInVersionNumber}
            </span>
          ) : null}
          <span className={`status-pill text-xs flex-shrink-0 ${getConfidenceClass(attribute.confidenceLevel)}`}>
            {getConfidenceLabel(attribute.confidenceLevel, attribute.confidenceScore)}
          </span>
        </div>
      </div>
      
      {/* Section info */}
      <p className="text-xs text-muted-foreground mb-3 leading-tight">
        Section: {attribute.section} – {attribute.category}
      </p>
      
      {/* Extracted Value */}
      <div className="mb-2">
        <label className="block text-xs font-medium text-muted-foreground mb-1">
          Extracted Value
        </label>
        <div className="px-3 py-2 bg-muted rounded-lg text-sm text-foreground leading-tight">
          {attribute.extractedValue}
        </div>
      </div>
      
      {/* Corrected Value */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">
          Corrected Value (if needed)
        </label>
        <input
          type="text"
          value={correctedValue}
          onChange={(e) => {
            e.stopPropagation();
            onCorrectedValueChange(e.target.value);
          }}
          onClick={(e) => e.stopPropagation()}
          placeholder="Enter corrected value..."
          className="input-field text-sm"
        />
        {saveHint && correctedValue && (
          <p className="text-xs text-primary mt-1 italic">
            {saveHint}
          </p>
        )}
      </div>
    </div>
  );
}
