"use client";

import { useState, useRef, useEffect } from "react";
import { sendChat, getDocuments, ChatResponse, SourceChunk, Document } from "@/lib/api";
import { Send, FileText, AlertTriangle, ChevronDown } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: SourceChunk[];
  confidence?: number;
  guardrailFlags?: string[];
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [judgmentMode, setJudgmentMode] = useState("moderate");
  const [showSources, setShowSources] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getDocuments().then(setDocuments).catch(console.error);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const response = await sendChat(
        input,
        selectedDocs.length > 0 ? selectedDocs : undefined,
        judgmentMode
      );
      const assistantMsg: Message = {
        role: "assistant",
        content: response.answer,
        sources: response.sources,
        confidence: response.confidence,
        guardrailFlags: response.guardrail_flags,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Regulation Q&A</h2>
        <div className="flex items-center gap-4">
          <select
            value={judgmentMode}
            onChange={(e) => setJudgmentMode(e.target.value)}
            className="text-sm border rounded px-2 py-1"
          >
            <option value="conservative">Conservative</option>
            <option value="moderate">Moderate</option>
            <option value="lenient">Lenient</option>
          </select>
          <select
            multiple
            value={selectedDocs}
            onChange={(e) => setSelectedDocs(Array.from(e.target.selectedOptions, (o) => o.value))}
            className="text-sm border rounded px-2 py-1 max-w-xs"
          >
            {documents
              .filter((d) => d.status === "ready")
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-20">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg">Tanyakan sesuatu tentang regulasi atau SOP Anda</p>
            <p className="text-sm mt-2">Upload dokumen terlebih dahulu, lalu mulai bertanya</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-3xl rounded-lg px-4 py-3 ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-white border shadow-sm"
              }`}
            >
              <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
              {msg.role === "assistant" && msg.confidence !== undefined && (
                <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                  <span>Confidence: {(msg.confidence * 100).toFixed(0)}%</span>
                  {msg.guardrailFlags && msg.guardrailFlags.length > 0 && (
                    <span className="flex items-center gap-1 text-amber-600">
                      <AlertTriangle className="w-3 h-3" />
                      {msg.guardrailFlags.join(", ")}
                    </span>
                  )}
                </div>
              )}
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2">
                  <button
                    onClick={() => setShowSources(showSources === i ? null : i)}
                    className="text-xs text-blue-600 flex items-center gap-1 hover:underline"
                  >
                    <ChevronDown className={`w-3 h-3 transition-transform ${showSources === i ? "rotate-180" : ""}`} />
                    {msg.sources.length} sumber
                  </button>
                  {showSources === i && (
                    <div className="mt-2 space-y-2">
                      {msg.sources.map((src, j) => (
                        <div key={j} className="bg-gray-50 rounded p-2 text-xs">
                          <div className="font-medium text-gray-700">
                            {src.document_name}
                            {src.section && ` • ${src.section}`}
                            {src.page_number && ` • Hal. ${src.page_number}`}
                          </div>
                          <div className="text-gray-500 mt-1 line-clamp-2">{src.content}</div>
                          <div className="text-gray-400 mt-1">
                            Relevance: {(src.relevance_score * 100).toFixed(0)}%
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border rounded-lg px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full" />
                Menganalisis dokumen...
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t bg-white p-4">
        <div className="flex items-center gap-2 max-w-4xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tanyakan tentang regulasi atau SOP..."
            className="flex-1 border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-blue-600 text-white rounded-lg px-4 py-2.5 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
