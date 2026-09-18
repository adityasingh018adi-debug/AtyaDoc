"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopNav } from "@/components/layout/TopNav";
import {
  Settings, Upload, Trash2, AlertCircle, ArrowLeft, PenLine, ImageIcon, ChevronDown, Package, Plus,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { SignaturePad } from "@/components/ui/SignaturePad";
import {
  getSupplierSignature, setSupplierSignature, removeSupplierSignature, validateImageFile,
  getNumbering, setNumbering, formatChallanNumber, DEFAULT_NUMBERING, type NumberingConfig,
  getDeclaration, setDeclaration, DEFAULT_DECLARATION, getUnits,
} from "@/lib/challanSettings";
import {
  getCompanies, updateCompany, getLastUsedCompanyId, setLastUsedCompanyId, type CompanyProfile,
} from "@/lib/companyProfile";
import {
  getCatalog, addCatalogItem, deleteCatalogItem, type CatalogItem,
} from "@/lib/challanItems";
import { cn } from "@/lib/utils";
import { showToast } from "@/lib/toast";

export default function ChallanSettingsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [signature, setSignature] = useState<string | null>(null);
  const [sigMode, setSigMode] = useState<"draw" | "upload">("draw");
  const [sigError, setSigError] = useState("");
  /** Editing keeps the saved signature until a new one replaces it, so backing
   *  out of "Change" doesn't quietly leave the business without one. */
  const [editingSig, setEditingSig] = useState(false);
  const [confirmRemoveSig, setConfirmRemoveSig] = useState(false);

  const [companies, setCompanies] = useState<CompanyProfile[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [logoError, setLogoError] = useState("");
  const [confirmRemoveLogo, setConfirmRemoveLogo] = useState(false);

  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [newItem, setNewItem] = useState({ desc: "", unit: "NOS" });
  const [units, setUnits] = useState<string[]>([]);

  const [numbering, setNumberingState] = useState<NumberingConfig>(DEFAULT_NUMBERING);
  const [declaration, setDeclarationState] = useState("");

  const sigFileRef = useRef<HTMLInputElement>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSignature(getSupplierSignature());
    setNumberingState(getNumbering());
    setDeclarationState(getDeclaration());
    setUnits(getUnits());
    const list = getCompanies();
    setCompanies(list);
    const last = getLastUsedCompanyId();
    setCompanyId(last && list.some((c) => c.id === last) ? last : list[0]?.id ?? "");
  }, []);

  useEffect(() => {
    if (companyId) setCatalog(getCatalog(companyId));
  }, [companyId]);

  const company = companies.find((c) => c.id === companyId);

  /* ── Signature ─────────────────────────────────────────────────────────── */

  const commitSignature = (dataUrl: string | null) => {
    setSignature(dataUrl);
    setEditingSig(false);
    if (dataUrl) setSupplierSignature(dataUrl);
    else removeSupplierSignature();
  };

  /** Read an image file into a data URL after validating type and size. */
  const readImage = (
    file: File | undefined,
    kind: "signature" | "logo",
    onError: (msg: string) => void,
    onDone: (dataUrl: string) => void
  ) => {
    onError("");
    if (!file) return;
    const problem = validateImageFile(file, kind);
    if (problem) { onError(problem); return; }
    const reader = new FileReader();
    reader.onload = () => onDone(reader.result as string);
    reader.onerror = () => onError("That file couldn't be read. Try another image.");
    reader.readAsDataURL(file);
  };

  const handleRemoveSignature = () => {
    commitSignature(null);
    setConfirmRemoveSig(false);
    if (sigFileRef.current) sigFileRef.current.value = "";
    showToast("Signature removed.", "success");
  };

  /* ── Company logo ──────────────────────────────────────────────────────── */

  const saveLogo = (dataUrl: string | null) => {
    if (!companyId) return;
    updateCompany(companyId, { logo: dataUrl ?? undefined });
    setCompanies(getCompanies());
    if (logoFileRef.current) logoFileRef.current.value = "";
  };

  const handleRemoveLogo = () => {
    saveLogo(null);
    setConfirmRemoveLogo(false);
    showToast("Logo removed from this company.", "success");
  };

  /* ── Saved items ───────────────────────────────────────────────────────── */

  const handleAddItem = () => {
    if (!newItem.desc.trim() || !companyId) return;
    addCatalogItem(companyId, { desc: newItem.desc, unit: newItem.unit });
    setCatalog(getCatalog(companyId));
    setNewItem({ desc: "", unit: newItem.unit });
  };

  const handleDeleteItem = (id: string) => {
    deleteCatalogItem(id);
    setCatalog(getCatalog(companyId));
  };

  /* ── Numbering ─────────────────────────────────────────────────────────── */

  const saveNumbering = (next: NumberingConfig) => {
    setNumberingState(next);
    setNumbering(next);
  };

  const inputClass =
    "w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:border-amber-500 transition-colors";
  const cardClass =
    "bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm";
  const ghostButton =
    "flex-1 flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-semibold text-xs py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors";

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopNav onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-2xl mx-auto space-y-5">

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
              <Link href="/challan" aria-label="Back to the challan maker"
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <ArrowLeft size={16} />
              </Link>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <Settings size={18} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-800 dark:text-white leading-tight">Challan Settings</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">Set these once; every new challan uses them.</p>
              </div>
            </motion.div>

            {/* Company picker — logo and item list are both per company */}
            <div className={cardClass}>
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">Company</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-3">
                The logo and the saved item list below belong to whichever company is selected here. One device can
                issue challans for several businesses without their lists mixing.
              </p>
              <div className="relative">
                <select value={companyId}
                  onChange={(e) => { setCompanyId(e.target.value); setLastUsedCompanyId(e.target.value); setLogoError(""); }}
                  className={cn(inputClass, "appearance-none pr-8")}>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Company logo */}
            <div className={cardClass}>
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <ImageIcon size={14} /> Company Logo
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-3">
                Printed inside the FROM box on the challan, next to {company?.name ?? "this company"}&apos;s name. The
                heading itself stays as DELIVERY CHALLAN — a gate clerk reads the document type first, not the brand.
              </p>

              {company?.logo ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white p-3 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={company.logo} alt={`${company.name} logo`} className="h-20 object-contain" />
                  </div>
                  <div className="flex gap-2">
                    <label className={cn(ghostButton, "cursor-pointer")}>
                      <PenLine size={14} /> Replace
                      <input ref={logoFileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                        onChange={(e) => readImage(e.target.files?.[0], "logo", setLogoError, (url) => {
                          saveLogo(url);
                          showToast("Logo updated.", "success");
                        })} />
                    </label>
                    <button onClick={() => setConfirmRemoveLogo(true)}
                      className="flex-1 flex items-center justify-center gap-1.5 border border-red-200 dark:border-red-800 text-red-600 font-semibold text-xs py-2.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                      <Trash2 size={14} /> Remove
                    </button>
                  </div>
                </div>
              ) : (
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer rounded-xl border border-dashed border-slate-300 dark:border-slate-600 px-4 py-6 justify-center hover:border-amber-400 transition-colors">
                  <Upload size={15} />
                  Choose a logo image
                  <input ref={logoFileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                    onChange={(e) => readImage(e.target.files?.[0], "logo", setLogoError, (url) => {
                      saveLogo(url);
                      showToast("Logo saved for this company.", "success");
                    })} />
                </label>
              )}
              <p className="text-[11px] text-slate-400 mt-1.5">
                PNG, JPG or WebP under 1 MB. Wide wordmarks and square emblems both work — the logo is scaled to fit
                without being stretched.
              </p>

              {logoError && (
                <div className="mt-3 flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2.5 text-xs text-red-600 dark:text-red-400">
                  <AlertCircle size={13} className="shrink-0 mt-0.5" /> {logoError}
                </div>
              )}
            </div>

            {/* Saved items */}
            <div className={cardClass}>
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Package size={14} /> Saved Items — {company?.name ?? "—"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-3">
                Every item on a challan you save is added here automatically, so the list builds itself. Pick from it on
                the challan form instead of retyping — which also keeps one spelling per product, so quantities still
                add up instead of reporting &ldquo;Mixed Units&rdquo;.
              </p>

              <div className="flex gap-2">
                <input value={newItem.desc} onChange={(e) => setNewItem((p) => ({ ...p, desc: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddItem(); }}
                  placeholder="Add an item by hand…" className={inputClass} />
                <input value={newItem.unit} list="settings-units"
                  onChange={(e) => setNewItem((p) => ({ ...p, unit: e.target.value }))}
                  aria-label="Unit" placeholder="Unit"
                  className={cn(inputClass, "w-24 shrink-0 uppercase")} />
                <datalist id="settings-units">
                  {units.map((u) => <option key={u} value={u} />)}
                </datalist>
                <button onClick={handleAddItem} disabled={!newItem.desc.trim()}
                  className="shrink-0 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-700 text-black font-bold text-xs px-3 rounded-lg transition-colors">
                  <Plus size={14} />
                </button>
              </div>

              {catalog.length === 0 ? (
                <p className="text-xs text-slate-400 mt-3">Nothing saved for this company yet.</p>
              ) : (
                <div className="mt-3 max-h-72 overflow-y-auto flex flex-col gap-1.5">
                  {catalog.map((item) => (
                    <div key={item.id}
                      className="flex items-center gap-2 rounded-lg border border-slate-100 dark:border-slate-700 px-3 py-2">
                      <span className="flex-1 min-w-0 text-xs text-slate-700 dark:text-slate-200 truncate">{item.desc}</span>
                      <span className="text-[11px] text-slate-400 shrink-0">{item.unit}</span>
                      {item.storageTemp && (
                        <span className="text-[10px] text-slate-400 shrink-0 hidden sm:inline">{item.storageTemp}</span>
                      )}
                      <button onClick={() => handleDeleteItem(item.id)} aria-label={`Remove ${item.desc}`}
                        className="text-slate-400 hover:text-red-600 shrink-0">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Supplier signature */}
            <div className={cardClass}>
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">Your Signature</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-3">
                Printed in the &ldquo;Authorised Signatory&rdquo; box on every challan. The receiver signs separately on
                each delivery — the two are never mixed.
              </p>

              {signature && !editingSig ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white p-3 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={signature} alt="Your saved signature" className="h-20 object-contain" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingSig(true); setSigError(""); }} className={ghostButton}>
                      <PenLine size={14} /> Change
                    </button>
                    <button onClick={() => setConfirmRemoveSig(true)}
                      className="flex-1 flex items-center justify-center gap-1.5 border border-red-200 dark:border-red-800 text-red-600 font-semibold text-xs py-2.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                      <Trash2 size={14} /> Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex bg-slate-100 dark:bg-slate-700 rounded-xl p-1 w-fit">
                    {(["draw", "upload"] as const).map((mode) => (
                      <button key={mode} onClick={() => { setSigMode(mode); setSigError(""); }}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                          sigMode === mode ? "bg-amber-500 text-black shadow-sm" : "text-slate-500 dark:text-slate-400"
                        )}>
                        {mode === "draw" ? "Draw" : "Upload"}
                      </button>
                    ))}
                  </div>

                  {sigMode === "draw" ? (
                    <SignaturePad value={null} onChange={(v) => {
                      if (!v) return;
                      commitSignature(v);
                      showToast("Signature saved.", "success");
                    }} />
                  ) : (
                    <div>
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer rounded-xl border border-dashed border-slate-300 dark:border-slate-600 px-4 py-6 justify-center hover:border-amber-400 transition-colors">
                        <Upload size={15} />
                        Choose a signature image
                        <input ref={sigFileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                          onChange={(e) => readImage(e.target.files?.[0], "signature", setSigError, (url) => {
                            commitSignature(url);
                            showToast("Signature saved.", "success");
                          })} />
                      </label>
                      <p className="text-[11px] text-slate-400 mt-1.5">
                        PNG, JPG or WebP, under 1 MB. A transparent PNG sits best on the signature line.
                      </p>
                    </div>
                  )}

                  {sigError && (
                    <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2.5 text-xs text-red-600 dark:text-red-400">
                      <AlertCircle size={13} className="shrink-0 mt-0.5" /> {sigError}
                    </div>
                  )}

                  {editingSig && (
                    <button onClick={() => { setEditingSig(false); setSigError(""); }}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-700">
                      Keep the signature I already have
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Numbering */}
            <div className={cardClass}>
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">Challan Numbering</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-3">
                New challans take the next number automatically. The counter only moves when a challan is saved.
              </p>

              <div className="space-y-3">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer">
                  <input type="checkbox" checked={numbering.usePrefix} className="accent-amber-500"
                    onChange={(e) => saveNumbering({ ...numbering, usePrefix: e.target.checked })} />
                  Use a prefix
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Prefix</label>
                    <input value={numbering.prefix} disabled={!numbering.usePrefix}
                      onChange={(e) => saveNumbering({ ...numbering, prefix: e.target.value })}
                      placeholder="CH-" className={cn(inputClass, !numbering.usePrefix && "opacity-50")} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Next number</label>
                    <input type="number" min={1} value={numbering.next}
                      onChange={(e) => saveNumbering({ ...numbering, next: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                      className={inputClass} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Digits</label>
                    <input type="number" min={1} max={8} value={numbering.pad}
                      onChange={(e) => saveNumbering({ ...numbering, pad: Math.min(8, Math.max(1, parseInt(e.target.value, 10) || 1)) })}
                      className={inputClass} />
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 dark:bg-slate-700/40 px-3 py-2.5 text-xs text-slate-500 dark:text-slate-400">
                  Next challan will be{" "}
                  <b className="text-slate-800 dark:text-slate-100 font-mono">{formatChallanNumber(numbering.next, numbering)}</b>
                </div>
              </div>
            </div>

            {/* Declaration */}
            <div className={cardClass}>
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">Default Declaration</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-3">
                Printed at the foot of new challans. You can still edit it on any individual challan; challans you
                already saved keep the wording they were saved with.
              </p>
              <textarea value={declaration} rows={3}
                onChange={(e) => { setDeclarationState(e.target.value); setDeclaration(e.target.value); }}
                className={cn(inputClass, "resize-none")} />
              {declaration.trim() !== DEFAULT_DECLARATION && (
                <button onClick={() => { setDeclarationState(DEFAULT_DECLARATION); setDeclaration(DEFAULT_DECLARATION); }}
                  className="text-xs text-amber-600 font-semibold hover:underline mt-2">
                  Reset to the standard wording
                </button>
              )}
            </div>
          </div>
        </main>
      </div>

      <AnimatePresence>
        {(confirmRemoveSig || confirmRemoveLogo) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
            onClick={() => { setConfirmRemoveSig(false); setConfirmRemoveLogo(false); }}>
            <motion.div initial={{ scale: 0.96 }} animate={{ scale: 1 }} exit={{ scale: 0.96 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 rounded-2xl p-5 max-w-sm w-full">
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-slate-800 dark:text-white">
                    {confirmRemoveLogo ? "Remove this company's logo?" : "Remove your signature?"}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {confirmRemoveLogo
                      ? "New challans for this company will print without it. Other companies keep their own logos, and challans you already downloaded are unaffected."
                      : "New challans will print an empty signature line until you add one again. Challans you already downloaded are unaffected."}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={confirmRemoveLogo ? handleRemoveLogo : handleRemoveSignature}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors">
                  Remove
                </button>
                <button onClick={() => { setConfirmRemoveSig(false); setConfirmRemoveLogo(false); }}
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
