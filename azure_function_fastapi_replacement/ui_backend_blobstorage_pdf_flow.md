┌──────────────────────────────────────────────────────────────────────┐
│ 1) USER / BROWSER                                                     │
│    ContractReview.tsx (React UI)                                      │
└───────────────┬──────────────────────────────────────────────────────┘
                │
                │ (A) GET /api/documents/{docId}
                │ (B) GET /api/documents/{docId}/attributes
                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 2) AZURE FUNCTIONS BACKEND                                            │
│    get_document()         get_attributes()                            │
└───────────────┬──────────────────────────────────────────────────────┘
                │
                │ SQL queries
                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 3) POSTGRES DB                                                        │
│    tables: documents, document_versions, attributes...                │
│    returns: storageref (blob ref)                                     │
└───────────────┬──────────────────────────────────────────────────────┘
                │
                │ backend builds proxy URL:
                │ storageUrl = /api/pdf?ref=<urlencoded storageref>
                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 4) UI RECEIVES JSON                                                   │
│    - document + versions + attributes                                 │
│    - uses: pdfUrl = storageUrl                                        │
└───────────────┬──────────────────────────────────────────────────────┘
                │
                │ (C) Browser loads PDF
                │     GET /api/pdf?ref=<storageref>
                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 5) AZURE FUNCTION: pdf_proxy()                                        │
│    - normalize ref → (container, blobName)                            │
│      * full URL: https://.../contracts/2024/x.pdf                     │
│      * legacy:   contracts/2024/x.pdf  -> container=contracts         │
│      * blobname: 2024/x.pdf          -> container=contracts           │
│    - uses AZURE_STORAGE_CONNECTION_STRING                             │
└───────────────┬──────────────────────────────────────────────────────┘
                │
                │ (D) HEAD blob (exists? size?)
                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 6) AZURE BLOB STORAGE                                                 │
│    container: contracts                                               │
│    blob name: 2024/<file>.pdf                                         │
└───────────────┬──────────────────────────────────────────────────────┘
                │
                │ (E) GET blob bytes (Range or Full)                    │
                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 7) pdf_proxy() RETURNS PDF                                            │
│    - Content-Type: application/pdf                                    │
│    - Accept-Ranges: bytes                                             │
│    - If Range request: 206 + Content-Range                            │
└───────────────┬──────────────────────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 8) PDF RENDERS IN UI                                                  │
│    iframe / pdf.js viewer shows the blob-backed PDF                   │
└──────────────────────────────────────────────────────────────────────┘
