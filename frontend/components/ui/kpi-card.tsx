"use client";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string;
  subtext?: string;
  icon?: React.ReactNode;
  color?: "indigo" | "emerald" | "purple" | "cyan" | "orange" | "red";
  trend?: "up" | "down" | "neutral";
  delta?: string;
  className?: string;
}

const colorMap = {
  indigo:  { text: "text-indigo-400",  bg: "bg-indigo-500/10",  border: "border-indigo-500/20",  glow: "rgba(99,102,241,0.12)" },
  emerald: { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", glow: "rgba(52,211,153,0.12)" },
  purple:  { text: "text-purple-400",  bg: "bg-purple-500/10",  border: "border-purple-500/20",  glow: "rgba(192,132,252,0.12)" },
  cyan:    { text: "text-cyan-400",    bg: "bg-cyan-500/10",    border: "border-cyan-500/20",    glow: "rgba(34,211,238,0.12)" },
  orange:  { text: "text-orange-400",  bg: "bg-orange-500/10",  border: "border-orange-500/20",  glow: "rgba(251,146,60,0.12)" },
  red:     { text: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/20",     glow: "rgba(248,113,113,0.12)" },
};

export function KpiCard({
  label,
  value,
  subtext,
  icon,
  color = "indigo",
  trend,
  delta,
  className,
}: KpiCardProps) {
  const c = colorMap[color];
  const TrendIcon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor =
    trend === "up"
      ? "text-emerald-400"
      : trend === "down"
      ? "text-red-400"
      : "text-slate-500";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative rounded-2xl p-4 border overflow-hidden",
        "bg-white/[0.02]",
        c.border,
        className
      )}
    >
      {/* Background glow */}
      <div
        className="absolute inset-0 rounded-2xl opacity-50 pointer-events-none"
        style={{
          background: `radial-gradient(circle at top left, ${c.glow}, transparent 70%)`,
        }}
      />
      <div className="relative">
        <div className="flex items-start justify-between mb-2">
          {icon ? (
            <div className={cn("p-1.5 rounded-lg", c.bg)}>
              <span className={cn("block w-4 h-4", c.text)}>{icon}</span>
            </div>
          ) : null}
          {trend && delta && (
            <div className={cn("flex items-center gap-0.5 text-[10px] font-medium", trendColor)}>
              <TrendIcon className="w-3 h-3" />
              {delta}
            </div>
          )}
        </div>
        <div className={cn("text-2xl font-bold tracking-tight mb-0.5", c.text)}>
          {value}
        </div>
        <div className="text-xs text-slate-400 font-medium">{label}</div>
        {subtext && <div className="text-[10px] text-slate-600 mt-1">{subtext}</div>}
      </div>
    </motion.div>
  );
}
