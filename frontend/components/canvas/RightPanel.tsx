"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useChatStore } from "@/lib/store";
import { cn, getDomainLabel } from "@/lib/utils";
import {
  CheckCircle2, Circle, Loader2, Brain, Cpu, BarChart3,
  TrendingUp, Shield, BookOpen, Zap, Activity, Clock,
  Target, Lightbulb, Database, ChevronDown, ChevronRight,
  AlertTriangle, Info, Sparkles, UserCheck, ShieldAlert,
  Edit3, HelpCircle, ArrowUpRight, History
} from "lucide-react";
import { useState } from "react";
import { HitlModals } from "./HitlModals";
import { streamChat } from "@/lib/api";
import styles from "./RightPanel.module.css";

// ── Workflow State Display ─────────────────────────────────────────────────
const WF_STATE_COLORS: Record<string, string> = {
  WAITING_FOR_INPUT:       "text-slate-400",
  CHECKING_MEMORY:         "text-blue-400",
  MEMORY_FOUND:            "text-purple-400",
  WAITING_FOR_HITL:        "text-amber-400",
  PROGRESS_CHECK:          "text-orange-400",
  MISSING_INFORMATION:     "text-yellow-400",
  CONTEXT_COMPLETE:        "text-emerald-400",
  PLANNING:                "text-indigo-400",
  RETRIEVING:              "text-blue-300",
  DIAGNOSING:              "text-violet-400",
  PATTERN_ANALYSIS:        "text-pink-400",
  PLAYBOOK_SELECTION:      "text-cyan-400",
  GENERATING_RECOMMENDATIONS: "text-emerald-300 animate-pulse",
  AWAITING_APPROVAL:       "text-amber-300",
  EXECUTION_TRACKING:      "text-green-400",
  OUTCOME_CAPTURE:         "text-teal-400",
  LEARNING:                "text-purple-300",
  MEMORY_UPDATE:           "text-indigo-300",
};

const WF_STATE_LABELS: Record<string, string> = {
  WAITING_FOR_INPUT:       "Waiting for Input",
  CHECKING_MEMORY:         "Checking Memory",
  MEMORY_FOUND:            "Memory Found",
  WAITING_FOR_HITL:        "Awaiting Human",
  PROGRESS_CHECK:          "Progress Check",
  MISSING_INFORMATION:     "Missing Information",
  CONTEXT_COMPLETE:        "Context Complete",
  PLANNING:                "Planning",
  RETRIEVING:              "Retrieving",
  DIAGNOSING:              "Diagnosing",
  PATTERN_ANALYSIS:        "Pattern Analysis",
  PLAYBOOK_SELECTION:      "Playbook Selection",
  GENERATING_RECOMMENDATIONS: "Generating Recommendations",
  AWAITING_APPROVAL:       "Awaiting Approval",
  EXECUTION_TRACKING:      "Execution Tracking",
  OUTCOME_CAPTURE:         "Outcome Capture",
  LEARNING:                "Learning",
  MEMORY_UPDATE:           "Memory Update",
};

// ── Collapsible Section ───────────────────────────────────────────────────
function Section({ title, icon, children, defaultOpen = true, badge }: {
  title: string; icon: React.ReactNode; children: React.ReactNode;
  defaultOpen?: boolean; badge?: string | number;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mx-3 my-2 border border-white/[0.06] bg-white/[0.01] hover:border-white/[0.1] rounded-xl overflow-hidden shadow-sm transition-all duration-200">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 bg-white/[0.015] hover:bg-white/[0.035] transition-colors group"
      >
        <div className="flex items-center gap-2">
          <span className="text-slate-400 group-hover:text-indigo-400 transition-colors">{icon}</span>
          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider group-hover:text-slate-100 transition-colors">{title}</span>
          {badge !== undefined && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 font-bold border border-indigo-500/20">
              {badge}
            </span>
          )}
        </div>
        {open ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-3.5 space-y-3 border-t border-white/[0.04]">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Agent Node ───────────────────────────────────────────────────────────
function AgentNode({ name, status, latency }: { name: string; status: string; latency?: number }) {
  const icon = status === "completed" ? (
    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
  ) : status === "running" ? (
    <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" />
  ) : (
    <Circle className="w-3 h-3 text-slate-700" />
  );

  return (
    <div className={cn(
      "flex items-center justify-between py-1 px-2 rounded-lg text-[10px] border transition-all",
      status === "running"   ? "bg-indigo-500/8 border-indigo-500/25 animate-pulse" :
      status === "completed" ? "bg-emerald-500/5 border-emerald-500/12 hover:bg-emerald-500/8" :
                               "bg-transparent border-transparent text-slate-700"
    )}>
      <div className="flex items-center gap-1.5">
        {icon}
        <span className={cn("capitalize font-medium",
          status === "completed" ? "text-slate-300" :
          status === "running"   ? "text-indigo-300" : "text-slate-600"
        )}>{name.replace(/_/g, " ")}</span>
      </div>
      {latency && status === "completed" && <span className="text-slate-600 font-mono">{latency}ms</span>}
    </div>
  );
}

// ── Main Right Panel ──────────────────────────────────────────────────────
export function RightPanel() {
  const {
    rightPanelOpen, agentTimeline, recommendation, dashboard,
    workflowState, plannerDecision, confidenceBreakdown,
    contextFieldScores, contextProvidedFields, contextMissingFields,
    domainDetection, selectedPlaybook, detectedPatterns, memoryDiscovery,
    executionPlan, isStreaming, executionMode, plannerSummary,
    selectedDomain, progressCheckResult, memoryEvolution,
    activeConversationId, addMessage, setIsStreaming, clearStreamText,
    setWorkflowState, setPlannerDecision
  } = useChatStore();

  const [activeModal, setActiveModal] = useState<"approve" | "reject" | "modify" | "escalate" | "need_info" | null>(null);

  if (!rightPanelOpen) return null;

  const rec = recommendation as any;
  const isContextRequired = !rec || rec?.is_context_required || rec?.insufficient_data;
  const nbaId = rec?.recommendation_id ?? rec?.id ?? "NBA-1374";
  const currentStatus = rec?.approval_status ?? rec?.lifecycle_status ?? "PENDING_APPROVAL";
  const version = rec?.version ?? "1.3";
  const owner = rec?.owner ?? "Customer Success Manager";
  const priority = (rec?.priority ?? "HIGH").toUpperCase();
  const playbookName = rec?.selected_playbook ?? selectedPlaybook?.selected_playbook ?? "Renewal Intervention";
  const confScore = rec?.confidence_score ?? dashboard?.confidence_score ?? 0.87;
  const confPct = Math.round(confScore * 100);

  const contextScore = (rec?.context_score ?? Object.values(contextFieldScores).reduce((a: number, b: any) => a + b, 0)) || 88;
  const wfLabel = WF_STATE_LABELS[workflowState] ?? workflowState;
  const wfColor = WF_STATE_COLORS[workflowState] ?? "text-slate-400";

  const handleModalAction = (action: string, modifier?: string) => {
    if (!activeConversationId) return;
    setIsStreaming(true);
    clearStreamText();
    setWorkflowState("WAITING_FOR_HITL");

    const fullCmd = modifier ? `${action} recommendation: ${modifier}` : `${action} recommendation`;
    
    addMessage(activeConversationId, {
      id: `tmp-${Date.now()}`,
      conversation_id: activeConversationId,
      role: "user",
      content: fullCmd,
      metadata: {},
      created_at: new Date().toISOString()
    });

    streamChat(fullCmd, activeConversationId, selectedDomain, (evt) => {
      if (evt.type === "workflow_state") setWorkflowState((evt.data as any).state);
      if (evt.type === "done") setIsStreaming(false);
    });
  };

  return (
    <>
      <motion.aside
        initial={{ x: 320 }} animate={{ x: 0 }} exit={{ x: 320 }}
        transition={{ type: "spring", damping: 28, stiffness: 220 }}
        className="w-80 flex-shrink-0 h-full flex flex-col border-l border-white/[0.08] overflow-hidden bg-[#0E1020]/95 backdrop-blur-md"
      >
        {/* Header */}
        <div className="flex-shrink-0 px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500/30 to-purple-600/30 border border-indigo-500/20 flex items-center justify-center">
              <Cpu className="w-3 h-3 text-indigo-400" />
            </div>
            <span className="text-xs font-bold text-white">Enterprise Decision OS</span>
          </div>
          {isStreaming && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
              <Loader2 className="w-2.5 h-2.5 text-indigo-400 animate-spin" />
              <span className="text-[9px] text-indigo-400 font-medium">Live</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/[0.05]">
          {isContextRequired && !isStreaming ? (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-5">
              <div className="relative w-16 h-16 flex items-center justify-center rounded-2xl bg-white/[0.02] border border-white/[0.06] shadow-inner group">
                <div className="absolute inset-0 bg-indigo-500/10 rounded-2xl blur-[8px] opacity-0 group-hover:opacity-100 transition-opacity" />
                <Database className="w-6 h-6 text-slate-500 relative z-10 animate-pulse" />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wide">Awaiting Context</h4>
                <p className="text-[10px] text-slate-500 leading-relaxed max-w-[200px] mx-auto">
                  Submit a prompt or select a template to initialize modeling, evidence gathering, and agent orchestration.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* 1. DECISION LIFECYCLE PANEL */}
          <Section title="Decision Lifecycle" icon={<Activity className="w-3.5 h-3.5 text-indigo-400" />} defaultOpen={true}>
            <div className="space-y-2.5 text-[11px]">
              <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                <span className="text-slate-400 font-medium">Recommendation ID</span>
                <span className="text-indigo-300 font-semibold font-mono">{nbaId}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                <span className="text-slate-400 font-medium">Version</span>
                <span className="text-slate-200">v{version}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                <span className="text-slate-400 font-medium">Status</span>
                <span className={cn("font-bold px-2 py-0.5 rounded text-[9px] uppercase tracking-wide border",
                  currentStatus.includes("APPROVED") || currentStatus.includes("approved") ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                  currentStatus.includes("REJECTED") || currentStatus.includes("rejected") ? "bg-red-500/10 text-red-400 border-red-500/20" :
                  currentStatus.includes("ESCALATED") ? "bg-purple-500/10 text-purple-400 border-purple-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                )}>{currentStatus.toUpperCase()}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                <span className="text-slate-400 font-medium">Owner</span>
                <span className="text-slate-200 font-semibold truncate max-w-[140px] text-right" title={owner}>{owner}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                <span className="text-slate-400 font-medium">Priority</span>
                <span className="text-amber-400 font-bold uppercase tracking-wide">{priority}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                <span className="text-slate-400 font-medium">Playbook</span>
                <span className="text-cyan-300 font-semibold truncate max-w-[140px] text-right" title={playbookName}>{playbookName}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                <span className="text-slate-400 font-medium">Confidence</span>
                <span className="text-emerald-400 font-bold text-[12px]">{confPct}%</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                <span className="text-slate-400 font-medium">Business Impact</span>
                <span className="text-emerald-400 font-bold text-[10px]">$150K Protected</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400 font-medium">Projected ROI</span>
                <span className="text-purple-300 font-bold">35x</span>
              </div>
            </div>
          </Section>

          {/* 1.5. CONFIDENCE CALIBRATION PANEL */}
          <Section title="Confidence Calibration" icon={<Shield className="w-3.5 h-3.5 text-emerald-450" />} defaultOpen={true}>
            <div className="flex flex-col items-center space-y-4">
              {/* Radial Gauge */}
              <div className="relative w-24 h-24 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="rgba(255,255,255,0.03)"
                    strokeWidth="6"
                    fill="transparent"
                  />
                  <motion.circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke={confScore >= 0.8 ? "#22C55E" : confScore >= 0.6 ? "#F59E0B" : "#EF4444"}
                    strokeWidth="6"
                    fill="transparent"
                    strokeDasharray={251.2}
                    initial={{ strokeDashoffset: 251.2 }}
                    animate={{ strokeDashoffset: 251.2 - (251.2 * confPct) / 100 }}
                    transition={{ duration: 1, ease: "easeOut" }}
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="text-[17px] font-black text-white leading-none">{confPct}%</span>
                  <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Confidence</span>
                </div>
              </div>

              {/* Confidence Parameters Grid */}
              <div className="w-full grid grid-cols-2 gap-2.5 text-[10px] bg-white/[0.01] border border-white/[0.04] p-2.5 rounded-xl">
                <div className="space-y-1">
                  <div className="flex justify-between text-slate-400">
                    <span>Completeness</span>
                    <span className="font-semibold text-slate-200">88%</span>
                  </div>
                  <div className="h-1 rounded-full bg-white/[0.05] overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: "88%" }} />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-slate-400">
                    <span>Similarity</span>
                    <span className="font-semibold text-slate-200">92%</span>
                  </div>
                  <div className="h-1 rounded-full bg-white/[0.05] overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: "92%" }} />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-slate-400">
                    <span>Evidence</span>
                    <span className="font-semibold text-slate-200">85%</span>
                  </div>
                  <div className="h-1 rounded-full bg-white/[0.05] overflow-hidden">
                    <div className="h-full bg-sky-500 rounded-full" style={{ width: "85%" }} />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-slate-400">
                    <span>Knowledge</span>
                    <span className="font-semibold text-slate-200">80%</span>
                  </div>
                  <div className="h-1 rounded-full bg-white/[0.05] overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full" style={{ width: "80%" }} />
                  </div>
                </div>
              </div>
            </div>
          </Section>

          {/* 2. HUMAN REVIEW REQUIRED ACTION BUTTONS */}
          <Section title="Human Review Required" icon={<UserCheck className="w-3.5 h-3.5 text-amber-400" />} defaultOpen={true}>
            <div className="space-y-3 pt-1">
              {/* Approve Card - Green Large CTA */}
              <button
                onClick={() => setActiveModal("approve")}
                className="w-full text-left p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-950/20 hover:bg-emerald-900/30 transition-all duration-200 cursor-pointer shadow-md hover:shadow-emerald-500/5 group"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-450 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Approve Recommendation</span>
                </div>
                <p className="text-[10px] text-emerald-300/70 mt-1 leading-relaxed">Authorize immediate playbook deployment and notification dispatches.</p>
                <div className="grid grid-cols-3 gap-2 mt-3 pt-2.5 border-t border-emerald-500/15 text-[9px] font-mono">
                  <div>
                    <span className="text-slate-500 block">IMPACT</span>
                    <span className="text-emerald-400 font-bold">$150K</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">ROI</span>
                    <span className="text-emerald-400 font-bold">35x</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">CONFIDENCE</span>
                    <span className="text-emerald-400 font-bold">{confPct}%</span>
                  </div>
                </div>
              </button>

              {/* Modify Card - Purple Secondary CTA */}
              <button
                onClick={() => setActiveModal("modify")}
                className="w-full text-left p-3 rounded-xl border border-purple-500/20 bg-purple-950/10 hover:bg-purple-900/20 transition-all duration-200 cursor-pointer group"
              >
                <div className="flex items-center gap-2">
                  <Edit3 className="w-3.5 h-3.5 text-purple-400 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold text-purple-300">Modify Recommendation</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">Adjust playbook items, modify timeline parameters, or rewrite tasks.</p>
              </button>

              <div className="grid grid-cols-2 gap-2">
                {/* Need Info Card - Blue */}
                <button
                  onClick={() => setActiveModal("need_info")}
                  className="text-left p-2.5 rounded-xl border border-blue-500/20 bg-blue-950/10 hover:bg-blue-900/20 transition-all duration-200 cursor-pointer group"
                >
                  <div className="flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-[10px] font-bold text-blue-300">Request Info</span>
                  </div>
                  <p className="text-[9px] text-slate-400 mt-1 leading-normal">Prompt for missing data.</p>
                </button>

                {/* Escalate Card - Orange */}
                <button
                  onClick={() => setActiveModal("escalate")}
                  className="text-left p-2.5 rounded-xl border border-amber-500/20 bg-amber-950/10 hover:bg-amber-900/20 transition-all duration-200 cursor-pointer group"
                >
                  <div className="flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[10px] font-bold text-amber-300">Escalate</span>
                  </div>
                  <p className="text-[9px] text-slate-400 mt-1 leading-normal">Route to stakeholders.</p>
                </button>
              </div>

              {/* Reject Card - Red */}
              <button
                onClick={() => setActiveModal("reject")}
                className="w-full text-left p-2.5 rounded-xl border border-red-500/20 bg-red-950/10 hover:bg-red-900/20 transition-all duration-200 cursor-pointer group"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-[10px] font-bold text-red-400">Reject Recommendation</span>
                </div>
                <p className="text-[9px] text-slate-400 mt-0.5">Archive findings and train classifier weights.</p>
              </button>
            </div>
          </Section>

          {/* 3. EXECUTION OVERVIEW */}
          <Section title="Execution Overview" icon={<Zap className="w-3.5 h-3.5 text-green-400" />} defaultOpen={true}>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Execution Status</span>
                <span className={cn("font-bold px-2 py-0.5 rounded-full text-[9px]",
                  currentStatus.includes("approved") || currentStatus.includes("APPROVED") ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                  "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                )}>
                  {currentStatus.includes("approved") || currentStatus.includes("APPROVED") ? "ACTIVE (42% Progress)" : "BLOCKED (Awaiting Approval)"}
                </span>
              </div>

              {executionPlan && (
                <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-1.5">
                  <div className="text-[10px] text-slate-400 font-semibold">Milestones</div>
                  <div className="space-y-1 text-[10px]">
                    <div className="flex items-center gap-1.5 text-emerald-400">
                      <CheckCircle2 className="w-3 h-3" /> <span>Executive Alignment (Day 1)</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-emerald-400">
                      <CheckCircle2 className="w-3 h-3" /> <span>Adoption Assessment (Day 3)</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-amber-300">
                      <Loader2 className="w-3 h-3 animate-spin" /> <span>Integration Review (Day 5 - Tomorrow)</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>Planner State</span>
                <span className="text-indigo-300">{currentStatus.includes("approved") ? "EXECUTING" : "WAITING_FOR_HUMAN"}</span>
              </div>
            </div>
          </Section>

          {/* 4. MONITORING VIEW */}
          <Section title="Monitoring & Evolution" icon={<TrendingUp className="w-3.5 h-3.5 text-cyan-400" />} defaultOpen={false}>
            <div className="space-y-2 text-[10px]">
              <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <div>
                  <div className="text-slate-500">Customer Health</div>
                  <div className="text-sm font-bold text-emerald-400 flex items-center gap-1">
                    71 <ArrowUpRight className="w-3 h-3" />
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-slate-500">Renewal Prob</div>
                  <div className="text-sm font-bold text-emerald-400">89% <span className="text-[9px] text-slate-500 font-normal">(was 84%)</span></div>
                </div>
              </div>

              {memoryEvolution && (
                <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 space-y-1">
                  <div className="text-purple-300 font-bold text-[10px] flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Strategy Evolved
                  </div>
                  <div className="text-slate-400 text-[9px]">
                    {memoryEvolution.previousRecommendation} ➔ <span className="text-white font-semibold">{playbookName}</span>
                  </div>
                </div>
              )}
            </div>
          </Section>

          {/* 5. AUDIT TRAIL */}
          <Section title="Audit Trail" icon={<History className="w-3.5 h-3.5 text-slate-400" />} defaultOpen={false}>
            <div className="space-y-2 pl-2 border-l border-white/10 text-[10px] font-mono">
              <div className="relative pl-3">
                <div className="absolute -left-[13px] top-1 w-2 h-2 rounded-full bg-indigo-400" />
                <div className="text-slate-300 font-bold">10:42 AM</div>
                <div className="text-slate-500">Recommendation Generated (v1.0)</div>
              </div>
              <div className="relative pl-3">
                <div className="absolute -left-[13px] top-1 w-2 h-2 rounded-full bg-blue-400" />
                <div className="text-slate-300 font-bold">10:45 AM</div>
                <div className="text-slate-500">User Opened Review Panel</div>
              </div>
              {currentStatus.includes("approved") && (
                <>
                  <div className="relative pl-3">
                    <div className="absolute -left-[13px] top-1 w-2 h-2 rounded-full bg-emerald-400" />
                    <div className="text-emerald-300 font-bold">10:46 AM</div>
                    <div className="text-slate-400">Recommendation Approved</div>
                  </div>
                  <div className="relative pl-3">
                    <div className="absolute -left-[13px] top-1 w-2 h-2 rounded-full bg-green-400" />
                    <div className="text-slate-300 font-bold">10:47 AM</div>
                    <div className="text-slate-500">Execution Plan Generated (Phase 9)</div>
                  </div>
                </>
              )}
            </div>
          </Section>

          {/* 6. EXECUTION GRAPH */}
          <Section title="Execution Graph" icon={<Cpu className="w-3.5 h-3.5" />} defaultOpen={false} badge={agentTimeline.length}>
            <div className="space-y-1">
              {agentTimeline.map((a) => (
                <AgentNode key={a.agent_name} name={a.agent_name} status={a.status} latency={a.latency_ms} />
              ))}
            </div>
          </Section>
        </>
      )}

        </div>
      </motion.aside>

      {/* HITL Modals portal */}
      <HitlModals activeModal={activeModal} onClose={() => setActiveModal(null)} onAction={handleModalAction} />
    </>
  );
}
