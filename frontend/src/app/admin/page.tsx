"use client";

import { useState, useEffect } from "react";
import { Settings } from "lucide-react";

interface Config {
  judgment_mode: string;
  max_context_chunks: number;
  confidence_threshold: number;
  llm_provider: string;
  llm_model: string;
  ollama_model: string;
  embedding_model: string;
}

export default function AdminPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [judgmentMode, setJudgmentMode] = useState("moderate");
  const [maxChunks, setMaxChunks] = useState(10);
  const [threshold, setThreshold] = useState(0.5);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/config").then((r) => r.json()).then((data) => {
      setConfig(data);
      setJudgmentMode(data.judgment_mode);
      setMaxChunks(data.max_context_chunks);
      setThreshold(data.confidence_threshold);
    }).catch(console.error);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/admin/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ judgment_mode: judgmentMode, max_context_chunks: maxChunks, confidence_threshold: threshold }),
      });
      alert("Configuration updated (runtime only, resets on restart)");
    } catch (err: any) { alert(`Error: ${err.message}`); }
    finally { setSaving(false); }
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-6">Admin Panel</h2>
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border p-6">
          <h3 className="font-medium mb-4 flex items-center gap-2"><Settings className="w-4 h-4" />Policy Judgment Layer</h3>
          <div className="space-y-2">
            {[
              { value: "conservative", label: "Conservative", desc: "Strict interpretation, flag all risks" },
              { value: "moderate", label: "Moderate", desc: "Balanced, focus on material gaps" },
              { value: "lenient", label: "Lenient", desc: "Flexible, only critical issues" },
            ].map((mode) => (
              <label key={mode.value} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${judgmentMode === mode.value ? "border-blue-500 bg-blue-50" : "hover:bg-gray-50"}`}>
                <input type="radio" name="judgment" value={mode.value} checked={judgmentMode === mode.value} onChange={(e) => setJudgmentMode(e.target.value)} className="mt-0.5" />
                <div><div className="text-sm font-medium">{mode.label}</div><div className="text-xs text-gray-500">{mode.desc}</div></div>
              </label>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-lg border p-6">
          <h3 className="font-medium mb-4">RAG Configuration</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Max Context Chunks</label>
              <input type="number" value={maxChunks} onChange={(e) => setMaxChunks(Number(e.target.value))} min={1} max={50} className="w-full border rounded px-3 py-2 text-sm" />
              <p className="text-xs text-gray-400 mt-1">Number of document chunks sent to LLM</p>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Confidence Threshold</label>
              <input type="number" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} min={0} max={1} step={0.05} className="w-full border rounded px-3 py-2 text-sm" />
              <p className="text-xs text-gray-400 mt-1">Minimum similarity score for retrieved chunks</p>
            </div>
            {config && (
              <div className="pt-4 border-t space-y-2">
                <div className="flex justify-between text-sm"><span className="text-gray-500">LLM Provider:</span><span className="font-mono text-xs">{config.llm_provider}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">LLM Model:</span><span className="font-mono text-xs">{config.llm_model}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">Embedding Model:</span><span className="font-mono text-xs">{config.embedding_model}</span></div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="mt-6">
        <button onClick={handleSave} disabled={saving} className="bg-blue-600 text-white rounded px-6 py-2 text-sm hover:bg-blue-700 disabled:opacity-50">
          {saving ? "Saving..." : "Save Configuration"}
        </button>
      </div>
      <div className="bg-white rounded-lg border p-6 mt-6">
        <h3 className="font-medium mb-4">Active Guardrails</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {[
            { label: "Prompt Injection Detection", desc: "Blocks attempts to override system instructions" },
            { label: "Topic Filtering", desc: "Rejects off-topic requests" },
            { label: "Legal Conclusion Prevention", desc: "Adds disclaimer for legal-sounding conclusions" },
            { label: "Source Citation Check", desc: "Flags responses lacking document references" },
            { label: "Sensitive Data Redaction", desc: "Masks credit cards, SSNs, emails in output" },
            { label: "Evidence Level Display", desc: "Shows confidence score with every response" },
          ].map((g) => (
            <div key={g.label} className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
              <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5" /><div><div className="font-medium">{g.label}</div><div className="text-xs text-gray-500">{g.desc}</div></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
