"use client";

import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopNav } from "@/components/layout/TopNav";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import {
  Receipt, Plus, Trash2, Download, Sparkles, Search, ChevronDown,
  CheckCircle, AlertCircle, Printer, Loader2, X, Camera, FileText as FileTextIcon,
  Bookmark, Mail, Copy, Share2,
} from "lucide-react";
import { motion } from "framer-motion";
import { downloadInvoicePdfAdvanced } from "@/lib/generatePdf";
import { addHistoryItem } from "@/lib/history";
import { getCompanies, getLastUsedCompanyId, setLastUsedCompanyId, type CompanyProfile } from "@/lib/companyProfile";
import { getCustomers, addCustomer, searchCustomers, type Customer } from "@/lib/customers";
import { getProducts, searchProducts, type Product } from "@/lib/products";
import {
  saveInvoice, nextInvoiceNumber, computeInvoiceTotals, getInvoice,
  type InvoiceRecord, type InvoiceLineItem, type PaymentStatus,
} from "@/lib/invoices";
import { getItemTemplates, saveItemTemplate, deleteItemTemplate, type ItemTemplate } from "@/lib/itemTemplates";
import { showToast } from "@/lib/toast";
import { Skeleton } from "@/components/ui/Skeleton";

const INVOICE_EDIT_KEY = "doclify_invoice_edit_id";
const INVOICE_PREFILL_KEY = "doclify_invoice_prefill";
const CONVERT_API = process.env.NEXT_PUBLIC_CONVERT_API_URL ?? "";
const CONVERT_API_KEY = process.env.NEXT_PUBLIC_CONVERT_API_KEY;

type AiExtractedItem = { desc: string; qty: number; rate: number; gstPercent?: number; hsn?: string };
type AiExtractedInvoice = { billTo?: string; gstin?: string; notes?: string; items?: AiExtractedItem[] };

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const STATUS_OPTIONS: { value: PaymentStatus; label: string; color: string }[] = [
  { value: "draft", label: "Draft", color: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300" },
  { value: "pending", label: "Pending", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  { value: "paid", label: "Paid", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  { value: "partial", label: "Partial", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  { value: "overdue", label: "Overdue", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
];

const TEMPLATE_PREVIEW: Record<InvoiceRecord["template"], { title: string; headerClass: string; accentClass: string; fontClass: string }> = {
  modern: { title: "INVOICE", headerClass: "bg-slate-900 text-white", accentClass: "text-emerald-600", fontClass: "" },
  minimal: { title: "Invoice", headerClass: "bg-transparent text-slate-800 dark:text-white border-b border-slate-200 dark:border-slate-700", accentClass: "text-slate-800 dark:text-white", fontClass: "" },
  professional: { title: "INVOICE", headerClass: "bg-transparent text-slate-800 dark:text-white border-b-2 border-slate-800 dark:border-slate-300", accentClass: "text-slate-800 dark:text-white", fontClass: "font-serif" },
  gst: { title: "TAX INVOICE", headerClass: "bg-emerald-700 text-white", accentClass: "text-emerald-700", fontClass: "" },
  restaurant: { title: "BILL", headerClass: "bg-transparent text-slate-800 dark:text-white text-center", accentClass: "text-slate-800 dark:text-white", fontClass: "font-mono" },
  retail: { title: "RETAIL INVOICE", headerClass: "bg-violet-600 text-white", accentClass: "text-violet-600", fontClass: "" },
  wholesale: { title: "WHOLESALE INVOICE", headerClass: "bg-amber-50 dark:bg-amber-900/20 text-slate-800 dark:text-white border-l-4 border-amber-600", accentClass: "text-amber-600", fontClass: "" },
};

export default function InvoicePage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saved">("idle");
  const [downloading, setDownloading] = useState(false);

  const [companies, setCompanies] = useState<CompanyProfile[]>([]);
  const [companyId, setCompanyId] = useState("");

  const [items, setItems] = useState<InvoiceLineItem[]>([
    { id: uid(), desc: "Web Development Services", qty: 1, rate: 45000, gstPercent: 18 },
    { id: uid(), desc: "UI/UX Design", qty: 1, rate: 20000, gstPercent: 18 },
  ]);

  const [form, setForm] = useState({
    invoiceNo: "",
    date: new Date().toISOString().slice(0, 10),
    dueDate: "",
    poNumber: "",
    deliveryDate: "",
    billTo: "Sharma Electronics\n123, MG Road\nNew Delhi - 110001",
    gstin: "07AABCS1234F1ZN",
    notes: "",
    terms: "Payment due within 15 days of invoice date.",
    discountType: "percent" as "percent" | "flat",
    discountValue: 0,
    shipping: 0,
    roundOff: true,
    taxMode: "cgst-sgst" as "cgst-sgst" | "igst",
    status: "draft" as PaymentStatus,
    template: "modern" as InvoiceRecord["template"],
  });

  // Customer picker
  const [customerId, setCustomerId] = useState<string | undefined>(undefined);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Product picker
  const [productQuery, setProductQuery] = useState("");
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  useEffect(() => {
    const list = getCompanies();
    setCompanies(list);
    const lastUsed = getLastUsedCompanyId();
    setCompanyId(lastUsed && list.some((c) => c.id === lastUsed) ? lastUsed : list[0]?.id ?? "");

    // Editing an existing invoice
    const editId = localStorage.getItem(INVOICE_EDIT_KEY);
    if (editId) {
      localStorage.removeItem(INVOICE_EDIT_KEY);
      const record = getInvoice(editId);
      if (record) {
        setEditingId(record.id);
        setItems(record.items);
        setForm({
          invoiceNo: record.invoiceNo, date: record.date, dueDate: record.dueDate ?? "",
          poNumber: record.poNumber ?? "", deliveryDate: record.deliveryDate ?? "",
          billTo: record.billTo, gstin: record.gstin, notes: record.notes ?? "", terms: record.terms ?? "",
          discountType: record.discountType, discountValue: record.discountValue, shipping: record.shipping,
          roundOff: record.roundOff, taxMode: record.taxMode, status: record.status, template: record.template,
        });
        setCompanyId(record.companyId);
        setCustomerId(record.customerId);
        setHydrated(true);
        return;
      }
    }

    // Prefill from a converted challan or AtyaDoc Scan
    const prefillRaw = localStorage.getItem(INVOICE_PREFILL_KEY);
    if (prefillRaw) {
      localStorage.removeItem(INVOICE_PREFILL_KEY);
      try {
        const prefill = JSON.parse(prefillRaw) as {
          billTo?: string; gstin?: string; notes?: string;
          items?: { desc: string; qty: number; rate?: number; gstPercent?: number; hsn?: string }[];
        };
        if (prefill.billTo) setForm((f) => ({ ...f, billTo: prefill.billTo! }));
        if (prefill.gstin) setForm((f) => ({ ...f, gstin: prefill.gstin! }));
        if (prefill.notes) setForm((f) => ({ ...f, notes: prefill.notes! }));
        if (prefill.items?.length) {
          setItems(prefill.items.map((i) => ({
            id: uid(), desc: i.desc, qty: i.qty, rate: i.rate ?? 0, gstPercent: i.gstPercent ?? 18, hsn: i.hsn,
          })));
        }
      } catch { /* ignore */ }
    }

    setForm((f) => ({ ...f, invoiceNo: nextInvoiceNumber() }));
    setHydrated(true);
  }, []);

  const selectedCompany = companies.find((c) => c.id === companyId);

  const totals = useMemo(() => computeInvoiceTotals({
    items, discountType: form.discountType, discountValue: form.discountValue,
    shipping: form.shipping, roundOff: form.roundOff, taxMode: form.taxMode,
  }), [items, form.discountType, form.discountValue, form.shipping, form.roundOff, form.taxMode]);

  const fmt = (n: number) => "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n);

  // ── Customer search ──
  useEffect(() => {
    if (!showCustomerDropdown) return;
    setCustomerResults(customerQuery ? searchCustomers(customerQuery) : getCustomers().slice(0, 8));
  }, [customerQuery, showCustomerDropdown]);

  const selectCustomer = (c: Customer) => {
    setCustomerId(c.id);
    setForm((f) => ({ ...f, billTo: [c.name, c.address].filter(Boolean).join("\n"), gstin: c.gst ?? f.gstin }));
    setCustomerQuery("");
    setShowCustomerDropdown(false);
  };

  const quickAddCustomerFromQuery = () => {
    if (!customerQuery.trim()) return;
    const created = addCustomer({ name: customerQuery.trim() });
    selectCustomer(created);
  };

  // ── Product search ──
  useEffect(() => {
    if (!showProductDropdown) return;
    setProductResults(productQuery ? searchProducts(productQuery) : getProducts().slice(0, 8));
  }, [productQuery, showProductDropdown]);

  const addProductAsLine = (p: Product) => {
    setItems((prev) => [...prev, { id: uid(), productId: p.id, desc: p.name, hsn: p.hsn, qty: 1, rate: p.sellingPrice, gstPercent: p.gstPercent }]);
    setProductQuery("");
    setShowProductDropdown(false);
  };

  // ── AI Fill (text or photo) ──
  const [aiOpen, setAiOpen] = useState(false);
  const [aiTab, setAiTab] = useState<"text" | "photo">("text");
  const [aiText, setAiText] = useState("");
  const [aiPhoto, setAiPhoto] = useState<File | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiSuccess, setAiSuccess] = useState("");

  const applyAiResult = (result: AiExtractedInvoice) => {
    if (result.billTo) setForm((f) => ({ ...f, billTo: result.billTo! }));
    if (result.gstin) setForm((f) => ({ ...f, gstin: result.gstin! }));
    if (result.notes) setForm((f) => ({ ...f, notes: result.notes! }));
    if (result.items && result.items.length > 0) {
      setItems(result.items.map((i) => ({
        id: uid(), desc: i.desc, qty: i.qty || 1, rate: i.rate || 0,
        gstPercent: i.gstPercent ?? 18, hsn: i.hsn || undefined,
      })));
    }
    setCustomerId(undefined);
    const msg = `Filled ${result.items?.length ?? 0} item${(result.items?.length ?? 0) !== 1 ? "s" : ""} with AI.`;
    setAiSuccess(msg);
    showToast(msg, "success");
    setTimeout(() => { setAiSuccess(""); setAiOpen(false); }, 2000);
  };

  const handleAiFromText = async () => {
    if (!aiText.trim()) { setAiError("Describe the invoice first."); return; }
    if (!CONVERT_API) { setAiError("AI service is not configured."); return; }
    setAiLoading(true); setAiError("");
    try {
      const resp = await fetch(`${CONVERT_API}/ai/invoice-from-text`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(CONVERT_API_KEY ? { "x-api-key": CONVERT_API_KEY } : {}) },
        body: JSON.stringify({ text: aiText }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? `Server error ${resp.status}`);
      applyAiResult(data);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI Fill failed. Try rephrasing.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleAiFromPhoto = async () => {
    if (!aiPhoto) { setAiError("Choose a photo first."); return; }
    if (!CONVERT_API) { setAiError("AI service is not configured."); return; }
    setAiLoading(true); setAiError("");
    try {
      const body = new FormData();
      body.append("file", aiPhoto);
      const resp = await fetch(`${CONVERT_API}/ai/invoice-from-image`, {
        method: "POST",
        headers: CONVERT_API_KEY ? { "x-api-key": CONVERT_API_KEY } : undefined,
        body,
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? `Server error ${resp.status}`);
      applyAiResult(data);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI scan failed. Try a clearer photo.");
    } finally {
      setAiLoading(false);
    }
  };

  const addItem = () => setItems((prev) => [...prev, { id: uid(), desc: "", qty: 1, rate: 0, gstPercent: 18 }]);
  const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));
  const updateItem = (id: string, field: keyof InvoiceLineItem, value: string | number) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)));

  // ── Item templates (save/load reusable line-item sets) ──
  const [itemTemplates, setItemTemplates] = useState<ItemTemplate[]>([]);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");

  useEffect(() => {
    setItemTemplates(getItemTemplates());
  }, []);

  const handleSaveItemTemplate = () => {
    if (!templateName.trim()) return;
    saveItemTemplate(templateName, items.map(({ desc, hsn, qty, rate, gstPercent }) => ({ desc, hsn, qty, rate, gstPercent })));
    setItemTemplates(getItemTemplates());
    setTemplateName("");
    setShowSaveTemplate(false);
    showToast("Saved as a reusable item template.", "success");
  };

  const handleLoadItemTemplate = (t: ItemTemplate) => {
    setItems(t.items.map((i) => ({ id: uid(), ...i })));
    setShowTemplateDropdown(false);
    showToast(`Loaded "${t.name}" template.`, "success");
  };

  const handleDeleteItemTemplate = (id: string) => {
    deleteItemTemplate(id);
    setItemTemplates(getItemTemplates());
  };

  // ── Sharing ──
  const buildShareText = () =>
    `Invoice ${form.invoiceNo}\nBill To: ${form.billTo.split("\n")[0]}\n` +
    items.map((i) => `${i.desc} x${i.qty} — ${fmt(i.qty * i.rate)}`).join("\n") +
    `\nTotal: ${fmt(totals.total)}`;

  const handleShareWhatsapp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(buildShareText())}`, "_blank");
  };
  const handleShareEmail = () => {
    window.location.href = `mailto:?subject=${encodeURIComponent(`Invoice ${form.invoiceNo}`)}&body=${encodeURIComponent(buildShareText())}`;
  };
  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(buildShareText());
      showToast("Invoice summary copied to clipboard.", "success");
    } catch {
      showToast("Couldn't copy — try again.", "error");
    }
  };

  const buildRecordPayload = (status: PaymentStatus): Omit<InvoiceRecord, "id" | "createdAt" | "updatedAt"> & { id?: string } => ({
    id: editingId ?? undefined,
    invoiceNo: form.invoiceNo, date: form.date, dueDate: form.dueDate || undefined,
    poNumber: form.poNumber || undefined, deliveryDate: form.deliveryDate || undefined,
    companyId, customerId, billTo: form.billTo, gstin: form.gstin, items,
    discountType: form.discountType, discountValue: form.discountValue, shipping: form.shipping,
    roundOff: form.roundOff, taxMode: form.taxMode, notes: form.notes || undefined, terms: form.terms || undefined,
    status, template: form.template,
  });

  const handleSaveDraft = () => {
    const record = saveInvoice(buildRecordPayload(form.status === "draft" ? "draft" : form.status));
    setEditingId(record.id);
    setSaveState("saved");
    showToast("Invoice saved.", "success");
    setTimeout(() => setSaveState("idle"), 2500);
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const record = saveInvoice(buildRecordPayload(form.status));
      setEditingId(record.id);
      await downloadInvoicePdfAdvanced({
        invoiceNo: form.invoiceNo, date: form.date, dueDate: form.dueDate || undefined,
        poNumber: form.poNumber || undefined, deliveryDate: form.deliveryDate || undefined,
        billTo: form.billTo, gstin: form.gstin,
        items: items.map(({ desc, hsn, qty, rate, gstPercent }) => ({ desc, hsn, qty, rate, gstPercent })),
        fromName: selectedCompany?.name ?? "AtyaDoc Business",
        fromAddress: selectedCompany?.address ?? "Mumbai",
        fromGst: selectedCompany?.gst,
        logo: selectedCompany?.logo,
        discountType: form.discountType, discountValue: form.discountValue, shipping: form.shipping,
        roundOff: form.roundOff, taxMode: form.taxMode, notes: form.notes, terms: form.terms,
        status: form.status, upiId: selectedCompany?.upiId,
        signatureDataUrl: selectedCompany?.signature, stampDataUrl: selectedCompany?.stamp,
        template: form.template,
      });
      addHistoryItem("invoice", `Invoice ${form.invoiceNo}.pdf`, fmt(totals.total));
      showToast("Invoice PDF downloaded.", "success");
    } catch {
      showToast("Couldn't generate the PDF. Try again.", "error");
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => window.print();

  if (!hydrated) return <PageSkeleton sidebarOpen={sidebarOpen} onCloseSidebar={() => setSidebarOpen(false)} />;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopNav onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-24 sm:pb-6">
          <div className="max-w-5xl mx-auto space-y-6">

            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center">
                  <Receipt size={24} className="text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white">{editingId ? "Edit Invoice" : "AI Invoice Maker"}</h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Generate professional GST invoices instantly</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setAiOpen((o) => !o)}
                  className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs px-4 py-2.5 rounded-xl transition-colors">
                  <Sparkles size={13} /> AI Fill
                </button>
                {STATUS_OPTIONS.find((s) => s.value === form.status) && (
                  <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as PaymentStatus }))}
                    className={`text-xs font-bold px-3 py-2 rounded-xl border-0 outline-none cursor-pointer ${STATUS_OPTIONS.find((s) => s.value === form.status)!.color}`}>
                    {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                )}
              </div>
            </motion.div>

            {/* AI Fill panel */}
            {aiOpen && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-amber-200 dark:border-amber-800 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex bg-slate-100 dark:bg-slate-700 rounded-xl p-1">
                    <button onClick={() => { setAiTab("text"); setAiError(""); }}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${aiTab === "text" ? "bg-amber-500 text-black shadow-sm" : "text-slate-500 dark:text-slate-400"}`}>
                      <FileTextIcon size={13} /> Describe in Text
                    </button>
                    <button onClick={() => { setAiTab("photo"); setAiError(""); }}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${aiTab === "photo" ? "bg-amber-500 text-black shadow-sm" : "text-slate-500 dark:text-slate-400"}`}>
                      <Camera size={13} /> Duplicate from Photo
                    </button>
                  </div>
                  <button onClick={() => setAiOpen(false)} aria-label="Close AI Fill" className="text-slate-400 hover:text-slate-600 p-1">
                    <X size={15} />
                  </button>
                </div>

                {aiTab === "text" ? (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Describe the invoice in plain English — AI extracts the customer, items, quantities, prices and GST.
                    </p>
                    <textarea value={aiText} onChange={(e) => setAiText(e.target.value)} rows={3}
                      placeholder="e.g. Bill Sharma Electronics for 2 laptops at ₹45,000 each and 1 printer at ₹8,000, GST 18%, GSTIN 07AABCS1234F1ZN"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:border-amber-500 resize-none" />
                    <button onClick={handleAiFromText} disabled={aiLoading}
                      className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-bold text-xs px-4 py-2 rounded-xl transition-colors">
                      {aiLoading ? <><Loader2 size={13} className="animate-spin" /> Thinking…</> : <><Sparkles size={13} /> Generate Invoice</>}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Upload a photo of a receipt, handwritten note, or existing invoice — AI duplicates the details automatically.
                    </p>
                    <div className="flex items-center gap-2">
                      <input type="file" accept="image/*" onChange={(e) => setAiPhoto(e.target.files?.[0] ?? null)}
                        className="flex-1 text-xs text-slate-600 dark:text-slate-300 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-amber-100 dark:file:bg-amber-900/30 file:text-amber-700 dark:file:text-amber-400 file:text-xs file:font-semibold" />
                      <button onClick={handleAiFromPhoto} disabled={!aiPhoto || aiLoading}
                        className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-200 disabled:text-slate-400 text-black font-bold text-xs px-4 py-2 rounded-xl transition-colors shrink-0">
                        {aiLoading ? <><Loader2 size={13} className="animate-spin" /> Scanning…</> : <><Camera size={13} /> Scan &amp; Fill</>}
                      </button>
                    </div>
                  </div>
                )}

                {aiError && (
                  <div className="mt-3 flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2.5 text-xs text-red-600 dark:text-red-400">
                    <AlertCircle size={13} className="shrink-0 mt-0.5" /> {aiError}
                  </div>
                )}
                {aiSuccess && (
                  <div className="mt-3 flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl px-3 py-2.5 text-xs text-emerald-600 dark:text-emerald-400">
                    <CheckCircle size={13} className="shrink-0" /> {aiSuccess}
                  </div>
                )}
              </motion.div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Form */}
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="space-y-4">

                {/* Template */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm">
                  <label className="text-xs text-slate-500 mb-2 block">PDF Template</label>
                  <div className="grid grid-cols-4 gap-2">
                    {([
                      { value: "modern", label: "Modern" },
                      { value: "minimal", label: "Minimal" },
                      { value: "professional", label: "Professional" },
                      { value: "gst", label: "GST" },
                      { value: "restaurant", label: "Restaurant" },
                      { value: "retail", label: "Retail" },
                      { value: "wholesale", label: "Wholesale" },
                    ] as const).map((t) => (
                      <button key={t.value} onClick={() => setForm((f) => ({ ...f, template: t.value }))}
                        className={`text-xs font-semibold py-2 rounded-lg border transition-all ${
                          form.template === t.value
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-600"
                        }`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Company */}
                {companies.length > 1 && (
                  <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm">
                    <label className="text-xs text-slate-500 mb-1 block">Invoice From</label>
                    <div className="relative">
                      <select value={companyId} onChange={(e) => { setCompanyId(e.target.value); setLastUsedCompanyId(e.target.value); }}
                        className="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 pr-8">
                        {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                )}

                <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Invoice Details</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Invoice No.</label>
                      <input value={form.invoiceNo} onChange={(e) => setForm({ ...form, invoiceNo: e.target.value })}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 transition-colors" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Date</label>
                      <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 transition-colors" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Due Date</label>
                      <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 transition-colors" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">PO Number</label>
                      <input value={form.poNumber} onChange={(e) => setForm({ ...form, poNumber: e.target.value })}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 transition-colors" />
                    </div>
                  </div>

                  {/* Customer search */}
                  <div className="relative">
                    <label className="text-xs text-slate-500 mb-1 block">Bill To</label>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="relative flex-1">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          value={customerQuery}
                          onChange={(e) => { setCustomerQuery(e.target.value); setShowCustomerDropdown(true); }}
                          onFocus={() => setShowCustomerDropdown(true)}
                          placeholder="Search saved customers or type a new name..."
                          className="w-full pl-7 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500" />
                      </div>
                      {showCustomerDropdown && (
                        <button onClick={() => setShowCustomerDropdown(false)} aria-label="Close customer search" className="text-slate-400 p-1">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    {showCustomerDropdown && (
                      <div className="absolute z-20 left-0 right-0 mt-[-4px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                        {customerResults.map((c) => (
                          <button key={c.id} onClick={() => selectCustomer(c)}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-b border-slate-50 dark:border-slate-700/50 last:border-0">
                            <span className="font-semibold">{c.name}</span>
                            {c.gst && <span className="text-slate-400 ml-2">{c.gst}</span>}
                          </button>
                        ))}
                        {customerQuery.trim() && (
                          <button onClick={quickAddCustomerFromQuery}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1.5">
                            <Plus size={12} /> Add &ldquo;{customerQuery.trim()}&rdquo; as new customer
                          </button>
                        )}
                        {customerResults.length === 0 && !customerQuery.trim() && (
                          <p className="text-xs text-slate-400 px-3 py-2">No saved customers yet — type a name to add one.</p>
                        )}
                      </div>
                    )}
                    <textarea value={form.billTo} onChange={(e) => { setForm({ ...form, billTo: e.target.value }); setCustomerId(undefined); }} rows={3}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 transition-colors resize-none" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">GSTIN</label>
                    <input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 transition-colors font-mono" />
                  </div>
                </div>

                {/* Items */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm">
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Line Items</h3>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <button onClick={() => setShowTemplateDropdown((o) => !o)}
                          className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 font-semibold hover:text-slate-700">
                          <Bookmark size={13} /> Templates
                        </button>
                        {showTemplateDropdown && (
                          <div className="absolute z-20 right-0 mt-1 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-56 overflow-y-auto">
                            {itemTemplates.length === 0 ? (
                              <p className="text-xs text-slate-400 px-3 py-3">No saved templates yet.</p>
                            ) : (
                              itemTemplates.map((t) => (
                                <div key={t.id} className="flex items-center justify-between px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 border-b border-slate-50 dark:border-slate-700/50 last:border-0">
                                  <button onClick={() => handleLoadItemTemplate(t)} className="flex-1 text-left text-xs text-slate-700 dark:text-slate-200">
                                    {t.name} <span className="text-slate-400">({t.items.length})</span>
                                  </button>
                                  <button onClick={() => handleDeleteItemTemplate(t.id)} aria-label={`Delete template ${t.name}`} className="text-red-400 hover:text-red-600 p-1">
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              ))
                            )}
                            <button onClick={() => { setShowSaveTemplate(true); setShowTemplateDropdown(false); }}
                              className="w-full text-left px-3 py-2 text-xs text-blue-600 font-semibold hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-1.5 border-t border-slate-100 dark:border-slate-700">
                              <Plus size={12} /> Save current items as template
                            </button>
                          </div>
                        )}
                      </div>
                      <button onClick={addItem} className="flex items-center gap-1 text-xs text-blue-600 font-semibold hover:text-blue-700">
                        <Plus size={13} /> Add Item
                      </button>
                    </div>
                  </div>

                  {showSaveTemplate && (
                    <div className="flex items-center gap-2 mb-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl p-2.5 border border-slate-200 dark:border-slate-600">
                      <input value={templateName} onChange={(e) => setTemplateName(e.target.value)} autoFocus
                        placeholder="Template name (e.g. Standard Web Dev Package)"
                        className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500" />
                      <button onClick={handleSaveItemTemplate} disabled={!templateName.trim()}
                        className="text-xs font-bold bg-blue-600 disabled:bg-slate-300 text-white px-3 py-1.5 rounded-lg">
                        Save
                      </button>
                      <button onClick={() => setShowSaveTemplate(false)} aria-label="Cancel" className="text-slate-400 hover:text-slate-600 p-1">
                        <X size={14} />
                      </button>
                    </div>
                  )}

                  {/* Product search */}
                  <div className="relative mb-3">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={productQuery}
                      onChange={(e) => { setProductQuery(e.target.value); setShowProductDropdown(true); }}
                      onFocus={() => setShowProductDropdown(true)}
                      placeholder="Search products to add instantly..."
                      className="w-full pl-7 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500" />
                    {showProductDropdown && (
                      <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                        {productResults.map((p) => (
                          <button key={p.id} onClick={() => addProductAsLine(p)}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-b border-slate-50 dark:border-slate-700/50 last:border-0 flex items-center justify-between">
                            <span className="font-semibold">{p.name}</span>
                            <span className="text-slate-400">₹{p.sellingPrice}/{p.unit}</span>
                          </button>
                        ))}
                        {productResults.length === 0 && (
                          <p className="text-xs text-slate-400 px-3 py-2">No products found — add some in the Product Library.</p>
                        )}
                        <button onClick={() => setShowProductDropdown(false)} className="w-full text-center px-3 py-1.5 text-[11px] text-slate-400 hover:text-slate-600 border-t border-slate-50 dark:border-slate-700/50">
                          Close
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-12 gap-1 mb-2 px-1">
                    <span className="col-span-5 text-xs text-slate-400">Description</span>
                    <span className="col-span-2 text-xs text-slate-400 text-center">Qty</span>
                    <span className="col-span-2 text-xs text-slate-400">Rate (₹)</span>
                    <span className="col-span-2 text-xs text-slate-400">GST%</span>
                    <span className="col-span-1 text-xs text-slate-400 text-right">Del</span>
                  </div>
                  <div className="space-y-2">
                    {aiLoading && (
                      <>
                        <div className="grid grid-cols-12 gap-1 items-center">
                          <Skeleton className="col-span-5 h-8" /><Skeleton className="col-span-2 h-8" /><Skeleton className="col-span-2 h-8" /><Skeleton className="col-span-2 h-8" /><Skeleton className="col-span-1 h-8" />
                        </div>
                        <div className="grid grid-cols-12 gap-1 items-center">
                          <Skeleton className="col-span-5 h-8" /><Skeleton className="col-span-2 h-8" /><Skeleton className="col-span-2 h-8" /><Skeleton className="col-span-2 h-8" /><Skeleton className="col-span-1 h-8" />
                        </div>
                      </>
                    )}
                    {items.map((item) => (
                      <div key={item.id} className="grid grid-cols-12 gap-1 items-center">
                        <input value={item.desc} onChange={(e) => updateItem(item.id, "desc", e.target.value)}
                          placeholder="Description" className="col-span-5 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500" />
                        <input type="number" value={item.qty} onChange={(e) => updateItem(item.id, "qty", +e.target.value)}
                          className="col-span-2 px-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 text-center" />
                        <input type="number" value={item.rate} onChange={(e) => updateItem(item.id, "rate", +e.target.value)}
                          className="col-span-2 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500" />
                        <input type="number" value={item.gstPercent} onChange={(e) => updateItem(item.id, "gstPercent", +e.target.value)}
                          className="col-span-2 px-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 text-center" />
                        <button onClick={() => removeItem(item.id)} aria-label="Remove line item" className="col-span-1 text-red-400 hover:text-red-600 flex items-center justify-center">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Charges & tax */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm space-y-3">
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Charges &amp; Tax</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Discount</label>
                      <div className="flex gap-1">
                        <input type="number" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: +e.target.value })}
                          className="flex-1 px-2.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500" />
                        <select value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value as "percent" | "flat" })}
                          className="px-2 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 outline-none">
                          <option value="percent">%</option>
                          <option value="flat">₹</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Shipping (₹)</label>
                      <input type="number" value={form.shipping} onChange={(e) => setForm({ ...form, shipping: +e.target.value })}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-slate-500">Tax Type</label>
                    <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
                      <button onClick={() => setForm({ ...form, taxMode: "cgst-sgst" })}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-all ${form.taxMode === "cgst-sgst" ? "bg-white dark:bg-slate-800 shadow-sm text-blue-600" : "text-slate-500"}`}>
                        CGST + SGST
                      </button>
                      <button onClick={() => setForm({ ...form, taxMode: "igst" })}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-all ${form.taxMode === "igst" ? "bg-white dark:bg-slate-800 shadow-sm text-blue-600" : "text-slate-500"}`}>
                        IGST
                      </button>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.roundOff} onChange={(e) => setForm({ ...form, roundOff: e.target.checked })}
                      className="w-4 h-4 rounded accent-blue-600" />
                    <span className="text-xs text-slate-600 dark:text-slate-300">Round off total to nearest rupee</span>
                  </label>
                </div>

                {/* Additional details */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm space-y-3">
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Additional Details</h3>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Delivery Date</label>
                    <input type="date" value={form.deliveryDate} onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Notes</label>
                    <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 resize-none" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Terms &amp; Conditions</label>
                    <textarea value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} rows={2}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 resize-none" />
                  </div>
                </div>
              </motion.div>

              {/* Preview */}
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
                className={`rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm self-start lg:sticky lg:top-4 overflow-hidden bg-white dark:bg-slate-800 ${TEMPLATE_PREVIEW[form.template].fontClass}`}>
                <div className={`flex items-center justify-between p-6 pb-4 mb-2 ${TEMPLATE_PREVIEW[form.template].headerClass}`}>
                  <div>
                    <h2 className="text-lg font-extrabold">{TEMPLATE_PREVIEW[form.template].title}</h2>
                    <p className="text-xs opacity-70">#{form.invoiceNo}</p>
                  </div>
                  {selectedCompany?.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selectedCompany.logo} alt={"logo"} loading="lazy" className="w-10 h-10 rounded-lg object-contain" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                      {(selectedCompany?.name ?? "DA").slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="p-6 pt-0">
                <div className="grid grid-cols-2 gap-4 mb-4 text-xs">
                  <div>
                    <p className="text-slate-400 mb-1">From:</p>
                    <p className="font-semibold text-slate-700 dark:text-slate-200">{selectedCompany?.name ?? "AtyaDoc Business"}</p>
                    <p className="text-slate-500">{selectedCompany?.address ?? "Mumbai"}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 mb-1">Bill To:</p>
                    <p className="font-semibold text-slate-700 dark:text-slate-200 whitespace-pre-line">{form.billTo}</p>
                    <p className="text-slate-500 mt-1 font-mono text-xs">{form.gstin}</p>
                  </div>
                </div>
                {(form.dueDate || form.poNumber) && (
                  <div className="flex gap-4 mb-4 text-xs text-slate-500">
                    {form.dueDate && <span>Due: {form.dueDate}</span>}
                    {form.poNumber && <span>PO#: {form.poNumber}</span>}
                  </div>
                )}
                <table className="w-full text-xs mb-4">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-700">
                      <th className="text-left text-slate-400 py-2 font-medium">Item</th>
                      <th className="text-center text-slate-400 py-2 font-medium">Qty</th>
                      <th className="text-right text-slate-400 py-2 font-medium">Rate</th>
                      <th className="text-right text-slate-400 py-2 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-b border-slate-50 dark:border-slate-800">
                        <td className="py-2 text-slate-700 dark:text-slate-300">{item.desc || "—"}</td>
                        <td className="py-2 text-center text-slate-500">{item.qty}</td>
                        <td className="py-2 text-right text-slate-500">{fmt(item.rate)}</td>
                        <td className="py-2 text-right font-semibold text-slate-700 dark:text-slate-200">{fmt(item.qty * item.rate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="space-y-1 text-xs mb-6">
                  <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{fmt(totals.subtotal)}</span></div>
                  {totals.discount > 0 && <div className="flex justify-between text-slate-500"><span>Discount</span><span>- {fmt(totals.discount)}</span></div>}
                  {form.taxMode === "cgst-sgst" ? (
                    <>
                      <div className="flex justify-between text-slate-500"><span>CGST</span><span>{fmt(totals.cgst)}</span></div>
                      <div className="flex justify-between text-slate-500"><span>SGST</span><span>{fmt(totals.sgst)}</span></div>
                    </>
                  ) : (
                    <div className="flex justify-between text-slate-500"><span>IGST</span><span>{fmt(totals.igst)}</span></div>
                  )}
                  {totals.shipping > 0 && <div className="flex justify-between text-slate-500"><span>Shipping</span><span>{fmt(totals.shipping)}</span></div>}
                  <div className="flex justify-between font-extrabold text-slate-800 dark:text-white text-sm border-t border-slate-100 dark:border-slate-700 pt-2 mt-2">
                    <span>Total</span><span className={TEMPLATE_PREVIEW[form.template].accentClass}>{fmt(totals.total)}</span>
                  </div>
                </div>

                {selectedCompany?.signature && (
                  <div className="flex justify-end mb-4">
                    <div className="text-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={selectedCompany.signature} alt={"Signature"} loading="lazy" className="h-10 mx-auto" />
                      <p className="text-[10px] text-slate-400 border-t border-slate-200 dark:border-slate-700 pt-1 mt-1">Authorised Signatory</p>
                    </div>
                  </div>
                )}

                <div className="hidden sm:flex flex-col gap-2">
                  <button onClick={handleDownload} disabled={downloading}
                    className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-70 text-white font-bold text-sm py-3 rounded-xl transition-colors shadow-md shadow-emerald-200 dark:shadow-emerald-900/30">
                    {downloading ? <><Loader2 size={15} className="animate-spin" /> Generating…</> : <><Download size={15} /> Download Invoice PDF</>}
                  </button>
                  <div className="flex gap-2">
                    <button onClick={handleSaveDraft}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-600 dark:text-slate-300 font-semibold text-xs py-2.5 rounded-xl transition-colors">
                      {saveState === "saved" ? <><CheckCircle size={13} className="text-emerald-500" /> Saved</> : "Save Draft"}
                    </button>
                    <button onClick={handlePrint}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-600 dark:text-slate-300 font-semibold text-xs py-2.5 rounded-xl transition-colors">
                      <Printer size={13} /> Print
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleShareWhatsapp} title="Share via WhatsApp"
                      className="flex-1 flex items-center justify-center gap-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-600 dark:text-slate-300 font-semibold text-xs py-2.5 rounded-xl transition-colors">
                      <Share2 size={13} /> WhatsApp
                    </button>
                    <button onClick={handleShareEmail} title="Share via Email"
                      className="flex-1 flex items-center justify-center gap-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-600 dark:text-slate-300 font-semibold text-xs py-2.5 rounded-xl transition-colors">
                      <Mail size={13} /> Email
                    </button>
                    <button onClick={handleCopySummary} title="Copy invoice summary to clipboard"
                      className="flex-1 flex items-center justify-center gap-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-600 dark:text-slate-300 font-semibold text-xs py-2.5 rounded-xl transition-colors">
                      <Copy size={13} /> Copy
                    </button>
                  </div>
                </div>
                </div>
              </motion.div>
            </div>
          </div>
        </main>

        {/* Sticky mobile action bar */}
        <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 p-3 flex gap-2 z-30">
          <button onClick={handleSaveDraft} className="px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold">
            {saveState === "saved" ? <CheckCircle size={15} className="text-emerald-500" /> : "Draft"}
          </button>
          <button onClick={handleDownload} disabled={downloading}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white font-bold text-sm py-3 rounded-xl">
            {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}
