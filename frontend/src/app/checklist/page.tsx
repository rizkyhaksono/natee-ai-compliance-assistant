"use client";

import { useState, useEffect } from "react";
import { getDocuments, generateChecklist, Document, ChecklistResponse } from "@/lib/api";
import { ClipboardCheck } from "lucide-react";

export default function ChecklistPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [documentId, setDocumentId] = useState("");
  const [focusArea, setFocusArea] = useState("");
  const [judgmentMode, setJudgmentMode] = useState("moderate");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ChecklistResponse | null>(null);

  useEffect(() => {
    getDocuments().then((docs) => setDocuments(docs.filter((d) => d.status === "ready"))).catch(console.error);
  }, []);

  const handleGenerate = async () => {
    if (!documentId) return;
    setLoading(true);
    try {
      const res = await generateChecklist(documentId, focusArea || undefined, judgmentMode);
      setResult(res);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const priorityColors: Record<string, string> = {
    critical: "bg-red-100 text-red-700 border-red-200",
    high: "bg-amber-100 text-amber-700 border-amber-200",
    medium: "bg-blue-100 text-blue-700 border-blue-200",
    low: "bg-gray-100 text-gray-700 border-gray-200",
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-6">Compliance Checklist Generator</h2>
      <div className="bg-white rounded-lg border p-6 mb-6">
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Document</label>
            <select value={documentId} onChange={(e) => setDocumentId(e.target.value)} className="w-full border rounded px-3 py-2 text-sm">
              <option value="">Select document...</option>
              {documents.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Focus Area (optional)</label>
            <input type="text" value={focusArea} onChange={(e) => setFocusArea(e.target.value)} placeholder="e.g., vendor management" className="w-full border rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Judgment Mode</label>
            <select value={judgmentMode} onChange={(e) => setJudgmentMode(e.target.value)} className="w-full border rounded px-3 py-2 text-sm">
              <option value="conservative">Conservative</option>
              <option value="moderate">Moderate</option>
              <option value="lenient">Lenient</option>
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={handleGenerate} disabled={loading || !documentId} className="w-full bg-blue-600 text-white rounded px-4 py-2 text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
              <ClipboardCheck className="w-4 h-4" />
              {loading ? "Generating..." : "Generate Checklist"}
            </button>
          </div>
        </div>
      </div>
      {result && (
        <div className="bg-white rounded-lg border">
          <div className="px-6 py-4 border-b">
            <h3 className="font-medium">{result.document_name}</h3>
            <p className="text-sm text-gray-500 mt-1">{result.summary}</p>
            <div className="text-xs text-gray-400 mt-1">{result.total_items} items</div>
          </div>
          <div className="divide-y">
            {result.items.map((item) => (
              <div key={item.item_number} className="px-6 py-4 flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium">{item.item_number}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{item.requirement}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${priorityColors[item.priority]}`}>{item.priority}</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-1">Source: {item.source_clause}</p>
                  <p className="text-sm text-gray-700">{item.action_needed}</p>
                  {(item.responsible_party || item.deadline_suggestion) && (
                    <div className="flex gap-4 mt-2 text-xs text-gray-500">
                      {item.responsible_party && <span>👤 {item.responsible_party}</span>}
                      {item.deadline_suggestion && <span>📅 {item.deadline_suggestion}</span>}
                    </div>
                  )}
                  {item.notes && <p className="text-xs text-gray-400 mt-1 italic">{item.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
