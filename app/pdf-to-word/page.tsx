"use client";

import { useState, useCallback } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopNav } from "@/components/layout/TopNav";
import { ConvertingOverlay } from "@/components/ui/ConvertingOverlay";
import {
  CheckCircle, Download, Upload, X, Loader2,
  Shield, Zap, Star, Lock, FileOutput, ArrowRight,
  AlignLeft, Type, Target, LayoutGrid,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Footer } from "@/components/layout/Footer";
import { addHistoryItem } from "@/lib/history";
import { showToast } from "@/lib/toast";

const API = process.env.NEXT_PUBLIC_CONVERT_API_URL ?? "";

const steps = [
  { n: "1", icon: Upload,     title: "Upload PDF",         desc: "Drop your .pdf file below"           },
  { n: "2", icon: Zap,        title: "Converting",         desc: "LibreOffice extracts text & layout"  },
  { n: "3", icon: Download,   title: "Download .docx",     desc: "Editable Word file, ready instantly" },
];

const features = [
  { icon: AlignLeft,   color: "text-purple-500",  label: "Keep Formatting",        desc: "Tables, headings kept"      },
  { icon: Type,        color: "text-amber-500",   label: "Editable Text",          desc: "Fully selectable & editable"},
  { icon: Target,      color: "text-emerald-500", label: "High Accuracy",          desc: "Powered by AtyaDoc"     },
  { icon: LayoutGrid,  color: "text-blue-500",    label: "All Layouts Supported",  desc: "Complex docs handled"       },
];

export default function PdfToWordPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [file,        setFile]        = useState<File | null>(null);
  const [isDragging,  setIsDragging]  = useState(false);
  const [converting,  setConverting]  = useState(false);
  const [progress,    setProgress]    = useState("");
  const [converted,   setConverted]   = useState(false);
  const [docxBlob,    setDocxBlob]    = useState<Blob | null>(null);
  const [error,       setError]       = useState("");

  const reset = () => {
    setFile(null); setConverted(false); setDocxBlob(null); setError(""); setProgress("");
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) { setFile(f); setConverted(false); setDocxBlob(null); setError(""); }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setConverted(false); setDocxBlob(null); setError(""); }
  };

  const handleConvert = async () => {
    if (!file) return;
    if (!API) { setError("Conversion API not configured. Set NEXT_PUBLIC_CONVERT_API_URL."); return; }
    setConverting(true); setError(""); setProgress("Uploading…");
    try {
      const form = new FormData();
      form.append("file", file);
      setProgress("Converting with LibreOffice…");
      const resp = await fetch(`${API}/convert/pdf-to-word`, {
        method: "POST",
        body: form,
        headers: process.env.NEXT_PUBLIC_CONVERT_API_KEY
          ? { "x-api-key": process.env.NEXT_PUBLIC_CONVERT_API_KEY }
          : undefined,
      });
      if (!resp.ok) { const j = await resp.json().catch(() => ({})); throw new Error(j.error ?? `Server error ${resp.status}`); }
      setProgress("Receiving Word file…");
      const blob = await resp.blob();
      setDocxBlob(blob);
      setConverted(true); setProgress("");
      addHistoryItem("pdf-to-word", file.name.replace(/\.pdf$/i, ".docx"), `${(blob.size / 1024).toFixed(1)} KB`);
      showToast("Converted to Word successfully.", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Conversion failed. Please try again.";
      setError(msg);
      showToast(msg, "error");
    } finally { setConverting(false); }
  };

  const handleDownload = () => {
    if (!docxBlob || !file) return;
    const url = URL.createObjectURL(docxBlob);
    const a = document.createElement("a");
    a.href = url; a.download = file.name.replace(/\.pdf$/i, ".docx"); a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <AnimatePresence>
        {converting && <ConvertingOverlay progress={progress} fromColor="#ef4444" toColor="#9333ea" fromLabel="PDF" toLabel="DOCX" />}
      </AnimatePresence>

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopNav onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          {/* Page background */}
          <div className="min-h-full bg-gradient-to-br from-purple-50 via-white to-violet-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4 sm:p-8">
            <div className="max-w-2xl mx-auto space-y-8">

              {/* ── Header + Steps combined row ── */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-6">

                {/* Icon + Title */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-200 dark:shadow-purple-900/40">
                    <FileOutput size={26} className="text-white" />
                  </div>
                  <h1 className="text-2xl font-black text-slate-800 dark:text-white leading-tight whitespace-nowrap">
                    PDF <span className="text-purple-600">to Word</span>
                  </h1>
                </div>

                {/* Divider */}
                <div className="w-px h-10 bg-slate-200 dark:bg-slate-700 shrink-0" />

                {/* Steps */}
                <div className="flex items-start gap-0 flex-1 relative">
                  {steps.map((s, i) => (
                    <div key={s.n} className="flex flex-col items-center text-center flex-1 relative">
                      {i < steps.length - 1 && (
                        <div className="absolute top-5 left-1/2 w-full border-t-2 border-dashed border-purple-200 dark:border-purple-800 z-0" />
                      )}
                      <div className={cn(
                        "relative z-10 w-10 h-10 rounded-xl flex items-center justify-center mb-2 transition-all",
                        i === 0 && file       ? "bg-purple-600 shadow-md shadow-purple-200 dark:shadow-purple-900/50"  :
                        i === 1 && converting ? "bg-amber-500 shadow-md shadow-amber-200 dark:shadow-amber-900/50"     :
                        i === 2 && converted  ? "bg-emerald-500 shadow-md shadow-emerald-200"                          :
                        "bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                      )}>
                        <s.icon size={16} className={cn(
                          (i === 0 && file) || (i === 1 && converting) || (i === 2 && converted)
                            ? "text-white" : "text-slate-400"
                        )} />
                        <span className={cn(
                          "absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-[10px] font-black flex items-center justify-center",
                          i === 0 && file       ? "bg-purple-700 text-white"   :
                          i === 1 && converting ? "bg-amber-600 text-white"    :
                          i === 2 && converted  ? "bg-emerald-600 text-white"  :
                          "bg-purple-600 text-white"
                        )}>{s.n}</span>
                      </div>
                      <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 leading-tight">{s.title}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 px-1 leading-tight">{s.desc}</p>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* ── Drop Zone ── */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={cn(
                    "relative rounded-3xl border-2 transition-all duration-200 overflow-hidden",
                    isDragging ? "border-purple-400 bg-purple-50 dark:bg-purple-900/20 scale-[1.01]" :
                    file       ? "border-purple-300 bg-purple-50/50 dark:bg-purple-900/10 dark:border-purple-700" :
                    "border-dashed border-purple-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:border-purple-300"
                  )}>
                  <input type="file" accept=".pdf" onChange={handleFileInput}
                    className="absolute inset-0 opacity-0 cursor-pointer z-10" />

                  {file ? (
                    <div className="flex flex-col items-center gap-4 py-10 px-6">
                      <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/40 rounded-2xl flex items-center justify-center">
                        <FileOutput size={32} className="text-purple-600" />
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-slate-800 dark:text-slate-100">{file.name}</p>
                        <p className="text-sm text-slate-400 mt-1">{(file.size / 1024).toFixed(1)} KB · PDF Document</p>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); reset(); }}
                        className="relative z-20 flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 font-medium">
                        <X size={14} /> Remove file
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 py-10 px-6 pointer-events-none">
                      {/* Animated upload area */}
                      <div className="relative">
                        <motion.div animate={{ y: [-3, 3, -3] }} transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                          className="w-12 h-12 bg-gradient-to-br from-red-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-200 dark:shadow-purple-900/40">
                          <Upload size={21} className="text-white" />
                        </motion.div>
                        {/* Floating badges */}
                        <motion.div animate={{ y: [-5, 2, -5], rotate: [-5, 5, -5] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                          className="absolute -top-2 -left-9 bg-white dark:bg-slate-700 rounded-lg px-2 py-0.5 shadow-lg border border-slate-100 dark:border-slate-600 text-xs font-black text-red-600">PDF</motion.div>
                        <motion.div animate={{ y: [2, -5, 2], rotate: [5, -5, 5] }} transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                          className="absolute -top-1 -right-11 bg-white dark:bg-slate-700 rounded-lg px-1.5 py-0.5 shadow-lg border border-slate-100 dark:border-slate-600 text-xs font-black text-purple-600">DOCX</motion.div>
                        {/* Sparkles */}
                        {[[-22, -6], [22, 6], [-12, 22]].map(([x, y], i) => (
                          <motion.div key={i} className="absolute w-1 h-1 bg-purple-400 rounded-full"
                            style={{ left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)` }}
                            animate={{ scale: [0, 1, 0], opacity: [0, 1, 0] }}
                            transition={{ duration: 2, delay: i * 0.4, repeat: Infinity }} />
                        ))}
                      </div>
                      <div className="text-center space-y-1.5">
                        <p className="text-base font-bold text-slate-700 dark:text-slate-200">Drag &amp; drop your PDF here</p>
                        <p className="text-xs text-slate-400">or</p>
                        <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-red-500 to-purple-600 text-white text-xs font-semibold px-5 py-2 rounded-xl shadow-lg shadow-purple-200 dark:shadow-purple-900/30">
                          <FileOutput size={13} /> Browse Files
                        </div>
                      </div>
                      <p className="text-xs text-slate-400">Supports .pdf • Max file size 50 MB</p>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Error */}
              {error && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl px-4 py-3 text-sm text-red-600 dark:text-red-400">
                  {error}
                </motion.div>
              )}

              {/* ── Convert Button ── */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="space-y-4">
                {!converted ? (
                  <button onClick={handleConvert} disabled={!file || converting}
                    className={cn(
                      "w-full flex items-center justify-center gap-3 py-4 rounded-2xl text-base font-bold transition-all shadow-xl",
                      !file      ? "bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed shadow-none" :
                      converting ? "bg-gradient-to-r from-red-500 to-purple-600 text-white cursor-wait opacity-80"  :
                      "bg-gradient-to-r from-red-500 to-purple-600 hover:from-red-400 hover:to-purple-500 text-white shadow-purple-200 dark:shadow-purple-900/40"
                    )}>
                    {converting
                      ? <><Loader2 size={18} className="animate-spin" /> Converting…</>
                      : <><ArrowRight size={18} /> Convert to Word</>}
                  </button>
                ) : (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                    className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-2xl p-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle size={28} className="text-emerald-500 shrink-0" />
                      <div>
                        <p className="font-bold text-emerald-800 dark:text-emerald-300">Conversion Complete!</p>
                        <p className="text-sm text-emerald-600 dark:text-emerald-400">{file?.name.replace(/\.pdf$/i, ".docx")} · ready</p>
                      </div>
                    </div>
                    <button onClick={handleDownload}
                      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-200 dark:shadow-emerald-900/30 transition-colors">
                      <Download size={16} /> Save Word
                    </button>
                  </motion.div>
                )}

                {/* Security note */}
                {!converted && (
                  <div className="flex items-center gap-2 text-slate-400 text-xs">
                    <Shield size={13} className="text-emerald-500 shrink-0" />
                    <span>Your files are secure &amp; private — We never store your files</span>
                  </div>
                )}
              </motion.div>

              {/* ── Feature Badges ── */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
                className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {features.map((f) => (
                  <div key={f.label} className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm text-center">
                    <f.icon size={20} className={cn("mx-auto mb-2", f.color)} />
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{f.label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{f.desc}</p>
                  </div>
                ))}
              </motion.div>

              <Footer />

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
