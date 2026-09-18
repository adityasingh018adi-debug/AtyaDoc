"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopNav } from "@/components/layout/TopNav";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { motion } from "framer-motion";
import {
  Activity,
  FileText,
  Receipt,
  Clipboard,
  FileType,
  ScanText,
  Clock,
  Info,
  Cpu,
  Database,
} from "lucide-react";
import { getHistory, timeAgo, type HistoryItem, type HistoryType } from "@/lib/history";
import { getInvoices, computeInvoiceTotals } from "@/lib/invoices";
import { getChallans } from "@/lib/challans";
import { IndianRupee, TrendingUp, AlertCircle } from "lucide-react";

const TYPE_ICON: Record<HistoryType, typeof FileText> = {
  "word-to-pdf": FileType,
  "pdf-to-word": FileType,
  invoice: Receipt,
  challan: Clipboard,
  ocr: ScanText,
};
const TYPE_LABEL: Record<HistoryType, string> = {
  "word-to-pdf": "Word to PDF",
  "pdf-to-word": "PDF to Word",
  invoice: "AI Invoice Maker",
  challan: "AI Challan Maker",
  ocr: "OCR Scanner",
};
const TYPE_COLOR: Record<HistoryType, string> = {
  "word-to-pdf": "bg-blue-500",
  "pdf-to-word": "bg-rose-500",
  invoice: "bg-emerald-500",
  challan: "bg-amber-500",
  ocr: "bg-purple-500",
};

export default function AdminPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const [invoices, setInvoices] = useState<ReturnType<typeof getInvoices>>([]);
  const [challanCount, setChallanCount] = useState(0);

  useEffect(() => {
    setItems(getHistory());
    setInvoices(getInvoices());
    setChallanCount(getChallans().length);
    setHydrated(true);
  }, []);

  const now = new Date();
  const invoiceTotals = invoices.map((inv) => ({ inv, totals: computeInvoiceTotals(inv) }));
  const paidInvoices = invoiceTotals.filter((i) => i.inv.status === "paid");
  const pendingInvoices = invoiceTotals.filter((i) => i.inv.status === "pending" || i.inv.status === "overdue" || i.inv.status === "partial");
  const monthlySales = invoiceTotals
    .filter((i) => i.inv.status === "paid" && new Date(i.inv.date).getMonth() === now.getMonth() && new Date(i.inv.date).getFullYear() === now.getFullYear())
    .reduce((s, i) => s + i.totals.total, 0);
  const gstCollected = invoiceTotals.filter((i) => i.inv.status === "paid").reduce((s, i) => s + i.totals.taxAmount, 0);
  const outstanding = pendingInvoices.reduce((s, i) => s + i.totals.total, 0);
  const fmtMoney = (n: number) => "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);

  const totalDocs = items.length;
  const byType = items.reduce((acc, i) => {
    acc[i.type] = (acc[i.type] || 0) + 1;
    return acc;
  }, {} as Record<HistoryType, number>);
  const toolUsage = (Object.keys(TYPE_LABEL) as HistoryType[])
    .map((type) => ({ type, count: byType[type] || 0 }))
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count);
  const maxCount = Math.max(1, ...toolUsage.map((t) => t.count));
  const recent = items.slice(0, 6);

  if (!hydrated) return <PageSkeleton sidebarOpen={sidebarOpen} onCloseSidebar={() => setSidebarOpen(false)} />;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopNav onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-6xl mx-auto space-y-6">

            {/* Header */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center shadow-lg">
                  <Activity size={24} className="text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white">Activity Dashboard</h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400">AtyaDoc — usage stats for this device</p>
                </div>
              </div>
            </motion.div>

            {/* Honesty banner — this is a local-only demo dashboard, not a real admin panel */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              className="flex items-start gap-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl px-4 py-3.5">
              <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                This page is a local activity log, not a real admin panel — there is no login, no server-side analytics,
                and no account system. The numbers below come from your browser&apos;s local storage on this device only,
                and reset if you clear your browser data.
              </p>
            </motion.div>

            {/* Business Overview */}
            <div>
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">Business Overview</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "Total Invoices", value: invoices.length, icon: Receipt, color: "from-emerald-500 to-emerald-700" },
                  { label: "Total Challans", value: challanCount, icon: Clipboard, color: "from-amber-500 to-orange-600" },
                  { label: "Paid Invoices", value: paidInvoices.length, icon: TrendingUp, color: "from-blue-500 to-blue-700" },
                  { label: "Pending / Overdue", value: pendingInvoices.length, icon: AlertCircle, color: "from-red-500 to-red-700" },
                  { label: "Monthly Sales (Paid)", value: fmtMoney(monthlySales), icon: IndianRupee, color: "from-purple-500 to-purple-700", small: true },
                  { label: "GST Collected", value: fmtMoney(gstCollected), icon: IndianRupee, color: "from-indigo-500 to-indigo-700", small: true },
                  { label: "Outstanding Payments", value: fmtMoney(outstanding), icon: AlertCircle, color: "from-amber-500 to-amber-700", small: true },
                ].map((stat, i) => (
                  <motion.div key={stat.label}
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                    className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm">
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-3`}>
                      <stat.icon size={17} className="text-white" />
                    </div>
                    <p className={stat.small ? "text-lg font-extrabold text-slate-800 dark:text-white truncate" : "text-2xl font-extrabold text-slate-800 dark:text-white"}>
                      {stat.value}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{stat.label}</p>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Documents Tracked", value: totalDocs, icon: FileText, color: "from-blue-500 to-blue-700" },
                { label: "Tools Used", value: toolUsage.length, icon: Cpu, color: "from-emerald-500 to-emerald-700" },
                { label: "Most Used Tool", value: toolUsage[0] ? TYPE_LABEL[toolUsage[0].type] : "—", icon: Activity, color: "from-purple-500 to-purple-700", small: true },
                { label: "Storage", value: "Local only", icon: Database, color: "from-amber-500 to-orange-600", small: true },
              ].map((stat, i) => (
                <motion.div key={stat.label}
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm">
                  <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-3`}>
                    <stat.icon size={17} className="text-white" />
                  </div>
                  <p className={stat.small ? "text-sm font-extrabold text-slate-800 dark:text-white truncate" : "text-2xl font-extrabold text-slate-800 dark:text-white"}>
                    {stat.value}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{stat.label}</p>
                </motion.div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Tool Usage */}
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
                className="lg:col-span-1 bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Cpu size={16} className="text-slate-700 dark:text-slate-300" />
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Tool Usage</h3>
                </div>
                {toolUsage.length === 0 ? (
                  <p className="text-xs text-slate-400">No activity yet — use any tool to see stats here.</p>
                ) : (
                  <div className="space-y-4">
                    {toolUsage.map((t) => {
                      const pct = Math.round((t.count / maxCount) * 100);
                      const Icon = TYPE_ICON[t.type];
                      return (
                        <div key={t.type}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <Icon size={13} className="text-slate-500" />
                              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{TYPE_LABEL[t.type]}</span>
                            </div>
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{t.count}</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className={`h-full ${TYPE_COLOR[t.type]} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>

              {/* Recent Activity */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
                className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Activity size={16} className="text-slate-700 dark:text-slate-300" />
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Recent Activity</h3>
                </div>
                {recent.length === 0 ? (
                  <p className="text-xs text-slate-400">Nothing tracked yet on this device.</p>
                ) : (
                  <div className="space-y-3">
                    {recent.map((item) => {
                      const Icon = TYPE_ICON[item.type];
                      return (
                        <div key={item.id} className="flex items-center gap-3 py-2 border-b border-slate-50 dark:border-slate-700/50 last:border-0">
                          <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-700 flex items-center justify-center shrink-0">
                            <Icon size={14} className="text-slate-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{item.name}</p>
                            <p className="text-xs text-slate-400">{TYPE_LABEL[item.type]}</p>
                          </div>
                          <div className="flex items-center gap-1 text-slate-400 shrink-0">
                            <Clock size={11} />
                            <span className="text-xs">{timeAgo(item.createdAt)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            </div>

            {/* System Info — accurate facts only */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Info size={16} className="text-slate-700 dark:text-slate-300" />
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">About this app</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                {[
                  { label: "Framework", value: "Next.js (static export)" },
                  { label: "Hosting", value: "Cloudflare Pages" },
                  { label: "Conversion engine", value: "LibreOffice (Railway API)" },
                  { label: "PDF generation", value: "jsPDF + autotable" },
                  { label: "Accounts / login", value: "None — no sign-up required" },
                  { label: "Data storage", value: "Browser localStorage only" },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between items-center py-1.5 border-b border-slate-50 dark:border-slate-700/50 last:border-0">
                    <span className="text-xs text-slate-400">{row.label}</span>
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{row.value}</span>
                  </div>
                ))}
              </div>
            </motion.div>

          </div>
        </main>
      </div>
    </div>
  );
}
