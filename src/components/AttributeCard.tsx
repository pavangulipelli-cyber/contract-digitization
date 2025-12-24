import { Attribute } from "@/types";
import { isNonEmptyString, safeNumber } from "@/utils/nullSafe";

interface AttributeCardProps {
  attribute: Attribute;
  isSelected: boolean;
  onSelect: () => void;
  correctedValue: string;
  onCorrectedValueChange: (value: string) => void;
  saveHint?: string;
  isDirty?: boolean;
  latestVersionNumber?: number;
}

export function AttributeCard({
  attribute,
  isSelected,
  onSelect,
  correctedValue,
  onCorrectedValueChange,
  saveHint,
  isDirty,
  latestVersionNumber,
}: AttributeCardProps) {
  const deriveLevel = (
    level: Attribute["confidenceLevel"] | null | undefined,
    scoreRaw: unknown
  ): "high" | "medium" | "low" | null => {
    if (level === "high" || level === "medium" || level === "low") return level;
    const score = safeNumber(scoreRaw, NaN);
    if (Number.isFinite(score) && score > 0) {
      if (score >= 80) return "high";
      if (score >= 50) return "medium";
      return "low";
    }
    return null;
  };

  const getConfidenceClass = (
    level: Attribute["confidenceLevel"] | null | undefined,
    score: unknown
  ) => {
    const derived = deriveLevel(level, score);
    switch (derived) {
      case "high":
        return "confidence-high";
      case "medium":
        return "confidence-medium";
      case "low":
        return "confidence-low";
      default:
        return "";
    }
  };

  const getConfidenceLabel = (
    level: Attribute["confidenceLevel"] | null | undefined,
    scoreRaw: unknown
  ) => {
    const derived = deriveLevel(level, scoreRaw);
    if (!derived) return "";
    const levelLabel = derived[0].toUpperCase() + derived.slice(1);
    const score = safeNumber(scoreRaw, 0);
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
        <div className="flex items-center gap-1 flex-wrap justify-end">
          {attribute.changedInVersionNumber ? (
            <span className="status-pill text-xs flex-shrink-0">
              Changed in v{attribute.changedInVersionNumber}
            </span>
          ) : null}
          {isDirty && latestVersionNumber && (
            <span className="status-pill text-xs flex-shrink-0 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
              Pending v{latestVersionNumber}
            </span>
          )}
          {deriveLevel(attribute.confidenceLevel as any, attribute.confidenceScore) && (
            <span
              className={`status-pill text-xs flex-shrink-0 ${getConfidenceClass(
                attribute.confidenceLevel as any,
                attribute.confidenceScore
              )}`}
            >
              {getConfidenceLabel(attribute.confidenceLevel as any, attribute.confidenceScore)}
            </span>
          )}
        </div>
      </div>
      
      {/* Section info */}
      {(
        isNonEmptyString(attribute.section) || isNonEmptyString(attribute.category)
      ) && (
        <p className="text-xs text-muted-foreground mb-3 leading-tight">
          Section: {isNonEmptyString(attribute.section) ? attribute.section : ""}
          {isNonEmptyString(attribute.section) && isNonEmptyString(attribute.category) ? " – " : ""}
          {isNonEmptyString(attribute.category) ? attribute.category : ""}
        </p>
      )}
      
      {/* Extracted Value */}
      {isNonEmptyString(attribute.extractedValue) && (
        <div className="mb-2">
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Extracted Value
          </label>
          <div className="px-3 py-2 bg-muted rounded-lg text-sm text-foreground leading-tight">
            {attribute.extractedValue}
          </div>
        </div>
      )}
      
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
