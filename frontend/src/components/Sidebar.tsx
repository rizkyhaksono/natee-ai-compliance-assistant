"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  FileUp,
  GitCompareArrows,
  ClipboardCheck,
  Activity,
  ScrollText,
  Settings,
  Shield,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Chat / Q&A", icon: MessageSquare },
  { href: "/documents", label: "Documents", icon: FileUp },
  { href: "/gap-analysis", label: "Gap Analysis", icon: GitCompareArrows },
  { href: "/checklist", label: "Checklist", icon: ClipboardCheck },
  { href: "/audit", label: "Audit Trail", icon: ScrollText },
  { href: "/evaluation", label: "Evaluation", icon: Activity },
  { href: "/admin", label: "Admin", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col">
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-blue-400" />
          <div>
            <h1 className="font-bold text-sm">AI Compliance</h1>
            <p className="text-xs text-slate-400">Assistant</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm transition-colors ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-slate-700 text-xs text-slate-500">
        v1.0.0 • RAG + Guardrails
      </div>
    </aside>
  );
}
