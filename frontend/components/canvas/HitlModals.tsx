"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useChatStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { X, Check, AlertTriangle, Edit3, ShieldAlert, HelpCircle, ArrowRight, Sparkles } from "lucide-react";
import toast from "react-hot-toast";

interface HitlModalsProps {
  activeModal: "approve" | "reject" | "modify" | "escalate" | "need_info" | null;
  onClose: () => void;
  onAction: (action: string, modifier?: string) => void;
}

export function HitlModals({ activeModal, onClose, onAction }: HitlModalsProps) {
  const { recommendation } = useChatStore();

  const rec = recommendation as any;
  const nbaId = rec?.recommendation_id ?? rec?.id ?? "NBA-1374";
  const playbook = rec?.selected_playbook ?? "Renewal Intervention Playbook";
  const confPct = rec?.confidence_score ? Math.round(rec.confidence_score * 100) : 87;
  const currentVersion = rec?.version ?? "1.3";
  const nextVersion = (parseFloat(currentVersion) + 0.1).toFixed(1);

  // Modal local states
  const [reviewNotes, setReviewNotes] = useState("");
  const [rejectReason, setRejectReason] = useState("Insufficient Evidence");
  const [rejectComments, setRejectComments] = useState("");

  const [editAction, setEditAction] = useState(rec?.action ?? "");
  const [editTimeline, setEditTimeline] = useState(rec?.timeline ?? "14 Days");
  const [editPriority, setEditPriority] = useState(rec?.priority ?? "high");
  const [editOwner, setEditOwner] = useState("Customer Success Manager");
  const [editOutcome, setEditOutcome] = useState(rec?.expected_outcome ?? "");

  const [escalateReviewer, setEscalateReviewer] = useState("VP Customer Success");
  const [escalatePriority, setEscalatePriority] = useState("High");

  const [selectedGaps, setSelectedGaps] = useState<string[]>(["Budget", "Stakeholders", "Timeline"]);
  const [gapQuestions, setGapQuestions] = useState<string[]>([
    "Who owns renewal approval?",
    "What is the budget range?",
    "What is the target procurement process?",
  ]);

  if (!activeModal) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#0c0d18] shadow-2xl overflow-hidden text-slate-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] bg-white/[0.02]">
            <div className="flex items-center gap-2.5">
              {activeModal === "approve"   && <Check className="w-5 h-5 text-emerald-400" />}
              {activeModal === "reject"    && <AlertTriangle className="w-5 h-5 text-red-400" />}
              {activeModal === "modify"    && <Edit3 className="w-5 h-5 text-amber-400" />}
              {activeModal === "escalate"  && <ShieldAlert className="w-5 h-5 text-purple-400" />}
              {activeModal === "need_info" && <HelpCircle className="w-5 h-5 text-blue-400" />}
              <div>
                <h3 className="text-sm font-bold text-white capitalize">
                  {activeModal === "need_info" ? "Request Discovery Information" : `${activeModal} Recommendation`}
                </h3>
                <p className="text-[10px] text-slate-500 font-mono">ID: {nbaId} · v{currentVersion}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
            {/* ── APPROVE MODAL ────────────────────────────────────── */}
            {activeModal === "approve" && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Playbook:</span>
                    <span className="font-semibold text-white">{playbook}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Confidence:</span>
                    <span className="font-bold text-emerald-400">{confPct}%</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Business Impact:</span>
                    <span className="font-bold text-emerald-400 uppercase">HIGH (150K ARR Protected)</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Review Notes (Optional)</label>
                  <textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Add executive sign-off comments or execution notes..."
                    className="w-full h-24 p-3 text-xs rounded-xl bg-white/[0.04] border border-white/10 text-white outline-none focus:border-emerald-500/50 transition-all resize-none"
                  />
                </div>
              </div>
            )}

            {/* ── REJECT MODAL ─────────────────────────────────────── */}
            {activeModal === "reject" && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Rejection Reason</label>
                  <select
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="w-full p-3 text-xs rounded-xl bg-white/[0.04] border border-white/10 text-white outline-none focus:border-red-500/50 transition-all"
                  >
                    <option value="Insufficient Evidence" className="bg-[#0c0d18]">Insufficient Evidence</option>
                    <option value="Not Relevant" className="bg-[#0c0d18]">Not Relevant</option>
                    <option value="Too Risky" className="bg-[#0c0d18]">Too Risky</option>
                    <option value="Need More Context" className="bg-[#0c0d18]">Need More Context</option>
                    <option value="Other" className="bg-[#0c0d18]">Other</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Comments &amp; Feedback for Replanning</label>
                  <textarea
                    value={rejectComments}
                    onChange={(e) => setRejectComments(e.target.value)}
                    placeholder="Explain why this recommendation was rejected to guide the planner's alternative strategy..."
                    className="w-full h-24 p-3 text-xs rounded-xl bg-white/[0.04] border border-white/10 text-white outline-none focus:border-red-500/50 transition-all resize-none"
                  />
                </div>
              </div>
            )}

            {/* ── MODIFY MODAL ─────────────────────────────────────── */}
            {activeModal === "modify" && (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-amber-300 flex items-center justify-between">
                  <span>Modifying recommendation will create <strong>v{nextVersion}</strong></span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 font-bold">Archive v{currentVersion}</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Primary Recommendation Action</label>
                  <textarea
                    value={editAction}
                    onChange={(e) => setEditAction(e.target.value)}
                    className="w-full h-20 p-3 text-xs rounded-xl bg-white/[0.04] border border-white/10 text-white outline-none focus:border-amber-500/50 transition-all resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-400">Timeline</label>
                    <input
                      value={editTimeline}
                      onChange={(e) => setEditTimeline(e.target.value)}
                      className="w-full p-2.5 text-xs rounded-xl bg-white/[0.04] border border-white/10 text-white outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-400">Priority</label>
                    <select
                      value={editPriority}
                      onChange={(e) => setEditPriority(e.target.value)}
                      className="w-full p-2.5 text-xs rounded-xl bg-white/[0.04] border border-white/10 text-white outline-none"
                    >
                      <option value="critical" className="bg-[#0c0d18]">Critical</option>
                      <option value="high" className="bg-[#0c0d18]">High</option>
                      <option value="medium" className="bg-[#0c0d18]">Medium</option>
                      <option value="low" className="bg-[#0c0d18]">Low</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400">Assign Owner</label>
                  <input
                    value={editOwner}
                    onChange={(e) => setEditOwner(e.target.value)}
                    className="w-full p-2.5 text-xs rounded-xl bg-white/[0.04] border border-white/10 text-white outline-none"
                  />
                </div>
              </div>
            )}

            {/* ── ESCALATE MODAL ───────────────────────────────────── */}
            {activeModal === "escalate" && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Assign Reviewer</label>
                  <select
                    value={escalateReviewer}
                    onChange={(e) => setEscalateReviewer(e.target.value)}
                    className="w-full p-3 text-xs rounded-xl bg-white/[0.04] border border-white/10 text-white outline-none focus:border-purple-500/50 transition-all"
                  >
                    <option value="VP Customer Success" className="bg-[#0c0d18]">VP Customer Success</option>
                    <option value="Director CS" className="bg-[#0c0d18]">Director CS</option>
                    <option value="RevOps Lead" className="bg-[#0c0d18]">RevOps Lead</option>
                    <option value="Executive Sponsor" className="bg-[#0c0d18]">Executive Sponsor</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Escalation Priority</label>
                  <select
                    value={escalatePriority}
                    onChange={(e) => setEscalatePriority(e.target.value)}
                    className="w-full p-3 text-xs rounded-xl bg-white/[0.04] border border-white/10 text-white outline-none focus:border-purple-500/50 transition-all"
                  >
                    <option value="High" className="bg-[#0c0d18]">High</option>
                    <option value="Critical" className="bg-[#0c0d18]">Critical</option>
                    <option value="Urgent" className="bg-[#0c0d18]">Urgent (24h SLA)</option>
                  </select>
                </div>
              </div>
            )}

            {/* ── NEED INFO MODAL ──────────────────────────────────── */}
            {activeModal === "need_info" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300">Missing Context Categories</label>
                  <div className="flex flex-wrap gap-2">
                    {["Budget", "Stakeholders", "Decision Maker", "Timeline", "Procurement"].map((gap) => {
                      const active = selectedGaps.includes(gap);
                      return (
                        <button
                          key={gap}
                          onClick={() => {
                            if (active) setSelectedGaps(selectedGaps.filter(g => g !== gap));
                            else setSelectedGaps([...selectedGaps, gap]);
                          }}
                          className={cn("px-3 py-1.5 text-xs rounded-lg border transition-all font-medium",
                            active ? "bg-blue-500/20 border-blue-500/40 text-blue-300" : "bg-white/[0.03] border-white/10 text-slate-500 hover:bg-white/5"
                          )}
                        >
                          {active ? "✓ " : "+ "}{gap}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300">Generated Discovery Questions</label>
                  <div className="space-y-2">
                    {gapQuestions.map((q, i) => (
                      <div key={i} className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-slate-300 flex items-center justify-between">
                        <span>{q}</span>
                        <span className="text-[10px] text-slate-500 font-mono">Q{i+1}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/[0.06] bg-white/[0.02]">
            <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors">
              Cancel
            </button>

            {activeModal === "approve" && (
              <button
                onClick={() => {
                  onAction("approve", reviewNotes || "Approved via HITL Modal");
                  toast.success("Recommendation approved!");
                  onClose();
                }}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" /> Approve Recommendation
              </button>
            )}

            {activeModal === "reject" && (
              <button
                onClick={() => {
                  onAction("reject", `${rejectReason}: ${rejectComments}`);
                  toast.error("Recommendation rejected");
                  onClose();
                }}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/20 transition-all flex items-center gap-1.5"
              >
                <AlertTriangle className="w-3.5 h-3.5" /> Confirm Rejection
              </button>
            )}

            {activeModal === "modify" && (
              <button
                onClick={() => {
                  onAction("modify", `Modified Action: ${editAction} | Timeline: ${editTimeline} | Priority: ${editPriority} | Owner: ${editOwner}`);
                  toast.success(`Saved as version ${nextVersion}`);
                  onClose();
                }}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-500/20 transition-all flex items-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5" /> Save as v{nextVersion}
              </button>
            )}

            {activeModal === "escalate" && (
              <button
                onClick={() => {
                  onAction("escalate", `Escalated to ${escalateReviewer} with priority ${escalatePriority}`);
                  toast.success(`Escalated to ${escalateReviewer}`);
                  onClose();
                }}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/20 transition-all flex items-center gap-1.5"
              >
                <ShieldAlert className="w-3.5 h-3.5" /> Escalate to {escalateReviewer}
              </button>
            )}

            {activeModal === "need_info" && (
              <button
                onClick={() => {
                  onAction("need_info", `Discovery requested for gaps: ${selectedGaps.join(", ")}`);
                  toast.success("Discovery questions generated");
                  onClose();
                }}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition-all flex items-center gap-1.5"
              >
                <HelpCircle className="w-3.5 h-3.5" /> Submit Request
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
