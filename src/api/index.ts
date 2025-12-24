import { Document, Attribute, DocumentVersion } from "@/types";
import { mockDocuments } from "@/data/mockDocuments";
import { mockAttributesByDocument } from "@/data/mockAttributes";
 ///api/documents/${docId}/attributes/export?format=${format}&version=${v}`
 ///api/documents/${docId}/attributes?version=${versionParam}`
        // export_attributes: [GET,OPTIONS] http://localhost:7075/api/documents/{document_id}/attributes/export -need to test

        // get_attributes: [GET,OPTIONS] http://localhost:7075/api/documents/{document_id}/attributes - need to test
 
        // get_document: [GET,OPTIONS] http://localhost:7075/api/documents/{document_id} -done
 
        // get_documents: [GET,OPTIONS] http://localhost:7075/api/documents -done
 
        // get_versions: [GET,OPTIONS] http://localhost:7075/api/documents/{document_id}/versions -done
 
        // health: [GET,OPTIONS] http://localhost:7075/api/health
 
        // pdf_proxy: [GET,OPTIONS] http://localhost:7075/api/pdf 
 
        // save_review: [POST,OPTIONS] http://localhost:7075/api/documents/{document_id}/review -done
 
        // serve_static_files: [GET,OPTIONS] http://localhost:7075/contracts/{*path}
// Azure Functions / AKS API base URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
console.info("[API] Using base URL:", API_BASE_URL);
// Toggle to force mock data (set VITE_USE_MOCKS=true or leave API_BASE_URL empty)
const USE_MOCKS = !API_BASE_URL || import.meta.env.VITE_USE_MOCKS === "true";

// Helper for API requests
async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// -------- Normalizers to harden against nulls --------
function normalizeDocument(doc: any): Document {
  const status = (doc?.status ?? "Reviewed") as Document["status"];
  return {
    id: String(doc?.id ?? ""),
    title: typeof doc?.title === "string" ? doc.title : "",
    uploadedAt: typeof doc?.uploadedAt === "string" ? doc.uploadedAt : "",
    status,
    attributeCount: typeof doc?.attributeCount === "number" ? doc.attributeCount : 0,
    overallConfidence: typeof doc?.overallConfidence === "number" ? doc.overallConfidence : 0,
    reviewedBy: typeof doc?.reviewedBy === "string" ? doc.reviewedBy : undefined,
    source: typeof doc?.source === "string" ? doc.source : undefined,
    storageRef: typeof doc?.storageRef === "string" ? doc.storageRef : undefined,
    currentVersionNumber:
      typeof doc?.currentVersionNumber === "number" ? doc.currentVersionNumber : undefined,
    versions: Array.isArray(doc?.versions)
      ? doc.versions.map((v: any) => ({
          id: String(v?.id ?? ""),
          documentId: String(v?.documentId ?? doc?.id ?? ""),
          versionNumber: typeof v?.versionNumber === "number" ? v.versionNumber : 1,
          isLatest: (v?.isLatest ?? false) as any,
          createdAt: typeof v?.createdAt === "string" ? v.createdAt : new Date().toISOString(),
          status: typeof v?.status === "string" ? v.status : status,
          storageRef: typeof v?.storageRef === "string" ? v.storageRef : undefined,
          storageUrl: typeof v?.storageUrl === "string" ? v.storageUrl : undefined,
          notes: typeof v?.notes === "string" ? v.notes : undefined,
        }))
      : undefined,
  };
}

function deriveConfidenceLevel(score: any): "high" | "medium" | "low" | null {
  const n = typeof score === "number" ? score : Number(score);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 80) return "high";
  if (n >= 50) return "medium";
  return "low";
}

function normalizeAttribute(attr: any): any /* returns Attribute but may carry null confidenceLevel */ {
  const id = attr?.id ?? attr?.attributeKey ?? "";
  if (!attr?.id && !attr?.attributeKey) {
    console.warn("[API] Attribute missing id/attributeKey", attr);
  }
  const extractedValue = typeof attr?.extractedValue === "string" ? attr.extractedValue : "";
  const correctedValue = typeof attr?.correctedValue === "string" ? attr.correctedValue : "";
  const confidenceScore = typeof attr?.confidenceScore === "number" ? attr.confidenceScore : 0;
  const rawLevel = attr?.confidenceLevel;
  const levelValid = rawLevel === "high" || rawLevel === "medium" || rawLevel === "low";
  const confidenceLevel = levelValid ? rawLevel : deriveConfidenceLevel(confidenceScore);
  return {
    id: String(id),
    name: typeof attr?.name === "string" ? attr.name : "",
    category: typeof attr?.category === "string" ? attr.category : "",
    section: typeof attr?.section === "string" ? attr.section : "",
    page: typeof attr?.page === "number" ? attr.page : 1,
    confidenceScore,
    // Allow null here; UI guards will hide the pill
    confidenceLevel: confidenceLevel as any,
    extractedValue,
    correctedValue,
    highlightedText: typeof attr?.highlightedText === "string" ? attr.highlightedText : "",
    boundingBox: attr?.boundingBox && typeof attr?.boundingBox === "object" ? attr.boundingBox : undefined,
    rowId: typeof attr?.rowId === "string" ? attr.rowId : undefined,
    versionId: typeof attr?.versionId === "string" ? attr.versionId : undefined,
    changedInVersionNumber:
      typeof attr?.changedInVersionNumber === "number" ? attr.changedInVersionNumber : undefined,
    attributeKey: String(attr?.attributeKey ?? id),
  } as any;
}

// Simulate network delay for mock data
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getDocuments(): Promise<Document[]> {
  if (!USE_MOCKS) {
    try {
      const raw = await apiRequest<any[]>("/api/documents");
      return raw.map(normalizeDocument);
    } catch (e) {
      console.warn("[API] getDocuments failed, using mock fallback", e);
    }
  }
  
  // Mock fallback
  await delay(300);
  return mockDocuments;
}

export async function getDocumentById(id: string): Promise<Document | null> {
  if (!USE_MOCKS) {
    try {
      const raw = await apiRequest<any>(`/api/documents/${id}`);
      return normalizeDocument(raw);
    } catch {
      console.warn("[API] getDocumentById failed, using mock fallback");
    }
  }
  
  // Mock fallback
  await delay(200);
  return mockDocuments.find((doc) => doc.id === id) || null;
}

export async function getDocumentVersions(docId: string): Promise<DocumentVersion[]> {
  if (!USE_MOCKS) {
    try {
      return await apiRequest<DocumentVersion[]>(`/api/documents/${docId}/versions`);
    } catch (e) {
      console.warn("[API] getDocumentVersions failed, using mock fallback", e);
    }
  }
  // Mock fallback
  await delay(200);
  const doc = mockDocuments.find((d) => d.id === docId);
  const baseVersion: DocumentVersion = {
    id: `${docId}-v1`,
    documentId: docId,
    versionNumber: 1,
    isLatest: true,
    createdAt: new Date().toISOString(),
    status: doc?.status || "Reviewed",
    storageRef: doc?.storageRef,
    storageUrl: doc?.storageRef ? `/${doc?.storageRef}` : undefined,
  };
  return [baseVersion];
}

export interface AttributesResponse {
  documentId: string;
  version: DocumentVersion;
  attributes: Attribute[];
}

export async function getAttributesByDocumentId(
  docId: string,
  version?: number | "latest"
): Promise<AttributesResponse> {
  const versionParam = version ?? "latest";
  if (!USE_MOCKS) {
    try {
      const raw = await apiRequest<any>(`/api/documents/${docId}/attributes?version=${versionParam}`);
      // Normalize attributes array and version fields
      const attrs = Array.isArray(raw?.attributes) ? raw.attributes.map(normalizeAttribute) : [];
      const v = raw?.version ?? {};
      const version: DocumentVersion = {
        id: String(v?.id ?? `${docId}-v${versionParam}`),
        documentId: String(v?.documentId ?? docId),
        versionNumber: typeof v?.versionNumber === "number" ? v.versionNumber : (typeof versionParam === "number" ? versionParam : 1),
        isLatest: (v?.isLatest ?? (versionParam === "latest")) as any,
        createdAt: typeof v?.createdAt === "string" ? v.createdAt : new Date().toISOString(),
        status: typeof v?.status === "string" ? v.status : "Reviewed",
        storageRef: typeof v?.storageRef === "string" ? v.storageRef : undefined,
        storageUrl: typeof v?.storageUrl === "string" ? v.storageUrl : undefined,
        notes: typeof v?.notes === "string" ? v.notes : undefined,
      };
      return { documentId: String(raw?.documentId ?? docId), version, attributes: attrs } as AttributesResponse;
    } catch (e) {
      console.warn("[API] getAttributesByDocumentId failed, using mock fallback", e);
    }
  }
  
  // Mock fallback
  await delay(250);
  const attrs = mockAttributesByDocument[docId] || [];
  const doc = mockDocuments.find((d) => d.id === docId);
  return {
    documentId: docId,
    version: {
      id: `${docId}-v${versionParam === "latest" ? 1 : versionParam}`,
      documentId: docId,
      versionNumber: typeof versionParam === "number" ? versionParam : 1,
      isLatest: versionParam === "latest",
      createdAt: new Date().toISOString(),
      status: doc?.status || "Reviewed",
      storageRef: doc?.storageRef,
      storageUrl: doc?.storageRef ? `/${doc?.storageRef}` : undefined,
    },
    attributes: attrs,
  };
}

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

export async function saveReview(
  docId: string,
  payload: SaveReviewPayload
): Promise<SaveReviewResponse> {
  if (!USE_MOCKS) {
    try {
      return await apiRequest<SaveReviewResponse>(`/api/documents/${docId}/review`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.warn("[API] saveReview failed, using mock fallback", e);
    }
  }
  
  // Mock fallback
  await delay(500);
  console.log("Review saved:", { docId, payload });
  return { 
    ok: true, 
    versionNumber: 1, 
    versionId: `ver-${docId}-v1`,
    updatedCount: Object.keys(payload.corrections).length,
    updatedKeys: Object.keys(payload.corrections)
  };
}

// Bulk operations
export interface BulkActionPayload {
  documentIds: string[];
  action: "approve" | "review" | "delete";
  reviewedBy?: string;
}

export async function bulkUpdateDocuments(
  payload: BulkActionPayload
): Promise<{ success: boolean; updatedCount: number }> {
  if (!USE_MOCKS) {
    try {
      return await apiRequest<{ success: boolean; updatedCount: number }>("/api/documents/bulk", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.warn("[API] bulkUpdateDocuments failed, using mock fallback", e);
    }
  }
  
  // Mock fallback
  await delay(600);
  console.log("Bulk action executed:", payload);
  return { success: true, updatedCount: payload.documentIds.length };
}

// Export functionality
export interface ExportOptions {
  documentIds?: string[];
  format: "csv" | "json";
  includeAttributes?: boolean;
}

export async function exportDocuments(options: ExportOptions): Promise<Blob> {
  if (!USE_MOCKS) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/documents/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options),
      });
      if (!response.ok) throw new Error(`Export documents failed: ${response.status}`);
      return response.blob();
    } catch (e) {
      console.warn("[API] exportDocuments failed, using mock fallback", e);
    }
  }
  
  // Mock fallback - generate export data locally
  await delay(400);
  
  const docs = options.documentIds
    ? mockDocuments.filter((d) => options.documentIds!.includes(d.id))
    : mockDocuments;

  if (options.format === "json") {
    const exportData = options.includeAttributes
      ? docs.map((doc) => ({
          ...doc,
          attributes: mockAttributesByDocument[doc.id] || [],
        }))
      : docs;
    
    return new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
  }

  // CSV format
  const headers = [
    "ID",
    "Title",
    "Status",
    "Uploaded At",
    "Attribute Count",
    "Confidence",
    "Reviewed By",
  ];

  const rows = docs.map((doc) => [
    doc.id,
    `"${doc.title}"`,
    doc.status,
    doc.uploadedAt,
    doc.attributeCount.toString(),
    `${doc.overallConfidence}%`,
    doc.reviewedBy || "",
  ]);

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

  return new Blob([csvContent], { type: "text/csv" });
}

export async function exportAttributes(
  docId: string,
  format: "csv" | "json",
  version?: number | "latest"
): Promise<Blob> {
  if (API_BASE_URL) {
    try {
      const v = version ?? "latest";
      const response = await fetch(
        `${API_BASE_URL}/api/documents/${docId}/attributes/export?format=${format}&version=${v}`
      );
      if (!response.ok) throw new Error(`Export failed: ${response.status}`);
      return response.blob();
    } catch (e) {
      console.warn("[API] exportAttributes failed, using mock fallback", e);
    }
  }
  
  // Mock fallback
  await delay(300);
  
  const attributes = mockAttributesByDocument[docId] || [];

  if (format === "json") {
    return new Blob([JSON.stringify(attributes, null, 2)], {
      type: "application/json",
    });
  }

  // CSV format
  const headers = [
    "ID",
    "Name",
    "Category",
    "Section",
    "Page",
    "Confidence",
    "Extracted Value",
    "Corrected Value",
  ];

  const rows = attributes.map((attr) => [
    attr.id,
    `"${attr.name}"`,
    attr.category,
    `"${attr.section}"`,
    attr.page.toString(),
    `${attr.confidenceScore}%`,
    `"${attr.extractedValue}"`,
    `"${attr.correctedValue}"`,
  ]);

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

  return new Blob([csvContent], { type: "text/csv" });
}

// Note: PDFs are now served via backend proxy at /api/pdf
// The backend provides storageUrl in API responses - use that directly.
