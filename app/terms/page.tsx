"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { FileText, ArrowLeft, AlertTriangle, CheckCircle, XCircle, Scale, RefreshCw, Info } from "lucide-react";
import { Footer } from "@/components/layout/Footer";

const sections = [
  {
    icon: CheckCircle,
    color: "text-emerald-500",
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    title: "Acceptance of Terms",
    content: [
      "By accessing or using AtyaDoc (atyadoc.in), you agree to be bound by these Terms of Use.",
      "If you do not agree to these terms, please discontinue use of the service immediately.",
      "These terms apply to all visitors, users, and anyone who accesses AtyaDoc.",
    ],
  },
  {
    icon: Info,
    color: "text-blue-500",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    title: "Description of Service",
    content: [
      "AtyaDoc is a free, browser-based document utility offering: Word to PDF conversion, PDF to Word conversion, OCR (optical character recognition), AI Invoice & Challan generation, and a business ledger (Khatabook).",
      "The service is provided free of charge on an as-is, as-available basis.",
      "We reserve the right to modify, suspend, or discontinue any feature at any time without notice.",
    ],
  },
  {
    icon: CheckCircle,
    color: "text-violet-500",
    bg: "bg-violet-50 dark:bg-violet-900/20",
    title: "Acceptable Use",
    content: [
      "You may use AtyaDoc for lawful personal, educational, or business purposes.",
      "You agree not to upload files containing malware, viruses, or malicious code.",
      "You agree not to attempt to reverse-engineer, scrape, or abuse the service's APIs or infrastructure.",
      "You are solely responsible for the content of files you upload and for ensuring you have the right to process them.",
    ],
  },
  {
    icon: XCircle,
    color: "text-rose-500",
    bg: "bg-rose-50 dark:bg-rose-900/20",
    title: "Prohibited Activities",
    content: [
      "Processing files that contain illegal, harmful, or offensive content.",
      "Using AtyaDoc to infringe on the intellectual property rights of others.",
      "Uploading confidential or classified government/military documents through third-party OCR services.",
      "Automated bulk processing that places excessive load on the service without prior permission.",
    ],
  },
  {
    icon: AlertTriangle,
    color: "text-amber-500",
    bg: "bg-amber-50 dark:bg-amber-900/20",
    title: "Disclaimer of Warranties",
    content: [
      "AtyaDoc is provided \"as is\" without warranties of any kind, express or implied.",
      "We do not guarantee that conversions will be 100% perfect or that all formatting will be preserved.",
      "OCR accuracy depends on image quality and is not guaranteed. Always review extracted text before use.",
      "We are not responsible for data loss resulting from conversion errors or service downtime.",
    ],
  },
  {
    icon: Scale,
    color: "text-slate-500",
    bg: "bg-slate-50 dark:bg-slate-800/40",
    title: "Limitation of Liability",
    content: [
      "To the maximum extent permitted by law, AtyaDoc and its creators shall not be liable for any indirect, incidental, or consequential damages arising from your use of the service.",
      "Our total liability to you for any claim related to AtyaDoc shall not exceed the amount you have paid us (which is zero, as the service is free).",
      "Some jurisdictions do not allow limitation of liability — in such cases the above may not fully apply to you.",
    ],
  },
  {
    icon: RefreshCw,
    color: "text-cyan-500",
    bg: "bg-cyan-50 dark:bg-cyan-900/20",
    title: "Changes to These Terms",
    content: [
      "We may update these Terms of Use at any time. Changes will be effective immediately upon posting.",
      "Continued use of AtyaDoc after changes constitutes your acceptance of the revised terms.",
      "For questions or concerns about these terms, contact us at adityasingh018adi@gmail.com.",
    ],
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="max-w-3xl mx-auto px-4 py-10 sm:py-16">

        {/* Back */}
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="mb-8">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-violet-600 transition-colors font-medium">
            <ArrowLeft size={15} /> Back to AtyaDoc
          </Link>
        </motion.div>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-200 dark:shadow-blue-900/40">
              <Scale size={26} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-800 dark:text-white">Terms of Use</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Last updated: June 2026</p>
            </div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl px-5 py-4">
            <div className="flex items-start gap-3">
              <FileText size={17} className="text-blue-500 shrink-0 mt-0.5" />
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                Please read these terms carefully before using AtyaDoc. They govern your use of the service and outline our mutual rights and responsibilities.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Sections */}
        <div className="space-y-6">
          {sections.map((s, i) => (
            <motion.div key={s.title}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i }}
              className="bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm">
              <div className={`flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-700 ${s.bg}`}>
                <s.icon size={18} className={s.color} />
                <h2 className="font-black text-slate-800 dark:text-white text-base">{s.title}</h2>
              </div>
              <ul className="px-5 py-4 space-y-3">
                {s.content.map((c, j) => (
                  <li key={j} className="flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 mt-2 shrink-0" />
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{c}</p>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          className="text-xs text-center text-slate-400 mt-10 mb-8">
          These terms are governed by applicable laws. By using AtyaDoc, you agree to resolve disputes amicably via email before seeking legal remedies.
        </motion.p>

        <Footer />
      </div>
    </div>
  );
}
