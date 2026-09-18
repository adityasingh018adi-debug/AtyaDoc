"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

const ConvertAnimation = dynamic(
  () => import("@/components/3d/ConvertAnimation").then((m) => m.ConvertAnimation),
  { ssr: false }
);

interface Props {
  progress: string;
  fromColor?: string;
  toColor?: string;
  fromLabel?: string;
  toLabel?: string;
}

export function ConvertingOverlay({
  progress,
  fromColor = "#3b82f6",
  toColor   = "#ef4444",
  fromLabel = "DOCX",
  toLabel   = "PDF",
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backdropFilter: "blur(8px)", backgroundColor: "rgba(2,6,23,0.7)" }}
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1,    opacity: 1 }}
        exit={{    scale: 0.85, opacity: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        className="relative w-full max-w-md mx-4 rounded-3xl overflow-hidden
                   border border-white/10 shadow-2xl shadow-black/60"
        style={{
          background: "linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(30,27,75,0.95) 100%)",
        }}
      >
        {/* Glow rings */}
        <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full"
          style={{ background: `radial-gradient(circle, ${fromColor}30 0%, transparent 70%)` }} />
        <div className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full"
          style={{ background: `radial-gradient(circle, ${toColor}30 0%, transparent 70%)` }} />

        {/* 3-D scene */}
        <div className="h-64 w-full relative">
          <ConvertAnimation fromColor={fromColor} toColor={toColor} />

          {/* Labels */}
          <div className="absolute bottom-3 left-0 right-0 flex justify-between px-10 pointer-events-none">
            <span className="text-xs font-bold px-2 py-1 rounded-lg"
              style={{ background: `${fromColor}33`, color: fromColor, border: `1px solid ${fromColor}55` }}>
              {fromLabel}
            </span>
            <span className="text-xs font-bold px-2 py-1 rounded-lg"
              style={{ background: `${toColor}33`, color: toColor, border: `1px solid ${toColor}55` }}>
              {toLabel}
            </span>
          </div>
        </div>

        {/* Progress area */}
        <div className="px-8 pb-8 pt-2 text-center space-y-4">
          {/* Animated progress bar */}
          <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${fromColor}, ${toColor})` }}
              animate={{ x: ["-100%", "100%"] }}
              transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
            />
          </div>

          <div className="flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin text-white/60" />
            <p className="text-sm font-semibold text-white/90 animate-pulse">
              {progress || "Converting…"}
            </p>
          </div>

          <p className="text-xs text-white/40">
            Powered by AtyaDoc · Please wait
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
