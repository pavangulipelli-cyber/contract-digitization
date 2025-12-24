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
import { safeLower } from "@/utils/nullSafe";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/hooks/use-toast";

type FilterStatus = "all" | DocumentStatus;
type ViewMode = "grid" | "list";

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
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
    const reviewed = documents.filter((d) => d.status === "Reviewed").length;
    const approved = documents.filter((d) => d.status === "Approved").length;
    const completed = documents.filter(
      (d) => d.status === "Reviewed" || d.status === "Approved"
    ).length;
    return { total, pending, reviewed, approved, completed };
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const matchesSearch = safeLower(doc.title).includes(safeLower(searchQuery));
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

      <div className="flex">
        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed lg:sticky top-0 left-0 h-screen bg-slate-950 border-r border-white/10 z-50 lg:z-auto transition-transform duration-300 ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          } w-64 flex-shrink-0`}
        >
          <div className="p-6 pt-24">
            {/* Close button for mobile */}
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden absolute top-6 right-4 text-slate-400 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Filters
            </h3>

            {/* Status Filters */}
            <div className="space-y-1">
              <button
                onClick={() => setStatusFilter("all")}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === "all"
                    ? "bg-white/10 text-white"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span>All Documents</span>
                <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full">
                  {stats.total}
                </span>
              </button>

              <button
                onClick={() => setStatusFilter("Pending Review")}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === "Pending Review"
                    ? "bg-white/10 text-white"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span>Pending Review</span>
                <span className="text-xs bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded-full">
                  {stats.pending}
                </span>
              </button>

              <button
                onClick={() => setStatusFilter("Reviewed")}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === "Reviewed"
                    ? "bg-white/10 text-white"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span>Reviewed</span>
                <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">
                  {stats.reviewed}
                </span>
              </button>

              <button
                onClick={() => setStatusFilter("Approved")}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === "Approved"
                    ? "bg-white/10 text-white"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span>Approved</span>
                <span className="text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full">
                  {stats.approved}
                </span>
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 max-w-[calc(100vw-16rem)] lg:max-w-none">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden mb-4 flex items-center gap-2 px-3 py-2 text-sm font-medium bg-slate-950 text-white rounded-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              Filters
            </button>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              <SummaryCard
                title="Total Documents"
                value={stats.total}
                icon={<FileTextIcon className="w-5 h-5 text-accent" />}
                iconColor="bg-accent/10"
              />
              <SummaryCard
                title="Pending Review"
                value={stats.pending}
                icon={<ClockIcon className="w-5 h-5 text-warning" />}
                iconColor="bg-warning/10"
              />
              <SummaryCard
                title="Completed"
                value={stats.completed}
                icon={<CheckCircleIcon className="w-5 h-5 text-success" />}
                iconColor="bg-success/10"
              />
            </div>

            {/* Toolbar */}
            <div className="bg-card rounded-lg border border-border shadow-sm p-4 mb-4">
              <div className="flex flex-col sm:flex-row gap-3 mb-3">
                {/* Left: Select toggle and search */}
                <div className="flex items-center gap-3 flex-1">
                  <button
                    onClick={toggleSelectMode}
                    className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-all shadow-sm ${
                      showCheckboxes
                        ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90 shadow-md"
                        : "bg-card text-muted-foreground border-border hover:border-primary hover:text-primary"
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

                {/* Right: View toggle, Filter and Export */}
                <div className="flex items-center gap-3">
                  {/* View Mode Toggle */}
                  <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                    <button
                      onClick={() => setViewMode("grid")}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                        viewMode === "grid"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setViewMode("list")}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                        viewMode === "list"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                    </button>
                  </div>

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
                      <div className="absolute right-0 mt-2 w-full sm:w-48 bg-card rounded-lg shadow-md border border-border z-10 animate-fade-in">
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
                      <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-card text-foreground rounded-lg border border-border hover:bg-muted/50 transition-all shadow-sm">
                        <DownloadIcon className="w-4 h-4" />
                        Export
                      </button>

                      <div className="absolute right-0 mt-2 hidden group-hover:block z-10">
                        <div className="bg-card rounded-lg shadow-md border border-border overflow-hidden">
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
                <div className="flex items-center gap-3 px-4 py-2 bg-muted rounded-lg">
                  <button
                    onClick={allSelected ? clearSelection : selectAll}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {allSelected ? (
                      <CheckSquareIcon className="w-5 h-5 text-primary" />
                    ) : someSelected ? (
                      <MinusSquareIcon className="w-5 h-5 text-primary" />
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
            </div>

            {/* Document List/Grid */}
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-48 bg-muted rounded-lg animate-pulse" />
                ))}
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="text-center py-12 bg-card rounded-lg border border-border">
                <FileTextIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No documents found</p>
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {filteredDocuments.map((doc) => (
                  <DocumentCard
                    key={doc.id}
                    document={doc}
                    showCheckbox={showCheckboxes}
                    isSelected={selectedIds.has(doc.id)}
                    onSelectToggle={toggleSelection}
                    viewMode="grid"
                  />
                ))}
              </div>
            ) : (
              <div className="bg-card rounded-lg border border-border shadow-sm divide-y divide-border">
                {filteredDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className={`group flex items-center gap-4 px-4 py-2 hover:bg-muted/50 transition-colors cursor-pointer ${
                      selectedIds.has(doc.id) ? "bg-primary/5" : ""
                    }`}
                    onClick={() => {
                      const navigate = (window as any).navigate;
                      if (navigate) navigate(`/documents/${doc.id}`);
                    }}
                  >
                    {/* Checkbox */}
                    {showCheckboxes && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelection(doc.id);
                        }}
                        className="flex-shrink-0 text-muted-foreground hover:text-primary transition-colors"
                      >
                        {selectedIds.has(doc.id) ? (
                          <CheckSquareIcon className="w-5 h-5 text-primary" />
                        ) : (
                          <SquareIcon className="w-5 h-5" />
                        )}
                      </button>
                    )}

                    {/* Icon */}
                    <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-md flex items-center justify-center">
                      <FileTextIcon className="w-4 h-4 text-primary" />
                    </div>

                    {/* Title */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-foreground truncate text-sm">
                        {doc.title}
                      </h3>
                      <p className="text-xs text-muted-foreground truncate">
                        {doc.uploadedAt}
                      </p>
                    </div>

                    {/* Status */}
                    <div className="hidden sm:block">
                      <span
                        className={`status-pill ${
                          doc.status === "Pending Review"
                            ? "status-pending"
                            : doc.status === "Reviewed"
                            ? "status-reviewed"
                            : "status-approved"
                        }`}
                      >
                        {doc.status}
                      </span>
                    </div>

                    {/* Confidence */}
                    <div className="hidden md:block text-sm text-muted-foreground">
                      {doc.overallConfidence}%
                    </div>

                    {/* Attributes */}
                    <div className="hidden lg:block text-sm text-muted-foreground">
                      {doc.attributeCount} attrs
                    </div>

                    {/* Action */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const navigate = (window as any).navigate;
                        if (navigate) navigate(`/documents/${doc.id}`);
                      }}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                        doc.status === "Pending Review"
                          ? "btn-primary"
                          : "btn-outline"
                      }`}
                    >
                      {doc.status === "Pending Review" ? "Review" : "View"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

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
