"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Shield, ArrowLeft, Lock, Eye, Database, Globe, Mail, CheckCircle } from "lucide-react";
import { Footer } from "@/components/layout/Footer";

const sections = [
  {
    icon: Database,
    color: "text-violet-500",
    bg: "bg-violet-50 dark:bg-violet-900/20",
    title: "Information We Collect",
    content: [
      "We do not require you to create an account or log in to use AtyaDoc.",
      "When you upload a file for conversion or OCR processing, it is processed in memory and immediately discarded after the operation. We never store your files on our servers.",
      "We may collect anonymous usage analytics (page views, feature usage) to improve the product. No personally identifiable information is included.",
    ],
  },
  {
    icon: Lock,
    color: "text-emerald-500",
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    title: "How We Use Your Information",
    content: [
      "Uploaded files are used solely to perform the requested conversion or OCR scan and are never read, analyzed, or stored beyond the duration of the request.",
      "Anonymous analytics data helps us understand which features are most used so we can prioritize improvements.",
      "We do not sell, rent, or share your data with third parties for marketing purposes.",
    ],
  },
  {
    icon: Globe,
    color: "text-blue-500",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    title: "Third-Party Services",
    content: [
      "OCR scanning is powered by OCR.space (https://ocr.space). Files sent for OCR are subject to their privacy policy. We use the free public API; please avoid uploading sensitive or confidential documents for OCR.",
      "Document conversion (Word ↔ PDF) is handled by our own Railway-hosted LibreOffice API. Files are processed and deleted immediately.",
      "The frontend is hosted on Cloudflare Pages. Cloudflare may log basic request metadata per their privacy policy.",
    ],
  },
  {
    icon: Eye,
    color: "text-amber-500",
    bg: "bg-amber-50 dark:bg-amber-900/20",
    title: "Cookies & Tracking",
    content: [
      "We use only essential cookies required for the application to function (e.g., theme preference).",
      "We do not use advertising cookies or cross-site tracking.",
      "You can clear cookies at any time through your browser settings without affecting core functionality.",
    ],
  },
  {
    icon: Shield,
    color: "text-rose-500",
    bg: "bg-rose-50 dark:bg-rose-900/20",
    title: "Data Security",
    content: [
      "All data in transit is encrypted via HTTPS/TLS.",
      "Uploaded files are processed in isolated, ephemeral environments and are never written to persistent storage.",
      "We follow industry best practices to protect the infrastructure powering AtyaDoc.",
    ],
  },
  {
    icon: Mail,
    color: "text-cyan-500",
    bg: "bg-cyan-50 dark:bg-cyan-900/20",
    title: "Contact Us",
    content: [
      "If you have any questions about this Privacy Policy or how we handle your data, please reach out:",
      "Email: adityasingh018adi@gmail.com",
      "We will respond to privacy-related inquiries within 7 business days.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
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
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shadow-lg shadow-violet-200 dark:shadow-violet-900/40">
              <Shield size={26} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-800 dark:text-white">Privacy Policy</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Last updated: June 2026</p>
            </div>
          </div>
          <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-2xl px-5 py-4">
            <div className="flex items-start gap-3">
              <CheckCircle size={17} className="text-violet-500 shrink-0 mt-0.5" />
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                <strong>Short version:</strong> AtyaDoc does not store your files. We don&apos;t require sign-up, we don&apos;t sell your data, and we never read your documents. Your privacy is our default.
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

        {/* Footer note */}
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          className="text-xs text-center text-slate-400 mt-10 mb-8">
          This policy may be updated from time to time. Continued use of AtyaDoc after changes constitutes acceptance of the updated policy.
        </motion.p>

        <Footer />
      </div>
    </div>
  );
}
