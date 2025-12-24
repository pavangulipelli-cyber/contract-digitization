# Cross-Version Attribute Update Implementation

## Overview
Implemented a comprehensive fix to allow edits made in older document versions to update the latest version correctly using stable `attributeKey` identifiers instead of version-specific UUIDs.

## Problem Statement
Previously, when users edited attributes while viewing an old version, the system failed to update the latest version because:
1. Frontend used version-specific UUID `id` to track corrections
2. Backend tried to match by `id` which differed across versions
3. Result: Edits in old versions were lost

## Solution Architecture

### Backend Changes (`function_app.py`)

#### 1. Modified `save_review` Endpoint
**Key Changes:**
- Accepts `corrections` object keyed by `attributeKey` (stable identifier)
- Always updates the LATEST version's `corrected_value` regardless of which version user is viewing
- Supports both formats:
  - `corrections: Record<attributeKey, correctedValue>`
  - `attributes: Array<{attributeKey, correctedValue}>`
- Allows empty string values to clear corrections
- Returns `updatedKeys` array for UI tracking

**Request Format:**
```json
{
  "corrections": {
    "party_a_name": "Acme Corp",
    "effective_date": "2024-01-15"
  },
  "reviewerName": "Jane Doe",
  "status": "Reviewed",
  "reviewedAt": "2024-01-20T10:00:00Z"
}
```

**Response Format:**
```json
{
  "ok": true,
  "versionNumber": 3,
  "versionId": "ver-doc123-v3",
  "updatedCount": 2,
  "updatedKeys": ["party_a_name", "effective_date"]
}
```

#### 2. Database Query Logic
```sql
UPDATE extracted_fields
SET corrected_value = %s,
    updated_at = CURRENT_TIMESTAMP
WHERE version_id = %s
  AND attribute_key = %s
```

### Frontend Changes

#### 1. ContractReview.tsx

**State Management:**
- Changed `correctedValues` from `Record<id, value>` to `Record<attributeKey, value>`
- Added `latestChangedKeys: Set<string>` to track which attributes changed in latest version

**Key Functions Updated:**

**a) Initialize correctedValues:**
```typescript
const initialValues: Record<string, string> = {};
attrs.forEach((attr) => {
  initialValues[attr.attributeKey] = attr.correctedValue || "";
});
setCorrectedValues(initialValues);
```

**b) handleAcceptAll:**
```typescript
setCorrectedValues((prev) => {
  const updated = { ...prev };
  attributes.forEach((attr) => {
    const currentValue = (prev[attr.attributeKey] || "").trim();
    if (!currentValue && attr.extractedValue) {
      updated[attr.attributeKey] = attr.extractedValue;
    }
  });
  return updated;
});
```

**c) handleSaveReview:**
```typescript
const corrections: Record<string, string> = {};
attributes.forEach((attr) => {
  const correctedValue = correctedValues[attr.attributeKey] || "";
  corrections[attr.attributeKey] = correctedValue;
});

const payload = {
  corrections,
  reviewerName: "unknown",
  status: "Reviewed",
  reviewedAt: new Date().toISOString(),
};

const result = await saveReview(id, payload);

// Track which keys were updated
if (result.updatedKeys) {
  setLatestChangedKeys(new Set(result.updatedKeys));
}
```

**d) jumpToLatest Function:**
```typescript
const jumpToLatest = async (attributeKey: string) => {
  await handleVersionClick(latestVersionNumber);
  
  setTimeout(() => {
    const foundAttr = attributes.find(a => a.attributeKey === attributeKey);
    if (foundAttr) {
      setSelectedAttributeId(foundAttr.id);
    }
  }, 300);
};
```

**e) AttributeCard Rendering:**
```typescript
{sortedFilteredAttributes.map((attr) => {
  const showLatestChangeCta = !isViewingLatest && latestChangedKeys.has(attr.attributeKey);
  
  return (
    <AttributeCard
      key={attr.id}
      attribute={attr}
      correctedValue={correctedValues[attr.attributeKey] || ""}
      onCorrectedValueChange={(value) =>
        setCorrectedValues((prev) => ({ ...prev, [attr.attributeKey]: value }))
      }
      showLatestChangeCta={showLatestChangeCta}
      latestVersionNumber={latestVersionNumber}
      onJumpToLatest={() => jumpToLatest(attr.attributeKey)}
    />
  );
})}
```

#### 2. AttributeCard.tsx

**Props Added:**
```typescript
interface AttributeCardProps {
  // ... existing props
  showLatestChangeCta?: boolean;
  latestVersionNumber?: number;
  onJumpToLatest?: () => void;
}
```

**UI Enhancement:**
```tsx
{showLatestChangeCta && latestVersionNumber && onJumpToLatest && (
  <button
    onClick={(e) => {
      e.stopPropagation();
      onJumpToLatest();
    }}
    className="mt-2 w-full px-3 py-1.5 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
  >
    Changed in latest v{latestVersionNumber} — Jump to Latest
  </button>
)}
```

#### 3. API Types (index.ts)

**Updated SaveReviewPayload:**
```typescript
export interface SaveReviewPayload {
  corrections: Record<string, string>; // attributeKey -> correctedValue
  reviewerName?: string;
  status: "Reviewed" | "Approved";
  reviewedAt?: string;
}

export interface SaveReviewResponse {
  ok: boolean;
  versionNumber: number;
  versionId: string;
  updatedCount: number;
  updatedKeys?: string[];
}
```

#### 4. Type Definitions (types/index.ts)

**Added attributeKey to Attribute:**
```typescript
export interface Attribute {
  // ... existing fields
  attributeKey: string; // Stable identifier across versions
}
```

## User Experience Flow

### Scenario: User Edits in Old Version

1. **User views version 2** (not latest)
2. **User edits** "Party A Name" → "Acme Corporation"
3. **User clicks Save Review**
   - Backend updates latest version (v3) `corrected_value` for `party_a_name`
   - Response includes `updatedKeys: ["party_a_name"]`
4. **UI shows CTA** on "Party A Name" card: "Changed in latest v3 — Jump to Latest"
5. **User clicks CTA**
   - Switches to version 3
   - Selects "Party A Name" attribute
   - Shows updated value

## Key Benefits

1. **Stable Identifiers**: `attributeKey` is consistent across all versions
2. **Always Current**: Edits update latest version regardless of viewing context
3. **User Awareness**: Clear feedback when changes affect latest version
4. **Navigation**: One-click jump to latest version to see changes
5. **Data Integrity**: No lost edits due to ID mismatches

## Database Schema Support

The `extracted_fields` table already supports this:
```sql
CREATE TABLE extracted_fields (
  field_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attribute_key VARCHAR(255) NOT NULL, -- Stable key
  row_id VARCHAR(255) GENERATED ALWAYS AS 
    (version_id || '-' || attribute_key) STORED,
  -- ...
);
```

## Testing Checklist

- [ ] Edit attribute in old version, verify update in latest
- [ ] Accept All in old version, verify all updates in latest
- [ ] Clear value (empty string) in old version, verify cleared in latest
- [ ] CTA appears when editing old version after save
- [ ] Jump to Latest navigates correctly and selects attribute
- [ ] Multiple version switches preserve corrected values
- [ ] Export includes latest corrected values

## Files Modified

### Backend
- `azure_function_fastapi_replacement/function_app.py`

### Frontend
- `src/pages/ContractReview.tsx`
- `src/components/AttributeCard.tsx`
- `src/api/index.ts`
- `src/types/index.ts`

## Migration Notes

No database migration required - `attribute_key` already exists in schema and is populated for all existing data.
