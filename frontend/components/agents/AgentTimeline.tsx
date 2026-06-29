"use client";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, Loader2, Clock, SkipForward } from "lucide-react";
import { useChatStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const AGENT_LABELS: Record<string, string> = {
  conversation_manager:      "Conversation Manager",
  information_completeness:  "Info Completeness",
  planner:                   "Planner Agent",
  memory_agent:              "Memory Agent",
  knowledge_agent:           "Knowledge Agent",
  domain_specialist:         "Domain Specialist",
  risk_agent:                "Risk Assessment",
  opportunity_agent:         "Opportunity Agent",
  recommendation_agent:      "Recommendation Agent",
  confidence_agent:          "Confidence Agent",
};

const AGENT_ICONS: Record<string, string> = {
  conversation_manager:     "💬",
  information_completeness: "📋",
  planner:                  "🗺️",
  memory_agent:             "🧠",
  knowledge_agent:          "📚",
  domain_specialist:        "🎯",
  risk_agent:               "⚠️",
  opportunity_agent:        "📈",
  recommendation_agent:     "✨",
  confidence_agent:         "📊",
};

export function AgentTimeline() {
  const { agentTimeline, isStreaming } = useChatStore();

  if (agentTimeline.length === 0 && !isStreaming) return null;

  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-wider text-slate-600 font-medium mb-2">Agent Execution</p>
      <AnimatePresence initial={false}>
        {agentTimeline.map((agent, i) => (
          <motion.div
            key={agent.agent_name}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className={cn(
              "flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg",
              agent.status === "running" && "bg-indigo-500/10 border border-indigo-500/20",
              agent.status === "completed" && "bg-emerald-500/5",
              agent.status === "failed" && "bg-red-500/10",
            )}
          >
            {/* Status icon */}
            <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
              {agent.status === "running" && (
                <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
              )}
              {agent.status === "completed" && (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              )}
              {agent.status === "failed" && (
                <XCircle className="w-3.5 h-3.5 text-red-400" />
              )}
              {agent.status === "pending" && (
                <Clock className="w-3.5 h-3.5 text-slate-600" />
              )}
              {agent.status === "skipped" && (
                <SkipForward className="w-3.5 h-3.5 text-slate-600" />
              )}
            </div>

            {/* Label */}
            <span className="text-[10px]">{AGENT_ICONS[agent.agent_name] ?? "🤖"}</span>
            <span className={cn(
              "text-xs flex-1 truncate",
              agent.status === "running" && "text-indigo-300 font-medium",
              agent.status === "completed" && "text-slate-300",
              agent.status === "failed" && "text-red-400",
              agent.status === "pending" && "text-slate-600",
              agent.status === "skipped" && "text-slate-600",
            )}>
              {AGENT_LABELS[agent.agent_name] ?? agent.agent_name}
            </span>

            {/* Latency */}
            {agent.latency_ms != null && agent.status === "completed" && (
              <span className="text-[9px] text-slate-600 flex-shrink-0">{agent.latency_ms}ms</span>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
