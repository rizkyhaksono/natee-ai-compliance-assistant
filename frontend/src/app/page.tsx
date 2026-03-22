"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { sendChat, getDocuments, SourceChunk, Document } from "@/lib/api";
import {
  Send,
  FileText,
  AlertTriangle,
  ChevronDown,
  Trash2,
  Plus,
  MessageSquare,
  X,
} from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import Badge from "@/components/ui/Badge";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: SourceChunk[];
  confidence?: number;
  guardrailFlags?: string[];
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "chat_conversations_v2";

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function relativeTime(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

function loadConversations(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveConversations(convs: Conversation[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(convs));
}

// Typing indicator component
function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-1">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="h-2 w-2 rounded-full bg-zinc-400 dark:bg-zinc-500"
          style={{ animation: `bounce 1s infinite ${delay}ms` }}
        />
      ))}
      <style>{`@keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }`}</style>
    </div>
  );
}

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [judgmentMode, setJudgmentMode] = useState("moderate");
  const [showSources, setShowSources] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDocDropdown, setShowDocDropdown] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentConversation = conversations.find((c) => c.id === currentId) ?? null;
  const messages = currentConversation?.messages ?? [];

  useEffect(() => {
    const convs = loadConversations();
    setConversations(convs);
    if (convs.length > 0) setCurrentId(convs[0].id);
  }, []);

  useEffect(() => {
    getDocuments(1, 1000)
      .then((res) => setDocuments(res.items))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Gagal memuat dokumen");
      });
  }, []);

  useEffect(() => {
    if (!showDocDropdown) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setShowDocDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDocDropdown]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const persistAndSet = useCallback((convs: Conversation[]) => {
    const sorted = [...convs].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    saveConversations(sorted);
    setConversations(sorted);
    return sorted;
  }, []);

  const newConversation = () => {
    const conv: Conversation = {
      id: genId(),
      title: "New Chat",
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    persistAndSet([conv, ...conversations]);
    setCurrentId(conv.id);
    setShowSources(null);
    setError(null);
    inputRef.current?.focus();
  };

  const deleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = conversations.filter((c) => c.id !== id);
    persistAndSet(updated);
    if (currentId === id) setCurrentId(updated[0]?.id ?? null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const text = input.trim();
    setInput("");
    setError(null);

    // Ensure there's an active conversation
    let convId = currentId;
    let baseConvs = conversations;

    if (!convId) {
      const conv: Conversation = {
        id: genId(),
        title: text.slice(0, 45) + (text.length > 45 ? "..." : ""),
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      baseConvs = [conv, ...conversations];
      convId = conv.id;
      setCurrentId(convId);
    }

    const userMsg: Message = { role: "user", content: text };

    // Append user message
    const withUser = baseConvs.map((c) => {
      if (c.id !== convId) return c;
      const isFirst = c.messages.length === 0;
      return {
        ...c,
        messages: [...c.messages, userMsg],
        title: isFirst ? text.slice(0, 45) + (text.length > 45 ? "..." : "") : c.title,
        updatedAt: new Date().toISOString(),
      };
    });
    persistAndSet(withUser);
    setLoading(true);

    try {
      const response = await sendChat(
        text,
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
      setConversations((prev) => {
        const updated = prev.map((c) =>
          c.id === convId
            ? { ...c, messages: [...c.messages, assistantMsg], updatedAt: new Date().toISOString() }
            : c
        );
        return persistAndSet(updated);
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal memproses pertanyaan";
      setError(message);
      setConversations((prev) => {
        const updated = prev.map((c) =>
          c.id === convId
            ? {
                ...c,
                messages: [
                  ...c.messages,
                  { role: "assistant" as const, content: `Error: ${message}` },
                ],
                updatedAt: new Date().toISOString(),
              }
            : c
        );
        return persistAndSet(updated);
      });
    } finally {
      setLoading(false);
    }
  };

  const readyDocuments = documents.filter((d) => d.status === "ready");
  const toggleDoc = (id: string) =>
    setSelectedDocs((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const confidenceBar = (confidence: number) => {
    const pct = confidence * 100;
    const color = pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : "bg-rose-500";
    return (
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
          <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs">{pct.toFixed(0)}%</span>
      </div>
    );
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Conversation Sidebar */}
      <div
        className={`flex flex-col border-r border-zinc-200 bg-white transition-all duration-200 dark:border-zinc-800 dark:bg-zinc-950 ${
          sidebarOpen ? "w-60 flex-shrink-0" : "w-0 overflow-hidden"
        }`}
      >
        <div className="flex flex-shrink-0 items-center justify-between px-3 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Chats</span>
          <button
            onClick={newConversation}
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            title="New chat"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {conversations.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-zinc-400 dark:text-zinc-600">
              No conversations yet
            </p>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => { setCurrentId(conv.id); setShowSources(null); }}
                className={`group flex w-full items-start gap-2 rounded-lg px-3 py-2.5 text-left transition-colors ${
                  conv.id === currentId
                    ? "bg-zinc-100 dark:bg-zinc-800"
                    : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
                }`}
              >
                <MessageSquare className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-zinc-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-zinc-800 dark:text-zinc-200">
                    {conv.title}
                  </p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-600">
                    {relativeTime(conv.updatedAt)}
                  </p>
                </div>
                <button
                  onClick={(e) => deleteConversation(conv.id, e)}
                  className="hidden rounded p-0.5 text-zinc-400 hover:text-rose-500 group-hover:flex"
                >
                  <X className="h-3 w-3" />
                </button>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex flex-shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-black md:px-6">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            title="Toggle sidebar"
          >
            <MessageSquare className="h-4 w-4" />
          </button>
          <h2 className="flex-1 text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {currentConversation?.title || "Regulation Q&A"}
          </h2>
          <div className="flex items-center gap-2">
            <select
              value={judgmentMode}
              onChange={(e) => setJudgmentMode(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <option value="conservative">Conservative</option>
              <option value="moderate">Moderate</option>
              <option value="lenient">Lenient</option>
            </select>

            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowDocDropdown(!showDocDropdown)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1 text-xs text-zinc-900 hover:bg-zinc-50 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                {selectedDocs.length === 0 ? "Semua dokumen" : `${selectedDocs.length} dipilih`}
              </button>
              {showDocDropdown && (
                <div className="absolute right-0 top-9 z-50 w-56 rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                  <div className="max-h-56 overflow-y-auto p-2">
                    {readyDocuments.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-zinc-400">No documents ready</p>
                    ) : (
                      readyDocuments.map((doc) => (
                        <label
                          key={doc.id}
                          className="flex cursor-pointer items-center gap-2 rounded px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                          <input
                            type="checkbox"
                            checked={selectedDocs.includes(doc.id)}
                            onChange={() => toggleDoc(doc.id)}
                            className="rounded"
                          />
                          <span className="flex-1 truncate text-xs text-zinc-900 dark:text-zinc-100">
                            {doc.name}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {messages.length > 0 && (
              <button
                onClick={() => {
                  if (!currentId) return;
                  const updated = conversations.map((c) =>
                    c.id === currentId ? { ...c, messages: [], title: "New Chat", updatedAt: new Date().toISOString() } : c
                  );
                  persistAndSet(updated);
                  setShowSources(null);
                }}
                className="rounded-lg p-1.5 text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400"
                title="Clear this chat"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300">
              {error}
            </div>
          )}
          {readyDocuments.length === 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
              Belum ada dokumen dengan status ready. Upload dokumen dulu di halaman Documents.
            </div>
          )}
          {messages.length === 0 && (
            <EmptyState
              icon={FileText}
              title="Tanyakan sesuatu tentang regulasi atau SOP"
              description="Upload dokumen terlebih dahulu, lalu mulai bertanya"
            />
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-3xl rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "rounded-br-sm bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black"
                    : "rounded-bl-sm border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none text-sm [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                )}

                {msg.role === "assistant" && msg.confidence !== undefined && (
                  <div className="mt-2 flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                    {confidenceBar(msg.confidence)}
                    {msg.guardrailFlags && msg.guardrailFlags.length > 0 && (
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 text-amber-500" />
                        {msg.guardrailFlags.map((flag, fi) => (
                          <Badge key={fi} variant="warning">{flag}</Badge>
                        ))}
                      </span>
                    )}
                  </div>
                )}

                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2">
                    <button
                      onClick={() => setShowSources(showSources === i ? null : i)}
                      className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                    >
                      <ChevronDown className={`h-3 w-3 transition-transform ${showSources === i ? "rotate-180" : ""}`} />
                      {msg.sources.length} sumber
                    </button>
                    {showSources === i && (
                      <div className="mt-2 space-y-2">
                        {msg.sources.map((src, j) => (
                          <div key={j} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs dark:border-zinc-700 dark:bg-zinc-950">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-zinc-700 dark:text-zinc-200">{src.document_name}</span>
                              {src.section && <Badge variant="info">{src.section}</Badge>}
                              {src.page_number && <Badge>Hal. {src.page_number}</Badge>}
                            </div>
                            <p className="mt-1 line-clamp-2 text-zinc-500 dark:text-zinc-400">{src.content}</p>
                            <p className="mt-1 text-zinc-400">Relevance: {(src.relevance_score * 100).toFixed(0)}%</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
                <TypingDots />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form
          onSubmit={handleSubmit}
          className="flex-shrink-0 border-t border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-black"
        >
          <div className="mx-auto flex max-w-4xl items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tanyakan tentang regulasi atau SOP..."
              className="flex-1 rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-xl bg-zinc-900 px-4 py-2.5 text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-300"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
