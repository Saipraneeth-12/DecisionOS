"use client";
/**
 * StreamingFeed — DecisionOS Streaming-First Center Panel
 *
 * Renders every SSE event in real-time as a flowing, typewriter-style feed.
 * Exactly like ChatGPT reasoning mode + Cursor agent mode.
 */
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Zap, CheckCircle2, Clock, Loader2, AlertTriangle,
  TrendingUp, Shield, Target, BookOpen, Sparkles, Eye,
  BarChart3, MapPin, ChevronDown, ChevronRight, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import styles from "./DecisionCanvas.module.css";

// ── Types ────────────────────────────────────────────────────────────────────

export type FeedEventType =
  | "input_received"
  | "workflow_state"
  | "memory_started" | "memory_complete"
  | "agent_start" | "agent_complete"
  | "context_completeness"
  | "domain_detection"
  | "planner_started" | "planner_complete" | "planner_decision"
  | "pattern_detected" | "pattern_detection"
  | "playbook_selected" | "playbook_selection"
  | "live_update"
  | "recommendation_streaming"
  | "recommendation_complete"
  | "hitl_phase"
  | "progress_check"
  | "execution_plan_started";

export interface FeedEvent {
  id: string;
  type: FeedEventType;
  ts: number;
  data: Record<string, unknown>;
}

interface StreamingFeedProps {
  events: FeedEvent[];
  streamingText: string;
  isStreaming: boolean;
  userMessage?: string;
}

// ── Icon + colour maps ────────────────────────────────────────────────────────

const AGENT_META: Record<string, { icon: string; label: string; color: string }> = {
  context_evaluator:        { icon: "🔎", label: "Context Evaluator",     color: "text-blue-400" },
  conversation_manager:     { icon: "💬", label: "Conversation Manager",  color: "text-sky-400"  },
  information_completeness: { icon: "📋", label: "Completeness Check",    color: "text-amber-400"},
  planner:                  { icon: "🗺️", label: "Planner",               color: "text-indigo-400"},
  memory_agent:             { icon: "🧠", label: "Memory Agent",          color: "text-purple-400"},
  knowledge_agent:          { icon: "📚", label: "Knowledge Agent",       color: "text-emerald-400"},
  domain_specialist:        { icon: "🎯", label: "Domain Specialist",     color: "text-orange-400"},
  risk_agent:               { icon: "⚠️", label: "Risk Agent",            color: "text-rose-400" },
  opportunity_agent:        { icon: "📈", label: "Opportunity Agent",     color: "text-green-400" },
  pattern_detection_agent:  { icon: "🔬", label: "Pattern Agent",         color: "text-violet-400"},
  playbook_router:          { icon: "📖", label: "Playbook Router",       color: "text-cyan-400"  },
  recommendation_agent:     { icon: "✨", label: "Recommendation Agent",  color: "text-yellow-400"},
  confidence_agent:         { icon: "📊", label: "Confidence Agent",      color: "text-lime-400"  },
  progress_check_agent:     { icon: "🔄", label: "Progress Check",        color: "text-teal-400"  },
  approval_agent:           { icon: "✅", label: "Approval Agent",        color: "text-emerald-400"},
  memory_updater:           { icon: "💾", label: "Memory Updater",        color: "text-slate-400" },
};

const PHASE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  CHECKING_MEMORY:           { label: "Checking Memory",          icon: <Brain className="w-3.5 h-3.5" />,      color: "text-purple-400" },
  MEMORY_FOUND:              { label: "Memory Found",             icon: <Brain className="w-3.5 h-3.5" />,      color: "text-emerald-400" },
  PLANNING:                  { label: "Planning",                 icon: <MapPin className="w-3.5 h-3.5" />,     color: "text-indigo-400" },
  DIAGNOSING:                { label: "Running Diagnostics",      icon: <Shield className="w-3.5 h-3.5" />,     color: "text-orange-400" },
  PATTERN_ANALYSIS:          { label: "Pattern Classification",   icon: <Eye className="w-3.5 h-3.5" />,        color: "text-violet-400" },
  PLAYBOOK_SELECTION:        { label: "Selecting Playbook",       icon: <BookOpen className="w-3.5 h-3.5" />,   color: "text-cyan-400" },
  GENERATING_RECOMMENDATIONS:{ label: "Generating Recommendation",icon: <Sparkles className="w-3.5 h-3.5" />,  color: "text-yellow-400" },
  AWAITING_APPROVAL:         { label: "Awaiting Approval",        icon: <Target className="w-3.5 h-3.5" />,     color: "text-amber-400" },
  CONTEXT_COMPLETE:          { label: "Context Complete",         icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: "text-emerald-400" },
  MISSING_INFORMATION:       { label: "Missing Information",      icon: <AlertTriangle className="w-3.5 h-3.5" />, color: "text-amber-400" },
  PROGRESS_CHECK:            { label: "Progress Check",           icon: <TrendingUp className="w-3.5 h-3.5" />, color: "text-teal-400" },
  MEMORY_UPDATE:             { label: "Updating Memory",          icon: <Brain className="w-3.5 h-3.5" />,      color: "text-slate-400" },
  LEARNING:                  { label: "Learning",                 icon: <Zap className="w-3.5 h-3.5" />,        color: "text-lime-400" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function usePrevious<T>(val: T) {
  const ref = useRef<T>(val);
  useEffect(() => { ref.current = val; });
  return ref.current;
}

function PulseDot({ color = "bg-indigo-400" }: { color?: string }) {
  return (
    <span className="relative flex h-2 w-2 flex-shrink-0">
      <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-60", color)} />
      <span className={cn("relative inline-flex rounded-full h-2 w-2", color)} />
    </span>
  );
}

function DoneDot() {
  return <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />;
}

function SkipDot() {
  return <span className="w-2 h-2 rounded-full bg-slate-700 flex-shrink-0" />;
}

// ── Event Renderers ──────────────────────────────────────────────────────────

function MemoryStartedRow() {
  return (
    <div className="flex items-start gap-3">
      <PulseDot color="bg-purple-400" />
      <div className="space-y-1 min-w-0">
        <p className="text-[12px] font-semibold text-purple-300">Checking organizational memory…</p>
        <div className="flex flex-col gap-0.5 text-[11px] text-slate-500 pl-2">
          <span>↳ Searching previous sessions…</span>
          <span>↳ Searching outcomes…</span>
          <span>↳ Searching historical recommendations…</span>
        </div>
      </div>
    </div>
  );
}

function MemoryCompleteRow({ data }: { data: Record<string, unknown> }) {
  const found = data.found as boolean;
  const count = data.count as number;
  return (
    <div className="flex items-start gap-3">
      <DoneDot />
      <div className="space-y-1 min-w-0">
        {found ? (
          <>
            <p className="text-[12px] font-semibold text-emerald-300">✓ Similar scenario found</p>
            <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-xl p-3 space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Similar Cases</span>
                <span className="text-emerald-400 font-bold">{count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Memory Signal</span>
                <span className="text-emerald-400 font-bold">Strong</span>
              </div>
            </div>
          </>
        ) : (
          <p className="text-[12px] font-semibold text-slate-400">✓ Memory checked — no prior cases</p>
        )}
      </div>
    </div>
  );
}

function AgentStartRow({ agentName }: { agentName: string }) {
  const meta = AGENT_META[agentName] ?? { icon: "⚙️", label: agentName.replace(/_/g, " "), color: "text-slate-400" };
  return (
    <div className="flex items-center gap-2.5">
      <PulseDot color="bg-indigo-400" />
      <span className="text-base flex-shrink-0">{meta.icon}</span>
      <span className={cn("text-[12px] font-semibold", meta.color)}>{meta.label}</span>
      <span className="text-[10px] text-slate-600 animate-pulse">Running…</span>
    </div>
  );
}

function AgentCompleteRow({ agentName, data }: { agentName: string; data: Record<string, unknown> }) {
  const meta = AGENT_META[agentName] ?? { icon: "⚙️", label: agentName.replace(/_/g, " "), color: "text-slate-400" };
  const status = data.status as string;
  const skipped = status === "skipped";
  const latency = data.latency_ms as number;
  return (
    <div className="flex items-center gap-2.5">
      {skipped ? <SkipDot /> : <DoneDot />}
      <span className="text-base flex-shrink-0">{meta.icon}</span>
      <span className={cn("text-[12px] font-semibold", skipped ? "text-slate-600 line-through" : meta.color)}>
        {meta.label}
      </span>
      {skipped ? (
        <span className="text-[10px] text-slate-600 ml-1">Skipped</span>
      ) : (
        <>
          <span className="text-[10px] text-emerald-600 font-bold">✓</span>
          {latency ? <span className="text-[10px] text-slate-700 ml-auto">{latency}ms</span> : null}
        </>
      )}
    </div>
  );
}

function WorkflowStateRow({ state }: { state: string }) {
  const cfg = PHASE_CONFIG[state];
  if (!cfg) return null;
  return (
    <div className="flex items-center gap-2 py-0.5">
      <div className="h-px flex-1 bg-white/[0.04]" />
      <div className={cn("flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border bg-white/[0.02]",
        cfg.color, "border-current/20")}>
        {cfg.icon}
        {cfg.label}
      </div>
      <div className="h-px flex-1 bg-white/[0.04]" />
    </div>
  );
}

function ContextCompletenessRow({ data }: { data: Record<string, unknown> }) {
  const score = (data.score as number) ?? 0;
  const provided = (data.provided_fields as string[]) ?? [];
  const missing  = (data.missing_fields  as string[]) ?? [];
  const color = score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-amber-500" : "bg-rose-500";
  const textColor = score >= 80 ? "text-emerald-400" : score >= 60 ? "text-amber-400" : "text-rose-400";
  return (
    <div className="flex items-start gap-3">
      <DoneDot />
      <div className="space-y-2 flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-semibold text-slate-300">Context Completeness</p>
          <span className={cn("text-[13px] font-black", textColor)}>{score}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
          <motion.div className={cn("h-full rounded-full", color)} initial={{ width: 0 }} animate={{ width: `${score}%` }} transition={{ duration: 0.6, ease: "easeOut" }} />
        </div>
        {provided.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {provided.slice(0, 7).map(f => (
              <span key={f} className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">✓ {f}</span>
            ))}
          </div>
        )}
        {missing.length > 0 && (
          <div className="text-[10px] text-slate-600">
            Missing: {missing.slice(0, 3).join(", ")}
          </div>
        )}
      </div>
    </div>
  );
}

function PlannerRow({ data }: { data: Record<string, unknown> }) {
  const mode = (data.execution_mode as string) ?? "standard";
  const notes = (data.planning_notes as string) ?? "";
  return (
    <div className="flex items-start gap-3">
      <DoneDot />
      <div className="space-y-1.5 flex-1 min-w-0">
        <p className="text-[12px] font-semibold text-indigo-300">✓ Execution Graph Built</p>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="text-slate-500">Mode:</span>
          <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 font-bold text-[10px] uppercase">{mode}</span>
        </div>
        {notes && <p className="text-[11px] text-slate-500 leading-relaxed">{notes.slice(0, 120)}{notes.length > 120 ? "…" : ""}</p>}
      </div>
    </div>
  );
}

function PatternRow({ data }: { data: Record<string, unknown> }) {
  const patterns = (data.patterns as string[]) ?? [(data.value as string)].filter(Boolean);
  const confidence = ((data.confidence as number) ?? 0.75) * 100;
  return (
    <div className="flex items-start gap-3">
      <DoneDot />
      <div className="space-y-1.5 flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-semibold text-violet-300">✓ Patterns Classified</p>
          <span className="text-[10px] text-slate-600">{Math.round(confidence)}% confidence</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {patterns.slice(0, 5).map(p => (
            <motion.span key={p} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
              className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/25 font-semibold">
              {p}
            </motion.span>
          ))}
        </div>
      </div>
    </div>
  );
}

function PlaybookRow({ data }: { data: Record<string, unknown> }) {
  const playbook = (data.selected_playbook ?? data.value) as string;
  return (
    <div className="flex items-start gap-3">
      <DoneDot />
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold text-cyan-300">✓ Playbook Selected</p>
        <div className="mt-1 flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-cyan-950/30 border border-cyan-500/20">
          <BookOpen className="w-3 h-3 text-cyan-400 flex-shrink-0" />
          <span className="text-[11px] text-cyan-300 font-semibold">{playbook}</span>
        </div>
      </div>
    </div>
  );
}

function DomainRow({ data }: { data: Record<string, unknown> }) {
  const domain = (data.detected_domain as string) ?? "";
  const conf   = ((data.confidence as number) ?? 0.88) * 100;
  return (
    <div className="flex items-center gap-3">
      <DoneDot />
      <p className="text-[12px] font-semibold text-orange-300">✓ Domain Detected</p>
      <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-300 border border-orange-500/20 font-bold capitalize">{domain.replace("_", " ")}</span>
      <span className="text-[10px] text-slate-600 ml-auto">{Math.round(conf)}% confidence</span>
    </div>
  );
}

function LiveUpdateRow({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2.5 text-[11px] text-slate-500 italic pl-1">
      <Loader2 className="w-3 h-3 animate-spin text-indigo-500/50 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function RecommendationStreamingRow({ text, done }: { text: string; done: boolean }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {done ? <DoneDot /> : <PulseDot color="bg-yellow-400" />}
        <p className="text-[12px] font-bold text-yellow-300">
          {done ? "✓ Recommendation Complete" : "Generating Recommendation…"}
        </p>
      </div>
      {text && (
        <div className={cn("pl-5 text-sm text-slate-200 leading-relaxed prose-dark", !done && styles.typingCursor)}>
          <pre className="font-sans whitespace-pre-wrap break-words">{text}</pre>
        </div>
      )}
    </div>
  );
}

function HitlPhaseRow({ data }: { data: Record<string, unknown> }) {
  const label  = data.label as string;
  const status = data.status as string;
  const isDone = status === "completed";
  const isRun  = status === "running";
  return (
    <div className="flex items-center gap-2.5">
      {isDone ? <DoneDot /> : isRun ? <PulseDot color="bg-amber-400" /> : <SkipDot />}
      <span className={cn("text-[12px] font-semibold", isDone ? "text-emerald-300" : isRun ? "text-amber-300" : "text-slate-500")}>
        {isDone ? "✓" : isRun ? "●" : "○"} {label}
      </span>
    </div>
  );
}

function InputRow({ message }: { message: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-indigo-400 flex-shrink-0" />
        <p className="text-[11px] font-bold text-indigo-300 uppercase tracking-widest">Input Received</p>
      </div>
      <div className="ml-5 px-4 py-3 rounded-xl bg-indigo-500/8 border border-indigo-500/15 text-[12px] text-slate-300 leading-relaxed">
        {message}
      </div>
    </div>
  );
}

// ── Main StreamingFeed ────────────────────────────────────────────────────────

export function StreamingFeed({ events, streamingText, isStreaming, userMessage }: StreamingFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevLen   = usePrevious(events.length);

  useEffect(() => {
    if (events.length !== prevLen || streamingText)
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [events.length, streamingText]);

  const recStreamingStarted = events.some(e => e.type === "recommendation_streaming");
  const recComplete         = events.some(e => e.type === "recommendation_complete");

  // Collapse repeated live_update runs: only show last live_update before next event type
  const dedupedEvents: FeedEvent[] = [];
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.type === "live_update") {
      const next = events[i + 1];
      if (next && next.type === "live_update") continue; // skip, keep last only
    }
    dedupedEvents.push(e);
  }

  return (
    <div className="space-y-3 py-2">
      {userMessage && (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
          <InputRow message={userMessage} />
        </motion.div>
      )}

      {dedupedEvents.map((evt, idx) => (
        <motion.div
          key={evt.id}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.18, delay: Math.min(idx * 0.02, 0.3) }}
        >
          {evt.type === "workflow_state"          && <WorkflowStateRow state={evt.data.state as string} />}
          {evt.type === "memory_started"          && <MemoryStartedRow />}
          {evt.type === "memory_complete"         && <MemoryCompleteRow data={evt.data} />}
          {evt.type === "agent_start"             && <AgentStartRow agentName={evt.data.agent_name as string} />}
          {evt.type === "agent_complete"          && <AgentCompleteRow agentName={evt.data.agent_name as string} data={evt.data} />}
          {evt.type === "context_completeness"    && <ContextCompletenessRow data={evt.data} />}
          {evt.type === "domain_detection"        && <DomainRow data={evt.data} />}
          {(evt.type === "planner_complete" || evt.type === "planner_decision") && <PlannerRow data={evt.data} />}
          {(evt.type === "pattern_detected" || evt.type === "pattern_detection") && <PatternRow data={evt.data} />}
          {(evt.type === "playbook_selected" || evt.type === "playbook_selection") && <PlaybookRow data={evt.data} />}
          {evt.type === "live_update"             && <LiveUpdateRow message={evt.data.message as string} />}
          {evt.type === "hitl_phase"              && <HitlPhaseRow data={evt.data} />}
          {evt.type === "recommendation_streaming" && (
            <RecommendationStreamingRow text={streamingText} done={recComplete} />
          )}
        </motion.div>
      ))}

      {/* Streaming recommendation text if not yet recorded as event */}
      {isStreaming && !recStreamingStarted && streamingText && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <RecommendationStreamingRow text={streamingText} done={false} />
        </motion.div>
      )}

      {/* Generic still-streaming indicator */}
      {isStreaming && dedupedEvents.length === 0 && !streamingText && (
        <div className="flex items-center gap-2.5 py-2">
          <PulseDot color="bg-indigo-400" />
          <p className="text-[12px] text-indigo-300 font-semibold animate-pulse">Starting workflow orchestration…</p>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
