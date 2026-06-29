"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ArrowRight, CheckCircle2, Clock, X, TrendingUp, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EvolutionEntry {
  recommendation_id: string;
  title: string;
  playbook: string;
  status: string;
  created_at: string;
  confidence?: number;
  outcome?: string;
}

const STATUS_STYLE: Record<string, string> = {
  approved:         "text-emerald-400 bg-emerald-500/12 border-emerald-500/25",
  pending_approval: "text-amber-400 bg-amber-500/12 border-amber-500/25",
  executing:        "text-sky-400 bg-sky-500/12 border-sky-500/25",
  completed:        "text-slate-400 bg-slate-500/10 border-slate-500/20",
  rejected:         "text-rose-400 bg-rose-500/12 border-rose-500/25",
  modified:         "text-violet-400 bg-violet-500/12 border-violet-500/25",
  draft:            "text-slate-500 bg-slate-500/8 border-slate-500/15",
};

const STATUS_DOT: Record<string, string> = {
  approved: "bg-emerald-400", executing: "bg-sky-400",
  completed: "bg-slate-500", rejected: "bg-rose-400",
  modified: "bg-violet-400", pending_approval: "bg-amber-400",
  draft: "bg-slate-700",
};

interface StrategyEvolutionCardProps {
  entries: EvolutionEntry[];
  currentTitle?: string;
}

export function StrategyEvolutionCard({ entries, currentTitle }: StrategyEvolutionCardProps) {
  const [expanded, setExpanded] = useState(true);

  if (entries.length === 0) return null;

  const allEntries = currentTitle
    ? [...entries, { recommendation_id: "current", title: currentTitle, playbook: "Current", status: "pending_approval", created_at: new Date().toISOString() }]
    : entries;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-violet-500/15 bg-gradient-to-br from-violet-950/20 to-slate-950/50 overflow-hidden"
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3.5 border-b border-white/[0.05] hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
            <RotateCcw className="w-3.5 h-3.5 text-violet-400" />
          </div>
          <div className="text-left">
            <p className="text-[12px] font-bold text-white">Strategy Evolution</p>
            <p className="text-[10px] text-slate-500">{entries.length} prior recommendation{entries.length !== 1 ? "s" : ""} in memory</p>
          </div>
        </div>
        <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-4 h-4 text-slate-600" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: "hidden" }}
          >
            <div className="px-5 py-4">
              {/* Timeline */}
              <div className="relative">
                {/* Connector line */}
                <div className="absolute left-4 top-5 bottom-5 w-px bg-gradient-to-b from-violet-500/40 via-indigo-500/20 to-transparent" />

                <div className="space-y-3">
                  {allEntries.map((entry, i) => {
                    const isCurrent = entry.recommendation_id === "current" || i === allEntries.length - 1;
                    return (
                      <motion.div
                        key={entry.recommendation_id}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.06 }}
                        className="flex gap-4 items-start"
                      >
                        {/* Dot */}
                        <div className={cn(
                          "w-8 h-8 rounded-xl border flex items-center justify-center flex-shrink-0 z-10",
                          isCurrent
                            ? "bg-violet-500/20 border-violet-500/40 shadow-md shadow-violet-500/10"
                            : "bg-slate-900 border-white/[0.06]"
                        )}>
                          {isCurrent ? (
                            <TrendingUp className="w-3.5 h-3.5 text-violet-400" />
                          ) : (
                            <span className={cn("w-2 h-2 rounded-full", STATUS_DOT[entry.status] ?? "bg-slate-600")} />
                          )}
                        </div>

                        {/* Content */}
                        <div className={cn(
                          "flex-1 px-3 py-2.5 rounded-xl border transition-all",
                          isCurrent
                            ? "bg-violet-500/8 border-violet-500/20"
                            : "bg-white/[0.02] border-white/[0.05]"
                        )}>
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className={cn("text-[12px] font-semibold leading-tight", isCurrent ? "text-violet-200" : "text-slate-300")}>
                              {entry.title}
                            </p>
                            <span className={cn(
                              "badge flex-shrink-0 text-[9px]",
                              STATUS_STYLE[entry.status] ?? "text-slate-500 bg-slate-500/10 border-slate-500/20"
                            )}>
                              {entry.status.replace(/_/g, " ")}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-[10px] text-slate-600">📖 {entry.playbook}</span>
                            {entry.confidence && (
                              <span className="text-[10px] text-slate-600">
                                📊 {Math.round(entry.confidence * 100)}%
                              </span>
                            )}
                            {entry.outcome && (
                              <span className={cn("text-[10px] font-semibold",
                                entry.outcome === "positive" ? "text-emerald-400" :
                                entry.outcome === "negative" ? "text-rose-400" : "text-slate-400"
                              )}>
                                {entry.outcome === "positive" ? "✓" : entry.outcome === "negative" ? "✗" : "~"} {entry.outcome}
                              </span>
                            )}
                            <span className="text-[10px] text-slate-700 ml-auto">
                              {new Date(entry.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
