"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import {
  FileText, FileOutput, Receipt, Clipboard, ScanText, ScanLine,
  BookOpen, Clock, LayoutTemplate, Archive, ChevronRight,
  Sparkles, Sun, Moon, X, Briefcase, Building2, Users, Package, ListChecks,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

type LucideIcon = React.FC<{ size?: number; className?: string }>;

const navGroups = [
  {
    section: "CONVERT & TOOLS",
    sectionIcon: Sparkles,
    items: [
      { label: "Doclify Scan",       href: "/scan",         gradient: "from-indigo-500 to-purple-600", icon: ScanLine   as LucideIcon },
      { label: "Word to PDF",        href: "/word-to-pdf", gradient: "from-violet-500 to-blue-600",   icon: FileText   as LucideIcon, text: "W" },
      { label: "PDF to Word",        href: "/pdf-to-word", gradient: "from-red-500 to-rose-500",      icon: FileOutput as LucideIcon },
      { label: "AI Invoice Maker",   href: "/invoice",     gradient: "from-emerald-500 to-green-600", icon: Receipt    as LucideIcon },
      { label: "AI Challan Maker",   href: "/challan",     gradient: "from-orange-500 to-amber-500",  icon: Clipboard  as LucideIcon },
      { label: "OCR Scanner",        href: "/ocr",         gradient: "from-cyan-400 to-teal-600",     icon: ScanText   as LucideIcon },
      { label: "Khatabook (Ledger)", href: "/ledger",      gradient: "from-violet-500 to-purple-700", icon: BookOpen   as LucideIcon },
    ],
  },
  {
    section: "BUSINESS",
    sectionIcon: Building2,
    items: [
      { label: "All Invoices",     href: "/invoices",        gradient: "from-emerald-500 to-green-600", icon: ListChecks as LucideIcon },
      { label: "All Challans",     href: "/challans",        gradient: "from-orange-500 to-amber-500",  icon: Clipboard  as LucideIcon },
      { label: "Customers",        href: "/customers",       gradient: "from-blue-500 to-cyan-600",      icon: Users      as LucideIcon },
      { label: "Product Library",  href: "/products",        gradient: "from-teal-500 to-emerald-600",   icon: Package    as LucideIcon },
      { label: "Company Profile",  href: "/company-profile", gradient: "from-indigo-500 to-blue-600",    icon: Building2  as LucideIcon },
    ],
  },
  {
    section: "OTHER TOOLS",
    sectionIcon: Briefcase,
    items: [
      { label: "Recent Files",    href: "/recent",    gradient: "from-blue-500 to-cyan-500",     icon: Clock          as LucideIcon },
      { label: "Templates",       href: "/templates", gradient: "from-indigo-500 to-purple-600", icon: LayoutTemplate as LucideIcon },
      { label: "Saved Documents", href: "/saved",     gradient: "from-rose-500 to-pink-600",     icon: Archive        as LucideIcon },
    ],
  },
];

interface SidebarProps { isOpen: boolean; onClose: () => void; }

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname  = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden" onClick={onClose} />
      )}

      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-56 flex flex-col border-r border-white/5 transition-transform duration-300",
        "bg-[#0b0f1a]",
        "md:relative md:translate-x-0 md:z-auto",
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>

        {/* ── Logo ── */}
        <div className="px-4 py-5 border-b border-white/5 shrink-0">
          <div className="flex items-center justify-between">
            <Link href="/" onClick={onClose} className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/logo.svg" alt="DoclifyAI" className="w-12 h-12 rounded-2xl shadow-lg shadow-violet-900/40" />
              </div>
              <div className="min-w-0">
                <span className="text-xl font-black bg-gradient-to-r from-violet-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  DoclifyAI
                </span>
                <p className="text-[11px] text-slate-500 leading-none mt-0.5 truncate">
                  Smart Tools, Simple Solutions
                </p>
              </div>
            </Link>
            <button onClick={onClose} aria-label="Close menu" className="md:hidden text-slate-500 hover:text-white p-1.5 rounded-lg hover:bg-white/5">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Nav ── */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {navGroups.map((group) => (
            <div key={group.section}>
              <div className="flex items-center gap-1.5 px-1 mb-3">
                <group.sectionIcon size={12} className="text-violet-400 shrink-0" />
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  {group.section}
                </p>
              </div>

              <ul className="space-y-1.5">
                {group.items.map((item) => {
                  const active = pathname === item.href;
                  const Icon   = item.icon;
                  return (
                    <li key={item.href}>
                      <Link href={item.href} onClick={onClose}>
                        <motion.div
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          className={cn(
                            "flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl border transition-all duration-200 group",
                            active
                              ? "bg-gradient-to-r from-violet-600/25 to-blue-600/20 border-violet-500/40 shadow-lg shadow-violet-900/20"
                              : "bg-white/[0.03] border-white/[0.07] hover:bg-white/[0.07] hover:border-white/[0.12]"
                          )}
                        >
                          {/* Icon square */}
                          <div className={cn(
                            "w-9 h-9 flex items-center justify-center rounded-xl shrink-0 bg-gradient-to-br shadow-sm",
                            item.gradient
                          )}>
                            {item.text
                              ? <span className="text-white font-black text-xs">{item.text}</span>
                              : <Icon size={17} className="text-white" />
                            }
                          </div>

                          <span className={cn(
                            "flex-1 text-sm font-semibold truncate",
                            active ? "text-white" : "text-slate-300 group-hover:text-white"
                          )}>
                            {item.label}
                          </span>
                          <ChevronRight size={13} className={cn(
                            "shrink-0 transition-colors",
                            active ? "text-violet-400" : "text-slate-600 group-hover:text-slate-400"
                          )} />
                        </motion.div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* ── Bottom ── */}
        <div className="px-3 pb-4 shrink-0">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
          >
            <div className="flex items-center gap-2">
              {mounted && theme === "dark"
                ? <Moon size={14} className="text-blue-400" />
                : <Sun size={14} className="text-amber-400" />}
              <span className="text-xs text-slate-400 font-medium">
                {mounted && theme === "dark" ? "Dark Mode" : "Light Mode"}
              </span>
            </div>
            <div className={cn(
              "w-9 h-5 rounded-full relative transition-colors duration-300",
              mounted && theme === "dark" ? "bg-blue-600" : "bg-slate-600"
            )}>
              <div className={cn(
                "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-300",
                mounted && theme === "dark" ? "translate-x-4" : "translate-x-0.5"
              )} />
            </div>
          </button>
        </div>
      </aside>
    </>
  );
}
