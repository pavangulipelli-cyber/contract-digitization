import { useState, useEffect, useMemo, useCallback } from "react";
import { Navbar } from "@/components/Navbar";
import { SummaryCard } from "@/components/SummaryCard";
import { DocumentCard } from "@/components/DocumentCard";
import { BulkActionBar } from "@/components/BulkActionBar";
import {
  FileTextIcon,
  ClockIcon,
  CheckCircleIcon,
  SearchIcon,
  ChevronDownIcon,
  DownloadIcon,
  CheckSquareIcon,
  SquareIcon,
  MinusSquareIcon,
} from "@/components/icons/Icons";
import { getDocuments, bulkUpdateDocuments, exportDocuments } from "@/api";
import { Document, DocumentStatus } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/hooks/use-toast";

type FilterStatus = "all" | DocumentStatus;

export default function DocumentsDashboard() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCheckboxes, setShowCheckboxes] = useState(false);

  useEffect(() => {
    console.info("[DocumentsDashboard] Mounted");

    async function fetchDocuments() {
      console.info("[DocumentsDashboard] Fetching documents");
      try {
        const data = await getDocuments();
        setDocuments(data);
        console.info("[DocumentsDashboard] Documents loaded", { count: data.length });
      } catch (error) {
        console.error("Failed to fetch documents:", error);
        toast({
          title: "Error",
          description: "Failed to load documents. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    }
    fetchDocuments();
  }, []);

  const stats = useMemo(() => {
    const total = documents.length;
    const pending = documents.filter((d) => d.status === "Pending Review").length;
    const completed = documents.filter(
      (d) => d.status === "Reviewed" || d.status === "Approved"
    ).length;
    return { total, pending, completed };
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || doc.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [documents, searchQuery, statusFilter]);

  const statusOptions: { value: FilterStatus; label: string }[] = [
    { value: "all", label: "All Status" },
    { value: "Pending Review", label: "Pending Review" },
    { value: "Reviewed", label: "Reviewed" },
    { value: "Approved", label: "Approved" },
  ];

  // Selection handlers
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      console.info("[DocumentsDashboard] Toggled selection", {
        id,
        selected: newSet.has(id),
        totalSelected: newSet.size,
      });
      return newSet;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filteredDocuments.map((d) => d.id)));
    console.info("[DocumentsDashboard] Select all", { count: filteredDocuments.length });
  }, [filteredDocuments]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    console.info("[DocumentsDashboard] Cleared selection");
  }, []);

  const toggleSelectMode = useCallback(() => {
    setShowCheckboxes((prev) => !prev);
    if (showCheckboxes) {
      clearSelection();
    }
    console.info("[DocumentsDashboard] Toggled select mode", {
      enabled: !showCheckboxes,
    });
  }, [showCheckboxes, clearSelection]);

  // Bulk actions
  const handleBulkApprove = async () => {
    setIsProcessing(true);
    console.info("[DocumentsDashboard] Bulk approve", { ids: Array.from(selectedIds) });
    try {
      const result = await bulkUpdateDocuments({
        documentIds: Array.from(selectedIds),
        action: "approve",
        reviewedBy: user?.name,
      });

      if (result.success) {
        // Update local state
        setDocuments((prev) =>
          prev.map((doc) =>
            selectedIds.has(doc.id)
              ? { ...doc, status: "Approved" as const, reviewedBy: user?.name }
              : doc
          )
        );
        clearSelection();
        toast({
          title: "Documents Approved",
          description: `${result.updatedCount} document(s) have been approved.`,
        });
      }
    } catch (error) {
      console.error("Bulk approve failed:", error);
      toast({
        title: "Error",
        description: "Failed to approve documents. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkReview = async () => {
    setIsProcessing(true);
    console.info("[DocumentsDashboard] Bulk review", { ids: Array.from(selectedIds) });
    try {
      const result = await bulkUpdateDocuments({
        documentIds: Array.from(selectedIds),
        action: "review",
        reviewedBy: user?.name,
      });

      if (result.success) {
        setDocuments((prev) =>
          prev.map((doc) =>
            selectedIds.has(doc.id)
              ? { ...doc, status: "Reviewed" as const, reviewedBy: user?.name }
              : doc
          )
        );
        clearSelection();
        toast({
          title: "Documents Updated",
          description: `${result.updatedCount} document(s) marked as reviewed.`,
        });
      }
    } catch (error) {
      console.error("Bulk review failed:", error);
      toast({
        title: "Error",
        description: "Failed to update documents. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExport = async (format: "csv" | "json") => {
    setIsProcessing(true);
    console.info("[DocumentsDashboard] Export requested", {
      format,
      ids: selectedIds.size > 0 ? Array.from(selectedIds) : "all",
    });
    try {
      const blob = await exportDocuments({
        documentIds: selectedIds.size > 0 ? Array.from(selectedIds) : undefined,
        format,
        includeAttributes: true,
      });

      // Download the file
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `documents-export-${new Date().toISOString().split("T")[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Export Complete",
        description: `Documents exported as ${format.toUpperCase()}.`,
      });
    } catch (error) {
      console.error("Export failed:", error);
      toast({
        title: "Error",
        description: "Failed to export documents. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Determine header checkbox state
  const allSelected =
    filteredDocuments.length > 0 &&
    filteredDocuments.every((d) => selectedIds.has(d.id));
  const someSelected =
    filteredDocuments.some((d) => selectedIds.has(d.id)) && !allSelected;

  return (
    <div className="min-h-screen bg-background">
      <Navbar title="Documents Dashboard" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <SummaryCard
            title="Total Documents"
            value={stats.total}
            icon={<FileTextIcon className="w-6 h-6 text-accent" />}
            iconColor="bg-accent/10"
          />
          <SummaryCard
            title="Pending Review"
            value={stats.pending}
            icon={<ClockIcon className="w-6 h-6 text-warning" />}
            iconColor="bg-warning/10"
          />
          <SummaryCard
            title="Completed"
            value={stats.completed}
            icon={<CheckCircleIcon className="w-6 h-6 text-success" />}
            iconColor="bg-success/10"
          />
        </div>

        {/* Document List Container */}
        <div className="bg-card rounded-xl card-shadow p-6">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            {/* Left: Select toggle and search */}
            <div className="flex items-center gap-3 flex-1">
              <button
                onClick={toggleSelectMode}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  showCheckboxes
                    ? "bg-accent text-accent-foreground border-accent"
                    : "bg-card text-muted-foreground border-border hover:border-accent"
                }`}
              >
                <CheckSquareIcon className="w-4 h-4" />
                Select
              </button>

              <div className="relative flex-1">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search documents…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-field pl-10"
                />
              </div>
            </div>

            {/* Right: Filter and Export */}
            <div className="flex items-center gap-3">
              {/* Status Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="input-field w-full sm:w-48 flex items-center justify-between text-left"
                >
                  <span>
                    {statusOptions.find((o) => o.value === statusFilter)?.label}
                  </span>
                  <ChevronDownIcon className="w-4 h-4 text-muted-foreground" />
                </button>

                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-full sm:w-48 bg-card rounded-lg card-shadow-lg border border-border z-10 animate-fade-in">
                    {statusOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setStatusFilter(option.value);
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-muted transition-colors first:rounded-t-lg last:rounded-b-lg ${
                          statusFilter === option.value ? "bg-muted font-medium" : ""
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Export button (when not in select mode) */}
              {!showCheckboxes && (
                <div className="relative group">
                  <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-secondary text-secondary-foreground rounded-lg border border-border hover:bg-secondary/80 transition-colors">
                    <DownloadIcon className="w-4 h-4" />
                    Export
                  </button>

                  <div className="absolute right-0 mt-2 hidden group-hover:block z-10">
                    <div className="bg-card rounded-lg card-shadow-lg border border-border overflow-hidden">
                      <button
                        onClick={() => handleExport("csv")}
                        className="w-full px-4 py-2 text-sm text-left hover:bg-muted transition-colors whitespace-nowrap"
                      >
                        Export as CSV
                      </button>
                      <button
                        onClick={() => handleExport("json")}
                        className="w-full px-4 py-2 text-sm text-left hover:bg-muted transition-colors whitespace-nowrap"
                      >
                        Export as JSON
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Select All header (when in select mode) */}
          {showCheckboxes && filteredDocuments.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-2 bg-muted rounded-lg mb-4">
              <button
                onClick={allSelected ? clearSelection : selectAll}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {allSelected ? (
                  <CheckSquareIcon className="w-5 h-5 text-accent" />
                ) : someSelected ? (
                  <MinusSquareIcon className="w-5 h-5 text-accent" />
                ) : (
                  <SquareIcon className="w-5 h-5" />
                )}
              </button>
              <span className="text-sm text-muted-foreground">
                {allSelected
                  ? "All selected"
                  : someSelected
                  ? `${selectedIds.size} selected`
                  : "Select all"}
              </span>
            </div>
          )}

          {/* Document List */}
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="text-center py-12">
              <FileTextIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No documents found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredDocuments.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  document={doc}
                  showCheckbox={showCheckboxes}
                  isSelected={selectedIds.has(doc.id)}
                  onSelectToggle={toggleSelection}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        onClearSelection={clearSelection}
        onBulkApprove={handleBulkApprove}
        onBulkReview={handleBulkReview}
        onExport={handleExport}
        isProcessing={isProcessing}
      />
    </div>
  );
}
