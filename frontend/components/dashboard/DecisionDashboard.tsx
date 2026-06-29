"use client";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert, TrendingUp, Brain, BookOpen, Sparkles,
  CheckCircle2, Clock, AlertCircle, History, Target,
  ChevronDown, ChevronUp, ExternalLink, ThumbsUp
} from "lucide-react";
import { useChatStore } from "@/lib/store";
import { ScoreRing } from "../ui/score-ring";
import { Progress } from "../ui/progress";
import { Badge } from "../ui/badge";
import { AgentTimeline } from "../agents/AgentTimeline";
import { ApprovalModal } from "./ApprovalModal";
import { cn, getRiskColor, getRiskBg, getPriorityColor, getConfidenceColor } from "@/lib/utils";
import { useState } from "react";

export function DecisionDashboard() {
  const { dashboard, recommendation, isStreaming, setApprovalModalOpen, agentTimeline } = useChatStore();
  const [expandedSection, setExpandedSection] = useState<string | null>("scores");

  function toggle(section: string) {
    setExpandedSection(prev => prev === section ? null : section);
  }

  const hasData = !!dashboard || isStreaming;

  return (
    <motion.aside
      initial={{ x: 320 }}
      animate={{ x: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="w-80 flex-shrink-0 h-full flex flex-col glass border-l border-white/[0.06] overflow-hidden"
    >
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold text-white">Decision Intelligence</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-3 px-3 space-y-3">
        {/* Empty state */}
        {!hasData && (
          <div className="py-12 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
              <Brain className="w-6 h-6 text-slate-600" />
            </div>
            <p className="text-xs text-slate-600">Send a message to see decision analytics</p>
          </div>
        )}

        {/* Scores */}
        {(dashboard || isStreaming) && (
          <DashSection title="Scores" icon={<Target className="w-3.5 h-3.5" />} id="scores" expanded={expandedSection === "scores"} onToggle={toggle}>
            <div className="grid grid-cols-2 gap-3 py-2">
              <ScoreRing
                value={dashboard?.confidence_score ?? 0}
                color="#818cf8"
                label="Confidence"
                sublabel="OVERALL"
                size={72}
              />
              <ScoreRing
                value={1 - (dashboard?.risk_score ?? 0)}
                color={dashboard?.risk_score ? (dashboard.risk_score > 0.6 ? "#f87171" : dashboard.risk_score > 0.4 ? "#fb923c" : "#4ade80") : "#4ade80"}
                label="Health Score"
                sublabel="ACCOUNT"
                size={72}
              />
              <ScoreRing
                value={(dashboard?.impact_score ?? 70) / 100}
                color="#c084fc"
                label="Impact"
                sublabel="POTENTIAL"
                size={72}
              />
              <ScoreRing
                value={dashboard?.score_breakdown?.data_coverage ?? 0}
                color="#38bdf8"
                label="Data Coverage"
                sublabel="EVIDENCE"
                size={72}
              />
            </div>

            {/* Score breakdown */}
            {dashboard?.score_breakdown && (
              <div className="mt-2 space-y-2">
                {Object.entries(dashboard.score_breakdown).map(([key, val]) => (
                  <div key={key}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] text-slate-500 capitalize">{key.replace(/_/g, " ")}</span>
                      <span className="text-[10px] text-slate-400">{((val as number) * 100).toFixed(0)}%</span>
                    </div>
                    <Progress value={(val as number) * 100} className="h-1" />
                  </div>
                ))}
              </div>
            )}
          </DashSection>
        )}

        {/* Risk Level */}
        {recommendation && (
          <DashSection title="Risk Assessment" icon={<ShieldAlert className="w-3.5 h-3.5" />} id="risk" expanded={expandedSection === "risk"} onToggle={toggle}>
            <div className={cn("p-3 rounded-xl border mb-2", getRiskBg(recommendation.risk_level))}>
              <div className="flex items-center justify-between mb-1">
                <span className={cn("text-sm font-bold uppercase tracking-wide", getRiskColor(recommendation.risk_level))}>
                  {recommendation.risk_level} Risk
                </span>
                <span className={cn("text-xs font-medium", getRiskColor(recommendation.risk_level))}>
                  {((recommendation.risk_score ?? 0) * 100).toFixed(0)}%
                </span>
              </div>
              <div className={cn("text-xs", getPriorityColor(recommendation.priority), "inline-flex items-center gap-1 px-2 py-0.5 rounded-full")}>
                {recommendation.priority?.toUpperCase()} PRIORITY
              </div>
            </div>

            {/* Risk factors */}
            {recommendation.risk_factors?.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] text-slate-600 uppercase tracking-wide font-medium">Risk Factors</p>
                {recommendation.risk_factors.slice(0, 4).map((r, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px] text-slate-400">
                    <AlertCircle className="w-3 h-3 text-orange-400 flex-shrink-0 mt-0.5" />
                    {r}
                  </div>
                ))}
              </div>
            )}
          </DashSection>
        )}

        {/* Recommendation */}
        {recommendation && (
          <DashSection title="Recommendation" icon={<Sparkles className="w-3.5 h-3.5 text-indigo-400" />} id="rec" expanded={expandedSection === "rec"} onToggle={toggle}>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-white leading-tight">{recommendation.title}</p>
              {recommendation.timeline && (
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Clock className="w-3 h-3 text-indigo-400" />
                  {recommendation.timeline}
                </div>
              )}
              {recommendation.roi_estimate && (
                <div className="flex items-center gap-1.5 text-[11px] text-yellow-400">
                  <TrendingUp className="w-3 h-3" />
                  {recommendation.roi_estimate}
                </div>
              )}
              {/* Approval status */}
              <div className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border",
                recommendation.approval_status === "approved" && "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
                recommendation.approval_status === "pending" && "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
                recommendation.approval_status === "rejected" && "bg-red-500/15 text-red-400 border-red-500/30",
                recommendation.approval_status === "modified" && "bg-blue-500/15 text-blue-400 border-blue-500/30",
                recommendation.approval_status === "escalated" && "bg-orange-500/15 text-orange-400 border-orange-500/30",
              )}>
                <CheckCircle2 className="w-3 h-3" />
                {recommendation.approval_status === "pending" ? "Awaiting Review" : `Status: ${recommendation.approval_status}`}
              </div>

              {recommendation.approval_status === "pending" && (
                <button
                  onClick={() => setApprovalModalOpen(true)}
                  className="w-full py-2 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-medium transition-all flex items-center justify-center gap-1.5"
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                  Review Recommendation
                </button>
              )}
            </div>
          </DashSection>
        )}

        {/* Evidence */}
        {(recommendation?.evidence?.length ?? 0) > 0 && recommendation && (
          <DashSection title="Evidence" icon={<BookOpen className="w-3.5 h-3.5" />} id="evidence" expanded={expandedSection === "evidence"} onToggle={toggle}>
            <div className="space-y-1.5">
              {(recommendation.evidence ?? []).slice(0, 5).map((ev, i) => (
                <div key={i} className="flex items-start gap-2 text-[11px] text-slate-400 p-2 rounded-lg bg-white/[0.02]">
                  <span className="text-indigo-400 flex-shrink-0 font-bold">{i + 1}</span>
                  {ev}
                </div>
              ))}
            </div>
            {(recommendation.sources?.length ?? 0) > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-[10px] text-slate-600 uppercase tracking-wide font-medium">Sources</p>
                {(recommendation.sources ?? []).map((s, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[11px] text-indigo-400">
                    <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
                    {s}
                  </div>
                ))}
              </div>
            )}
            {(recommendation.business_rules?.length ?? 0) > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-[10px] text-slate-600 uppercase tracking-wide font-medium">Business Rules</p>
                {(recommendation.business_rules ?? []).map((r, i) => (
                  <div key={i} className="text-[11px] text-slate-400 px-2 py-1 rounded bg-white/[0.02] border-l-2 border-indigo-500/40">
                    {r}
                  </div>
                ))}
              </div>
            )}
          </DashSection>
        )}

        {/* Memory */}
        {(recommendation?.memory_references?.filter(Boolean).length ?? 0) > 0 && recommendation && (
          <DashSection title="Memory References" icon={<Brain className="w-3.5 h-3.5" />} id="memory" expanded={expandedSection === "memory"} onToggle={toggle}>
            <div className="space-y-2">
              {(recommendation.memory_references ?? []).filter(Boolean).slice(0, 3).map((m, i) => (
                <div key={i} className="p-2 rounded-lg bg-purple-500/5 border border-purple-500/15 text-[11px] text-slate-400 leading-relaxed">
                  {m}
                </div>
              ))}
            </div>
          </DashSection>
        )}

        {/* Historical Cases */}
        {(recommendation?.similar_cases?.length ?? 0) > 0 && recommendation && (
          <DashSection title="Historical Cases" icon={<History className="w-3.5 h-3.5" />} id="history" expanded={expandedSection === "history"} onToggle={toggle}>
            <div className="space-y-2">
              {(recommendation.similar_cases ?? []).slice(0, 3).map((c, i) => (
                <div key={i} className="p-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 font-mono">{c.entity_id || `Case ${i + 1}`}</span>
                    <span className={cn(
                      "text-[9px] px-1.5 py-0.5 rounded-full font-medium",
                      c.outcome === "success" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
                    )}>
                      {c.outcome}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2">{c.summary}</p>
                  {c.result && <p className="text-[10px] text-indigo-400">{c.result}</p>}
                  <div className="flex items-center gap-1">
                    <div className="flex-1 h-0.5 rounded-full bg-white/[0.04]">
                      <div className="h-full rounded-full bg-indigo-500/50" style={{ width: `${c.similarity * 100}%` }} />
                    </div>
                    <span className="text-[9px] text-slate-600">{(c.similarity * 100).toFixed(0)}% match</span>
                  </div>
                </div>
              ))}
            </div>
          </DashSection>
        )}

        {/* Agent Timeline */}
        {agentTimeline.length > 0 && (
          <DashSection title="Agent Execution" icon={<CheckCircle2 className="w-3.5 h-3.5" />} id="agents" expanded={expandedSection === "agents"} onToggle={toggle}>
            <AgentTimeline />
            {dashboard && (
              <div className="mt-2 flex items-center justify-between text-[10px] text-slate-600 px-1">
                <span>{dashboard.agents_executed?.length ?? agentTimeline.length} agents</span>
                <span>{dashboard.execution_time_ms ? `${(dashboard.execution_time_ms / 1000).toFixed(1)}s total` : ""}</span>
              </div>
            )}
          </DashSection>
        )}

        {/* Improvement tips */}
        {(dashboard?.improvement_tips?.length ?? 0) > 0 && dashboard && (
          <div className="p-3 rounded-xl border border-yellow-500/20 bg-yellow-500/5">
            <p className="text-[10px] font-medium text-yellow-400 mb-1.5">💡 Improve Confidence</p>
            {(dashboard.improvement_tips ?? []).map((tip, i) => (
              <p key={i} className="text-[11px] text-slate-400 mb-1 leading-relaxed">{tip}</p>
            ))}
          </div>
        )}
      </div>

      <ApprovalModal />
    </motion.aside>
  );
}

function DashSection({
  title, icon, id, expanded, onToggle, children
}: {
  title: string;
  icon: React.ReactNode;
  id: string;
  expanded: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => onToggle(id)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2 text-slate-400">
          {icon}
          <span className="text-xs font-medium text-slate-300">{title}</span>
        </div>
        {expanded ? <ChevronUp className="w-3 h-3 text-slate-600" /> : <ChevronDown className="w-3 h-3 text-slate-600" />}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
