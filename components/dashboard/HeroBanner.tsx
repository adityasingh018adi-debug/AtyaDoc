"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Zap, Shield, Clock, Users } from "lucide-react";

// Load Three.js scene client-only (no SSR)
const HeroScene = dynamic(
  () => import("@/components/3d/HeroScene").then((m) => m.HeroScene),
  { ssr: false }
);

/**
 * Decides whether the 3D scene is worth loading at all.
 *
 * The scene was hidden on phones with `hidden sm:block`, but CSS only hides it —
 * React still mounted the component, so every mobile visitor downloaded the
 * whole Three.js bundle for an ornament they never saw. Deciding in JS means the
 * dynamic import never fires there.
 *
 * On desktop it waits for the browser to go idle, so decoration never competes
 * with the page becoming usable, and it stays off entirely for anyone who has
 * asked for reduced motion.
 */
function useDeferredScene() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!window.matchMedia("(min-width: 640px)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    type IdleWindow = Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const w = window as IdleWindow;

    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setShow(true), { timeout: 2500 });
      return () => w.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(() => setShow(true), 1200);
    return () => window.clearTimeout(id);
  }, []);

  return show;
}

const pills = [
  { icon: Zap,    label: "AI Powered" },
  { icon: Shield, label: "Secure" },
  { icon: Clock,  label: "Lightning Fast" },
  { icon: Users,  label: "50K+ Users" },
];

export function HeroBanner() {
  const showScene = useDeferredScene();

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white"
      style={{ minHeight: 240 }}>

      {/* Ambient glows */}
      <div className="absolute -top-10 -right-10 w-80 h-80 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 left-1/4 w-64 h-64 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-0 left-0 w-40 h-40 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* 3D Scene — right side, DESKTOP ONLY
          Hidden on mobile because Three.js WebGL canvas bleeds outside CSS overflow bounds on Android */}
      <div className="absolute inset-y-0 right-0 w-1/2 pointer-events-none hidden sm:block">
        {showScene && <HeroScene />}
      </div>

      {/* Mobile-only: decorative gradient orbs instead of 3D */}
      <div className="absolute inset-y-0 right-0 w-1/2 pointer-events-none sm:hidden flex items-center justify-center overflow-hidden">
        <div className="w-32 h-32 bg-blue-500/20 rounded-full blur-2xl absolute top-4 right-4" />
        <div className="w-20 h-20 bg-amber-400/15 rounded-full blur-xl absolute bottom-6 right-8" />
        <div className="w-24 h-24 bg-purple-500/20 rounded-full blur-2xl absolute top-12 right-16" />
      </div>

      {/* Content — full width on mobile, 56% on desktop */}
      <div className="relative z-10 p-5 sm:p-8 sm:max-w-[56%]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-1.5 bg-blue-500/20 border border-blue-500/30
                          rounded-full px-3 py-1 text-xs text-blue-300 mb-3 sm:mb-4">
            <Zap size={11} className="text-amber-400" />
            New: AI-powered document intelligence
          </div>

          <h1 className="text-xl sm:text-3xl font-extrabold leading-tight mb-2">
            All-in-One Document &amp;{" "}
            Business Solution with{" "}
            <span className="bg-amber-400 text-black px-2 py-0.5 rounded-md inline-block mt-1">
              powerful AI.
            </span>
          </h1>

          <p className="text-slate-400 text-xs sm:text-sm mb-4 sm:mb-6 leading-relaxed">
            Convert documents, generate invoices, scan receipts, and manage your
            business ledger — all in one place.
          </p>

          <div className="flex flex-wrap gap-2">
            {pills.map((pill, i) => (
              <motion.div
                key={pill.label}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="flex items-center gap-1.5 bg-white/10 border border-white/10
                           rounded-full px-3 py-1.5 text-xs font-medium backdrop-blur-sm"
              >
                <pill.icon size={12} className="text-amber-400" />
                {pill.label}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
