"use client";

import { useState, useEffect } from "react";
import { getAuditLogs, AuditLog, PaginatedResponse } from "@/lib/api";
import { ScrollText, Star, MessageSquare, GitCompareArrows, ClipboardCheck, ChevronDown } from "lucide-react";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import Pagination from "@/components/ui/Pagination";

export default function AuditPage() {
  const [data, setData] = useState<PaginatedResponse<AuditLog> | null>(null);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadLogs = async (p = page, f = filter) => {
    try {
      const result = await getAuditLogs(p, 20, f || undefined);
      setData(result);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadLogs(page, filter);
  }, [page, filter]);

  const handleFilterChange = (f: string) => {
    setFilter(f);
    setPage(1);
  };

  const actionVariant = (action: string): "info" | "warning" | "success" | "default" => {
    const map: Record<string, "info" | "warning" | "success" | "default"> = {
      qa_query: "info",
      gap_analysis: "warning",
      checklist_generation: "success",
    };
    return map[action] || "default";
  };

  const actionIcon = (action: string) => {
    const iconMap: Record<string, typeof MessageSquare> = {
      qa_query: MessageSquare,
      gap_analysis: GitCompareArrows,
      checklist_generation: ClipboardCheck,
    };
    return iconMap[action] || MessageSquare;
  };

  const getBorderColor = (action: string) => {
    const map: Record<string, string> = {
      qa_query: "border-l-blue-500",
      gap_analysis: "border-l-amber-500",
      checklist_generation: "border-l-emerald-500",
    };
    return map[action] || "border-l-zinc-300 dark:border-l-zinc-700";
  };

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  const logs = data?.items || [];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between px-6 py-4 bg-zinc-50 dark:bg-zinc-950">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Audit Trail</h2>
        <select
          value={filter}
          onChange={(e) => handleFilterChange(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          <option value="">All actions</option>
          <option value="qa_query">Q&A Queries</option>
          <option value="gap_analysis">Gap Analysis</option>
          <option value="checklist_generation">Checklist Generation</option>
        </select>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 pb-4">
      {logs.length === 0 ? (
        <EmptyState icon={ScrollText} title="No audit logs yet" description="Logs will appear here as you use the system" />
      ) : (
        <>
          <div className="space-y-3">
            {logs.map((log) => {
              const Icon = actionIcon(log.action);
              const isExpanded = expandedId === log.id;
              return (
                <div
                  key={log.id}
                  className={`rounded-xl border border-l-4 border-zinc-200 bg-white transition-all dark:border-zinc-800 dark:bg-zinc-950 ${getBorderColor(log.action)}`}
                >
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : log.id)}
                    className="w-full px-6 py-4 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="mt-1 flex-shrink-0">
                          <Icon className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge variant={actionVariant(log.action)}>
                              {log.action.replace(/_/g, " ")}
                            </Badge>
                            {log.judgment_mode && (
                              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                Mode: <span className="font-medium">{log.judgment_mode}</span>
                              </span>
                            )}
                            {log.confidence_score != null && (
                              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                Confidence: <span className="font-medium">{(log.confidence_score * 100).toFixed(0)}%</span>
                              </span>
                            )}
                          </div>
                          {log.query && (
                            <p className="text-sm text-zinc-700 dark:text-zinc-200 italic border-l-2 border-zinc-200 pl-3 dark:border-zinc-700">
                              "{log.query}"
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-zinc-500 dark:text-zinc-400" title={new Date(log.created_at).toLocaleString()}>
                            {getRelativeTime(log.created_at)}
                          </span>
                          {log.response && (
                            <ChevronDown
                              className={`h-4 w-4 text-zinc-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                            />
                          )}
                        </div>
                        {log.reviewer_score != null && (
                          <div className="flex items-center gap-1 text-xs">
                            <Star className="h-3 w-3 text-amber-500" />
                            <span className="text-zinc-600 dark:text-zinc-300">{log.reviewer_score}/5</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="border-t border-zinc-200 px-6 py-4 dark:border-zinc-800 space-y-3">
                      {log.response && (
                        <div>
                          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Response:</span>
                          <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-200">
                            {log.response}
                          </p>
                        </div>
                      )}
                      {log.guardrail_flags && log.guardrail_flags.length > 0 && (
                        <div>
                          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 block mb-1">Guardrail Flags:</span>
                          <div className="flex flex-wrap gap-1">
                            {log.guardrail_flags.map((flag, i) => (
                              <Badge key={i} variant="warning">
                                {flag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {log.reviewer_feedback && (
                        <div>
                          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Reviewer Feedback:</span>
                          <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-200">
                            {log.reviewer_feedback}
                          </p>
                        </div>
                      )}
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                        {new Date(log.created_at).toLocaleString()}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
      </div>

      {/* Pagination - fixed at bottom */}
      {data && (
        <div className="flex-shrink-0 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
          <Pagination page={data.page} totalPages={data.total_pages} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
