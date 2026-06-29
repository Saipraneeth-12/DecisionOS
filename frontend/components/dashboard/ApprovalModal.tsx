"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, Edit3, XCircle, AlertTriangle, User, Clock } from "lucide-react";
import { useChatStore } from "@/lib/store";
import { approveByConversation } from "@/lib/api";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

const ACTIONS = [
  {
    value: "approved",
    label: "Approve",
    icon: CheckCircle2,
    color: "text-emerald-400",
    bg: "bg-emerald-500/12 border-emerald-500/25 hover:bg-emerald-500/22",
    selectedRing: "ring-emerald-500/30",
  },
  {
    value: "modified",
    label: "Modify",
    icon: Edit3,
    color: "text-yellow-400",
    bg: "bg-yellow-500/12 border-yellow-500/25 hover:bg-yellow-500/22",
    selectedRing: "ring-yellow-500/30",
  },
  {
    value: "rejected",
    label: "Reject",
    icon: XCircle,
    color: "text-red-400",
    bg: "bg-red-500/12 border-red-500/25 hover:bg-red-500/22",
    selectedRing: "ring-red-500/30",
  },
  {
    value: "escalated",
    label: "Escalate",
    icon: AlertTriangle,
    color: "text-orange-400",
    bg: "bg-orange-500/12 border-orange-500/25 hover:bg-orange-500/22",
    selectedRing: "ring-orange-500/30",
  },
] as const;

export function ApprovalModal() {
  const {
    approvalModalOpen,
    setApprovalModalOpen,
    recommendation,
    setRecommendation,
    updateConversation,
    activeConversationId,
  } = useChatStore();

  const [selected, setSelected] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [modifiedAction, setModifiedAction] = useState("");
  const [escalationTarget, setEscalationTarget] = useState("");
  const [decisionOwner, setDecisionOwner] = useState("");
  const [loading, setLoading] = useState(false);

  if (!approvalModalOpen) return null;

  async function handleSubmit() {
    // Require an action to be selected
    if (!selected) {
      toast.error("Please select a decision action");
      return;
    }
    // Need at least a conversation ID to persist
    if (!activeConversationId) {
      // No backend to call — just update client state
      applyLocally(selected);
      return;
    }

    setLoading(true);
    try {
      await approveByConversation(
        activeConversationId,
        selected,
        comment || undefined,
        selected === "modified" ? modifiedAction || undefined : undefined,
        selected === "escalated" ? escalationTarget || undefined : undefined,
        decisionOwner || undefined,
      );
      applyLocally(selected);
    } catch (err) {
      // If backend call fails (e.g. recommendation not yet persisted), still update UI
      console.warn("Approval API error:", err);
      applyLocally(selected);
    } finally {
      setLoading(false);
    }
  }

  function applyLocally(status: string) {
    // Update recommendation in store
    if (recommendation) {
      setRecommendation({ ...recommendation, approval_status: status });
    }
    // Update conversation status
    if (activeConversationId) {
      const newStatus =
        status === "approved"
          ? "approved"
          : status === "escalated"
          ? "escalated"
          : "needs_review";
      updateConversation(activeConversationId, { status: newStatus });
    }
    const icons: Record<string, string> = {
      approved: "✅",
      rejected: "❌",
      modified: "✏️",
      escalated: "⚠️",
    };
    toast.success(`Decision ${status}`, { icon: icons[status] ?? "📋" });
    closeModal();
  }

  function closeModal() {
    setApprovalModalOpen(false);
    setSelected(null);
    setComment("");
    setModifiedAction("");
    setEscalationTarget("");
    setDecisionOwner("");
  }

  return (
    <AnimatePresence>
      {approvalModalOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
            onClick={closeModal}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg px-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="rounded-2xl border border-white/[0.1] overflow-hidden shadow-2xl"
              style={{ background: "#0d0d1a" }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07]">
                <div>
                  <h3 className="text-sm font-bold text-white">Human-in-the-Loop Review</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Review the AI recommendation and record your decision
                  </p>
                </div>
                <button
                  onClick={closeModal}
                  className="p-1.5 rounded-lg text-slate-600 hover:text-slate-400 hover:bg-white/[0.06] transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">

                {/* Recommendation summary */}
                {recommendation && (
                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-xs font-semibold text-slate-200 leading-snug">
                        {recommendation.title}
                      </p>
                      <span className={cn(
                        "text-[9px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0",
                        recommendation.priority?.toLowerCase() === "critical"
                          ? "bg-red-500/15 text-red-400"
                          : recommendation.priority?.toLowerCase() === "high"
                          ? "bg-orange-500/15 text-orange-400"
                          : "bg-yellow-500/15 text-yellow-400"
                      )}>
                        {(recommendation.priority ?? "MEDIUM").toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed mt-1">
                      {recommendation.action}
                    </p>
                    {recommendation.timeline && (
                      <div className="flex items-center gap-1.5 mt-2 text-[10px] text-slate-600">
                        <Clock className="w-3 h-3" />
                        {recommendation.timeline}
                      </div>
                    )}
                  </div>
                )}

                {/* Decision Owner */}
                <div>
                  <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest mb-1.5 block">
                    Decision Owner
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
                    <input
                      value={decisionOwner}
                      onChange={(e) => setDecisionOwner(e.target.value)}
                      placeholder="Your name or role…"
                      className="w-full pl-9 pr-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-indigo-500/40 transition-colors"
                    />
                  </div>
                </div>

                {/* Action buttons */}
                <div>
                  <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest mb-2 block">
                    Your Decision
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {ACTIONS.map((action) => {
                      const Icon = action.icon;
                      const isSelected = selected === action.value;
                      return (
                        <button
                          key={action.value}
                          type="button"
                          onClick={() => setSelected(isSelected ? null : action.value)}
                          className={cn(
                            "flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-semibold transition-all",
                            action.bg,
                            action.color,
                            isSelected && `ring-2 ${action.selectedRing} scale-[1.02]`
                          )}
                        >
                          <Icon className="w-4 h-4" />
                          {action.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Modified action field */}
                <AnimatePresence>
                  {selected === "modified" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest mb-1.5 block">
                        Modified Action
                      </label>
                      <textarea
                        value={modifiedAction}
                        onChange={(e) => setModifiedAction(e.target.value)}
                        placeholder="Describe your modified recommendation…"
                        rows={3}
                        className="w-full px-3 py-2.5 bg-white/[0.04] border border-yellow-500/20 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-yellow-500/40 resize-none transition-colors"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Escalation target */}
                <AnimatePresence>
                  {selected === "escalated" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest mb-1.5 block">
                        Escalate To
                      </label>
                      <input
                        value={escalationTarget}
                        onChange={(e) => setEscalationTarget(e.target.value)}
                        placeholder="e.g. VP Customer Success, CRO…"
                        className="w-full px-3 py-2.5 bg-white/[0.04] border border-orange-500/20 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-orange-500/40 transition-colors"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Comment */}
                <div>
                  <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest mb-1.5 block">
                    Notes / Rationale{" "}
                    <span className="normal-case text-slate-700">(optional)</span>
                  </label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Add context, rationale, or next steps…"
                    rows={2}
                    className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-indigo-500/30 resize-none transition-colors"
                  />
                </div>

                {/* Submit */}
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!selected || loading}
                  className={cn(
                    "w-full py-3 rounded-xl text-sm font-bold transition-all select-none",
                    selected && !loading
                      ? "bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20 cursor-pointer"
                      : "bg-white/[0.04] text-slate-600 cursor-not-allowed border border-white/[0.06]"
                  )}
                >
                  {loading
                    ? "Submitting…"
                    : selected
                    ? `Submit — ${selected.charAt(0).toUpperCase() + selected.slice(1)}`
                    : "Select a decision above"}
                </button>

              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
