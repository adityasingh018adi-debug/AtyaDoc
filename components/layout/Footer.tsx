"use client";

import Link from "next/link";
import { FileText, FileOutput, Receipt, Clipboard, ScanText, BookOpen, Sparkles, Heart } from "lucide-react";

const tools = [
  { label: "Word to PDF",        href: "/word-to-pdf" },
  { label: "PDF to Word",        href: "/pdf-to-word" },
  { label: "AI Invoice Maker",   href: "/invoice"     },
  { label: "AI Challan Maker",   href: "/challan"     },
  { label: "OCR Scanner",        href: "/ocr"         },
  { label: "Khatabook (Ledger)", href: "/ledger"      },
];

const company = [
  { label: "Templates",    href: "/templates" },
  { label: "Recent Files", href: "/recent"    },
  { label: "Activity",     href: "/admin"     },
];

const legal = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Use",   href: "/terms"   },
  { label: "Contact",        href: "/contact" },
];

export function Footer() {
  return (
    <footer className="mt-8 border-t border-slate-200 dark:border-slate-800 pt-8 pb-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-8">

        {/* Brand */}
        <div className="col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2.5 mb-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo.svg" alt="AtyaDoc" className="w-9 h-9 rounded-xl shadow-md" />
            <span className="font-black bg-gradient-to-r from-violet-500 to-blue-500 bg-clip-text text-transparent text-lg">
              AtyaDoc
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            All-in-one document &amp; business tool. Convert, invoice, scan — everything in one place.
          </p>
          <div className="flex items-center gap-1.5 mt-3">
            <Sparkles size={11} className="text-amber-400" />
            <span className="text-[10px] text-slate-400">Powered by AtyaDoc</span>
          </div>
        </div>

        {/* Tools */}
        <div>
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">Tools</p>
          <ul className="space-y-2">
            {tools.map((t) => (
              <li key={t.href}>
                <Link href={t.href} className="text-xs text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors">
                  {t.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Company */}
        <div>
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">Product</p>
          <ul className="space-y-2">
            {company.map((t) => (
              <li key={t.href}>
                <Link href={t.href} className="text-xs text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors">
                  {t.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Legal */}
        <div>
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">Legal</p>
          <ul className="space-y-2">
            {legal.map((t) => (
              <li key={t.href}>
                <Link href={t.href} className="text-xs text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors">
                  {t.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
        <p className="text-[11px] text-slate-400 flex items-center gap-1">
          © {new Date().getFullYear()} AtyaDoc · Made with <Heart size={10} className="text-red-400 fill-red-400" /> in India
        </p>
        <p className="text-[11px] text-slate-400">
          Free · Fast · Secure · No login required
        </p>
      </div>
    </footer>
  );
}
