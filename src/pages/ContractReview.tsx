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
  const [selectedAttributeKey, setSelectedAttributeKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [correctedValues, setCorrectedValues] = useState<Record<string, string>>({});
  const [originalValues, setOriginalValues] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [followLatest, setFollowLatest] = useState(true);
  const [selectedBBox, setSelectedBBox] = useState<Attribute["boundingBox"] | null>(null);
  const [currentPdfPage, setCurrentPdfPage] = useState<number>(1);


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

        // Initialize corrected values by attributeKey (stable across versions)
        const initialValues: Record<string, string> = {};
        attrs.forEach((attr) => {
          initialValues[attr.attributeKey] = attr.correctedValue || "";
        });
        setCorrectedValues(initialValues);
        setOriginalValues(initialValues); // Track original values

        // Select first attribute by default
        if (attrs.length > 0) {
          setSelectedAttributeId(attrs[0].id);
          setSelectedAttributeKey(attrs[0].attributeKey);
          console.info("[ContractReview] Default attribute selected", {
            attributeId: attrs[0].id,
            attributeKey: attrs[0].attributeKey,
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

  const lowConfidenceCount = useMemo(() => {
    return attributes.filter((attr) => attr.confidenceLevel === "low").length;
  }, [attributes]);

  const latestVersionNumber = useMemo(() => {
    return versions[0]?.versionNumber ?? contractDoc?.currentVersionNumber ?? 1;
  }, [versions, contractDoc]);

  const isViewingLatest = (selectedVersionNumber ?? latestVersionNumber) === latestVersionNumber;

  // Track which attributes have unsaved changes (dirty)
  const isDirtyMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    attributes.forEach((attr) => {
      const currentValue = correctedValues[attr.attributeKey] || "";
      const originalValue = originalValues[attr.attributeKey] || "";
      map[attr.attributeKey] = currentValue !== originalValue;
    });
    return map;
  }, [attributes, correctedValues, originalValues]);

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

  // Sync selectedAttributeId when attributes load (find by attributeKey)
  useEffect(() => {
    if (selectedAttributeKey && attributes.length > 0) {
      const foundAttr = attributes.find(a => a.attributeKey === selectedAttributeKey);
      if (foundAttr && foundAttr.id !== selectedAttributeId) {
        setSelectedAttributeId(foundAttr.id);
      }
    }
  }, [attributes, selectedAttributeKey]);

  // Update bounding box and PDF page when selected attribute changes
  useEffect(() => {
    if (selectedAttribute) {
      // Set bounding box from attribute if available
      if (selectedAttribute.boundingBox) {
        setSelectedBBox(selectedAttribute.boundingBox);
        setCurrentPdfPage(selectedAttribute.boundingBox.page);
      } else {
        // Fallback to attribute's page field
        setSelectedBBox(null);
        setCurrentPdfPage(selectedAttribute.page || 1);
      }
    } else {
      setSelectedBBox(null);
      setCurrentPdfPage(1);
    }
  }, [selectedAttribute]);

  // Version tab click -> reload attributes/PDF
  const handleVersionClick = async (versionNumber: number) => {
    if (!id) return;
    if (selectedVersionNumber === versionNumber) return;
    setFollowLatest(versionNumber === latestVersionNumber);
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

      // Preserve existing correctedValues (user edits) and only add new ones from this version
      setCorrectedValues((prev) => {
        const updated = { ...prev };
        attrs.forEach((attr) => {
          // Only set if not already edited by user (keyed by attributeKey)
          if (!updated[attr.attributeKey]) {
            updated[attr.attributeKey] = attr.correctedValue || "";
          }
        });
        return updated;
      });
      
      // Update original values for new version
      const versionOriginals: Record<string, string> = {};
      attrs.forEach((attr) => {
        versionOriginals[attr.attributeKey] = attr.correctedValue || "";
      });
      setOriginalValues((prev) => ({ ...prev, ...versionOriginals }));

      // Selection will be handled by the sync effect using selectedAttributeKey
    } finally {
      setIsLoading(false);
    }
  };

  // Attribute click -> jump to the version where it changed
  const handleAttributeClick = async (attr: Attribute) => {
    // Always update selectedAttributeKey for stable selection
    setSelectedAttributeKey(attr.attributeKey);
    
    const target = attr.changedInVersionNumber ?? selectedVersionNumber ?? 1;
    if (target !== selectedVersionNumber) {
      // Navigate to target version (selection will sync via effect)
      await handleVersionClick(target);
    } else {
      // Same version, just select it
      setSelectedAttributeId(attr.id);
    }
  };

  const handleAcceptAll = async () => {
    console.log("Starting handleAcceptAll", {
      currentVersion: selectedVersionNumber,
      latestVersion: latestVersionNumber,
      isViewingLatest,
    });

    // If not on latest version, switch to it first
    if (!isViewingLatest) {
      await handleVersionClick(latestVersionNumber);
      // Wait a bit for attributes to load
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Calculate how many empty fields will be filled FIRST
    let filledCount = 0;
    attributes.forEach((attr) => {
      const currentValue = (correctedValues[attr.attributeKey] || "").trim();
      if (!currentValue && attr.extractedValue) {
        filledCount++;
      }
    });
    
    console.log("Accept All - filled blanks count:", filledCount);
    
    // Now update the state with extracted values
    setCorrectedValues((prev) => {
      const updated = { ...prev };
      attributes.forEach((attr) => {
        const currentValue = (prev[attr.attributeKey] || "").trim();
        // Only set if current corrected value is empty
        if (!currentValue && attr.extractedValue) {
          updated[attr.attributeKey] = attr.extractedValue;
        }
      });
      return updated;
    });
    
    toast({
      title: filledCount > 0 ? "✅ Values Applied" : "No Changes",
      description: filledCount > 0 
        ? `Applied ${filledCount} extracted value${filledCount !== 1 ? 's' : ''} to empty field${filledCount !== 1 ? 's' : ''} (version ${latestVersionNumber}). Click "Save Review" to submit.`
        : `All fields already have values. No changes were made.`,
    });
  };

  const handleSaveReview = async () => {
    if (!id) return;

    setIsSaving(true);
    try {
      console.log("Starting handleSaveReview with id:", id);
      console.log("Current correctedValues:", correctedValues);
      console.log("Original values:", originalValues);
      console.log("Latest version number:", latestVersionNumber);

      // Build corrections object - ONLY include attributes that were actually modified
      const corrections: Record<string, string> = {};
      attributes.forEach((attr) => {
        const currentValue = correctedValues[attr.attributeKey] || "";
        const originalValue = originalValues[attr.attributeKey] || "";
        
        // Only include if value has changed
        if (currentValue !== originalValue) {
          corrections[attr.attributeKey] = currentValue;
        }
      });
      
      console.log("Modified attributes to save:", Object.keys(corrections).length);
      console.log("Corrections payload:", corrections);
      
      // Don't send if nothing changed
      if (Object.keys(corrections).length === 0) {
        toast({
          title: "No Changes",
          description: "No attributes were modified.",
        });
        setIsSaving(false);
        return;
      }

      const payload = {
        corrections,
        reviewerName: "unknown",
        status: "Reviewed" as const,
        reviewedAt: new Date().toISOString(),
        viewedVersionNumber: selectedVersionNumber, // For reporting only
      };

      console.log("Payload to be saved (by attributeKey):", payload);

      // Save review - always updates latest version (backend handles this)
      const result = await saveReview(id, payload);

      console.log("Review saved successfully:", result);

      // Update originalValues for saved keys to reflect persisted state
      const updatedOriginals = { ...originalValues };
      Object.keys(corrections).forEach((key) => {
        updatedOriginals[key] = correctedValues[key];
      });
      setOriginalValues(updatedOriginals);

      // Reload current view to get updated changedInVersionNumber from DB
      const attrResp = await getAttributesByDocumentId(id, selectedVersionNumber || latestVersionNumber);
      const updatedAttrs = Array.isArray(attrResp) ? attrResp : attrResp?.attributes || [];
      setAttributes(updatedAttrs);

      toast({
        title: "Review Submitted",
        description: `Review sent to Conga CLM for approval (v${result.versionNumber}). ${result.updatedCount} attribute(s) updated.`,
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

  // Poll for new versions every 10s
  useEffect(() => {
    if (!id) return;
    const intervalId = setInterval(async () => {
      try {
        const nextVersions = await getDocumentVersions(id);
        const nextSorted = [...nextVersions].sort((a, b) => b.versionNumber - a.versionNumber);
        const prevLatest = versions[0]?.versionNumber ?? 1;
        const nextLatest = nextSorted[0]?.versionNumber ?? 1;
        
        setVersions(nextSorted);
        
        // If a new latest version arrived and user is following latest
        if (nextLatest > prevLatest && followLatest && isViewingLatest) {
          await handleVersionClick(nextLatest);
          setFollowLatest(true);
        }
      } catch (error) {
        console.warn("[ContractReview] Failed to poll versions", error);
      }
    }, 1000000);
    
    return () => clearInterval(intervalId);
  }, [id, followLatest, isViewingLatest]);

  useEffect(() => {
    console.info("[ContractReview] Search updated", { query: searchQuery });
  }, [searchQuery]);

  useEffect(() => {
    if (selectedAttributeId && selectedAttributeKey) {
      console.info("[ContractReview] Attribute selected", { 
        attributeId: selectedAttributeId,
        attributeKey: selectedAttributeKey 
      });
    }
  }, [selectedAttributeId, selectedAttributeKey]);

  // Get PDF URL from active version (backend provides proxy URL)
  const pdfUrl = activeVersion?.storageUrl;

  // Log PDF URL information for debugging
  useEffect(() => {
    if (activeVersion) {
      console.info("[PDF Viewer] ========== PDF URL INFO ==========");
      console.info("[PDF Viewer] Storage Ref (from DB):", activeVersion.storageRef);
      console.info("[PDF Viewer] Storage URL (proxy endpoint):", activeVersion.storageUrl);
      console.info("[PDF Viewer] Version Number:", activeVersion.versionNumber);
      console.info("[PDF Viewer] Version Status:", activeVersion.status);
      
      if (pdfUrl) {
        console.info("[PDF Viewer] ✅ PDF will be loaded from Azure Blob Storage via proxy");
        console.info("[PDF Viewer] Full URL:", pdfUrl);
      } else {
        console.warn("[PDF Viewer] ⚠️ No PDF URL available");
      }
      console.info("[PDF Viewer] ==========================================");
    }
  }, [activeVersion, pdfUrl]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar title="Contract Review" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="animate-pulse space-y-3">
            <div className="h-6 bg-muted rounded w-48" />
            <div className="h-64 bg-muted rounded-lg" />
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 animate-fade-in">
        {/* Top Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <Link
              to="/documents"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-1.5"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              Back to Documents
            </Link>
            <h1 className="text-xl font-heading font-semibold text-foreground">Contract Review</h1>
            <p className="text-sm text-muted-foreground leading-tight">
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left Panel: Attributes */}
          <div className="bg-card rounded-lg border border-border shadow-sm p-4">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-heading font-semibold text-foreground">
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
                  <div className="bg-card rounded-lg shadow-md border border-border overflow-hidden">
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
            <p className="text-sm text-muted-foreground mb-3 leading-tight">
              Review and correct attributes. Low-confidence values are highlighted.
            </p>

            {/* Search */}
            <div className="relative mb-3">
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
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {sortedFilteredAttributes.map((attr) => (
                <AttributeCard
                  key={attr.id}
                  attribute={attr}
                  isSelected={selectedAttributeId === attr.id}
                  onSelect={() => handleAttributeClick(attr)}
                  correctedValue={correctedValues[attr.attributeKey] || ""}
                  onCorrectedValueChange={(value) =>
                    setCorrectedValues((prev) => ({ ...prev, [attr.attributeKey]: value }))
                  }
                  saveHint={!isViewingLatest ? `Will be saved to Latest (v${latestVersionNumber})` : undefined}
                  isDirty={isDirtyMap[attr.attributeKey] || false}
                  latestVersionNumber={latestVersionNumber}
                />
              ))}
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2 mt-4 pt-4 border-t border-border">
              <div className="flex-1">
                <button onClick={handleAcceptAll} className="btn-outline w-full text-sm">
                  Accept Extracted Values for Blank Fields Only
                </button>
                {!isViewingLatest && (
                  <p className="text-xs text-primary mt-1 text-center italic">
                    Applies to Latest (v{latestVersionNumber})
                  </p>
                )}
              </div>
              <button
                onClick={handleSaveReview}
                disabled={isSaving}
                className="btn-primary flex-1 disabled:opacity-50 text-sm"
              >
                {isSaving ? "Saving..." : "Save Review"}
              </button>
            </div>
          </div>

          {/* Right Panel: PDF Viewer with version scroll bar */}
          <div className="lg:sticky lg:top-8">
            {/* New version available CTA */}
            {!followLatest && latestVersionNumber > (selectedVersionNumber ?? 1) && (
              <div className="mb-3 p-3 glass rounded-lg flex items-center justify-between shadow-sm border-l-4 border-primary">
                <span className="text-sm text-foreground font-medium">
                  🔔 New version available (v{latestVersionNumber})
                </span>
                <button
                  onClick={() => {
                    setFollowLatest(true);
                    handleVersionClick(latestVersionNumber);
                  }}
                  className="text-sm px-3 py-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-all shadow-sm hover:shadow-md"
                >
                  View Latest
                </button>
              </div>
            )}
            
            {/* Version scroll bar */}
            {versions.length > 0 && (
              <div className="flex gap-1 overflow-x-auto whitespace-nowrap pb-2 mb-2 border-b border-border">
                {versions.map((v) => {
                  const label = v.versionNumber === latestVersionNumber
                    ? `v${v.versionNumber} – Latest`
                    : v.versionNumber === 1
                    ? "v1 – Original"
                    : `v${v.versionNumber}`;
                  const isActive = selectedVersionNumber === v.versionNumber;
                  return (
                    <button
                      key={v.id}
                      className={`tab-button flex-shrink-0 ${
                        isActive
                          ? "tab-button-active"
                          : "tab-button-inactive"
                      }`}
                      onClick={() => handleVersionClick(v.versionNumber)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="mb-2 text-xs text-muted-foreground leading-tight">
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
              selectedBBox={selectedBBox}
              currentPdfPage={currentPdfPage}
              documentTitle={contractDoc.title}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
