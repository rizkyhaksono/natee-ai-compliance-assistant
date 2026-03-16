"use client";

import { useState, useEffect } from "react";
import { uploadDocument, getDocuments, deleteDocument, Document } from "@/lib/api";
import { Upload, Trash2, FileText, CheckCircle, AlertCircle, Loader } from "lucide-react";

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState("other");
  const [docName, setDocName] = useState("");

  const loadDocs = () => getDocuments().then(setDocuments).catch(console.error);
  useEffect(() => { loadDocs(); }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadDocument(file, { name: docName || file.name, document_type: docType });
      setDocName("");
      await loadDocs();
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this document?")) return;
    await deleteDocument(id);
    await loadDocs();
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "ready": return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "processing": return <Loader className="w-4 h-4 text-blue-500 animate-spin" />;
      case "error": return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return <FileText className="w-4 h-4 text-gray-400" />;
    }
  };

  const typeColor = (type: string) => {
    const colors: Record<string, string> = {
      regulation: "bg-purple-100 text-purple-700",
      sop: "bg-blue-100 text-blue-700",
      contract: "bg-amber-100 text-amber-700",
      policy: "bg-green-100 text-green-700",
      other: "bg-gray-100 text-gray-700",
    };
    return colors[type] || colors.other;
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-6">Document Management</h2>
      <div className="bg-white rounded-lg border p-6 mb-6">
        <h3 className="font-medium mb-4">Upload Document</h3>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <input type="text" placeholder="Document name (optional)" value={docName} onChange={(e) => setDocName(e.target.value)} className="border rounded px-3 py-2 text-sm" />
          <select value={docType} onChange={(e) => setDocType(e.target.value)} className="border rounded px-3 py-2 text-sm">
            <option value="regulation">Regulation</option>
            <option value="sop">SOP</option>
            <option value="contract">Contract</option>
            <option value="policy">Policy</option>
            <option value="other">Other</option>
          </select>
          <label className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-lg px-4 py-2 cursor-pointer hover:bg-gray-50 ${uploading ? "opacity-50" : ""}`}>
            <Upload className="w-4 h-4" />
            <span className="text-sm">{uploading ? "Uploading..." : "Choose File (PDF, DOCX, TXT)"}</span>
            <input type="file" accept=".pdf,.docx,.txt" onChange={handleUpload} disabled={uploading} className="hidden" />
          </label>
        </div>
      </div>
      <div className="bg-white rounded-lg border">
        <div className="px-6 py-3 border-b"><h3 className="font-medium">{documents.length} Documents</h3></div>
        {documents.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No documents uploaded yet</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="px-6 py-3">Status</th><th className="px-6 py-3">Name</th><th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Chunks</th><th className="px-6 py-3">Version</th><th className="px-6 py-3">Uploaded</th><th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-6 py-3">{statusIcon(doc.status)}</td>
                  <td className="px-6 py-3 text-sm font-medium">{doc.name}</td>
                  <td className="px-6 py-3"><span className={`text-xs px-2 py-1 rounded-full ${typeColor(doc.document_type)}`}>{doc.document_type}</span></td>
                  <td className="px-6 py-3 text-sm text-gray-500">{doc.total_chunks}</td>
                  <td className="px-6 py-3 text-sm text-gray-500">{doc.version}</td>
                  <td className="px-6 py-3 text-sm text-gray-500">{new Date(doc.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-3"><button onClick={() => handleDelete(doc.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
