import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { AttributeCard } from "@/components/AttributeCard";
import { PDFViewer } from "@/components/PDFViewer";
import {
  ArrowLeftIcon,
  SearchIcon,
  AlertCircleIcon,
  DownloadIcon,
} from "@/components/icons/Icons";
import {
  getDocumentById,
  getDocumentVersions,
  getAttributesByDocumentId,
  saveReview,
  exportAttributes,
  getPdfUrl,
} from "@/api";
import { Document, Attribute, DocumentVersion } from "@/types";
import { toast } from "@/hooks/use-toast";

export default function ContractReview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [contractDoc, setContractDoc] = useState<Document | null>(null);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [selectedVersionNumber, setSelectedVersionNumber] = useState<number | null>(null);
  const [activeVersion, setActiveVersion] = useState<DocumentVersion | null>(null);
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAttributeId, setSelectedAttributeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [correctedValues, setCorrectedValues] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);


  useEffect(() => {
    console.info("[ContractReview] Mounted", { documentId: id });

    async function fetchData() {
      if (!id) return;

      console.info("[ContractReview] Fetching document and attributes", {
        documentId: id,
      });

      try {
        const docData = await getDocumentById(id);

        if (!docData) {
          navigate("/documents");
          return;
        }

        setContractDoc(docData);

        // Versions (prefer doc.versions, fallback to API)
        let docVersions: DocumentVersion[] = docData.versions || [];
        if (!docVersions.length) {
          try {
            docVersions = await getDocumentVersions(id);
          } catch (e) {
            console.warn("[ContractReview] Failed to fetch versions, continuing", e);
          }
        }
        docVersions = [...docVersions].sort((a, b) => b.versionNumber - a.versionNumber);
        setVersions(docVersions);

        const defaultVersion = docData.currentVersionNumber || (docVersions[0]?.versionNumber ?? 1);
        setSelectedVersionNumber(defaultVersion);

        const attrResp = await getAttributesByDocumentId(id, defaultVersion);
        const attrs = Array.isArray(attrResp) ? attrResp : attrResp?.attributes || [];
        const versionMeta = !Array.isArray(attrResp)
          ? attrResp?.version || null
          : docVersions.find((v) => v.versionNumber === defaultVersion) || null;

        setAttributes(attrs);
        setActiveVersion(versionMeta);

        console.info("[ContractReview] Data loaded", {
          documentId: docData.id,
          attributeCount: attrs.length,
          selectedVersion: defaultVersion,
        });

        // Initialize corrected values
        const initialValues: Record<string, string> = {};
        attrs.forEach((attr) => {
          initialValues[attr.id] = attr.correctedValue || "";
        });
        setCorrectedValues(initialValues);

        // Select first attribute by default
        if (attrs.length > 0) {
          setSelectedAttributeId(attrs[0].id);
          console.info("[ContractReview] Default attribute selected", {
            attributeId: attrs[0].id,
          });
        }
      } catch (error) {
        console.error("Failed to fetch document:", error);
        toast({
          title: "Error",
          description: "Failed to load document. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [id, navigate]);

  const filteredAttributes = useMemo(() => {
    return attributes.filter((attr) => {
      const searchLower = searchQuery.toLowerCase();
      return (
        attr.name.toLowerCase().includes(searchLower) ||
        attr.section.toLowerCase().includes(searchLower) ||
        attr.category.toLowerCase().includes(searchLower)
      );
    });
  }, [attributes, searchQuery]);

  const sortedFilteredAttributes = useMemo(() => {
    const list = [...filteredAttributes];
    list.sort((a, b) => {
      const av = a.changedInVersionNumber ?? 1;
      const bv = b.changedInVersionNumber ?? 1;
      if (bv !== av) return bv - av;
      const ac = a.confidenceScore ?? 0;
      const bc = b.confidenceScore ?? 0;
      if (bc !== ac) return bc - ac;
      return (a.name ?? "").localeCompare(b.name ?? "");
    });
    return list;
  }, [filteredAttributes]);

  const selectedAttribute = useMemo(() => {
    return attributes.find((attr) => attr.id === selectedAttributeId) || null;
  }, [attributes, selectedAttributeId]);

  const lowConfidenceCount = useMemo(() => {
    return attributes.filter((attr) => attr.confidenceLevel === "low").length;
  }, [attributes]);

  // Version tab click -> reload attributes/PDF
  const handleVersionClick = async (versionNumber: number) => {
    if (!id) return;
    if (selectedVersionNumber === versionNumber) return;
    setSelectedVersionNumber(versionNumber);
    setIsLoading(true);
    try {
      const attrResp = await getAttributesByDocumentId(id, versionNumber);
      const attrs = Array.isArray(attrResp) ? attrResp : attrResp?.attributes || [];
      const versionMeta = !Array.isArray(attrResp)
        ? attrResp?.version || null
        : versions.find((v) => v.versionNumber === versionNumber) || null;

      setAttributes(attrs);
      setActiveVersion(versionMeta);

      const initialValues: Record<string, string> = {};
      attrs.forEach((attr) => {
        initialValues[attr.id] = attr.correctedValue || "";
      });
      setCorrectedValues(initialValues);

      if (selectedAttributeId) {
        const exists = attrs.find((a) => a.id === selectedAttributeId);
        if (!exists && attrs.length) {
          setSelectedAttributeId(attrs[0].id);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Attribute click -> jump to the version where it changed
  const handleAttributeClick = async (attr: Attribute) => {
    setSelectedAttributeId(attr.id);
    const target = attr.changedInVersionNumber ?? selectedVersionNumber ?? 1;
    if (target !== selectedVersionNumber) {
      await handleVersionClick(target);
      setSelectedAttributeId(attr.id);
    }
  };

  const handleAcceptAll = () => {
    const newValues: Record<string, string> = {};
    console.log("Starting handleAcceptAll with attributes:", attributes);
    
    attributes.forEach((attr) => {
      newValues[attr.id] = attr.extractedValue;
    });
    
    console.log("New values to be set:", newValues);
    setCorrectedValues(newValues);
    console.log("Corrected values updated:", newValues);
    
    toast({
      title: "Values Accepted",
      description: "All extracted values have been copied to corrected fields.",
    });
  };

  const handleSaveReview = async () => {
    if (!id) return;

    setIsSaving(true);
    try {
      console.log("Starting handleSaveReview with id:", id);
      console.log("Current correctedValues:", correctedValues);
      console.log("Original attributes:", attributes);

      // Prepare attributes with corrected values
      const updatedAttributes = attributes.map((attribute) => {
        const correctedValue = correctedValues[attribute.id] || attribute.correctedValue;
        console.log(`Processing attribute ${attribute.id}:`, {
          correctedValue,
          originalAttribute: attribute,
        });
        return {
          ...attribute,
          correctedValue,
          lastModified: new Date().toISOString(),
        };
      });

      console.log("Updated attributes prepared:", updatedAttributes);

      const payload = {
        documentId: id,
        versionNumber: selectedVersionNumber ?? ("latest" as const),
        attributes: updatedAttributes.map((a) => ({ id: a.id, rowId: a.rowId, correctedValue: a.correctedValue })),
        status: "Reviewed" as const,
        reviewedAt: new Date().toISOString(),
      };

      console.log("Payload to be saved:", payload);

      // Save review and update database
      await saveReview(id, payload);

      console.log("Review saved successfully");

      toast({
        title: "Review Saved",
        description: "Your review and attributes have been saved to the database.",
      });
    } catch (error) {
      console.error("Failed to save review:", error);
      toast({
        title: "Error",
        description: "Failed to save review. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportAttributes = async (format: "csv" | "json") => {
    if (!id) return;

    setIsExporting(true);
    console.info("[ContractReview] Export attributes", { documentId: id, format });
    try {
      const blob = await exportAttributes(id, format, selectedVersionNumber ?? "latest");

      // Download the file
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = `${contractDoc?.title.replace(/\.[^/.]+$/, "")}-attributes.${format}`;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Export Complete",
        description: `Attributes exported as ${format.toUpperCase()}.`,
      });
    } catch (error) {
      console.error("Export failed:", error);
      toast({
        title: "Error",
        description: "Failed to export attributes. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    console.info("[ContractReview] Search updated", { query: searchQuery });
  }, [searchQuery]);

  useEffect(() => {
    if (selectedAttributeId) {
      console.info("[ContractReview] Attribute selected", { attributeId: selectedAttributeId });
    }
  }, [selectedAttributeId]);

  // Get PDF URL from active version
  const pdfUrl = activeVersion?.storageUrl || (activeVersion?.storageRef ? getPdfUrl(activeVersion.storageRef) : undefined);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar title="Contract Review" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-48" />
            <div className="h-64 bg-muted rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!contractDoc) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar title="Contract Review" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Top Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <Link
              to="/documents"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              Back to Documents
            </Link>
            <h1 className="text-xl font-semibold text-foreground">Contract Review</h1>
            <p className="text-sm text-muted-foreground">
              AI-powered attribute extraction and validation
            </p>
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>Document ID: {id}</span>
            <span>·</span>
            <span>{attributes.length} attributes</span>
            {lowConfidenceCount > 0 && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1 text-destructive">
                  <AlertCircleIcon className="w-4 h-4" />
                  {lowConfidenceCount} low confidence
                </span>
              </>
            )}
          </div>
        </div>

        {/* Main Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel: Attributes */}
          <div className="bg-card rounded-xl card-shadow p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-semibold text-foreground">
                Extracted Attributes
              </h2>

              {/* Export dropdown */}
              <div className="relative group">
                <button
                  disabled={isExporting}
                  className="flex items-center gap-1 px-2 py-1 text-sm text-muted-foreground hover:text-foreground rounded transition-colors disabled:opacity-50"
                >
                  <DownloadIcon className="w-4 h-4" />
                  Export
                </button>

                <div className="absolute right-0 mt-1 hidden group-hover:block z-10">
                  <div className="bg-card rounded-lg card-shadow-lg border border-border overflow-hidden">
                    <button
                      onClick={() => handleExportAttributes("csv")}
                      className="w-full px-4 py-2 text-sm text-left hover:bg-muted transition-colors whitespace-nowrap"
                    >
                      Export as CSV
                    </button>
                    <button
                      onClick={() => handleExportAttributes("json")}
                      className="w-full px-4 py-2 text-sm text-left hover:bg-muted transition-colors whitespace-nowrap"
                    >
                      Export as JSON
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Review and correct attributes. Low-confidence values are highlighted.
            </p>

            {/* Search */}
            <div className="relative mb-4">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search attributes or sections…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field pl-10"
              />
            </div>

            {/* Attribute List */}
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {sortedFilteredAttributes.map((attr) => (
                <AttributeCard
                  key={attr.id}
                  attribute={attr}
                  isSelected={selectedAttributeId === attr.id}
                  onSelect={() => handleAttributeClick(attr)}
                  correctedValue={correctedValues[attr.id] || ""}
                  onCorrectedValueChange={(value) =>
                    setCorrectedValues((prev) => ({ ...prev, [attr.id]: value }))
                  }
                />
              ))}
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 mt-6 pt-6 border-t border-border">
              <button onClick={handleAcceptAll} className="btn-secondary flex-1">
                Accept All Extracted Values
              </button>
              <button
                onClick={handleSaveReview}
                disabled={isSaving}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save Review"}
              </button>
            </div>
          </div>

          {/* Right Panel: PDF Viewer with version tabs */}
          <div className="lg:sticky lg:top-8">
            {versions.length > 0 && (
              <div className="flex items-center gap-2 mb-3">
                {versions.map((v) => {
                  const label = `v${v.versionNumber}${v.isLatest ? " – Latest" : v.versionNumber === 1 ? " – Original" : ""}`;
                  const isActive = selectedVersionNumber === v.versionNumber;
                  return (
                    <button
                      key={v.id}
                      className={`px-3 py-1 rounded text-sm border ${isActive ? "bg-muted border-border" : "bg-card border-border hover:bg-muted"}`}
                      onClick={() => handleVersionClick(v.versionNumber)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="mb-2 text-xs text-muted-foreground">
              {activeVersion ? (
                <span>
                  Version {activeVersion.versionNumber} – {activeVersion.status} – Generated {new Date(activeVersion.createdAt).toLocaleString()}
                </span>
              ) : null}
              {selectedAttribute && (
                <div>
                  Viewing attribute: {selectedAttribute.name}{" "}
                  {selectedAttribute.changedInVersionNumber ? (
                    <span>(changed in v{selectedAttribute.changedInVersionNumber})</span>
                  ) : null}
                </div>
              )}
            </div>
            <PDFViewer
              pdfUrl={pdfUrl}
              selectedAttribute={selectedAttribute}
              documentTitle={contractDoc.title}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
