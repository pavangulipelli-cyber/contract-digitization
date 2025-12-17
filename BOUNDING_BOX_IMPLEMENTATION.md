# Bounding Box Highlight Feature - Implementation Guide

## Overview
This implementation adds bounding-box based highlighting to the PDF viewer when users click on attributes. The feature includes:
- Database column for storing normalized bounding box coordinates
- FastAPI endpoint returning bounding box data
- React PDF viewer with overlay highlight and pulse animation
- Auto-page navigation to the attribute's location
- Fallback behavior for missing bounding box data

---

## Backend Setup

### 1. Database Migration

**Location:** `fastapi_server_postgresql/data/migration_add_bounding_box.sql`

Run the migration to add the bounding_box column:

```bash
cd fastapi_server_postgresql
psql -U postgres -d contract_ai_postgres_db -f data/migration_add_bounding_box.sql
```

Or, if using the FastAPI server's auto-migration on startup, the schema will be applied automatically.

**What it does:**
- Adds `bounding_box JSONB` column to `attributes` table
- Creates index for faster queries
- Populates sample bounding boxes for doc-001 attributes

### 2. Seed Data with Bounding Boxes

**Location:** `fastapi_server_postgresql/data/seed_bounding_boxes.sql`

If needed, manually apply the seed data:

```bash
psql -U postgres -d contract_ai_postgres_db -f data/seed_bounding_boxes.sql
```

**Bounding Box Format:**
```json
{
  "page": 1,
  "x": 0.10,
  "y": 0.15,
  "w": 0.80,
  "h": 0.05
}
```

Where:
- `page`: PDF page number (1-indexed)
- `x`, `y`: Top-left corner position (0..1 relative to page width/height)
- `w`, `h`: Width and height (0..1 relative to page dimensions)

### 3. FastAPI Endpoint Update

**Location:** `fastapi_server_postgresql/main.py` (lines ~370-390)

The GET `/api/documents/{document_id}/attributes` endpoint now includes:
```python
bounding_box AS "boundingBox"
```

**Response format:**
```json
{
  "id": "attr-001",
  "name": "Contract Start Date",
  "page": 1,
  "boundingBox": {
    "page": 1,
    "x": 0.10,
    "y": 0.15,
    "w": 0.80,
    "h": 0.05
  },
  ...
}
```

---

## Frontend Setup

### 1. Type Definitions

**Location:** `src/types/index.ts`

Updated `Attribute` interface to include optional `boundingBox`:
```typescript
boundingBox?: {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
};
```

### 2. ContractReview Component

**Location:** `src/pages/ContractReview.tsx`

Added state variables:
- `selectedBBox`: Tracks the bounding box of the selected attribute
- `currentPdfPage`: Controls which page is displayed in the PDF viewer

Added useEffect hook to sync these values when an attribute is selected:
```typescript
useEffect(() => {
  if (selectedAttribute) {
    if (selectedAttribute.boundingBox) {
      setSelectedBBox(selectedAttribute.boundingBox);
      setCurrentPdfPage(selectedAttribute.boundingBox.page);
    } else {
      setSelectedBBox(null);
      setCurrentPdfPage(selectedAttribute.page || 1);
    }
  } else {
    setSelectedBBox(null);
    setCurrentPdfPage(1);
  }
}, [selectedAttribute]);
```

### 3. PDFViewer Component

**Location:** `src/components/PDFViewer.tsx`

Enhanced with:
- `selectedBBox` and `currentPdfPage` props
- State for tracking rendered page dimensions (`pageWidth`, `pageHeight`)
- `onPageRenderSuccess` callback to capture rendered page dimensions
- Overlay DIV positioned absolutely over the PDF page to show highlight

**Highlight Overlay:**
```tsx
{selectedBBox && selectedBBox.page === currentPage && pageWidth > 0 && (
  <div
    className="bbox-highlight bbox-pulse"
    style={{
      position: "absolute",
      left: `${selectedBBox.x * 100}%`,
      top: `${selectedBBox.y * 100}%`,
      width: `${selectedBBox.w * 100}%`,
      height: `${selectedBBox.h * 100}%`,
      backgroundColor: "rgba(255, 193, 7, 0.3)",
      border: "2px solid rgba(255, 193, 7, 0.8)",
      pointerEvents: "none",
      zIndex: 10,
    }}
  />
)}
```

### 4. Styling

**Location:** `src/components/PDFViewer.css`

Added styles for bounding box highlight:
- `.bbox-highlight`: Base styling with semi-transparent yellow background
- `.bbox-pulse`: Animation class with 2-second pulse effect
- `@keyframes bbox-pulse`: Smooth pulsing animation with expanding glow

---

## Testing Instructions

### 1. Backend Testing

**Start FastAPI Server:**
```bash
cd fastapi_server_postgresql
python main.py
```

**Test Endpoint:**
```bash
curl "http://localhost:8000/api/documents/doc-001/attributes?version=latest"
```

Expected response should include `boundingBox` for attributes with data:
```json
[
  {
    "id": "attr-001",
    "name": "Contract Start Date",
    "page": 1,
    "boundingBox": {
      "page": 1,
      "x": 0.10,
      "y": 0.15,
      "w": 0.80,
      "h": 0.05
    }
  }
]
```

### 2. Frontend Testing

**Start Frontend Dev Server:**
```bash
npm run dev
```

**Manual Test Steps:**
1. Navigate to a document (e.g., doc-001)
2. Verify the PDF loads on the right panel
3. Click on an attribute in the left panel (e.g., "Contract Start Date")
4. **Expected behavior:**
   - PDF viewer navigates to the correct page (from boundingBox.page)
   - Yellow highlight box appears on the PDF with pulse animation
   - Highlight updates when clicking different attributes
5. Click on an attribute without boundingBox data
   - Should still work with fallback to `attribute.page`
   - No highlight box shown

### 3. Browser DevTools Testing

Open the PDF container in DevTools:
```javascript
// In browser console
document.getElementById('pdf-container')
// Should show the overlay div with class "bbox-highlight bbox-pulse"
```

---

## Fallback Behavior

If `boundingBox` is missing:
1. Component checks for `attribute.page` field
2. PDF navigates to that page
3. No highlight overlay is rendered
4. Highlighted text section still displays below PDF

This ensures backward compatibility with attributes that don't have bounding box data.

---

## Customization Guide

### Change Highlight Color
Edit in `PDFViewer.tsx`:
```tsx
backgroundColor: "rgba(255, 193, 7, 0.3)",  // RGBA color
border: "2px solid rgba(255, 193, 7, 0.8)",
```

Or in `PDFViewer.css`:
```css
--bbox-color: rgb(255, 193, 7);  /* Golden yellow */
--bbox-opacity: 0.3;
--bbox-border-opacity: 0.8;
```

### Adjust Animation Duration
Edit in `PDFViewer.css`:
```css
animation: bbox-pulse 2s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite;
/* Change "2s" to desired duration */
```

### Update Bounding Box Data
Insert/update data in PostgreSQL:
```sql
UPDATE attributes
SET bounding_box = '{"page": 1, "x": 0.15, "y": 0.25, "w": 0.70, "h": 0.04}'
WHERE attributekey = 'attr-001' AND documentid = 'doc-001';
```

---

## Database Schema

### attributes table
```sql
CREATE TABLE attributes (
  ...
  bounding_box JSONB,
  ...
);

CREATE INDEX idx_attributes_bounding_box ON attributes(bounding_box);
```

### Sample Data
```sql
{
  "page": 1,
  "x": 0.10,
  "y": 0.15,
  "w": 0.80,
  "h": 0.05
}
```

---

## Troubleshooting

### Highlight not showing
1. Check `boundingBox` in API response (DevTools > Network tab)
2. Verify `currentPage` matches `boundingBox.page`
3. Ensure `pageWidth` > 0 (page rendered successfully)

### Highlight in wrong position
1. Verify normalized coordinates are between 0 and 1
2. Check `pageWidth` and `pageHeight` match rendered page
3. Consider zoom level and scroll position

### Animation not running
1. Verify `bbox-pulse` class is applied
2. Check browser DevTools for CSS errors
3. Confirm `@keyframes bbox-pulse` is defined in CSS

### API not returning boundingBox
1. Run migration: `migration_add_bounding_box.sql`
2. Verify column exists: `SELECT bounding_box FROM attributes LIMIT 1;`
3. Check FastAPI query includes: `bounding_box AS "boundingBox"`

---

## Files Modified

1. **Database:**
   - `fastapi_server_postgresql/data/migration_add_bounding_box.sql` (new)
   - `fastapi_server_postgresql/data/seed_bounding_boxes.sql` (new)
   - `fastapi_server_postgresql/data/contract_ai_seed_postgres.sql` (updated with bounding_box column)

2. **Backend:**
   - `fastapi_server_postgresql/main.py` (updated GET attributes endpoint)

3. **Frontend:**
   - `src/types/index.ts` (added boundingBox to Attribute type)
   - `src/pages/ContractReview.tsx` (added state and useEffect)
   - `src/components/PDFViewer.tsx` (added overlay rendering and logic)
   - `src/components/PDFViewer.css` (added pulse animation and styling)

---

## Next Steps (Optional Enhancements)

1. **OCR Integration:** Auto-populate bounding boxes from OCR extraction tools
2. **Drag & Resize:** Allow users to manually adjust highlight boxes
3. **Export:** Include highlight boxes in PDF exports
4. **Multiple Highlights:** Show all attributes on current page simultaneously
5. **Keyboard Navigation:** Use arrow keys to jump between attributes on same page
6. **History:** Remember recently highlighted attributes

---

## Support

For issues or questions about the implementation:
1. Check browser console for errors
2. Verify PostgreSQL migration ran successfully
3. Confirm API response includes boundingBox field
4. Review CSS animation timing if visual issues occur
