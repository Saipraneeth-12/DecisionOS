"use client";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface ProgressProps {
  value: number; // 0-100
  className?: string;
  barClassName?: string;
  showLabel?: boolean;
  color?: string;
  animate?: boolean;
}

export function Progress({
  value,
  className,
  barClassName,
  showLabel,
  color,
  animate = true,
}: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value));

  const defaultColor =
    clamped >= 80
      ? "from-emerald-500 to-emerald-400"
      : clamped >= 60
      ? "from-indigo-500 to-purple-500"
      : clamped >= 40
      ? "from-yellow-500 to-amber-400"
      : "from-red-500 to-orange-400";

  return (
    <div className={cn("relative h-1.5 rounded-full bg-white/5 overflow-hidden", className)}>
      {animate ? (
        <motion.div
          className={cn(
            "absolute left-0 top-0 h-full rounded-full bg-gradient-to-r",
            color ?? defaultColor,
            barClassName
          )}
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      ) : (
        <div
          className={cn(
            "absolute left-0 top-0 h-full rounded-full bg-gradient-to-r",
            color ?? defaultColor,
            barClassName
          )}
          style={{ width: `${clamped}%` }}
        />
      )}
      {showLabel && (
        <span className="absolute right-0 -top-5 text-xs text-slate-400">
          {clamped.toFixed(0)}%
        </span>
      )}
    </div>
  );
}
