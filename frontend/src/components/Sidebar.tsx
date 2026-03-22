"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/context/ThemeContext";
import {
  MessageSquare,
  FileUp,
  GitCompareArrows,
  ClipboardCheck,
  Activity,
  ScrollText,
  Settings,
  Shield,
  Sun,
  Moon,
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
  const { theme, toggleTheme } = useTheme();

  return (
    <aside className="flex w-64 flex-col border-r border-zinc-800 bg-zinc-950 text-white dark:bg-black">
      <div className="border-b border-zinc-800 p-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800">
            <Shield className="h-4 w-4 text-zinc-200" />
          </div>
          <div>
            <h1 className="text-sm font-bold">AI Compliance</h1>
            <p className="text-xs text-zinc-500">Assistant</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 p-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all ${
                isActive
                  ? "border-l-2 border-white bg-white font-medium text-black"
                  : "border-l-2 border-transparent text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-100"
              }`}
            >
              <item.icon className={`h-4 w-4 ${isActive ? "text-black" : ""}`} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-zinc-800 p-4">
        <button
          type="button"
          onClick={toggleTheme}
          className="mb-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
        >
          {theme === "dark" ? (
            <Sun className="h-3.5 w-3.5" />
          ) : (
            <Moon className="h-3.5 w-3.5" />
          )}
          {theme === "dark" ? "Switch to Light" : "Switch to Dark"}
        </button>
        <div className="text-xs text-zinc-600">v1.0.0</div>
      </div>
    </aside>
  );
}
