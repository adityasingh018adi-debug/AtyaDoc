"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopNav } from "@/components/layout/TopNav";
import {
  Clipboard, Plus, Trash2, Download, Camera, FileText as FileTextIcon,
  Loader2, CheckCircle, AlertCircle, ChevronDown, X, ArrowRightLeft,
  GripVertical, Printer, Save, Settings, List, Copy, ChevronUp, Thermometer, Package,
} from "lucide-react";
import { motion } from "framer-motion";
import { downloadChallanPdf, printChallanPdf, type ChallanPdfData } from "@/lib/challanPdf";
import { ChallanPreview } from "@/components/challan/ChallanPreview";
import { addHistoryItem } from "@/lib/history";
import { parseChallanText } from "@/lib/parseChallanText";
import {
  getCompanies, addCompany, getLastUsedCompanyId, setLastUsedCompanyId, type CompanyProfile,
} from "@/lib/companyProfile";
import { getCustomers, addCustomer, type Customer } from "@/lib/customers";
import { getCatalog, rememberChallanItems, type CatalogItem } from "@/lib/challanItems";
import { SignaturePad } from "@/components/ui/SignaturePad";
import { CHALLAN_TYPES, saveChallan, getChallan, type ChallanType } from "@/lib/challans";
import {
  CHALLAN_TEMPLATES, getPreferredTemplate, setPreferredTemplate, type ChallanTemplateId,
} from "@/lib/challanTemplates";
import {
  getSupplierSignature, getDeclaration, getUnits, rememberUnits,
  getStorageTemperatures, rememberStorageTemperature,
  peekNextChallanNumber, consumeChallanNumber, computeTotals, padCount,
} from "@/lib/challanSettings";
import { cn } from "@/lib/utils";
import { showToast } from "@/lib/toast";

interface LineItem {
  id: string;
  desc: string;
  qty: number | string;
  unit: string;
  remarks?: string;
}

const OCR_API_KEY = process.env.NEXT_PUBLIC_OCR_API_KEY || "helloworld";
const INVOICE_PREFILL_KEY = "doclify_invoice_prefill";
const CHALLAN_PREFILL_KEY = "doclify_challan_prefill";
/** Set by the challans list for Edit and Duplicate; consumed once on mount. */
const CHALLAN_HANDOFF_KEY = "doclify_challan_edit_id";

function rowId() {
  return Math.random().toString(36).slice(2, 10);
}

const emptyRow = (): LineItem => ({ id: rowId(), desc: "", qty: 1, unit: "NOS" });

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Parsed but not yet applied — the user confirms before anything is overwritten. */
type ExtractionReview = {
  source: "photo" | "text";
  deliverTo?: string;
  vehicle?: string;
  items: { desc: string; qty: number; unit: string }[];
};

export default function ChallanPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [items, setItems] = useState<LineItem[]>([emptyRow()]);
  const [challanId, setChallanId] = useState<string | undefined>(undefined);
  const [templateId, setTemplateId] = useState<ChallanTemplateId>("premium");
  const [showRemarks, setShowRemarks] = useState(false);
  const [units, setUnits] = useState<string[]>([]);
  const [temps, setTemps] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);

  /**
   * True while the challan number is the one the counter is about to issue. The
   * counter is only advanced when such a challan is saved, so opening the form
   * and walking away doesn't burn a number and leave a gap in the books.
   */
  const [numberIsAuto, setNumberIsAuto] = useState(true);

  const [form, setForm] = useState({
    challanNo: "",
    type: "Delivery Challan" as ChallanType,
    date: todayISO(),
    deliverTo: "",
    toPhone: "",
    toGst: "",
    vehicle: "",
    dispatchedThrough: "",
    poNumber: "",
    storageTemp: "",
  });
  const [declaration, setDeclaration] = useState("");

  const [companies, setCompanies] = useState<CompanyProfile[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("default");
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [newCompany, setNewCompany] = useState({ name: "", address: "" });

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState<string>("");

  /** The company's permanent item list, reloaded whenever the company changes. */
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogQuery, setCatalogQuery] = useState("");

  /** Signed at handover, per challan. Never seeded from the supplier's. */
  const [receiverSignature, setReceiverSignature] = useState<string | null>(null);
  /** The business's own, held in settings and reused on every challan. */
  const [supplierSignature, setSupplierSignature] = useState<string | null>(null);

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  };

  useEffect(() => {
    const list = getCompanies();
    setCompanies(list);
    const lastUsed = getLastUsedCompanyId();
    setSelectedCompanyId(lastUsed && list.some((c) => c.id === lastUsed) ? lastUsed : list[0]?.id ?? "default");
    setCustomers(getCustomers());
    setTemplateId(getPreferredTemplate());
    setSupplierSignature(getSupplierSignature());
    setUnits(getUnits());
    setTemps(getStorageTemperatures());

    const handoffRaw = localStorage.getItem(CHALLAN_HANDOFF_KEY);
    if (handoffRaw) {
      localStorage.removeItem(CHALLAN_HANDOFF_KEY);
      let id = handoffRaw;
      let mode: "edit" | "duplicate" = "edit";
      try {
        const parsed = JSON.parse(handoffRaw) as { id: string; mode?: "edit" | "duplicate" };
        if (parsed?.id) { id = parsed.id; mode = parsed.mode ?? "edit"; }
      } catch {
        /* an older list page stored the bare id */
      }
      const existing = getChallan(id);
      if (existing) {
        // Editing keeps the challan's own number; duplicating must take a fresh
        // one, or two different deliveries would carry the same number.
        setChallanId(mode === "edit" ? existing.id : undefined);
        setNumberIsAuto(mode === "duplicate");
        setForm({
          challanNo: mode === "edit" ? existing.challanNo : peekNextChallanNumber(),
          type: existing.type,
          date: mode === "edit" ? existing.date : todayISO(),
          deliverTo: existing.deliverTo,
          toPhone: existing.toPhone ?? "",
          toGst: existing.toGst ?? "",
          vehicle: existing.vehicle,
          dispatchedThrough: existing.dispatchedThrough ?? "",
          poNumber: existing.poNumber ?? "",
          storageTemp: existing.storageTemp ?? "",
        });
        setItems(existing.items.map((i) => ({ id: rowId(), desc: i.desc, qty: i.qty, unit: i.unit, remarks: i.remarks })));
        setShowRemarks(existing.items.some((i) => (i.remarks ?? "").trim() !== ""));
        setDeclaration(existing.declaration ?? getDeclaration());
        if (existing.companyId) setSelectedCompanyId(existing.companyId);
        if (existing.customerId) setCustomerId(existing.customerId);
        if (existing.templateId) setTemplateId(existing.templateId as ChallanTemplateId);
        // A duplicate is a new delivery, so it starts unsigned by the receiver.
        setReceiverSignature(mode === "edit" ? existing.receiverSignature ?? null : null);
        if (mode === "duplicate") showToast("Duplicated. Check the details, then save.", "success");
        return;
      }
    }

    setForm((f) => ({ ...f, challanNo: peekNextChallanNumber() }));
    setDeclaration(getDeclaration());

    const prefillRaw = localStorage.getItem(CHALLAN_PREFILL_KEY);
    if (prefillRaw) {
      localStorage.removeItem(CHALLAN_PREFILL_KEY);
      try {
        const prefill = JSON.parse(prefillRaw) as {
          deliverTo?: string; vehicle?: string; items?: { desc: string; qty: number; unit: string }[];
        };
        if (prefill.deliverTo) setForm((f) => ({ ...f, deliverTo: prefill.deliverTo! }));
        if (prefill.vehicle) setForm((f) => ({ ...f, vehicle: prefill.vehicle! }));
        if (prefill.items?.length) {
          setItems(prefill.items.map((i) => ({ id: rowId(), ...i })));
        }
      } catch { /* ignore */ }
    }
  }, []);

  // The saved item list belongs to the company, so switching company swaps it.
  useEffect(() => {
    if (selectedCompanyId) setCatalog(getCatalog(selectedCompanyId));
  }, [selectedCompanyId]);

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId) ?? companies[0];
  const totals = computeTotals(items);

  /* ── Customers ─────────────────────────────────────────────────────────── */

  const applyCustomer = (id: string) => {
    setCustomerId(id);
    const c = customers.find((x) => x.id === id);
    if (!c) return;
    setForm((f) => ({
      ...f,
      deliverTo: [c.name, c.address].filter(Boolean).join("\n"),
      toPhone: c.phone ?? "",
      toGst: c.gst ?? "",
    }));
    setDirty(true);
  };

  /** Save the typed address so the next challan to this customer is two clicks. */
  const saveCurrentCustomer = () => {
    const [name, ...rest] = form.deliverTo.split("\n");
    if (!name?.trim()) { showToast("Enter a delivery address first.", "error"); return; }
    const created = addCustomer({
      name: name.trim(),
      address: rest.join("\n").trim() || undefined,
      phone: form.toPhone || undefined,
      gst: form.toGst || undefined,
    });
    setCustomers(getCustomers());
    setCustomerId(created.id);
    showToast(`${created.name} saved to your customers.`, "success");
  };

  const handleAddCompany = () => {
    if (!newCompany.name.trim()) return;
    const created = addCompany({ name: newCompany.name, address: newCompany.address });
    setCompanies(getCompanies());
    setSelectedCompanyId(created.id);
    setLastUsedCompanyId(created.id);
    setNewCompany({ name: "", address: "" });
    setShowAddCompany(false);
  };

  /* ── Saved items ───────────────────────────────────────────────────────── */

  /**
   * Add a catalogue item as a line.
   *
   * It fills the first genuinely blank row rather than always appending, so
   * picking two items from a fresh form doesn't leave an empty line wedged above
   * them.
   */
  const addFromCatalog = (item: CatalogItem) => {
    setItems((prev) => {
      const row: LineItem = {
        id: rowId(), desc: item.desc, qty: item.defaultQty ?? 1, unit: item.unit,
      };
      const blank = prev.findIndex((r) => !r.desc.trim());
      if (blank === -1) return [...prev, row];
      const next = [...prev];
      next[blank] = row;
      return next;
    });
    if (item.storageTemp && !form.storageTemp) {
      setForm((f) => ({ ...f, storageTemp: item.storageTemp! }));
    }
    setDirty(true);
  };

  const filteredCatalog = useMemo(() => {
    const q = catalogQuery.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter((i) => i.desc.toLowerCase().includes(q) || i.unit.toLowerCase().includes(q));
  }, [catalog, catalogQuery]);

  /* ── Quick fill: scan a photo or paste a note, then review ─────────────── */

  const [quickFillTab, setQuickFillTab] = useState<"photo" | "text">("text");
  const [pastedText, setPastedText] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [fillError, setFillError] = useState("");
  const [review, setReview] = useState<ExtractionReview | null>(null);

  const stageExtraction = (raw: string, source: "photo" | "text") => {
    const parsed = parseChallanText(raw);
    if (parsed.items.length === 0 && !parsed.deliverTo && !parsed.vehicle) {
      setFillError("Couldn't find any challan details in that text. Try one item per line, like \"5 boxes of steel rods\".");
      return;
    }
    setReview({ source, deliverTo: parsed.deliverTo, vehicle: parsed.vehicle, items: parsed.items });
  };

  const applyReview = () => {
    if (!review) return;
    if (review.deliverTo) setForm((f) => ({ ...f, deliverTo: review.deliverTo! }));
    if (review.vehicle) setForm((f) => ({ ...f, vehicle: review.vehicle! }));
    if (review.items.length) setItems(review.items.map((i) => ({ id: rowId(), ...i })));
    setDirty(true);
    showToast(`Filled ${review.items.length} item${review.items.length === 1 ? "" : "s"}.`, "success");
    setReview(null);
  };

  const handleParseText = () => {
    setFillError("");
    if (!pastedText.trim()) { setFillError("Paste some text first."); return; }
    stageExtraction(pastedText, "text");
  };

  const handleScanPhoto = async () => {
    if (!photoFile) { setFillError("Choose a photo first."); return; }
    setScanning(true); setFillError("");
    try {
      const body = new FormData();
      body.append("file", photoFile);
      body.append("apikey", OCR_API_KEY);
      body.append("language", "eng");
      body.append("isOverlayRequired", "false");
      body.append("scale", "true");
      body.append("OCREngine", "2");
      const resp = await fetch("https://api.ocr.space/parse/image", { method: "POST", body });
      const data = await resp.json();
      if (data.IsErroredOnProcessing) throw new Error(data.ErrorMessage?.[0] ?? "OCR failed");
      const text = data.ParsedResults?.map((r: { ParsedText: string }) => r.ParsedText).join("\n").trim();
      if (!text) throw new Error("No text found in that photo. Try a clearer image.");
      stageExtraction(text, "photo");
    } catch (err) {
      setFillError(err instanceof Error ? err.message : "Scan failed. Try a clearer photo.");
    } finally {
      setScanning(false);
    }
  };

  /* ── Items ─────────────────────────────────────────────────────────────── */

  const addItem = () => { setItems((prev) => [...prev, emptyRow()]); setDirty(true); };
  const removeItem = (id: string) =>
    setItems((prev) => {
      const next = prev.filter((i) => i.id !== id);
      setDirty(true);
      return next.length ? next : [emptyRow()];   // never leave the table empty
    });
  const updateItem = (id: string, field: keyof LineItem, value: string | number) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
    setDirty(true);
  };

  const moveItem = useCallback((from: number, to: number) => {
    setItems((prev) => {
      if (to < 0 || to >= prev.length || from === to) return prev;
      const next = [...prev];
      const [row] = next.splice(from, 1);
      next.splice(to, 0, row);
      return next;
    });
    setDirty(true);
  }, []);

  // Pointer drag for the mouse, arrow buttons for touch and keyboard. Both write
  // through moveItem so the two paths can't reorder differently.
  const dragIndex = useRef<number | null>(null);

  /* ── Output ────────────────────────────────────────────────────────────── */

  const pdfData: ChallanPdfData = useMemo(() => ({
    challanNo: form.challanNo,
    date: form.date,
    type: form.type,
    from: {
      name: selectedCompany?.name ?? "",
      address: selectedCompany?.address,
      phone: selectedCompany?.phone,
      email: selectedCompany?.email,
      gst: selectedCompany?.gst,
      logo: selectedCompany?.logo ?? null,
    },
    to: {
      name: form.deliverTo.split("\n")[0] ?? "",
      address: form.deliverTo.split("\n").slice(1).join("\n"),
      phone: form.toPhone || undefined,
      gst: form.toGst || undefined,
    },
    vehicle: form.vehicle || undefined,
    dispatchedThrough: form.dispatchedThrough || undefined,
    poNumber: form.poNumber || undefined,
    storageTemp: form.storageTemp || undefined,
    items: items.map(({ desc, qty, unit, remarks }) => ({ desc, qty, unit, remarks })),
    declaration,
    supplierSignature,
    receiverSignature,
    templateId,
  }), [form, items, declaration, supplierSignature, receiverSignature, templateId, selectedCompany]);

  /**
   * Persist the challan.
   *
   * Saving is what consumes a challan number, and it happens before any PDF is
   * produced — a downloaded challan that isn't in the list is worse than a saved
   * one that wasn't downloaded. It also folds the lines into the company's
   * permanent item list, so the catalogue builds itself out of real work.
   */
  const persist = useCallback(() => {
    let challanNo = form.challanNo;
    if (!challanId && numberIsAuto) {
      challanNo = consumeChallanNumber();
      setNumberIsAuto(false);
      setForm((f) => ({ ...f, challanNo }));
    }
    const record = saveChallan({
      id: challanId,
      challanNo,
      type: form.type,
      date: form.date,
      companyId: selectedCompanyId,
      customerId: customerId || undefined,
      deliverTo: form.deliverTo,
      toPhone: form.toPhone || undefined,
      toGst: form.toGst || undefined,
      vehicle: form.vehicle,
      dispatchedThrough: form.dispatchedThrough || undefined,
      poNumber: form.poNumber || undefined,
      storageTemp: form.storageTemp || undefined,
      items: items.map(({ id, desc, qty, unit, remarks }) => ({ id, desc, qty: Number(qty) || 0, unit, remarks })),
      declaration,
      receiverSignature,
      templateId,
    });
    setChallanId(record.id);

    rememberUnits(items.map((i) => i.unit));
    rememberStorageTemperature(form.storageTemp);
    rememberChallanItems(selectedCompanyId, items, form.storageTemp);
    setUnits(getUnits());
    setTemps(getStorageTemperatures());
    setCatalog(getCatalog(selectedCompanyId));
    setDirty(false);
    return { record, challanNo };
  }, [challanId, numberIsAuto, form, selectedCompanyId, customerId, items, declaration, receiverSignature, templateId]);

  const handleSave = () => {
    persist();
    showToast("Challan saved, and its items added to this company's list.", "success");
  };

  const handleDownload = () => {
    const { challanNo } = persist();
    downloadChallanPdf({ ...pdfData, challanNo });
    addHistoryItem("challan", `Challan ${challanNo}.pdf`, `${items.length} item${items.length !== 1 ? "s" : ""}`);
    showToast("Challan saved and downloaded.", "success");
  };

  const handlePrint = () => {
    const { challanNo } = persist();
    const opened = printChallanPdf({ ...pdfData, challanNo });
    if (!opened) showToast("Your browser blocked the print window, so the PDF was downloaded instead.", "error");
  };

  /** Start a fresh challan from this one — same customer and items, new number. */
  const handleDuplicate = () => {
    const { record } = persist();
    localStorage.setItem(CHALLAN_HANDOFF_KEY, JSON.stringify({ id: record.id, mode: "duplicate" }));
    // A reload is the simplest way to reset every piece of form state at once,
    // and the handoff key above is what the fresh mount reads back.
    window.location.reload();
  };

  const inputClass =
    "w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:border-amber-500 transition-colors";
  const labelClass = "text-xs text-slate-500 dark:text-slate-400 mb-1 block";

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopNav onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-6xl mx-auto space-y-6">

            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                  <Clipboard size={24} className="text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white">AI Challan Maker</h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {challanId ? `Editing ${form.challanNo}` : "Create delivery challans in seconds"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link href="/challans"
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  <List size={14} /> All Challans
                </Link>
                <Link href="/challan/settings"
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  <Settings size={14} /> Settings
                </Link>
              </div>
            </motion.div>

            {/* ── Quick fill ── */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex bg-slate-100 dark:bg-slate-700 rounded-xl p-1">
                  {(["text", "photo"] as const).map((tab) => (
                    <button key={tab}
                      onClick={() => { setQuickFillTab(tab); setFillError(""); }}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all",
                        quickFillTab === tab ? "bg-amber-500 text-black shadow-sm" : "text-slate-500 dark:text-slate-400"
                      )}>
                      {tab === "photo" ? <><Camera size={13} /> Scan Photo</> : <><FileTextIcon size={13} /> Paste Text</>}
                    </button>
                  ))}
                </div>
              </div>

              {quickFillTab === "photo" ? (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Photograph a handwritten note or printed list. We&apos;ll read the items, address and vehicle number — and show you what we found before changing anything.
                  </p>
                  <div className="flex items-center gap-2">
                    <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                      className="flex-1 text-xs text-slate-600 dark:text-slate-300 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-amber-100 dark:file:bg-amber-900/30 file:text-amber-700 dark:file:text-amber-400 file:text-xs file:font-semibold" />
                    <button onClick={handleScanPhoto} disabled={!photoFile || scanning}
                      className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-700 text-black font-bold text-xs px-4 py-2 rounded-xl transition-colors shrink-0">
                      {scanning ? <><Loader2 size={13} className="animate-spin" /> Scanning…</> : <><Camera size={13} /> Scan</>}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Paste a note — the address on one line, then one item per line.
                  </p>
                  <textarea value={pastedText} onChange={(e) => setPastedText(e.target.value)} rows={4}
                    placeholder={"Deliver to: Sharma Traders, Delhi\nVehicle: DL 1C 1234\n5 boxes of steel rods\n10 kg cotton fabric"}
                    className={cn(inputClass, "resize-none")} />
                  <button onClick={handleParseText}
                    className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs px-4 py-2 rounded-xl transition-colors">
                    <FileTextIcon size={13} /> Read this
                  </button>
                </div>
              )}

              {fillError && (
                <div className="mt-3 flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2.5 text-xs text-red-600 dark:text-red-400">
                  <AlertCircle size={13} className="shrink-0 mt-0.5" /> {fillError}
                </div>
              )}

              {/* Review before anything is overwritten. Extraction from a photo of
                  handwriting is a guess, and a wrong quantity on a delivery note
                  is an argument at the gate. */}
              {review && (
                <div className="mt-4 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
                      Review what we read from your {review.source === "photo" ? "photo" : "text"}
                    </p>
                    <button onClick={() => setReview(null)} aria-label="Discard extraction" className="text-amber-700 hover:text-amber-900">
                      <X size={14} />
                    </button>
                  </div>
                  {review.deliverTo && <p className="text-xs text-slate-700 dark:text-slate-200"><b>Deliver to:</b> {review.deliverTo}</p>}
                  {review.vehicle && <p className="text-xs text-slate-700 dark:text-slate-200"><b>Vehicle:</b> {review.vehicle}</p>}
                  {review.items.length > 0 && (
                    <ul className="mt-2 space-y-0.5">
                      {review.items.map((i, n) => (
                        <li key={n} className="text-xs text-slate-700 dark:text-slate-200">
                          {padCount(n + 1)}. {i.desc} — {i.qty} {i.unit}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-2">
                    Applying this replaces the items already in the form.
                  </p>
                  <div className="flex gap-2 mt-3">
                    <button onClick={applyReview}
                      className="bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs px-4 py-2 rounded-xl transition-colors">
                      Use these details
                    </button>
                    <button onClick={() => setReview(null)}
                      className="border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 font-semibold text-xs px-4 py-2 rounded-xl">
                      Discard
                    </button>
                  </div>
                </div>
              )}
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {/* ── Form ── */}
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
                className="space-y-4">

                <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Challan Details</h3>

                  <div>
                    <label className={labelClass}>From (your company)</label>
                    {!showAddCompany ? (
                      <div className="flex items-center gap-2">
                        {selectedCompany?.logo && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={selectedCompany.logo} alt="" title="This company's logo appears on the challan"
                            className="h-9 w-12 object-contain rounded border border-slate-200 dark:border-slate-600 bg-white shrink-0" />
                        )}
                        <div className="relative flex-1">
                          <select value={selectedCompanyId}
                            onChange={(e) => { setSelectedCompanyId(e.target.value); setLastUsedCompanyId(e.target.value); setDirty(true); }}
                            className={cn(inputClass, "appearance-none pr-8")}>
                            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                        <button onClick={() => setShowAddCompany(true)}
                          className="flex items-center gap-1 text-xs text-amber-600 font-semibold hover:text-amber-700 shrink-0 px-2">
                          <Plus size={13} /> New
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2 bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 border border-slate-200 dark:border-slate-600">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Add company</p>
                          <button onClick={() => setShowAddCompany(false)} aria-label="Cancel adding company" className="text-slate-400 hover:text-slate-600">
                            <X size={14} />
                          </button>
                        </div>
                        <input value={newCompany.name} onChange={(e) => setNewCompany((p) => ({ ...p, name: e.target.value }))}
                          placeholder="Company name" autoFocus className={inputClass} />
                        <input value={newCompany.address} onChange={(e) => setNewCompany((p) => ({ ...p, address: e.target.value }))}
                          placeholder="Address" className={inputClass} />
                        <button onClick={handleAddCompany} disabled={!newCompany.name.trim()}
                          className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-slate-200 disabled:text-slate-400 text-black font-bold text-xs py-2 rounded-lg transition-colors">
                          Save Company
                        </button>
                      </div>
                    )}
                    <p className="text-[11px] text-slate-400 mt-1">
                      Logo, address and GSTIN come from{" "}
                      <Link href="/challan/settings" className="text-amber-600 hover:underline">this company&apos;s profile</Link>.
                    </p>
                  </div>

                  <div>
                    <label className={labelClass}>Challan Type</label>
                    <div className="relative">
                      <select value={form.type} onChange={(e) => update("type", e.target.value as ChallanType)}
                        className={cn(inputClass, "appearance-none pr-8")}>
                        {CHALLAN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Challan No.</label>
                      <input value={form.challanNo}
                        onChange={(e) => { update("challanNo", e.target.value); setNumberIsAuto(false); }}
                        className={inputClass} />
                      {numberIsAuto && !challanId && (
                        <p className="text-[11px] text-slate-400 mt-1">Next in sequence. Editing it stops the counter advancing.</p>
                      )}
                    </div>
                    <div>
                      <label className={labelClass}>Date</label>
                      <input type="date" value={form.date} onChange={(e) => update("date", e.target.value)} className={inputClass} />
                    </div>
                  </div>

                  {/* Storage temperature. Perishables are rejected on this at the
                      receiving dock, so it prints in the header strip. */}
                  <div>
                    <label className={cn(labelClass, "flex items-center gap-1.5")}>
                      <Thermometer size={12} /> Storage Temperature
                    </label>
                    <input value={form.storageTemp} list="challan-temps"
                      onChange={(e) => update("storageTemp", e.target.value)}
                      placeholder="Frozen (-18°C or below)" className={inputClass} />
                    <datalist id="challan-temps">
                      {temps.map((t) => <option key={t} value={t} />)}
                    </datalist>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {temps.slice(0, 5).map((t) => (
                        <button key={t} type="button" onClick={() => update("storageTemp", t)}
                          className={cn(
                            "text-[11px] px-2 py-1 rounded-lg border transition-colors",
                            form.storageTemp === t
                              ? "border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 font-semibold"
                              : "border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-slate-300"
                          )}>
                          {t}
                        </button>
                      ))}
                      {form.storageTemp && (
                        <button type="button" onClick={() => update("storageTemp", "")}
                          className="text-[11px] px-2 py-1 rounded-lg text-slate-400 hover:text-red-500">
                          Clear
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1.5">
                      Leave blank for goods with no cold-chain requirement — the field is then left off the challan entirely.
                    </p>
                  </div>
                </div>

                {/* Deliver to */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Deliver To</h3>
                    <button onClick={saveCurrentCustomer}
                      className="text-xs text-amber-600 font-semibold hover:text-amber-700">
                      Save as customer
                    </button>
                  </div>

                  {customers.length > 0 && (
                    <div className="relative">
                      <select value={customerId} onChange={(e) => applyCustomer(e.target.value)}
                        className={cn(inputClass, "appearance-none pr-8")}>
                        <option value="">Pick a saved customer…</option>
                        {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  )}

                  <textarea value={form.deliverTo} onChange={(e) => update("deliverTo", e.target.value)} rows={3}
                    placeholder={"Sharma Traders\n123, Karol Bagh\nNew Delhi - 110005"}
                    className={cn(inputClass, "resize-none")} />
                  <p className="text-[11px] text-slate-400 -mt-1">First line is the customer name; the rest is the address.</p>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Phone (optional)</label>
                      <input value={form.toPhone} onChange={(e) => update("toPhone", e.target.value)} className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>GSTIN (optional)</label>
                      <input value={form.toGst} onChange={(e) => update("toGst", e.target.value.toUpperCase())}
                        className={cn(inputClass, "font-mono uppercase")} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Vehicle No.</label>
                      <input value={form.vehicle} onChange={(e) => update("vehicle", e.target.value.toUpperCase())}
                        placeholder="DL 1C 1234" className={cn(inputClass, "font-mono uppercase")} />
                    </div>
                    <div>
                      <label className={labelClass}>Dispatched through</label>
                      <input value={form.dispatchedThrough} onChange={(e) => update("dispatchedThrough", e.target.value)}
                        placeholder="Own van / courier" className={inputClass} />
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>P.O. No. (optional)</label>
                    <input value={form.poNumber} onChange={(e) => update("poNumber", e.target.value)} className={inputClass} />
                  </div>
                </div>

                {/* Items */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm">
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Items</h3>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 cursor-pointer">
                        <input type="checkbox" checked={showRemarks} onChange={(e) => setShowRemarks(e.target.checked)}
                          className="accent-amber-500" />
                        Remarks
                      </label>
                      <button onClick={() => setCatalogOpen((o) => !o)}
                        className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300 font-semibold hover:text-amber-600">
                        <Package size={13} /> Saved items ({catalog.length})
                      </button>
                      <button onClick={addItem} className="flex items-center gap-1 text-xs text-amber-600 font-semibold hover:text-amber-700">
                        <Plus size={13} /> Add Item
                      </button>
                    </div>
                  </div>

                  {/* The company's permanent item list. Built automatically from
                      every challan saved for this company. */}
                  {catalogOpen && (
                    <div className="mb-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/40 p-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                          Saved items for {selectedCompany?.name ?? "this company"}
                        </p>
                        <button onClick={() => setCatalogOpen(false)} aria-label="Close saved items"
                          className="text-slate-400 hover:text-slate-600">
                          <X size={14} />
                        </button>
                      </div>
                      {catalog.length === 0 ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Nothing saved yet. Every item on a challan you save is added here automatically, and stays
                          available for this company only.
                        </p>
                      ) : (
                        <>
                          <input value={catalogQuery} onChange={(e) => setCatalogQuery(e.target.value)}
                            placeholder="Search saved items…"
                            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 outline-none focus:border-amber-500 mb-2" />
                          <div className="max-h-44 overflow-y-auto flex flex-wrap gap-1.5">
                            {filteredCatalog.map((item) => (
                              <button key={item.id} onClick={() => addFromCatalog(item)}
                                title={`Add ${item.desc}`}
                                className="text-[11px] px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors text-left">
                                <span className="font-semibold">{item.desc}</span>
                                <span className="text-slate-400 ml-1.5">{item.unit}</span>
                              </button>
                            ))}
                            {filteredCatalog.length === 0 && (
                              <p className="text-xs text-slate-400">Nothing matches that search.</p>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-2">
                            Manage this list in{" "}
                            <Link href="/challan/settings" className="text-amber-600 hover:underline">settings</Link>.
                          </p>
                        </>
                      )}
                    </div>
                  )}

                  <datalist id="challan-units">
                    {units.map((u) => <option key={u} value={u} />)}
                  </datalist>

                  <div className="space-y-2">
                    {items.map((item, index) => (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={() => { dragIndex.current = index; }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (dragIndex.current !== null) moveItem(dragIndex.current, index);
                          dragIndex.current = null;
                        }}
                        className="rounded-lg border border-slate-100 dark:border-slate-700 p-2"
                      >
                        <div className="grid grid-cols-12 gap-2 items-center">
                          <span className="col-span-1 flex items-center justify-center text-slate-300 cursor-grab active:cursor-grabbing" title="Drag to reorder">
                            <GripVertical size={14} />
                          </span>
                          <input value={item.desc} onChange={(e) => updateItem(item.id, "desc", e.target.value)}
                            placeholder="Item description" list="challan-catalog-descs"
                            className="col-span-5 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:border-amber-500" />
                          <input type="number" inputMode="decimal" min={0} value={item.qty}
                            onChange={(e) => updateItem(item.id, "qty", e.target.value)}
                            aria-label="Quantity"
                            className="col-span-2 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:border-amber-500 text-center" />
                          <input value={item.unit} list="challan-units"
                            onChange={(e) => updateItem(item.id, "unit", e.target.value)}
                            aria-label="Unit" placeholder="Unit"
                            className="col-span-3 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:border-amber-500 uppercase" />
                          <div className="col-span-1 flex items-center justify-end gap-0.5">
                            <button onClick={() => removeItem(item.id)} aria-label="Remove line item"
                              className="text-red-400 hover:text-red-600">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {showRemarks && (
                          <input value={item.remarks ?? ""} onChange={(e) => updateItem(item.id, "remarks", e.target.value)}
                            placeholder="Remarks (batch no., condition…)"
                            className="mt-2 w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:border-amber-500" />
                        )}

                        {/* Reordering by button as well as by drag — dragging is
                            unavailable on touch and to keyboard users. */}
                        <div className="flex items-center gap-1 mt-1.5">
                          <button onClick={() => moveItem(index, index - 1)} disabled={index === 0}
                            aria-label="Move item up"
                            className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:hover:text-slate-400">
                            <ChevronUp size={13} />
                          </button>
                          <button onClick={() => moveItem(index, index + 1)} disabled={index === items.length - 1}
                            aria-label="Move item down"
                            className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:hover:text-slate-400">
                            <ChevronDown size={13} />
                          </button>
                          <span className="text-[11px] text-slate-400 ml-1">Item {padCount(index + 1)}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Typing into any description offers the company's saved items. */}
                  <datalist id="challan-catalog-descs">
                    {catalog.map((i) => <option key={i.id} value={i.desc} />)}
                  </datalist>

                  <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-700/40 px-3 py-2.5">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Total items <b className="text-slate-800 dark:text-slate-100">{padCount(totals.items)}</b>
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Total quantity <b className="text-slate-800 dark:text-slate-100">{totals.display}</b>
                    </span>
                  </div>
                  {totals.quantity === null && totals.items > 0 && (
                    <p className="text-[11px] text-slate-400 mt-1.5">
                      Your items use different units, so quantities aren&apos;t added together — 10 KG and 5 NOS isn&apos;t 15 of anything.
                    </p>
                  )}
                </div>

                {/* Declaration */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Declaration</h3>
                  <textarea value={declaration} onChange={(e) => { setDeclaration(e.target.value); setDirty(true); }} rows={3}
                    className={cn(inputClass, "resize-none")} />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Saved with this challan. Change the default for new challans in{" "}
                    <Link href="/challan/settings" className="text-amber-600 hover:underline">settings</Link>.
                  </p>
                </div>

                {/* Signatures */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">Receiver&apos;s Signature</h3>
                    <p className="text-[11px] text-slate-400 mb-2">
                      Signed by whoever takes delivery. It belongs to this challan only and is never reused.
                    </p>
                    <SignaturePad value={receiverSignature} onChange={(v) => { setReceiverSignature(v); setDirty(true); }} />
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">Your Signature</h3>
                    {supplierSignature ? (
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={supplierSignature} alt="Your saved signature" className="h-12 w-32 object-contain bg-white rounded border border-slate-200" />
                        <Link href="/challan/settings" className="text-xs text-amber-600 font-semibold hover:underline">Change</Link>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        No signature saved yet.{" "}
                        <Link href="/challan/settings" className="text-amber-600 font-semibold hover:underline">Add one</Link>{" "}
                        and it will appear on every challan automatically.
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* ── Preview and actions ── */}
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
                className="space-y-4 lg:sticky lg:top-4">

                <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Preview</h3>
                    <span className="text-[11px] text-slate-400">
                      {dirty ? "Unsaved changes" : challanId ? "Saved" : "Not saved yet"}
                    </span>
                  </div>
                  <div className="rounded-lg overflow-hidden ring-1 ring-slate-200 dark:ring-slate-700 bg-white">
                    <ChallanPreview data={pdfData} />
                  </div>
                  {templateId !== "premium" && (
                    <p className="text-[11px] text-slate-400 mt-2">
                      Preview shows the Premium design. Your PDF will use{" "}
                      <b>{CHALLAN_TEMPLATES.find((t) => t.id === templateId)?.name}</b>.
                    </p>
                  )}
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm">
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">Challan design</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {CHALLAN_TEMPLATES.map((t) => {
                      const active = t.id === templateId;
                      return (
                        <button key={t.id} type="button" aria-pressed={active}
                          onClick={() => { setTemplateId(t.id); setPreferredTemplate(t.id); setDirty(true); }}
                          className={cn(
                            "text-left rounded-xl border p-3 transition-colors",
                            active ? "border-amber-400 bg-amber-50 dark:bg-amber-900/20"
                                   : "border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500"
                          )}>
                          <span className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: `rgb(${t.accent.join(",")})` }} />
                            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{t.name}</span>
                          </span>
                          <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">{t.description}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <button onClick={handleDownload}
                      className="col-span-2 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm py-3 rounded-xl transition-colors shadow-md shadow-amber-200 dark:shadow-amber-900/30">
                      <Download size={15} /> Save &amp; Download PDF
                    </button>
                    <button onClick={handlePrint}
                      className="flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-semibold text-xs py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                      <Printer size={14} /> Print
                    </button>
                    <button onClick={handleSave}
                      className="flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-semibold text-xs py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                      <Save size={14} /> Save only
                    </button>
                    <button onClick={handleDuplicate}
                      title="Save this one, then start a copy with a new number"
                      className="flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-semibold text-xs py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                      <Copy size={14} /> Duplicate
                    </button>
                    <button
                      onClick={() => {
                        localStorage.setItem(INVOICE_PREFILL_KEY, JSON.stringify({
                          billTo: form.deliverTo,
                          items: items.map(({ desc, qty }) => ({ desc, qty: Number(qty) || 0 })),
                        }));
                        router.push("/invoice");
                      }}
                      title="Convert this challan into an invoice"
                      className="flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-semibold text-xs py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                      <ArrowRightLeft size={14} /> To Invoice
                    </button>
                  </div>

                  <p className="flex items-start gap-1.5 text-[11px] text-slate-400 mt-3">
                    <CheckCircle size={12} className="shrink-0 mt-0.5 text-emerald-500" />
                    Challans are stored in this browser only — nothing is uploaded.
                  </p>
                </div>
              </motion.div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
