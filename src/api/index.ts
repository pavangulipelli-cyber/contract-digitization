import { Document, Attribute, DocumentVersion } from "@/types";
import { mockDocuments } from "@/data/mockDocuments";
import { mockAttributesByDocument } from "@/data/mockAttributes";

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

// Simulate network delay for mock data
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getDocuments(): Promise<Document[]> {
  if (!USE_MOCKS) {
    try {
      return await apiRequest<Document[]>("/api/documents");
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
      return await apiRequest<Document>(`/api/documents/${id}`);
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
      return await apiRequest<AttributesResponse>(`/api/documents/${docId}/attributes?version=${versionParam}`);
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
