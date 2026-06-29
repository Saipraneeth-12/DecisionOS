"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Zap, CheckCircle2, Clock, AlertTriangle, TrendingUp,
  Sparkles, Loader2, Shield, Target, BookOpen, Database,
  ChevronDown, ChevronRight, Activity, BarChart3, Eye,
  CircleDot, Check, X, ArrowRight, Info, RefreshCw,
  Cpu, Layers, FileText,
} from "lucide-react";
import { useChatStore } from "@/lib/store";
import { ScoreRing } from "../ui/score-ring";
import { cn, getStageLabel } from "@/lib/utils";
import { approveByConversation } from "@/lib/api";
import toast from "react-hot-toast";

// ── Agent display map ─────────────────────────────────────────────────────
const AGENT_META: Record<string, { label: string; icon: string; phase: number }> = {
  context_evaluator:        { label: "Context Evaluator",   icon: "🔎", phase: 0 },
  conversation_manager:     { label: "Intent Classifier",   icon: "💬", phase: 1 },
  information_completeness: { label: "Info Completeness",   icon: "📋", phase: 1 },
  planner:                  { label: "Planner",             icon: "🗺️", phase: 1 },
  memory_agent:             { label: "Memory Agent",        icon: "🧠", phase: 2 },
  knowledge_agent:          { label: "Knowledge Agent",     icon: "📚", phase: 2 },
  domain_specialist:        { label: "Domain Specialist",   icon: "🎯", phase: 3 },
  risk_agent:               { label: "Risk Agent",          icon: "⚠️", phase: 3 },
  opportunity_agent:        { label: "Opportunity Agent",   icon: "📈", phase: 3 },
  pattern_detection_agent:  { label: "Pattern Engine",      icon: "🔬", phase: 3 },
  playbook_router:          { label: "Playbook Router",     icon: "📖", phase: 3 },
  recommendation_agent:     { label: "NBA Generator",       icon: "✨", phase: 4 },
  confidence_agent:         { label: "Confidence Agent",    icon: "📊", phase: 4 },
  approval_agent:           { label: "Approval Agent",      icon: "✅", phase: 6 },
  execution_plan_agent:     { label: "Execution Planner",   icon: "⚡", phase: 7 },
};

const PHASES = [
  { num: 1, label: "Context & Planning" },
  { num: 2, label: "Memory Retrieval" },
  { num: 3, label: "Analysis" },
  { num: 4, label: "Recommendation" },
  { num: 6, label: "Approval" },
  { num: 7, label: "Execution" },
];

function AgentStatusDot({ status }: { status: string }) {
  if (status === "running")   return <span className="w-2 h-2 rounded-full bg-indigo-400 agent-dot-running flex-shrink-0" />;
  if (status === "completed") return <Check className="w-3 h-3 text-emerald-400 flex-shrink-0" />;
  if (status === "skipped")   return <span className="w-2 h-2 rounded-full bg-slate-600 flex-shrink-0" />;
  if (status === "failed")    return <X className="w-3 h-3 text-rose-400 flex-shrink-0" />;
  return <span className="w-2 h-2 rounded-full bg-slate-700 flex-shrink-0" />;
}

// ── Section accordion ────────────────────────────────────────────────────
function Section({
  title, icon, children, defaultOpen = true, badge
}: {
  title: string; icon: React.ReactNode; children: React.ReactNode;
  defaultOpen?: boolean; badge?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-white/[0.05] last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02] transition-colors group"
      >
        <div className="flex items-center gap-2">
          <span className="text-slate-500 group-hover:text-slate-400 transition-colors">{icon}</span>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest group-hover:text-slate-300 transition-colors">{title}</span>
          {badge && (
            <span className="px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 text-[9px] font-bold">{badge}</span>
          )}
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-3 h-3 text-slate-600" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            <div className="pb-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Score bar ─────────────────────────────────────────────────────────────
function ScoreBar({ label, value, color = "indigo", delta }: { label: string; value: number; color?: string; delta?: number }) {
  const barColor = {
    indigo: "bg-gradient-to-r from-indigo-500 to-purple-500",
    emerald: "bg-gradient-to-r from-emerald-500 to-teal-500",
    amber: "bg-gradient-to-r from-amber-500 to-orange-500",
    rose: "bg-gradient-to-r from-rose-500 to-pink-500",
    sky: "bg-gradient-to-r from-sky-500 to-cyan-500",
  }[color] ?? "bg-gradient-to-r from-indigo-500 to-purple-500";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-slate-500">{label}</span>
        <div className="flex items-center gap-1">
          {delta !== undefined && (
            <span className={cn("text-[9px] font-semibold", delta > 0 ? "text-emerald-400" : delta < 0 ? "text-rose-400" : "text-slate-500")}>
              {delta > 0 ? "+" : ""}{delta > 0 ? delta : Math.abs(delta)}
            </span>
          )}
          <span className="text-[10px] font-bold text-white">{value}%</span>
        </div>
      </div>
      <div className="progress-track">
        <motion.div
          className={cn("progress-fill", barColor)}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

// ── Empty state for panel ─────────────────────────────────────────────────
function PanelEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center space-y-4">
      <div className="relative w-14 h-14">
        <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
          <Brain className="w-6 h-6 text-indigo-400/60" />
        </div>
        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center">
          <span className="text-[8px] text-slate-500">AI</span>
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-400 mb-1">Intelligence Panel</p>
        <p className="text-[11px] text-slate-600 leading-relaxed">
          Start an analysis and the planner will stream live agent telemetry, confidence scores, and memory signals here.
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5 justify-center">
        {["Agents", "Confidence", "Memory", "Playbooks"].map((t) => (
          <span key={t} className="badge badge-slate">{t}</span>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────
export function IntelligencePanel() {
  const {
    activeConversationId, recommendation, isStreaming, currentStage,
    setRecommendation, updateConversation,
    detectedPatterns, selectedPlaybook, memoryEvolution,
    agentTimeline, checklist, decisionReadiness, memoryDiscovery,
    hitlPhases, hitlResult, executionPlan,
    liveThought,
  } = useChatStore();

  const [comment, setComment] = useState("");
  const [approving, setApproving] = useState(false);

  const rec = recommendation;
  const hasData = isStreaming || !!rec;

  // Derived values
  const confScore  = Math.round((rec?.confidence_score ?? 0) * 100);
  const healthScore = Math.round((rec?.health_score ?? 0) * 100);
  const riskScore  = Math.round((rec?.risk_score ?? 0) * 100);
  const covScore   = Math.round((rec?.coverage_score ?? 0) * 100);
  const bd = rec?.score_breakdown ?? {};
  const dataCoverage    = Math.round((bd.data_coverage    ?? 0) * 100);
  const evidenceQuality = Math.round((bd.evidence_quality ?? 1) * 100);
  const memSimilarity   = Math.round((bd.memory_similarity ?? 0.15) * 100);
  const domainConf      = Math.round((bd.domain_confidence ?? 0.75) * 100);
  const llmConf         = Math.round((bd.llm_confidence ?? 0.6) * 100);

  const activePatterns = detectedPatterns?.patterns ?? rec?.detected_patterns ?? [];
  const activePlaybook = selectedPlaybook?.selected_playbook ?? rec?.selected_playbook;
  const isHITLActive = hitlPhases.length > 0;
  const isApproved = rec?.approval_status === "approved" || rec?.lifecycle_status === "approved" || currentStage === "approved";

  const runningAgents   = agentTimeline.filter((a) => a.status === "running");
  const completedAgents = agentTimeline.filter((a) => a.status === "completed");
  const skippedAgents   = agentTimeline.filter((a) => a.status === "skipped");

  async function handleApprove() {
    if (!activeConversationId || !rec) return;
    setApproving(true);
    try {
      await approveByConversation(activeConversationId, "approved", comment || undefined, undefined, undefined, "Decision Maker", "scheduled");
      setRecommendation({ ...rec, approval_status: "approved", lifecycle_status: "approved" } as any);
      updateConversation(activeConversationId, { status: "approved" });
      toast.success("Recommendation approved!", { icon: "✅" });
    } catch {
      toast.error("Approval failed");
    }
    setApproving(false);
  }

  return (
    <motion.div
      initial={{ x: 360, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 360, opacity: 0 }}
      transition={{ type: "spring", damping: 30, stiffness: 260 }}
      className="w-[360px] flex-shrink-0 h-screen flex flex-col border-l border-white/[0.06] relative overflow-hidden"
      style={{ background: "rgba(7,7,15,0.92)" }}
    >
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center flex-shrink-0">
            <Brain className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-white leading-none">Intelligence Panel</p>
            <p className="text-[9px] text-slate-600 mt-0.5">Real-time agent telemetry</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {isStreaming && (
            <motion.div className="live-bar" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
              <span>LIVE</span>
            </motion.div>
          )}
          {!isStreaming && rec && (
            <span className={cn("badge", isApproved ? "badge-emerald" : "badge-amber")}>
              {isApproved ? "Approved" : "Awaiting Review"}
            </span>
          )}
        </div>
      </div>

      {/* Live thought bar */}
      <AnimatePresence>
        {liveThought && isStreaming && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex-shrink-0 px-4 py-2 border-b border-indigo-500/15 bg-indigo-500/5 flex items-center gap-2"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse flex-shrink-0" />
            <p className="text-[10px] text-indigo-300 truncate">{liveThought}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {!hasData ? (
          <PanelEmptyState />
        ) : (
          <>
            {/* ── Workflow Stages ── */}
            <Section title="Workflow" icon={<Layers className="w-3.5 h-3.5" />} defaultOpen>
              <div className="px-4 space-y-1 pt-1">
                {PHASES.map((phase) => {
                  const phaseAgents = agentTimeline.filter(
                    (a) => (AGENT_META[a.agent_name]?.phase ?? 1) === phase.num
                  );
                  const hitlPhase = hitlPhases.find((hp) => hp.phase === phase.num);
                  const isRunning = phaseAgents.some((a) => a.status === "running") || hitlPhase?.status === "running";
                  const isDone    = phaseAgents.length > 0 && phaseAgents.every((a) => a.status === "completed" || a.status === "skipped") || hitlPhase?.status === "completed";
                  const isPending = !isRunning && !isDone && phaseAgents.length === 0 && !hitlPhase;

                  return (
                    <div key={phase.num} className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-xl transition-all",
                      isRunning ? "bg-indigo-500/10 border border-indigo-500/20" :
                      isDone    ? "bg-emerald-500/5 border border-emerald-500/10" :
                                  "border border-transparent"
                    )}>
                      <div className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[9px] font-bold",
                        isRunning ? "bg-indigo-500 text-white animate-pulse" :
                        isDone    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
                                    "bg-white/5 text-slate-600 border border-white/10"
                      )}>
                        {isDone ? "✓" : phase.num}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className={cn(
                          "text-[11px] font-medium",
                          isRunning ? "text-indigo-300" :
                          isDone    ? "text-slate-300" :
                                      "text-slate-600"
                        )}>Phase {phase.num} — {phase.label}</span>
                        {hitlPhase?.transition && (
                          <p className="text-[9px] text-slate-500 mt-0.5">{hitlPhase.transition}</p>
                        )}
                      </div>
                      {isRunning && <Loader2 className="w-3 h-3 text-indigo-400 animate-spin flex-shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </Section>

            {/* ── Score Overview ── */}
            {rec && (
              <Section title="Decision Scores" icon={<BarChart3 className="w-3.5 h-3.5" />}>
                <div className="px-4 pt-2">
                  {/* Score rings */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {[
                      { label: "Confidence", value: confScore,   color: confScore >= 80 ? "#10b981" : confScore >= 60 ? "#f59e0b" : "#f43f5e" },
                      { label: "Health",     value: healthScore, color: "#6366f1" },
                      { label: "Evidence",   value: covScore,    color: "#38bdf8" },
                    ].map((s) => (
                      <div key={s.label} className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                        <ScoreRing value={s.value} size={52} strokeWidth={4} color={s.color} />
                        <span className="text-[9px] text-slate-500 font-semibold uppercase">{s.label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Confidence breakdown */}
                  <div className="space-y-2.5">
                    <p className="section-label">Confidence Breakdown</p>
                    {[
                      { label: "Data Coverage",    value: dataCoverage,    color: "indigo",  delta: bd.data_coverage != null ? undefined : undefined },
                      { label: "Evidence Quality", value: evidenceQuality, color: "emerald" },
                      { label: "Memory Signal",    value: memSimilarity,   color: "sky" },
                      { label: "Domain Fit",       value: domainConf,      color: "purple" as any },
                      { label: "LLM Confidence",   value: llmConf,         color: "amber" },
                    ].map((bar) => (
                      <ScoreBar key={bar.label} label={bar.label} value={bar.value} color={bar.color} />
                    ))}
                  </div>
                </div>
              </Section>
            )}

            {/* ── Active Agents ── */}
            {agentTimeline.length > 0 && (
              <Section
                title="Agents"
                icon={<Cpu className="w-3.5 h-3.5" />}
                badge={`${completedAgents.length}/${agentTimeline.length}`}
              >
                <div className="px-4 space-y-1 pt-1">
                  {agentTimeline.map((a) => {
                    const meta = AGENT_META[a.agent_name] ?? { label: a.agent_name, icon: "🤖", phase: 1 };
                    return (
                      <div key={a.agent_name} className={cn(
                        "flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all",
                        a.status === "running"   ? "bg-indigo-500/8 border border-indigo-500/15" :
                        a.status === "completed" ? "bg-white/[0.01] border border-white/[0.04]" :
                        a.status === "skipped"   ? "opacity-40 border border-transparent" :
                                                   "border border-transparent"
                      )}>
                        <span className="text-sm">{meta.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className={cn(
                              "text-[11px] font-medium truncate",
                              a.status === "running"   ? "text-indigo-300" :
                              a.status === "completed" ? "text-slate-300" : "text-slate-600"
                            )}>
                              {meta.label}
                            </span>
                            {a.latency_ms && a.status === "completed" && (
                              <span className="text-[9px] text-slate-600 flex-shrink-0">{a.latency_ms}ms</span>
                            )}
                          </div>
                          {a.status === "running" && (
                            <p className="text-[9px] text-indigo-400 mt-0.5 animate-pulse">Processing…</p>
                          )}
                        </div>
                        <AgentStatusDot status={a.status} />
                      </div>
                    );
                  })}
                </div>
              </Section>
            )}

            {/* ── HITL Phase Status ── */}
            {hitlPhases.length > 0 && (
              <Section title="Approval Workflow" icon={<Shield className="w-3.5 h-3.5" />} defaultOpen>
                <div className="px-4 space-y-1.5 pt-1">
                  {hitlPhases.map((hp) => (
                    <div key={hp.phase} className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-xl border",
                      hp.status === "completed" ? "bg-emerald-500/8 border-emerald-500/20" :
                      hp.status === "running"   ? "bg-indigo-500/10 border-indigo-500/20 animate-pulse" :
                                                  "bg-white/[0.02] border-white/[0.05]"
                    )}>
                      <div className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0",
                        hp.status === "completed" ? "bg-emerald-500/20 text-emerald-400" :
                        hp.status === "running"   ? "bg-indigo-500 text-white" :
                                                    "bg-white/5 text-slate-600"
                      )}>
                        {hp.status === "completed" ? "✓" : hp.phase}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium text-white/80">Phase {hp.phase} — {hp.label}</p>
                        {hp.transition && <p className="text-[10px] text-slate-500 mt-0.5">{hp.transition}</p>}
                      </div>
                      <span className={cn(
                        "text-[9px] font-bold uppercase px-2 py-0.5 rounded-full",
                        hp.status === "completed" ? "bg-emerald-500/15 text-emerald-400" :
                        hp.status === "running"   ? "bg-indigo-500/15 text-indigo-400" :
                                                    "text-slate-600"
                      )}>
                        {hp.status}
                      </span>
                    </div>
                  ))}
                  {hitlResult?.success && (
                    <div className="px-3 py-2.5 rounded-xl bg-emerald-500/8 border border-emerald-500/15 mt-2">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-[11px] font-semibold text-emerald-400">HITL Complete</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {[
                          { k: "Action", v: hitlResult.action?.toUpperCase() },
                          { k: "Status", v: hitlResult.new_status?.toUpperCase() },
                          { k: "Confidence", v: hitlResult.execution_confidence ? `${hitlResult.execution_confidence}%` : undefined },
                          { k: "Memory", v: hitlResult.memory_updated ? "UPDATED" : undefined },
                        ].filter((r) => r.v).map((row) => (
                          <div key={row.k}>
                            <span className="text-[9px] text-slate-600">{row.k}</span>
                            <p className="text-[10px] font-bold text-white">{row.v}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* ── Detected Domain & Patterns ── */}
            {(activePatterns.length > 0 || rec?.domain) && (
              <Section title="Domain & Patterns" icon={<Target className="w-3.5 h-3.5" />}>
                <div className="px-4 space-y-3 pt-1">
                  {rec?.domain && (
                    <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <div>
                        <p className="text-[9px] text-slate-600 uppercase font-semibold">Detected Domain</p>
                        <p className="text-[12px] font-bold text-white capitalize mt-0.5">
                          {rec.domain.replace(/_/g, " ")}
                        </p>
                      </div>
                      {detectedPatterns?.confidence && (
                        <div className="text-right">
                          <p className="text-[9px] text-slate-600">Confidence</p>
                          <p className="text-lg font-bold text-indigo-400">
                            {Math.round(detectedPatterns.confidence * 100)}%
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  {activePatterns.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {activePatterns.map((p: string) => (
                        <span key={p} className="badge badge-purple">{p.replace(/_/g, " ")}</span>
                      ))}
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* ── Active Playbook ── */}
            {activePlaybook && (
              <Section title="Active Playbook" icon={<BookOpen className="w-3.5 h-3.5" />}>
                <div className="px-4 pt-1">
                  <div className="px-3 py-3 rounded-xl bg-indigo-500/8 border border-indigo-500/15 space-y-2">
                    <div className="flex items-start gap-2">
                      <BookOpen className="w-3.5 h-3.5 text-indigo-400 mt-0.5 flex-shrink-0" />
                      <p className="text-[12px] font-semibold text-indigo-300">{activePlaybook}</p>
                    </div>
                    {selectedPlaybook?.playbook_guidance?.guidance_summary && (
                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        {String(selectedPlaybook.playbook_guidance.guidance_summary).slice(0, 180)}…
                      </p>
                    )}
                    {selectedPlaybook?.active_playbooks?.slice(1, 3).map((p: string) => (
                      <div key={p} className="flex items-center gap-1.5">
                        <ArrowRight className="w-2.5 h-2.5 text-slate-600" />
                        <span className="text-[10px] text-slate-500">{p}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Section>
            )}

            {/* ── Memory Signals ── */}
            {memoryDiscovery?.found && (
              <Section title="Memory Signals" icon={<Database className="w-3.5 h-3.5" />} badge={String(memoryDiscovery.count)}>
                <div className="px-4 space-y-2 pt-1">
                  {memoryDiscovery.cases.slice(0, 3).map((c, i) => (
                    <div key={i} className="px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-medium text-white/80 truncate">{c.summary}</p>
                        <span className={cn(
                          "badge flex-shrink-0 text-[8px]",
                          c.result === "positive" || c.outcome === "positive" ? "badge-emerald" :
                          c.result === "negative" || c.outcome === "negative" ? "badge-rose" : "badge-slate"
                        )}>
                          {c.result || c.outcome}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-slate-600">{c.time_ago ?? "past session"}</span>
                        <span className="text-[9px] text-indigo-400">{Math.round((c.similarity ?? 0) * 100)}% match</span>
                      </div>
                      {c.saved_value && (
                        <p className="text-[9px] text-emerald-400 font-semibold">{c.saved_value} saved</p>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* ── Context Completeness ── */}
            {decisionReadiness && (
              <Section title="Context Completeness" icon={<Activity className="w-3.5 h-3.5" />}>
                <div className="px-4 pt-2 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">Overall Readiness</span>
                    <span className={cn(
                      "text-base font-bold",
                      decisionReadiness.score >= 80 ? "text-emerald-400" :
                      decisionReadiness.score >= 60 ? "text-amber-400" : "text-rose-400"
                    )}>
                      {decisionReadiness.score}%
                    </span>
                  </div>
                  <div className="progress-track">
                    <motion.div
                      className={cn("progress-fill",
                        decisionReadiness.score >= 80 ? "progress-fill-emerald" :
                        decisionReadiness.score >= 60 ? "progress-fill-amber" : "progress-fill-rose"
                      )}
                      initial={{ width: 0 }}
                      animate={{ width: `${decisionReadiness.score}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                    />
                  </div>
                  {decisionReadiness.missing.length > 0 && (
                    <div className="space-y-1">
                      <p className="section-label">Missing</p>
                      {decisionReadiness.missing.slice(0, 4).map((m) => (
                        <div key={m} className="flex items-center gap-2">
                          <AlertTriangle className="w-2.5 h-2.5 text-amber-500 flex-shrink-0" />
                          <span className="text-[10px] text-slate-500">{m}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* ── Recommendation Lifecycle ── */}
            {rec && (
              <Section title="Recommendation State" icon={<Eye className="w-3.5 h-3.5" />}>
                <div className="px-4 pt-1 space-y-3">
                  {/* State machine visual */}
                  <div className="flex items-center gap-1 flex-wrap">
                    {["draft", "pending_approval", "approved", "executing", "completed"].map((state, i, arr) => {
                      const currentStatus = rec.approval_status ?? rec.lifecycle_status ?? "pending_approval";
                      const normalizedStatus = currentStatus.replace(/-/g, "_");
                      const stateIndex = arr.indexOf(normalizedStatus);
                      const myIndex = i;
                      const isActive = normalizedStatus === state;
                      const isDone = myIndex < stateIndex || (myIndex === stateIndex && state !== "pending_approval");

                      return (
                        <div key={state} className="flex items-center gap-1">
                          <div className={cn(
                            "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase transition-all",
                            isActive ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30" :
                            isDone   ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" :
                                       "bg-white/5 text-slate-600 border border-white/10"
                          )}>
                            {state.replace(/_/g, " ")}
                          </div>
                          {i < arr.length - 1 && (
                            <ArrowRight className="w-2.5 h-2.5 text-slate-700 flex-shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Key metrics */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Priority", value: rec.priority?.toUpperCase(), color: rec.priority === "critical" ? "text-rose-400" : rec.priority === "high" ? "text-orange-400" : "text-yellow-400" },
                      { label: "Confidence", value: `${confScore}%`, color: confScore >= 80 ? "text-emerald-400" : "text-amber-400" },
                      { label: "Urgency", value: rec.urgency?.replace(/_/g, " "), color: "text-slate-300" },
                      { label: "Risk", value: rec.risk_level?.toUpperCase(), color: "text-orange-400" },
                    ].map((m) => (
                      <div key={m.label} className="px-2.5 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                        <p className="text-[9px] text-slate-600 uppercase">{m.label}</p>
                        <p className={cn("text-[11px] font-bold mt-0.5", m.color)}>{m.value ?? "—"}</p>
                      </div>
                    ))}
                  </div>

                  {/* Memory evolution */}
                  {memoryEvolution?.updated && (
                    <div className="px-3 py-2 rounded-xl bg-violet-500/8 border border-violet-500/15 flex items-start gap-2">
                      <RefreshCw className="w-3 h-3 text-violet-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-[10px] font-semibold text-violet-300">Strategy Evolved</p>
                        {memoryEvolution.previousRecommendation && (
                          <p className="text-[9px] text-slate-500 mt-0.5">
                            Prev: {memoryEvolution.previousRecommendation.slice(0, 60)}…
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* ── Quick Approval Panel ── */}
            {rec && !isApproved && currentStage === "needs_review" && (
              <Section title="Human Review" icon={<Shield className="w-3.5 h-3.5" />} defaultOpen>
                <div className="px-4 pb-1 space-y-3 pt-2">
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Recommendation is awaiting your approval. Review the analysis and take action.
                  </p>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Optional comment or override…"
                    rows={2}
                    className="input-dark w-full resize-none p-2.5 text-[11px]"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleApprove}
                      disabled={approving}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all disabled:opacity-50"
                    >
                      {approving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      Approve
                    </button>
                    <button className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold bg-white/[0.04] hover:bg-white/[0.07] text-slate-300 border border-white/[0.08] transition-all">
                      <X className="w-3 h-3" />
                      Reject
                    </button>
                  </div>
                  <p className="text-[9px] text-slate-600 text-center">Or type "approve recommendation" in chat</p>
                </div>
              </Section>
            )}

            {/* ── Execution Plan Summary ── */}
            {executionPlan && (executionPlan as any).execution_steps && (
              <Section title="Execution Plan" icon={<Zap className="w-3.5 h-3.5" />} defaultOpen>
                <div className="px-4 pt-1 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Exec ID", value: (executionPlan as any).execution_id ?? "—" },
                      { label: "Confidence", value: `${(executionPlan as any).execution_confidence ?? 0}%` },
                      { label: "Steps", value: (executionPlan as any).execution_steps?.length ?? 0 },
                      { label: "Duration", value: `${(executionPlan as any).total_days ?? 0} days` },
                    ].map((m) => (
                      <div key={m.label} className="px-2.5 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                        <p className="text-[9px] text-slate-600 uppercase">{m.label}</p>
                        <p className="text-[11px] font-bold text-emerald-400 mt-0.5">{String(m.value)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-emerald-500/8 border border-emerald-500/15">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="text-[10px] text-emerald-400 font-semibold">EXECUTING — Closed Loop Active</span>
                  </div>
                </div>
              </Section>
            )}

            {/* ── Evidence ── */}
            {rec?.evidence && rec.evidence.length > 0 && (
              <Section title="Evidence" icon={<FileText className="w-3.5 h-3.5" />} defaultOpen={false}>
                <div className="px-4 pt-1 space-y-1">
                  {rec.evidence.slice(0, 6).map((e, i) => (
                    <div key={i} className="flex items-start gap-2 py-1">
                      <span className="text-indigo-500 mt-1 flex-shrink-0">◆</span>
                      <p className="text-[10px] text-slate-400 leading-relaxed">{e}</p>
                    </div>
                  ))}
                  {rec.evidence_strength && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="section-label">Strength</span>
                      <span className={cn("badge",
                        rec.evidence_strength === "High"   ? "badge-emerald" :
                        rec.evidence_strength === "Medium" ? "badge-amber" : "badge-slate"
                      )}>
                        {rec.evidence_strength}
                      </span>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* ── Session Telemetry ── */}
            <Section title="Session Telemetry" icon={<Activity className="w-3.5 h-3.5" />} defaultOpen={false}>
              <div className="px-4 pt-1">
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { label: "Agents Run",   value: agentTimeline.length },
                    { label: "Completed",    value: completedAgents.length },
                    { label: "Skipped",      value: skippedAgents.length },
                    { label: "Running",      value: runningAgents.length },
                  ].map((m) => (
                    <div key={m.label} className="px-2.5 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04] text-center">
                      <p className="text-[9px] text-slate-600 uppercase">{m.label}</p>
                      <p className="text-sm font-bold text-white mt-0.5">{m.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Section>
          </>
        )}
      </div>
    </motion.div>
  );
}
