"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopNav } from "@/components/layout/TopNav";
import {
  Clipboard, Search, Edit2, Download, Trash2, AlertCircle, Plus, Copy, Settings, Printer, Thermometer,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getChallans, deleteChallan, searchChallans, filterChallansByDate, type ChallanRecord,
} from "@/lib/challans";
import { getCompanies, type CompanyProfile } from "@/lib/companyProfile";
import { getPreferredTemplate, type ChallanTemplateId } from "@/lib/challanTemplates";
import { getSupplierSignature, computeTotals, padCount } from "@/lib/challanSettings";
import { downloadChallanPdf, printChallanPdf, formatChallanDate, type ChallanPdfData } from "@/lib/challanPdf";
import { showToast } from "@/lib/toast";
import { cn } from "@/lib/utils";

/** Read once by /challan on mount, so Edit and Duplicate open the right record. */
const CHALLAN_HANDOFF_KEY = "doclify_challan_edit_id";

function monthStartISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function ChallansPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [challans, setChallans] = useState<ChallanRecord[]>([]);
  const [companies, setCompanies] = useState<CompanyProfile[]>([]);
  const [supplierSignature, setSupplierSignature] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ChallanRecord | null>(null);

  useEffect(() => {
    setChallans(getChallans());
    setCompanies(getCompanies());
    setSupplierSignature(getSupplierSignature());
  }, []);

  const filtered = useMemo(() => {
    const bySearch = search.trim() ? searchChallans(search) : challans;
    return filterChallansByDate(bySearch, from || undefined, to || undefined);
  }, [challans, search, from, to]);

  /* Headline numbers for whatever is currently in view, so narrowing the date
     range answers "how much went out last week" without a separate report. */
  const stats = useMemo(() => {
    const items = filtered.reduce((n, c) => n + c.items.length, 0);
    const customers = new Set(filtered.map((c) => c.deliverTo.split("\n")[0].trim().toLowerCase()).filter(Boolean));
    const thisMonth = challans.filter((c) => c.date >= monthStartISO()).length;
    return { challans: filtered.length, items, customers: customers.size, thisMonth };
  }, [filtered, challans]);

  const toPdfData = (c: ChallanRecord): ChallanPdfData => {
    const company = companies.find((co) => co.id === c.companyId);
    return {
      challanNo: c.challanNo,
      date: c.date,
      type: c.type,
      from: {
        name: company?.name ?? "",
        address: company?.address,
        phone: company?.phone,
        email: company?.email,
        gst: company?.gst,
        logo: company?.logo ?? null,
      },
      to: {
        name: c.deliverTo.split("\n")[0] ?? "",
        address: c.deliverTo.split("\n").slice(1).join("\n"),
        phone: c.toPhone,
        gst: c.toGst,
      },
      vehicle: c.vehicle || undefined,
      dispatchedThrough: c.dispatchedThrough,
      poNumber: c.poNumber,
      storageTemp: c.storageTemp,
      items: c.items.map(({ desc, qty, unit, remarks }) => ({ desc, qty, unit, remarks })),
      declaration: c.declaration,
      supplierSignature,
      receiverSignature: c.receiverSignature ?? null,
      templateId: (c.templateId as ChallanTemplateId) ?? getPreferredTemplate(),
    };
  };

  const openInEditor = (id: string, mode: "edit" | "duplicate") => {
    localStorage.setItem(CHALLAN_HANDOFF_KEY, JSON.stringify({ id, mode }));
    router.push("/challan");
  };

  const handleDownload = (c: ChallanRecord) => {
    downloadChallanPdf(toPdfData(c));
    showToast(`Challan ${c.challanNo} downloaded.`, "success");
  };

  const handlePrint = (c: ChallanRecord) => {
    if (!printChallanPdf(toPdfData(c))) {
      showToast("Your browser blocked the print window, so the PDF was downloaded instead.", "error");
    }
  };

  const handleDelete = (id: string) => {
    deleteChallan(id);
    setChallans(getChallans());
    setDeleteTarget(null);
    showToast("Challan deleted.", "success");
  };

  const iconButton = "p-2 rounded-lg text-slate-500 transition-colors";

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopNav onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                  <Clipboard size={18} className="text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-black text-slate-800 dark:text-white leading-tight">All Challans</h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {challans.length} saved on this device · {stats.thisMonth} this month
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link href="/challan/settings"
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  <Settings size={14} /> Settings
                </Link>
                <button onClick={() => { localStorage.removeItem(CHALLAN_HANDOFF_KEY); router.push("/challan"); }}
                  className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold text-sm px-4 py-2.5 rounded-xl flex items-center gap-2 transition-colors">
                  <Plus size={15} /> New Challan
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Challans", value: padCount(stats.challans) },
                { label: "Line items", value: padCount(stats.items) },
                { label: "Customers", value: padCount(stats.customers) },
              ].map((s) => (
                <div key={s.label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-3">
                  <p className="text-[11px] text-slate-400 uppercase tracking-wide">{s.label}</p>
                  <p className="text-xl font-black text-slate-800 dark:text-white">{s.value}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by challan number, customer or item…"
                  className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 py-2.5 pl-9 pr-3 outline-none focus:border-amber-400 transition-colors" />
              </div>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date"
                className="text-sm rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 py-2.5 px-3 outline-none focus:border-amber-400" />
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date"
                className="text-sm rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 py-2.5 px-3 outline-none focus:border-amber-400" />
              {(from || to) && (
                <button onClick={() => { setFrom(""); setTo(""); }}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700 px-2">
                  Clear dates
                </button>
              )}
            </div>

            {filtered.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-10 text-center">
                <Clipboard size={30} className="text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {challans.length === 0 ? "No challans yet" : "Nothing matches those filters"}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {challans.length === 0
                    ? "Create one and it'll be saved here on this device."
                    : "Try a different challan number, customer or date range."}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {filtered.map((c) => {
                  const totals = computeTotals(c.items);
                  return (
                    <motion.div key={c.id}
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-4 flex flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-800 dark:text-white text-sm">{c.challanNo}</span>
                          <span className="text-[10px] font-semibold uppercase tracking-wide bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">
                            {c.type}
                          </span>
                          {c.storageTemp && (
                            <span className="text-[10px] font-semibold bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Thermometer size={9} /> {c.storageTemp}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
                          {c.deliverTo.split("\n")[0] || "—"} · {formatChallanDate(c.date)} · {c.items.length} item
                          {c.items.length === 1 ? "" : "s"} · {totals.display}
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <button onClick={() => openInEditor(c.id, "edit")} title="Edit this challan"
                          className={cn(iconButton, "hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20")}>
                          <Edit2 size={15} />
                        </button>
                        <button onClick={() => openInEditor(c.id, "duplicate")} title="Duplicate with a new number"
                          className={cn(iconButton, "hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20")}>
                          <Copy size={15} />
                        </button>
                        <button onClick={() => handleDownload(c)} title="Download PDF again"
                          className={cn(iconButton, "hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20")}>
                          <Download size={15} />
                        </button>
                        <button onClick={() => handlePrint(c)} title="Print"
                          className={cn(iconButton, "hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700")}>
                          <Printer size={15} />
                        </button>
                        <button onClick={() => setDeleteTarget(c)} title="Delete"
                          className={cn(iconButton, "hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20")}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      <AnimatePresence>
        {deleteTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
            onClick={() => setDeleteTarget(null)}>
            <motion.div initial={{ scale: 0.96 }} animate={{ scale: 1 }} exit={{ scale: 0.96 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 rounded-2xl p-5 max-w-sm w-full">
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-slate-800 dark:text-white">Delete {deleteTarget.challanNo}?</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    It&apos;s stored only on this device, so this can&apos;t be undone. The items stay in your saved
                    item list.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={() => handleDelete(deleteTarget.id)}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors">
                  Delete
                </button>
                <button onClick={() => setDeleteTarget(null)}
                  className="flex-1 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-semibold text-sm py-2.5 rounded-xl">
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
