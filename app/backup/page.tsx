"use client";

import { useEffect, useRef, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopNav } from "@/components/layout/TopNav";
import {
  Download, Upload, ShieldCheck, AlertCircle, AlertTriangle, HardDriveDownload,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  buildBundle, downloadBundle, parseBundle, applyBundle, summarize, totalRecords,
  type BackupBundle, type ImportMode, type SummaryRow,
} from "@/lib/dataBackup";
import { cn } from "@/lib/utils";
import { showToast } from "@/lib/toast";

export default function BackupPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [incoming, setIncoming] = useState<BackupBundle | null>(null);
  const [mode, setMode] = useState<ImportMode>("merge");
  const [error, setError] = useState("");
  const [confirmReplace, setConfirmReplace] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => setRows(summarize(buildBundle().keys));
  useEffect(() => { refresh(); }, []);

  const handleExport = () => {
    const bundle = buildBundle();
    if (totalRecords(bundle.keys) === 0) {
      showToast("There's nothing saved on this device yet.", "error");
      return;
    }
    downloadBundle(bundle);
    showToast("Backup downloaded. Keep it somewhere safe.", "success");
  };

  const handleFile = (file: File | undefined) => {
    setError("");
    setIncoming(null);
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        setIncoming(parseBundle(reader.result as string));
      } catch (err) {
        setError(err instanceof Error ? err.message : "That file couldn't be read.");
      }
    };
    reader.onerror = () => setError("That file couldn't be read.");
    reader.readAsText(file);
  };

  const runImport = () => {
    if (!incoming) return;
    const result = applyBundle(incoming, mode);
    setIncoming(null);
    setConfirmReplace(false);
    if (fileRef.current) fileRef.current.value = "";
    refresh();
    showToast(
      mode === "merge"
        ? `Restored ${result.written.length} item${result.written.length === 1 ? "" : "s"}; kept ${result.skipped.length} already on this device.`
        : `Replaced ${result.written.length} item${result.written.length === 1 ? "" : "s"} with the backup.`,
      "success"
    );
  };

  const cardClass =
    "bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm";
  const totalHere = rows.reduce((n, r) => n + r.count, 0);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopNav onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-2xl mx-auto space-y-5">

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center">
                <HardDriveDownload size={18} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-800 dark:text-white leading-tight">Backup &amp; Restore</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Your only copy lives in this browser. This is how you keep a second one.
                </p>
              </div>
            </motion.div>

            <div className="flex items-start gap-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-3.5 py-3">
              <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                Nothing here is uploaded to a server — that&apos;s the point, and it&apos;s also the risk. Clearing your
                browsing data, switching browsers, or reinstalling will erase every invoice, challan and ledger entry
                with no way to get them back. Download a backup regularly.
              </p>
            </div>

            {/* Export */}
            <div className={cardClass}>
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">What&apos;s on this device</h2>
              {rows.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  Nothing saved yet. Create an invoice or a challan and it&apos;ll appear here.
                </p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {rows.map((r) => (
                    <span key={r.label}
                      className="text-xs bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-200">
                      <b className="text-slate-900 dark:text-white">{r.count}</b> {r.label}
                    </span>
                  ))}
                </div>
              )}
              <button onClick={handleExport} disabled={totalHere === 0}
                className="mt-4 w-full flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-700 text-white font-bold text-sm py-3 rounded-xl transition-colors">
                <Download size={15} /> Download backup
              </button>
              <p className="text-[11px] text-slate-400 mt-2">
                A single .json file. It contains your business data in readable form, so store it the way you&apos;d store
                a spreadsheet of your customers.
              </p>
            </div>

            {/* Import */}
            <div className={cardClass}>
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">Restore from a backup</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-3">
                Use this on a new device, or after clearing your browser.
              </p>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer rounded-xl border border-dashed border-slate-300 dark:border-slate-600 px-4 py-6 justify-center hover:border-sky-400 transition-colors">
                <Upload size={15} />
                Choose a backup file
                <input ref={fileRef} type="file" accept="application/json,.json" className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0])} />
              </label>

              {error && (
                <div className="mt-3 flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2.5 text-xs text-red-600 dark:text-red-400">
                  <AlertCircle size={13} className="shrink-0 mt-0.5" /> {error}
                </div>
              )}

              {/* Nothing is written until the contents have been shown and the
                  mode chosen — a restore can destroy data, so it is never one
                  click away from a file picker. */}
              {incoming && (
                <div className="mt-4 rounded-xl border border-sky-300 dark:border-sky-700 bg-sky-50 dark:bg-sky-900/20 p-4">
                  <p className="text-xs font-bold text-sky-800 dark:text-sky-300">
                    This backup holds
                    {incoming.exportedAt ? ` (made ${incoming.exportedAt.slice(0, 10)})` : ""}:
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {summarize(incoming.keys).map((r) => (
                      <span key={r.label}
                        className="text-xs bg-white dark:bg-slate-800 border border-sky-200 dark:border-sky-700 rounded-lg px-2.5 py-1 text-slate-700 dark:text-slate-200">
                        <b>{r.count}</b> {r.label}
                      </span>
                    ))}
                    {summarize(incoming.keys).length === 0 && (
                      <span className="text-xs text-slate-500">Nothing recognisable in this file.</span>
                    )}
                  </div>

                  <div className="mt-3 space-y-2">
                    {([
                      { id: "merge" as const, title: "Keep what's here", body: "Only fills in what this device is missing. Nothing already saved is touched." },
                      { id: "replace" as const, title: "Replace with the backup", body: "Overwrites what's on this device. Anything saved here and not in the file is lost." },
                    ]).map((opt) => (
                      <button key={opt.id} type="button" onClick={() => setMode(opt.id)}
                        aria-pressed={mode === opt.id}
                        className={cn(
                          "w-full text-left rounded-xl border p-3 transition-colors",
                          mode === opt.id
                            ? "border-sky-400 bg-white dark:bg-slate-800"
                            : "border-transparent hover:border-sky-200 dark:hover:border-sky-800"
                        )}>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{opt.title}</span>
                        <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{opt.body}</span>
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2 mt-3">
                    <button onClick={() => (mode === "replace" ? setConfirmReplace(true) : runImport())}
                      className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-colors">
                      {mode === "merge" ? "Restore missing items" : "Replace everything"}
                    </button>
                    <button onClick={() => { setIncoming(null); if (fileRef.current) fileRef.current.value = ""; }}
                      className="border border-sky-300 dark:border-sky-700 text-sky-800 dark:text-sky-300 font-semibold text-xs px-4 py-2.5 rounded-xl">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            <p className="flex items-start gap-1.5 text-[11px] text-slate-400">
              <ShieldCheck size={12} className="shrink-0 mt-0.5 text-emerald-500" />
              Exporting and restoring happen entirely in your browser. The file never leaves your device unless you
              send it somewhere yourself.
            </p>
          </div>
        </main>
      </div>

      <AnimatePresence>
        {confirmReplace && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
            onClick={() => setConfirmReplace(false)}>
            <motion.div initial={{ scale: 0.96 }} animate={{ scale: 1 }} exit={{ scale: 0.96 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 rounded-2xl p-5 max-w-sm w-full">
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-slate-800 dark:text-white">Replace everything on this device?</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {totalHere > 0
                      ? `${totalHere} item${totalHere === 1 ? "" : "s"} currently saved here will be overwritten by the backup. This can't be undone — download a backup of what's here first if you're unsure.`
                      : "Nothing is currently saved here, so there is nothing to lose."}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={runImport}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors">
                  Replace
                </button>
                <button onClick={() => setConfirmReplace(false)}
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
