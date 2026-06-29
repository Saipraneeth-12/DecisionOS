"use client";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Clock, XCircle, Pencil, AlertTriangle, Loader2, Play } from "lucide-react";
import { cn } from "@/lib/utils";

const STATES = [
  { key: "draft",            label: "Draft",            icon: Clock },
  { key: "pending_approval", label: "Pending",          icon: AlertTriangle },
  { key: "approved",         label: "Approved",         icon: CheckCircle2 },
  { key: "executing",        label: "Executing",        icon: Loader2 },
  { key: "monitoring",       label: "Monitoring",       icon: Play },
  { key: "completed",        label: "Completed",        icon: CheckCircle2 },
];

const ALT_STATES = [
  { key: "rejected", label: "Rejected", icon: XCircle,  color: "text-rose-400 bg-rose-500/15 border-rose-500/30" },
  { key: "modified", label: "Modified", icon: Pencil,   color: "text-violet-400 bg-violet-500/15 border-violet-500/30" },
  { key: "escalated",label: "Escalated",icon: AlertTriangle, color: "text-orange-400 bg-orange-500/15 border-orange-500/30" },
];

const STATE_STYLE = {
  past:    "bg-emerald-500/15 border-emerald-500/25 text-emerald-400",
  current: "bg-indigo-500/20 border-indigo-500/40 text-indigo-300 shadow-md shadow-indigo-500/15",
  future:  "bg-white/[0.03] border-white/[0.06] text-slate-600",
};

interface LifecycleTimelineProps {
  currentStatus: string;
  recommendationId?: string;
  compact?: boolean;
}

export function LifecycleTimeline({ currentStatus, recommendationId, compact = false }: LifecycleTimelineProps) {
  const normalized = (currentStatus ?? "draft").toLowerCase().replace(/-/g, "_");

  // Check if it's an alt state
  const altState = ALT_STATES.find(s => s.key === normalized);
  const currentIndex = STATES.findIndex(s => s.key === normalized);

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {STATES.map((state, i) => {
          const isPast    = i < currentIndex;
          const isCurrent = i === currentIndex;
          const Icon = state.icon;
          return (
            <div key={state.key} className="flex items-center gap-1">
              <div className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase transition-all",
                isCurrent ? STATE_STYLE.current : isPast ? STATE_STYLE.past : STATE_STYLE.future
              )}>
                <Icon className={cn("w-2.5 h-2.5", isCurrent && "animate-spin")} />
                {state.label}
              </div>
              {i < STATES.length - 1 && (
                <ArrowRight className="w-2.5 h-2.5 text-slate-700 flex-shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Main flow */}
      <div className="relative">
        {/* Track line */}
        <div className="absolute top-5 left-5 right-5 h-px bg-gradient-to-r from-emerald-500/30 via-indigo-500/20 to-white/5" />

        <div className="flex items-start justify-between gap-1">
          {STATES.map((state, i) => {
            const isPast    = currentIndex > i;
            const isCurrent = currentIndex === i;
            const Icon      = state.icon;

            return (
              <motion.div
                key={state.key}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex flex-col items-center gap-1.5 flex-1"
              >
                <div className={cn(
                  "w-10 h-10 rounded-xl border-2 flex items-center justify-center transition-all z-10",
                  isCurrent
                    ? "bg-indigo-500 border-indigo-400 shadow-lg shadow-indigo-500/30"
                    : isPast
                    ? "bg-emerald-500/20 border-emerald-500/50"
                    : "bg-white/[0.03] border-white/[0.07]"
                )}>
                  <Icon className={cn(
                    "w-4 h-4",
                    isCurrent  ? "text-white" + (state.key === "executing" ? " animate-spin" : "") :
                    isPast     ? "text-emerald-400" :
                                 "text-slate-700"
                  )} />
                </div>
                <span className={cn(
                  "text-[9px] font-semibold uppercase text-center leading-tight max-w-[52px]",
                  isCurrent ? "text-indigo-300" : isPast ? "text-emerald-500" : "text-slate-700"
                )}>
                  {state.label}
                </span>
                {isCurrent && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"
                  />
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Alt states */}
      {altState && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border bg-white/[0.02] border-white/[0.06]">
          <span className="text-[10px] text-slate-600">Status:</span>
          <span className={cn("badge border text-[10px]", altState.color)}>
            <altState.icon className="w-2.5 h-2.5" />
            {altState.label}
          </span>
          {recommendationId && (
            <span className="text-[9px] text-slate-700 ml-auto font-mono">{recommendationId}</span>
          )}
        </div>
      )}

      {/* ID row */}
      {recommendationId && !altState && (
        <div className="flex items-center justify-between px-2">
          <span className="text-[9px] text-slate-600">Recommendation ID</span>
          <span className="text-[9px] text-slate-400 font-mono">{recommendationId}</span>
        </div>
      )}
    </div>
  );
}
