"use client";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ScoreRingProps {
  value: number; // 0-1
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  label?: string;
  sublabel?: string;
  className?: string;
  showGlow?: boolean;
}

export function ScoreRing({
  value,
  size = 80,
  strokeWidth = 6,
  color = "#818cf8",
  trackColor = "rgba(255,255,255,0.06)",
  label,
  sublabel,
  className,
  showGlow = false,
}: ScoreRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - value * circumference;
  const pct = Math.round(value * 100);

  return (
    <div className={cn("relative flex flex-col items-center", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        {showGlow && (
          <div
            className="absolute inset-0 rounded-full blur-xl opacity-20"
            style={{ background: color }}
          />
        )}
        <svg width={size} height={size} className="rotate-[-90deg]">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={trackColor}
            strokeWidth={strokeWidth}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: "easeOut", delay: 0.1 }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-base font-bold text-white leading-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            {pct}%
          </motion.span>
          {sublabel && (
            <span className="text-[9px] text-slate-500 mt-0.5 uppercase tracking-wide">
              {sublabel}
            </span>
          )}
        </div>
      </div>
      {label && (
        <span className="text-[11px] text-slate-400 mt-1.5 text-center font-medium">
          {label}
        </span>
      )}
    </div>
  );
}
