"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopNav } from "@/components/layout/TopNav";
import { motion } from "framer-motion";
import { Check, Crown, Sparkles } from "lucide-react";

const plans = [
  {
    name: "Free",
    price: "₹0",
    period: "forever",
    highlight: false,
    features: [
      "Word ↔ PDF conversion",
      "OCR scanning (limited)",
      "AI Invoice & Challan maker",
      "Khatabook ledger",
      "Up to 50 MB per file",
    ],
  },
  {
    name: "Pro",
    price: "₹299",
    period: "/month",
    highlight: true,
    features: [
      "Unlimited conversions",
      "Advanced OCR (25+ languages)",
      "Bulk document processing",
      "No watermark on exports",
      "Priority email support",
    ],
  },
];

export default function UpgradePage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopNav onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-4xl mx-auto space-y-6">

            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              className="text-center max-w-xl mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-200 dark:shadow-amber-900/30">
                <Crown size={26} className="text-white" />
              </div>
              <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white">Upgrade to AtyaDoc Pro</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">
                Pro is coming soon. Leave your email and we&apos;ll notify you the moment it launches.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {plans.map((plan, i) => (
                <motion.div key={plan.name}
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                  className={`rounded-2xl p-6 border shadow-sm ${
                    plan.highlight
                      ? "bg-gradient-to-br from-slate-900 to-blue-950 text-white border-transparent"
                      : "bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700"
                  }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className={`text-lg font-bold ${plan.highlight ? "text-white" : "text-slate-800 dark:text-white"}`}>
                      {plan.name}
                    </h3>
                    {plan.highlight && <Sparkles size={15} className="text-amber-400" />}
                  </div>
                  <p className="mb-5">
                    <span className={`text-3xl font-extrabold ${plan.highlight ? "text-white" : "text-slate-800 dark:text-white"}`}>
                      {plan.price}
                    </span>
                    <span className={`text-sm ${plan.highlight ? "text-slate-400" : "text-slate-500 dark:text-slate-400"}`}> {plan.period}</span>
                  </p>
                  <ul className="space-y-2.5 mb-6">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <Check size={15} className={`shrink-0 mt-0.5 ${plan.highlight ? "text-amber-400" : "text-emerald-500"}`} />
                        <span className={plan.highlight ? "text-slate-200" : "text-slate-600 dark:text-slate-300"}>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    disabled
                    className={`w-full font-bold text-sm py-2.5 rounded-xl transition-colors cursor-not-allowed opacity-80 ${
                      plan.highlight
                        ? "bg-amber-500 text-black"
                        : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300"
                    }`}>
                    {plan.highlight ? "Coming Soon" : "Current Plan"}
                  </button>
                </motion.div>
              ))}
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
