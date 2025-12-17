export type DocumentStatus = "Pending Review" | "Reviewed" | "Approved";
export type DocumentSource = "salesforce" | "conga" | "sftp";
export type ConfidenceLevel = "high" | "medium" | "low";

export interface Document {
  id: string;
  title: string;
  uploadedAt: string;
  status: DocumentStatus;
  attributeCount: number;
  overallConfidence: number;
  reviewedBy?: string;
  source?: DocumentSource;
  storageRef?: string;
  // Versioning
  currentVersionNumber?: number;
  versions?: DocumentVersion[];
}

export interface Attribute {
  id: string;
  name: string;
  category: string;
  section: string;
  page: number;
  confidenceScore: number;
  confidenceLevel: ConfidenceLevel;
  extractedValue: string;
  correctedValue: string;
  highlightedText: string;
  // Bounding box for highlight overlay
  boundingBox?: {
    page: number;
    x: number;
    y: number;
    w: number;
    h: number;
  };
  // Version-aware fields
  rowId?: string;
  versionId?: string;
  changedInVersionNumber?: number;
}

export interface User {
  name: string;
  email: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  versionNumber: number;
  isLatest: number | boolean;
  createdAt: string;
  status: string;
  storageRef?: string;
  storageUrl?: string;
  notes?: string;
}
