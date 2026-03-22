"use client";

import { useState, useEffect, useRef } from "react";
import {
  uploadDocument,
  getDocuments,
  deleteDocument,
  getDocumentContent,
  getDocumentDownloadUrl,
  Document,
  DocumentContent,
  PaginatedResponse,
} from "@/lib/api";
import {
  Upload,
  Trash2,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader,
  Eye,
  Download,
  X,
} from "lucide-react";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import ConfirmDialog from "@/components/ui/Dialog";
import Pagination from "@/components/ui/Pagination";

const UPLOAD_STEPS = [
  { label: "Membaca file..." },
  { label: "Mengekstrak teks..." },
  { label: "Memotong dokumen menjadi chunk..." },
  { label: "Membuat embedding vektor..." },
];

function detectDocType(filename: string): string {
  const n = filename.toLowerCase();
  if (/\b(uu|undang.undang|pp|peraturan|perpres|permen|regulation|act|law|nomor)\b/.test(n)) return "regulation";
  if (/\b(sop|standard.operating|prosedur|procedure)\b/.test(n)) return "sop";
  if (/\b(kontrak|perjanjian|agreement|contract|mou|spk)\b/.test(n)) return "contract";
  if (/\b(kebijakan|policy|policies)\b/.test(n)) return "policy";
  return "other";
}

const TYPE_LABELS: Record<string, string> = {
  regulation: "Regulation",
  sop: "SOP",
  contract: "Contract",
  policy: "Policy",
  other: "Other",
};

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<PaginatedResponse<Document> | null>(null);
  const [page, setPage] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState(0);
  const [docType, setDocType] = useState("auto");
  const [detectedType, setDetectedType] = useState<string | null>(null);
  const [docName, setDocName] = useState("");
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [viewContent, setViewContent] = useState<DocumentContent | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const uploadIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const loadDocs = async (p = page) => {
    try {
      const data = await getDocuments(p);
      setDocuments(data);
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : "Gagal mengambil dokumen";
      setMessage({ text: detail, type: "error" });
    }
  };

  useEffect(() => {
    loadDocs(page);
  }, [page]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const resolvedType = docType === "auto" ? detectDocType(file.name) : docType;
    if (docType === "auto") setDetectedType(resolvedType);

    setUploading(true);
    setUploadStep(0);
    setMessage(null);

    // Animate through upload steps
    uploadIntervalRef.current = setInterval(() => {
      setUploadStep((prev) => {
        if (prev < UPLOAD_STEPS.length - 1) return prev + 1;
        return prev;
      });
    }, 500);

    try {
      await uploadDocument(file, { name: docName || file.name, document_type: resolvedType });
      setDocName("");
      setDetectedType(null);
      setPage(1);
      await loadDocs(1);
      setUploadStep(UPLOAD_STEPS.length);
      setMessage({ text: "Upload berhasil diproses.", type: "success" });
      setTimeout(() => setUploadStep(0), 1500);
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : "Upload gagal";
      setMessage({ text: `Upload gagal: ${detail}`, type: "error" });
    } finally {
      setUploading(false);
      if (uploadIntervalRef.current) clearInterval(uploadIntervalRef.current);
      e.target.value = "";
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setMessage(null);
      await deleteDocument(deleteTarget.id);
      setDeleteTarget(null);
      await loadDocs();
      setMessage({ text: "Dokumen berhasil dihapus.", type: "success" });
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : "Hapus dokumen gagal";
      setMessage({ text: detail, type: "error" });
      setDeleteTarget(null);
    }
  };

  const handleView = async (id: string) => {
    setViewLoading(true);
    try {
      const content = await getDocumentContent(id);
      setViewContent(content);
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : "Gagal memuat konten";
      setMessage({ text: detail, type: "error" });
    } finally {
      setViewLoading(false);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "ready":
        return (
          <Badge variant="success">
            <CheckCircle className="mr-1 h-3 w-3" />
            Ready
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="warning">
            <Loader className="mr-1 h-3 w-3 animate-spin" />
            Processing
          </Badge>
        );
      case "error":
        return (
          <Badge variant="danger">
            <AlertCircle className="mr-1 h-3 w-3" />
            Error
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const typeBadge = (type: string) => {
    const variants: Record<string, "info" | "warning" | "success" | "default"> = {
      regulation: "info",
      sop: "warning",
      contract: "success",
      policy: "info",
    };
    return <Badge variant={variants[type] || "default"}>{type}</Badge>;
  };

  const docs = documents?.items || [];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header + Upload — fixed */}
      <div className="flex-shrink-0 bg-zinc-50 px-6 pt-6 pb-4 dark:bg-zinc-950">
        <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Document Management
        </h2>

        {message && (
          <div
            className={`mb-4 rounded-lg border px-4 py-2 text-sm ${
              message.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Upload Section */}
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h3 className="mb-3 font-medium text-zinc-900 dark:text-zinc-100">Upload Document</h3>
          <div className="mb-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
            <input
              type="text"
              placeholder="Document name (optional)"
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              disabled={uploading}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <div className="space-y-1">
              <select
                value={docType}
                onChange={(e) => { setDocType(e.target.value); setDetectedType(null); }}
                disabled={uploading}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              >
                <option value="auto">✨ Auto-detect type</option>
                <option value="regulation">Regulation</option>
                <option value="sop">SOP</option>
                <option value="contract">Contract</option>
                <option value="policy">Policy</option>
                <option value="other">Other</option>
              </select>
              {detectedType && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  ✓ Terdeteksi sebagai: <strong>{TYPE_LABELS[detectedType]}</strong>
                </p>
              )}
            </div>
            <label
              className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-300 px-4 py-2 text-zinc-600 transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-900 ${
                uploading ? "pointer-events-none opacity-50" : ""
              }`}
            >
              <Upload className="h-4 w-4" />
              <span className="text-sm">{uploading ? "Uploading..." : "Choose File (PDF, DOCX, TXT)"}</span>
              <input type="file" accept=".pdf,.docx,.txt" onChange={handleUpload} disabled={uploading} className="hidden" />
            </label>
          </div>

        {/* Upload Progress Steps */}
        {uploading && uploadStep >= 0 && (
          <div className="mt-4 space-y-2">
            {UPLOAD_STEPS.map((step, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                  idx < uploadStep
                    ? "border-emerald-500 bg-emerald-500"
                    : idx === uploadStep
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                    : "border-zinc-300 dark:border-zinc-700"
                }`}>
                  {idx < uploadStep && <CheckCircle className="h-3 w-3 text-white" />}
                  {idx === uploadStep && <Loader className="h-2 w-2 animate-spin text-blue-500" />}
                </div>
                <span className={`text-sm ${
                  idx <= uploadStep
                    ? "text-zinc-900 font-medium dark:text-zinc-100"
                    : "text-zinc-500 dark:text-zinc-400"
                }`}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        )}

        {uploadStep === UPLOAD_STEPS.length && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2 dark:bg-emerald-950">
            <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm text-emerald-700 dark:text-emerald-300">Upload selesai! Dokumen sedang diproses...</span>
          </div>
        )}
        </div>{/* end upload card */}
      </div>{/* end header */}

      {/* Scrollable Document List */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
          <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
            {documents?.total || 0} Documents
          </h3>
        </div>
        {docs.length === 0 ? (
          <EmptyState icon={FileText} title="No documents uploaded yet" description="Upload a PDF, DOCX, or TXT file to get started" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px]">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Name</th>
                    <th className="px-6 py-3">Type</th>
                    <th className="px-6 py-3">Chunks</th>
                    <th className="px-6 py-3">Version</th>
                    <th className="px-6 py-3">Uploaded</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map((doc) => (
                    <tr
                      key={doc.id}
                      className="border-b border-zinc-100 transition-colors hover:bg-zinc-50 dark:border-zinc-900 dark:hover:bg-zinc-900/50"
                    >
                      <td className="px-6 py-3">{statusBadge(doc.status)}</td>
                      <td className="px-6 py-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {doc.name}
                      </td>
                      <td className="px-6 py-3">{typeBadge(doc.document_type)}</td>
                      <td className="px-6 py-3 text-sm text-zinc-500 dark:text-zinc-400">
                        {doc.total_chunks}
                      </td>
                      <td className="px-6 py-3 text-sm text-zinc-500 dark:text-zinc-400">
                        {doc.version}
                      </td>
                      <td className="px-6 py-3 text-sm text-zinc-500 dark:text-zinc-400">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleView(doc.id)}
                            disabled={viewLoading}
                            title="View content"
                            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <a
                            href={getDocumentDownloadUrl(doc.id)}
                            title="Download"
                            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                          >
                            <Download className="h-4 w-4" />
                          </a>
                          <button
                            onClick={() => setDeleteTarget({ id: doc.id, name: doc.name })}
                            title="Delete"
                            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950 dark:hover:text-rose-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {documents && (
              <Pagination page={page} totalPages={documents.total_pages} onPageChange={setPage} />
            )}
          </>
        )}
      </div>
      </div>{/* end scrollable */}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Document"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* View Content Modal */}
      {viewContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setViewContent(null)} />
          <div className="relative z-10 flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-700">
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {viewContent.document_name}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {viewContent.total_chunks} chunks
                </p>
              </div>
              <button
                onClick={() => setViewContent(null)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <div className="space-y-4">
                {viewContent.content.map((chunk) => (
                  <div
                    key={chunk.chunk_index}
                    className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700"
                  >
                    <div className="mb-2 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                      <Badge>Chunk {chunk.chunk_index + 1}</Badge>
                      {chunk.section && <Badge variant="info">{chunk.section}</Badge>}
                      {chunk.page_number && <Badge>Page {chunk.page_number}</Badge>}
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
                      {chunk.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
