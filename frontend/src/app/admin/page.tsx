"use client";

import { useState, useEffect } from "react";
import { Settings, Shield } from "lucide-react";
import Badge from "@/components/ui/Badge";

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
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    fetch("/api/admin/config")
      .then((r) => r.json())
      .then((data) => {
        setConfig(data);
        setJudgmentMode(data.judgment_mode);
        setMaxChunks(data.max_context_chunks);
        setThreshold(data.confidence_threshold);
      })
      .catch(console.error);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await fetch("/api/admin/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          judgment_mode: judgmentMode,
          max_context_chunks: maxChunks,
          confidence_threshold: threshold,
        }),
      });
      setMessage({ text: "Configuration updated (runtime only, resets on restart)", type: "success" });
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : "Gagal menyimpan konfigurasi";
      setMessage({ text: detail, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6">
      <h2 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-100">Admin Panel</h2>

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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Judgment Mode */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h3 className="mb-4 flex items-center gap-2 font-medium text-zinc-900 dark:text-zinc-100">
            <Settings className="h-4 w-4" />
            Policy Judgment Layer
          </h3>
          <div className="space-y-2">
            {[
              {
                value: "conservative",
                label: "Conservative",
                desc: "Strict interpretation, flag all risks",
              },
              {
                value: "moderate",
                label: "Moderate",
                desc: "Balanced, focus on material gaps",
              },
              {
                value: "lenient",
                label: "Lenient",
                desc: "Flexible, only critical issues",
              },
            ].map((mode) => (
              <label
                key={mode.value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                  judgmentMode === mode.value
                    ? "border-zinc-900 bg-zinc-50 dark:border-zinc-200 dark:bg-zinc-900"
                    : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                }`}
              >
                <input
                  type="radio"
                  name="judgment"
                  value={mode.value}
                  checked={judgmentMode === mode.value}
                  onChange={(e) => setJudgmentMode(e.target.value)}
                  className="mt-0.5"
                />
                <div>
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {mode.label}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">{mode.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* RAG Config */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h3 className="mb-4 font-medium text-zinc-900 dark:text-zinc-100">RAG Configuration</h3>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-zinc-600 dark:text-zinc-300">
                Max Context Chunks
              </label>
              <input
                type="number"
                value={maxChunks}
                onChange={(e) => setMaxChunks(Number(e.target.value))}
                min={1}
                max={50}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
              <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                Number of document chunks sent to LLM
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-600 dark:text-zinc-300">
                Confidence Threshold
              </label>
              <input
                type="number"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                min={0}
                max={1}
                step={0.05}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
              <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                Minimum similarity score for retrieved chunks
              </p>
            </div>
            {config && (
              <div className="space-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500 dark:text-zinc-400">LLM Provider:</span>
                  <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300">
                    {config.llm_provider}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500 dark:text-zinc-400">LLM Model:</span>
                  <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300">
                    {config.llm_model}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500 dark:text-zinc-400">Embedding Model:</span>
                  <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300">
                    {config.embedding_model}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-zinc-900 px-6 py-2 text-sm text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-300"
        >
          {saving ? "Saving..." : "Save Configuration"}
        </button>
      </div>

      {/* Guardrails */}
      <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h3 className="mb-4 flex items-center gap-2 font-medium text-zinc-900 dark:text-zinc-100">
          <Shield className="h-4 w-4" />
          Active Guardrails
        </h3>
        <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          {[
            {
              label: "Prompt Injection Detection",
              desc: "Blocks attempts to override system instructions",
            },
            { label: "Topic Filtering", desc: "Rejects off-topic requests" },
            {
              label: "Legal Conclusion Prevention",
              desc: "Adds disclaimer for legal-sounding conclusions",
            },
            {
              label: "Source Citation Check",
              desc: "Flags responses lacking document references",
            },
            {
              label: "Sensitive Data Redaction",
              desc: "Masks credit cards, SSNs, emails in output",
            },
            {
              label: "Evidence Level Display",
              desc: "Shows confidence score with every response",
            },
          ].map((g) => (
            <div
              key={g.label}
              className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-emerald-500" />
              <div>
                <div className="font-medium text-zinc-900 dark:text-zinc-100">{g.label}</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">{g.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
