"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopNav } from "@/components/layout/TopNav";
import {
  ScanLine, Camera, Upload, X, Loader2, FileText, FileOutput, Receipt,
  Clipboard, FileSpreadsheet, Type, Languages, Wand2, Download, RotateCw,
  Sun, Contrast, Sparkles, CheckCircle, AlertCircle, ChevronDown, ArrowLeft,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "@/components/ui/Skeleton";
import { showToast } from "@/lib/toast";
import { addHistoryItem } from "@/lib/history";
import { parseChallanText } from "@/lib/parseChallanText";
import {
  exportHighQualityPdf, exportCompressedPdf, exportSearchablePdf,
  exportToWord, exportToExcel, exportToText, enhanceImage,
} from "@/lib/scanExport";

const CONVERT_API = process.env.NEXT_PUBLIC_CONVERT_API_URL ?? "";
const CONVERT_API_KEY = process.env.NEXT_PUBLIC_CONVERT_API_KEY;
const OCR_API_KEY = process.env.NEXT_PUBLIC_OCR_API_KEY || "helloworld";
const INVOICE_PREFILL_KEY = "doclify_invoice_prefill";
const CHALLAN_PREFILL_KEY = "doclify_challan_prefill";

type Stage = "capture" | "processing" | "results";
type OcrWord = { text: string; left: number; top: number; width: number; height: number };

const LANGUAGES = ["Hindi", "Spanish", "French", "German", "Arabic", "Chinese", "Japanese", "Portuguese", "Russian", "Bengali", "Tamil", "Telugu", "Marathi", "Gujarati"];

export default function ScanPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("capture");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [ocrWords, setOcrWords] = useState<OcrWord[]>([]);
  const [docType, setDocType] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<string | null>(null);
  const [processingError, setProcessingError] = useState("");

  const [enhanceOpen, setEnhanceOpen] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [sharpen, setSharpen] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [enhancing, setEnhancing] = useState(false);

  const [translateOpen, setTranslateOpen] = useState(false);
  const [targetLang, setTargetLang] = useState("Hindi");
  const [translating, setTranslating] = useState(false);
  const [translatedText, setTranslatedText] = useState("");

  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [pdfMenuOpen, setPdfMenuOpen] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Assign the stream to the <video> element once it's actually mounted (cameraOpen renders it),
  // instead of racing a fixed setTimeout against React's render — fixes a blank camera feed on slower devices.
  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraOpen]);

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      showToast("Camera capture isn't supported in this browser. Use Upload Image instead.", "error");
      return;
    }
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      } catch {
        // Desktops often have no "environment"-facing camera — retry with any available camera.
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }
      streamRef.current = stream;
      setCameraOpen(true);
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      const message =
        name === "NotFoundError" ? "No camera found on this device. Use Upload Image instead." :
        name === "NotAllowedError" ? "Camera permission was denied. Allow camera access in your browser's site settings, then try again." :
        name === "NotReadableError" ? "Your camera is already in use by another app. Close it and try again." :
        "Couldn't access your camera. Use Upload Image instead.";
      showToast(message, "error");
    }
  };

  const capturePhoto = async () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    const rawDataUrl = canvas.toDataURL("image/jpeg", 0.92);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setCameraOpen(false);
    try {
      const dataUrl = await compressForUpload(rawDataUrl);
      setImage(dataUrl);
      processDocument(dataUrl);
    } catch {
      setImage(rawDataUrl);
      processDocument(rawDataUrl);
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setCameraOpen(false);
  };

  /** OCR.space's free tier rejects files over 1MB — downscale large phone-camera photos before sending. */
  const compressForUpload = (dataUrl: string): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        const maxDim = 2000;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width *= scale;
          height *= scale;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        let quality = 0.85;
        let result = canvas.toDataURL("image/jpeg", quality);
        // Rough size check (base64 is ~33% larger than raw bytes) — keep shrinking quality until under ~900KB raw.
        while (result.length * 0.75 > 900_000 && quality > 0.3) {
          quality -= 0.1;
          result = canvas.toDataURL("image/jpeg", quality);
        }
        resolve(result);
      };
      img.onerror = reject;
      img.src = dataUrl;
    });

  const handleFileUpload = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const rawDataUrl = e.target?.result as string;
      try {
        const dataUrl = await compressForUpload(rawDataUrl);
        setImage(dataUrl);
        processDocument(dataUrl);
      } catch {
        setImage(rawDataUrl);
        processDocument(rawDataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], filename, { type: blob.type });
  }

  const processDocument = async (dataUrl: string) => {
    setStage("processing");
    setProcessingError("");
    try {
      const file = await dataUrlToFile(dataUrl, "scan.jpg");

      const ocrPromise = (async () => {
        const body = new FormData();
        body.append("file", file);
        body.append("apikey", OCR_API_KEY);
        body.append("language", "eng");
        body.append("isOverlayRequired", "true");
        body.append("scale", "true");
        body.append("OCREngine", "2");
        const resp = await fetch("https://api.ocr.space/parse/image", { method: "POST", body });
        const data = await resp.json();
        if (data.IsErroredOnProcessing) throw new Error(data.ErrorMessage?.[0] ?? "Couldn't read this document. Try a clearer, well-lit photo.");
        const result = data.ParsedResults?.[0];
        const text = (result?.ParsedText ?? "").trim();
        const words: OcrWord[] = (result?.TextOverlay?.Lines ?? []).flatMap((line: { Words: { WordText: string; Left: number; Top: number; Width: number; Height: number }[] }) =>
          line.Words.map((w) => ({ text: w.WordText, left: w.Left, top: w.Top, width: w.Width, height: w.Height }))
        );
        return { text, words };
      })();

      const classifyPromise = (async () => {
        if (!CONVERT_API) return null;
        try {
          const body = new FormData();
          body.append("file", file);
          const resp = await fetch(`${CONVERT_API}/ai/classify-document`, {
            method: "POST",
            headers: CONVERT_API_KEY ? { "x-api-key": CONVERT_API_KEY } : undefined,
            body,
          });
          if (!resp.ok) return null;
          return await resp.json();
        } catch {
          return null;
        }
      })();

      const [ocrResult, classifyResult] = await Promise.all([ocrPromise, classifyPromise]);

      if (!ocrResult.text) throw new Error("No readable text found. Try a clearer, well-lit photo.");
      setExtractedText(ocrResult.text);
      setOcrWords(ocrResult.words);
      setDocType(classifyResult?.type ?? null);
      setConfidence(classifyResult?.confidence ?? null);
      setStage("results");
      addHistoryItem("ocr", `Scan — ${classifyResult?.type ?? "Document"}`, `${ocrResult.text.split(/\s+/).filter(Boolean).length} words`);
    } catch (err) {
      setProcessingError(err instanceof Error ? err.message : "Something went wrong processing this document.");
      setStage("capture");
    }
  };

  const reset = () => {
    setStage("capture");
    setImage(null);
    setExtractedText("");
    setOcrWords([]);
    setDocType(null);
    setConfidence(null);
    setTranslatedText("");
    setEnhanceOpen(false);
    setTranslateOpen(false);
  };

  // ── Actions ──
  const handleConvertToWord = async () => {
    setBusyAction("word");
    try {
      await exportToWord(extractedText, "scanned-document.docx");
      showToast("Word document downloaded. Best-effort text extraction — complex layouts/tables may need manual touch-up.", "success");
    } finally { setBusyAction(null); }
  };

  const handleConvertToPdf = async (variant: "high" | "searchable" | "compressed") => {
    if (!image) return;
    setBusyAction(`pdf-${variant}`);
    try {
      if (variant === "high") await exportHighQualityPdf(image, "scan-hq.pdf");
      else if (variant === "compressed") await exportCompressedPdf(image, "scan-compressed.pdf");
      else await exportSearchablePdf(image, "scan-searchable.pdf", ocrWords);
      showToast("PDF downloaded.", "success");
    } finally { setBusyAction(null); }
  };

  const handleConvertToInvoice = async () => {
    if (!image) return;
    if (!CONVERT_API) { showToast("AI extraction service is not configured.", "error"); return; }
    setBusyAction("invoice");
    try {
      const file = await dataUrlToFile(image, "scan.jpg");
      const body = new FormData();
      body.append("file", file);
      const resp = await fetch(`${CONVERT_API}/ai/invoice-from-image`, {
        method: "POST",
        headers: CONVERT_API_KEY ? { "x-api-key": CONVERT_API_KEY } : undefined,
        body,
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? "Couldn't extract invoice details.");
      localStorage.setItem(INVOICE_PREFILL_KEY, JSON.stringify(data));
      showToast("Extracted! Opening Invoice Maker to review before saving.", "success");
      router.push("/invoice");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't extract invoice details.", "error");
    } finally { setBusyAction(null); }
  };

  const handleConvertToChallan = () => {
    const parsed = parseChallanText(extractedText);
    if (parsed.items.length === 0 && !parsed.deliverTo) {
      showToast("Couldn't find challan details in this scan. Try the manual Challan Maker instead.", "error");
      return;
    }
    localStorage.setItem(CHALLAN_PREFILL_KEY, JSON.stringify(parsed));
    showToast("Extracted! Opening Challan Maker to review before saving.", "success");
    router.push("/challan");
  };

  const handleConvertToExcel = () => {
    exportToExcel(extractedText, "scanned-table.xlsx");
    showToast("Excel file downloaded. Works best on clearly gridded tables.", "success");
  };

  const handleExtractText = () => {
    exportToText(extractedText, "extracted-text.txt");
    showToast("Text file downloaded.", "success");
  };

  const handleEnhance = async () => {
    if (!image) return;
    setEnhancing(true);
    try {
      const updated = await enhanceImage(image, { brightness, contrast, sharpen, rotate: rotation });
      setImage(updated);
      showToast("Enhancement applied. Re-scanning text from the updated image…", "success");
      await processDocument(updated);
    } finally {
      setEnhancing(false);
    }
  };

  const handleTranslate = async () => {
    if (!CONVERT_API) { showToast("Translation service not configured.", "error"); return; }
    setTranslating(true);
    try {
      const resp = await fetch(`${CONVERT_API}/ai/translate`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(CONVERT_API_KEY ? { "x-api-key": CONVERT_API_KEY } : {}) },
        body: JSON.stringify({ text: extractedText, targetLanguage: targetLang }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? "Translation failed.");
      setTranslatedText(data.translatedText);
      showToast(`Translated to ${targetLang}.`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Translation failed.", "error");
    } finally {
      setTranslating(false);
    }
  };

  const actionCards = [
    { key: "word", icon: FileText, color: "from-blue-500 to-blue-700", label: "Convert to Word", onClick: handleConvertToWord },
    { key: "pdf", icon: FileOutput, color: "from-red-500 to-rose-600", label: "Convert to PDF", onClick: () => setPdfMenuOpen((o) => !o) },
    { key: "invoice", icon: Receipt, color: "from-emerald-500 to-emerald-700", label: "Convert to Invoice", onClick: handleConvertToInvoice },
    { key: "challan", icon: Clipboard, color: "from-amber-500 to-orange-600", label: "Convert to Challan", onClick: handleConvertToChallan },
    { key: "excel", icon: FileSpreadsheet, color: "from-teal-500 to-green-600", label: "Convert to Excel", onClick: handleConvertToExcel },
    { key: "text", icon: Type, color: "from-slate-500 to-slate-700", label: "Extract Text", onClick: handleExtractText },
    { key: "translate", icon: Languages, color: "from-violet-500 to-purple-700", label: "Translate", onClick: () => setTranslateOpen((o) => !o) },
    { key: "enhance", icon: Wand2, color: "from-cyan-500 to-teal-600", label: "Enhance Scan", onClick: () => setEnhanceOpen((o) => !o) },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopNav onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-4xl mx-auto space-y-6">

            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <ScanLine size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                  AtyaDoc Scan <span className="text-[10px] font-bold uppercase tracking-wide bg-gradient-to-r from-amber-400 to-orange-500 text-black px-2 py-0.5 rounded-full">Premium</span>
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">Scan any document, detect its type, and convert it instantly</p>
              </div>
            </motion.div>

            {/* ── Capture stage ── */}
            {stage === "capture" && !cameraOpen && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-10 text-center"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); handleFileUpload(e.dataTransfer.files?.[0]); }}>
                <ScanLine size={48} className="text-indigo-200 dark:text-indigo-800 mx-auto mb-4" />
                <p className="font-bold text-slate-700 dark:text-slate-200 mb-1">Scan or upload a document</p>
                <p className="text-sm text-slate-400 mb-6">Drag &amp; drop an image here, or choose an option below</p>
                {processingError && (
                  <div className="flex items-center gap-2 justify-center text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-2.5 mb-6 max-w-md mx-auto">
                    <AlertCircle size={15} className="shrink-0" /> {processingError}
                  </div>
                )}
                <div className="flex items-center justify-center gap-3 flex-wrap">
                  <button onClick={startCamera}
                    className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm px-6 py-3.5 rounded-xl shadow-md shadow-indigo-200 dark:shadow-indigo-900/30 transition-all">
                    <Camera size={17} /> Open Camera
                  </button>
                  <label className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-sm px-6 py-3.5 rounded-xl cursor-pointer transition-colors">
                    <Upload size={17} /> Upload Image
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e.target.files?.[0])} />
                  </label>
                </div>
              </motion.div>
            )}

            {/* ── Camera view ── */}
            {cameraOpen && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-black rounded-2xl overflow-hidden relative">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video ref={videoRef} autoPlay playsInline muted className="w-full max-h-[60vh] object-contain" />
                <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-4">
                  <button onClick={stopCamera} aria-label="Cancel" className="w-12 h-12 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center">
                    <X size={20} />
                  </button>
                  <button onClick={capturePhoto} aria-label="Capture photo" className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-lg">
                    <div className="w-12 h-12 rounded-full border-4 border-slate-800" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── Processing stage ── */}
            {stage === "processing" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="bg-white dark:bg-slate-800 rounded-2xl p-10 text-center border border-slate-100 dark:border-slate-700">
                {image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt="Scanned document" className="max-h-48 mx-auto rounded-xl mb-6 shadow-md" />
                )}
                <Loader2 size={32} className="text-indigo-500 animate-spin mx-auto mb-3" />
                <p className="font-bold text-slate-700 dark:text-slate-200">Processing your document...</p>
                <p className="text-xs text-slate-400 mt-1">Extracting text &amp; detecting document type</p>
                <div className="max-w-sm mx-auto mt-6 space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-4/5 mx-auto" />
                  <Skeleton className="h-3 w-3/5 mx-auto" />
                </div>
              </motion.div>
            )}

            {/* ── Results stage ── */}
            {stage === "results" && image && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <button onClick={reset} className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                  <ArrowLeft size={13} /> Scan another document
                </button>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-3 sm:col-span-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image} alt="Scanned document" className="w-full rounded-xl object-contain max-h-64" />
                  </div>
                  <div className="sm:col-span-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5">
                    <p className="text-xs text-slate-400 mb-2">Document Detected</p>
                    {docType ? (
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-lg font-black text-slate-800 dark:text-white">{docType}</span>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          confidence === "high" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                          confidence === "medium" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                          "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                        }`}>{confidence ?? "unknown"} confidence</span>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 mb-3">Type detection unavailable — you can still use any action below.</p>
                    )}
                    <p className="text-xs text-slate-400 mb-1">Extracted text preview</p>
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed">{extractedText}</p>
                  </div>
                </div>

                {/* Action cards */}
                <div>
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">Choose an action</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {actionCards.map((card) => (
                      <button key={card.key} onClick={card.onClick} disabled={busyAction === card.key}
                        className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all text-left disabled:opacity-60">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center mb-3`}>
                          {busyAction === card.key ? <Loader2 size={18} className="text-white animate-spin" /> : <card.icon size={18} className="text-white" />}
                        </div>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{card.label}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* PDF variant menu */}
                {pdfMenuOpen && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5">
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">PDF Type</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {([
                        { variant: "high" as const, label: "High Quality PDF" },
                        { variant: "searchable" as const, label: "Searchable PDF" },
                        { variant: "compressed" as const, label: "Compressed PDF" },
                      ]).map((opt) => (
                        <button key={opt.variant} onClick={() => handleConvertToPdf(opt.variant)} disabled={busyAction === `pdf-${opt.variant}`}
                          className="flex items-center justify-center gap-1.5 text-xs font-semibold bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 disabled:opacity-60 text-slate-700 dark:text-slate-200 py-3 rounded-xl">
                          {busyAction === `pdf-${opt.variant}` && <Loader2 size={13} className="animate-spin" />}
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Translate panel */}
                {translateOpen && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5">
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">Translate extracted text</h4>
                    <p className="text-[11px] text-slate-400 mb-3">Works best when the scanned document is in English.</p>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="relative flex-1">
                        <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)}
                          className="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 outline-none pr-8">
                          {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                        </select>
                        <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                      <button onClick={handleTranslate} disabled={translating}
                        className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white font-bold text-xs px-4 py-2.5 rounded-xl">
                        {translating ? <Loader2 size={13} className="animate-spin" /> : <Languages size={13} />} Translate
                      </button>
                    </div>
                    {translatedText && (
                      <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 space-y-2">
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{translatedText}</p>
                        <button onClick={() => exportToText(translatedText, `translated-${targetLang.toLowerCase()}.txt`)}
                          className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-700">
                          <Download size={12} /> Download translation
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Enhance panel */}
                {enhanceOpen && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 space-y-4">
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">Enhance Scan</h4>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 flex items-center gap-1.5"><Sun size={12} /> Brightness ({brightness}%)</label>
                      <input type="range" min={50} max={150} value={brightness} onChange={(e) => setBrightness(+e.target.value)} className="w-full accent-cyan-600" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 flex items-center gap-1.5"><Contrast size={12} /> Contrast ({contrast}%)</label>
                      <input type="range" min={50} max={150} value={contrast} onChange={(e) => setContrast(+e.target.value)} className="w-full accent-cyan-600" />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                        <input type="checkbox" checked={sharpen} onChange={(e) => setSharpen(e.target.checked)} className="accent-cyan-600" />
                        <Sparkles size={12} /> Sharpen text
                      </label>
                      <button onClick={() => setRotation((r) => (r + 90) % 360)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-3 py-1.5 rounded-lg">
                        <RotateCw size={13} /> Rotate 90°
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Manual controls — automatic edge detection, background/shadow removal, and noise reduction aren&apos;t available yet.
                    </p>
                    <button onClick={handleEnhance} disabled={enhancing}
                      className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white font-bold text-sm py-3 rounded-xl">
                      {enhancing ? <><Loader2 size={15} className="animate-spin" /> Applying…</> : <><CheckCircle size={15} /> Apply &amp; Re-scan</>}
                    </button>
                  </motion.div>
                )}
              </motion.div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
