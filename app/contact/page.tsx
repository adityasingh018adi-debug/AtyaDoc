"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, ArrowLeft, MessageCircle, Code2, Sparkles, Send } from "lucide-react";
import { Footer } from "@/components/layout/Footer";
import { useState } from "react";

export default function ContactPage() {
  const [copied, setCopied] = useState(false);

  const copyEmail = () => {
    navigator.clipboard.writeText("adityasingh018adi@gmail.com");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="max-w-2xl mx-auto px-4 py-10 sm:py-16">

        {/* Back */}
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="mb-8">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-violet-600 transition-colors font-medium">
            <ArrowLeft size={15} /> Back to AtyaDoc
          </Link>
        </motion.div>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shadow-lg shadow-violet-200 dark:shadow-violet-900/40 mx-auto mb-4">
            <MessageCircle size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white mb-2">Get in Touch</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
            Have a question, found a bug, or want to suggest a feature?<br />
            We&apos;d love to hear from you.
          </p>
        </motion.div>

        {/* Contact cards */}
        <div className="space-y-4">

          {/* Email */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center">
                <Mail size={18} className="text-violet-500" />
              </div>
              <div>
                <p className="font-bold text-slate-800 dark:text-white text-sm">Email</p>
                <p className="text-xs text-slate-400">Best way to reach us</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700 rounded-xl px-4 py-3">
              <p className="flex-1 text-sm font-mono text-slate-700 dark:text-slate-200">
                adityasingh018adi@gmail.com
              </p>
              <button onClick={copyEmail}
                className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-800 dark:text-violet-400 transition-colors">
                {copied ? "Copied!" : <><Send size={11} /> Copy</>}
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
              <Sparkles size={10} className="text-amber-400" />
              We respond within 48 hours on business days.
            </p>
          </motion.div>

          {/* GitHub */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                <Code2 size={18} className="text-slate-700 dark:text-slate-300" />
              </div>
              <div>
                <p className="font-bold text-slate-800 dark:text-white text-sm">GitHub Issues</p>
                <p className="text-xs text-slate-400">Report bugs or request features</p>
              </div>
            </div>
            <a
              href="https://github.com/adityasingh018adi-debug/convertai/issues"
              target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-slate-700 dark:hover:bg-slate-100 transition-colors w-full">
              <Code2 size={13} /> Open an Issue on GitHub
            </a>
          </motion.div>

          {/* FAQ */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="bg-violet-50 dark:bg-violet-900/20 rounded-2xl border border-violet-100 dark:border-violet-800 p-5">
            <p className="font-bold text-slate-800 dark:text-white text-sm mb-3">Frequently Asked Questions</p>
            <div className="space-y-3">
              {[
                { q: "Is AtyaDoc completely free?", a: "Yes — all tools are free with no sign-up required." },
                { q: "Are my files stored on your servers?", a: "No. Files are processed in memory and deleted immediately after conversion." },
                { q: "What file size limits apply?", a: "Up to 50 MB for Word ↔ PDF conversions. Up to 5 MB for OCR scanning." },
                { q: "Which languages does OCR support?", a: "English by default, with 25+ languages available via OCR.space." },
              ].map(({ q, a }) => (
                <div key={q} className="text-sm">
                  <p className="font-semibold text-slate-700 dark:text-slate-200">{q}</p>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 leading-relaxed">{a}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        <div className="mt-10">
          <Footer />
        </div>
      </div>
    </div>
  );
}
