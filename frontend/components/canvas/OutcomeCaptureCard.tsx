"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ThumbsUp, ThumbsDown, Minus, DollarSign, Clock, TrendingUp,
  CheckCircle2, Loader2, MessageSquare
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { OutcomeCapture } from "@/lib/store";

interface OutcomeCaptureCardProps {
  recommendationId: string;
  recommendationTitle: string;
  onSubmit: (outcome: OutcomeCapture) => void;
}

export function OutcomeCaptureCard({ recommendationId, recommendationTitle, onSubmit }: OutcomeCaptureCardProps) {
  const [selected, setSelected]   = useState<"positive" | "neutral" | "negative" | null>(null);
  const [arrImpact, setArrImpact] = useState("");
  const [notes, setNotes]         = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!selected) return;
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 800));
    onSubmit({
      recommendation_id: recommendationId,
      outcome: selected,
      metrics: {
        arr_impact: arrImpact ? parseFloat(arrImpact) * 1000 : undefined,
        notes: notes || undefined,
      },
      submitted_at: new Date().toISOString(),
    });
    setSubmitted(true);
    setSubmitting(false);
  }

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-5 flex items-center gap-4"
      >
        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <p className="text-[13px] font-bold text-emerald-300">Outcome Captured</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Memory updated · Learning triggered · Future recommendations improved</p>
        </div>
      </motion.div>
    );
  }

  const outcomes = [
    { value: "positive" as const, label: "Positive", icon: ThumbsUp,  color: "bg-emerald-500/12 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20", activeColor: "bg-emerald-500/25 border-emerald-500/50 text-emerald-300" },
    { value: "neutral"  as const, label: "Neutral",  icon: Minus,     color: "bg-slate-500/12 border-slate-500/25 text-slate-400 hover:bg-slate-500/20",         activeColor: "bg-slate-500/30 border-slate-500/50 text-slate-200" },
    { value: "negative" as const, label: "Negative", icon: ThumbsDown,color: "bg-rose-500/12 border-rose-500/30 text-rose-400 hover:bg-rose-500/20",             activeColor: "bg-rose-500/25 border-rose-500/50 text-rose-300" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/[0.07] bg-gradient-to-br from-white/[0.02] to-transparent overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/[0.05] flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
          <TrendingUp className="w-4 h-4 text-indigo-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-bold text-white">Capture Outcome</p>
          <p className="text-[10px] text-slate-500 truncate">{recommendationTitle}</p>
        </div>
        <span className="badge badge-indigo">Closed Loop</span>
      </div>

      <div className="p-5 space-y-4">
        <p className="text-[11px] text-slate-500 leading-relaxed">
          How did this recommendation perform? Your feedback improves future decision quality.
        </p>

        {/* Outcome selector */}
        <div className="grid grid-cols-3 gap-2">
          {outcomes.map(({ value, label, icon: Icon, color, activeColor }) => (
            <button
              key={value}
              onClick={() => setSelected(value)}
              className={cn(
                "flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all",
                selected === value ? activeColor : color
              )}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-wide">{label}</span>
            </button>
          ))}
        </div>

        {/* Metrics */}
        <AnimatePresence>
          {selected && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3 overflow-hidden"
            >
              {selected === "positive" && (
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                  <input
                    value={arrImpact}
                    onChange={e => setArrImpact(e.target.value)}
                    placeholder="ARR impact ($K)…"
                    type="number"
                    className="input-dark w-full pl-8 pr-3 py-2.5 text-[12px]"
                  />
                </div>
              )}
              <div className="relative">
                <MessageSquare className="absolute left-3 top-3 w-3.5 h-3.5 text-slate-500" />
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Notes on what happened, blockers, or learnings…"
                  rows={3}
                  className="input-dark w-full pl-8 pr-3 py-2.5 text-[12px] resize-none"
                />
              </div>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[12px] font-bold transition-all disabled:opacity-60 shadow-lg shadow-indigo-500/15"
              >
                {submitting ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving outcome…</>
                ) : (
                  <><CheckCircle2 className="w-3.5 h-3.5" /> Submit &amp; Update Memory</>
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
