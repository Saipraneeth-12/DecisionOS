"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useChatStore } from "@/lib/store";
import { streamChat, fetchConversations, fetchConversation, type Recommendation, approveByConversation, uploadDocument } from "@/lib/api";
import { cn, getDomainLabel, DOMAINS } from "@/lib/utils";
import { StageBadge } from "../ui/stage-badge";
import { Progress } from "../ui/progress";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import toast from "react-hot-toast";
import {
  Loader2, Send, Paperclip, ChevronDown, Brain, Cpu,
  CheckCircle2, Clock, Zap, LayoutDashboard, Pencil,
  Check, X, Share2, Download, User, Bot, AlertCircle,
  FileText, FileSpreadsheet, Mail, BookOpen, Copy, TrendingUp, Sparkles, AlertTriangle, Play, HelpCircle, ArrowRight
} from "lucide-react";
import { StrategyEvolutionCard } from "./StrategyEvolutionCard";
import { OutcomeCaptureCard } from "./OutcomeCaptureCard";
import { LifecycleTimeline } from "./LifecycleTimeline";
import { StreamingFeed, type FeedEvent } from "./StreamingFeed";
import { RightPanel } from "./RightPanel";
import styles from "./DecisionCanvas.module.css";

// ── Agent display maps ────────────────────────────────────────────────────
const AGENT_ICONS: Record<string, string> = {
  context_evaluator:        "🔎",
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
  pattern_detection_agent:  "🔬",
  playbook_router:          "📋",
  progress_check_agent:     "🔄",
  approval_agent:           "✅",
  execution_plan_agent:     "⚡",
};

function getAgentSummary(name: string, out: Record<string, unknown>): string {
  const o = out as Record<string, unknown>;
  switch (name) {
    case "context_evaluator": {
      const cls   = (o.context_class  as string) ?? "";
      const score = (o.context_score  as number) ?? 0;
      const route = (o.routing        as string) ?? "";
      const provided = ((o.provided_fields as string[]) ?? []).length;
      if (route === "GREETING_FLOW") return "Greeting detected — lightweight response";
      if (route === "CONTEXT_REQUEST") return `Low context (${score}/100) — requesting more information`;
      if (route === "HITL_FLOW") return `HITL command detected — lifecycle action`;
      return `${cls} (${score}/100) · ${provided} fields · ${route === "FULL_PIPELINE" ? "full pipeline" : "partial pipeline"}`;
    }
    case "conversation_manager": {
      const intent = (o.intent  as string) ?? "Decision analysis";
      const domain = (o.domain  as string) ?? "";
      const urg    = (o.urgency as string) ?? "medium";
      return `Intent: ${intent} · Domain: ${getDomainLabel(domain)} · Urgency: ${urg}`;
    }
    case "information_completeness": {
      const q    = (o.information_quality as string) ?? "medium";
      const avail= (o.available_count     as number) ?? 0;
      return `${q.charAt(0).toUpperCase()+q.slice(1)} quality · ${avail} source${avail!==1?"s":""} available`;
    }
    case "planner": {
      const mode = (o.execution_mode as string) ?? "standard";
      const stage = (o.planning_notes as string) ?? "Execution plan generated";
      return stage.slice(0, 80) + (stage.length > 80 ? "…" : "");
    }
    case "memory_agent": {
      const n = ((o.similar_cases as unknown[]) ?? []).length;
      const t = (o.total_retrieved as number) ?? 0;
      return n > 0 ? `Found ${n} similar case${n>1?"s":""} · ${t} memories` : "No prior cases found";
    }
    case "knowledge_agent": {
      const t = (o.total_retrieved as number) ?? 0;
      return t > 0 ? `Retrieved ${t} knowledge item${t>1?"s":""}` : "No relevant knowledge retrieved";
    }
    case "domain_specialist": {
      const rc = (o.root_cause as string) ?? "";
      return rc ? rc.slice(0,120)+(rc.length>120?"…":"") : "Domain analysis complete";
    }
    case "risk_agent": {
      const lvl  = (o.risk_level as string) ?? (o.overall_risk_level as string) ?? "unknown";
      const prob = (o.churn_probability as number) ?? null;
      const esc  = (o.escalation_needed as boolean);
      if (lvl === "unknown" || prob == null) return "Risk: UNKNOWN — insufficient data";
      return `Risk: ${lvl.toUpperCase()} · ${Math.round(prob*100)}% prob${esc?" · Escalation":""}`;
    }
    case "opportunity_agent": {
      const opp   = (o.primary_opportunity as string) ?? null;
      const count = ((o.opportunities as unknown[]) ?? []).length;
      return opp ?? `${count} opportunit${count!==1?"ies":"y"} identified`;
    }
    case "recommendation_agent":
      return (o.title as string) ? `"${(o.title as string).slice(0,60)}"` : "Generating Next Best Action…";
    case "confidence_agent": {
      const score  = (o.confidence_score  as number|null) ?? null;
      const label  = (o.confidence_label  as string) ?? "";
      const insuff = (o.insufficient_data as boolean);
      if (insuff || score == null) return `${label || "Insufficient Data"}`;
      return `${label} — ${Math.round(score*100)}% confidence`;
    }
    case "pattern_detection_agent": {
      const patterns = ((o.patterns as string[]) ?? []);
      const conf = (o.confidence as number) ?? 0;
      return patterns.length > 0 ? `${patterns.slice(0,2).join(", ")} · ${Math.round(conf*100)}% conf` : "No strong patterns";
    }
    case "playbook_router": {
      const pb = (o.selected_playbook as string) ?? "";
      return pb ? `Selected: ${pb}` : "No playbook matched";
    }
    case "progress_check_agent": {
      const summary = (o.update_summary as string) ?? "";
      const hasUpdates = (o.has_updates as boolean);
      return hasUpdates ? summary.slice(0, 80) + (summary.length > 80 ? "…" : "") : "No updates detected";
    }
    case "approval_agent": {
      const status = (o.new_status as string) ?? "";
      const nbaId  = (o.recommendation_id as string) ?? "";
      return status ? `${nbaId} → ${status.toUpperCase()}` : "Processing lifecycle action";
    }
    case "execution_plan_agent": {
      const steps = (o.steps as number) ?? 0;
      const execId = (o.execution_id as string) ?? "";
      return steps > 0 ? `${steps} steps · ${execId}` : "Execution plan generated";
    }
    default: return "Complete";
  }
}


interface AgentLine { agent_name: string; status: "running"|"completed"|"skipped"|"pending"; summary: string; }

// ── Main Component ────────────────────────────────────────────────────────
export function DecisionCanvas() {
  const {
    activeConversationId, conversations, messages, setMessages, addMessage,
    isStreaming, setIsStreaming, streamingText, appendStreamText, clearStreamText,
    updateAgentStatus, resetAgentTimeline, agentTimeline,
    setChecklist, setChecklistVisible, setDashboard, setRecommendation,
    recommendation, selectedDomain, setSelectedDomain,
    toggleRightPanel, rightPanelOpen, updateConversation,
    setCurrentStage, setMemoryDiscovery, memoryDiscovery, setDecisionReadiness,
    setActiveConversation, setApprovalModalOpen,
    executionPlan, setExecutionPlan, liveThought, setLiveThought,
    plannerSummary, setPlannerSummary, forceExecution, setForceExecution,
    addUploadedDoc,
    detectedPatterns, setDetectedPatterns, selectedPlaybook, setSelectedPlaybook,
    memoryEvolution, setMemoryEvolution,
    hitlPhases, hitlResult, addHitlPhase, setHitlResult, clearHitlState,
    outcomeCapture, setOutcomeCapture,
    strategyEvolution, addStrategyEntry, clearStrategyEvolution,
    feedEvents, addFeedEvent, clearFeedEvents, resetConversationState,
    // V2 state
    setWorkflowState, setPlannerDecision, setConfidenceBreakdown,
    setContextFields, setDomainDetection, setProgressCheckResult, setExecutionMode,
  } = useChatStore();

  const bottomRef   = useRef<HTMLDivElement>(null);
  const abortRef    = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [inputValue,   setInputValue]   = useState("");
  const [domainOpen,   setDomainOpen]   = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft,   setTitleDraft]   = useState("");
  const [loadingConv,  setLoadingConv]  = useState(false);
  const [agentLines,   setAgentLines]   = useState<AgentLine[]>([]);
  const [showUploadZone, setShowUploadZone] = useState(false);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  const activeConv     = conversations.find((c) => c.id === activeConversationId);
  const activeMessages = activeConversationId ? (messages[activeConversationId] ?? []) : [];
  const userMessages   = activeMessages.filter((m) => m.role === "user");
  const threadMessages = activeMessages.filter((m) => m.role === "user" || m.role === "assistant");
  const isContextRequired = !!(recommendation as unknown as { is_context_required?: boolean })?.is_context_required;
  const rec = recommendation as any;
  const confScore = rec?.confidence_score ?? 0.87;
  const confPct = Math.round(confScore * 100);

  useEffect(() => {
    if (!activeConversationId || messages[activeConversationId]) return;
    setLoadingConv(true);
    fetchConversation(activeConversationId)
      .then((d) => {
        setMessages(activeConversationId, d.messages ?? []);
        // Attempt to extract previous recommendation if exists
        const latestRec = d.messages?.find(m => m.metadata?.has_recommendation);
        if (latestRec) {
          fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"}/conversations/${activeConversationId}/recommendation`)
            .then(res => res.json())
            .then(r => {
              setRecommendation(r);
              if (r.detected_patterns) {
                setDetectedPatterns({ patterns: r.detected_patterns, confidence: 0.85, evidence_signals: [] });
              } else {
                setDetectedPatterns(null);
              }
              if (r.selected_playbook) {
                setSelectedPlaybook({ selected_playbook: r.selected_playbook, active_playbooks: [r.selected_playbook], playbook_guidance: r.playbook_guidance ?? {} });
              } else {
                setSelectedPlaybook(null);
              }
              if (r.recommendation_updated) {
                setMemoryEvolution({
                  updated: r.recommendation_updated,
                  previousRecommendation: r.previous_recommendation ?? null,
                  previousStatus: r.previous_status ?? null,
                  reasoningSummary: r.reasoning_summary ?? ""
                });
              } else {
                setMemoryEvolution(null);
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {}).finally(() => setLoadingConv(false));
  }, [activeConversationId]);

  useEffect(() => { setAgentLines([]); }, [activeConversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [threadMessages.length, streamingText, recommendation, agentLines.length, liveThought]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 136) + "px";
  }, [inputValue]);

  function commitTitle() {
    const t = titleDraft.trim();
    if (t && activeConversationId && t !== activeConv?.title)
      updateConversation(activeConversationId, { title: t });
    setEditingTitle(false);
  }

  const handleSend = useCallback((overrideMsg?: string) => {
    const message = overrideMsg !== undefined ? overrideMsg : inputValue.trim();
    if (!message || isStreaming) return;
    if (overrideMsg === undefined) setInputValue("");
    setCurrentStage("analyzing");
    setAgentLines([]);

    const convId = activeConversationId;
    addMessage(convId ?? "new", {
      id: `tmp-${Date.now()}`, conversation_id: convId ?? "new",
      role: "user", content: message, metadata: {},
      created_at: new Date().toISOString(),
    });

    resetAgentTimeline(); clearStreamText();
    setDashboard(null); setRecommendation(null);
    setChecklistVisible(false); setMemoryDiscovery(null); setDecisionReadiness(null);
    setExecutionPlan(null); setLiveThought("Starting workflow orchestration..."); setPlannerSummary(null);
    setDetectedPatterns(null); setSelectedPlaybook(null); setMemoryEvolution(null);
    clearHitlState(); setOutcomeCapture(null); clearFeedEvents();
    // V2 resets
    setWorkflowState("WAITING_FOR_INPUT"); setPlannerDecision(null);
    setConfidenceBreakdown([]); setContextFields({}, [], []); setDomainDetection(null);
    setProgressCheckResult(null);
    setIsStreaming(true);

    abortRef.current = new AbortController();
    let buf = "";
    let resolvedId: string | null = convId;

    streamChat(message, convId, selectedDomain, (event) => {
      switch (event.type) {
        // ── V2 events ─────────────────────────────────────────────────
        case "workflow_state": {
          const ws = event.data as { state: string; label?: string };
          setWorkflowState(ws.state);
          addFeedEvent("workflow_state", event.data);
          break;
        }
        case "planner_decision": {
          const pd = event.data as any;
          setPlannerDecision(pd.decision ?? pd);
          if (pd.execution_mode) setExecutionMode(pd.execution_mode);
          addFeedEvent("planner_decision", event.data);
          break;
        }
        case "planner_started": {
          addFeedEvent("planner_started", event.data);
          break;
        }
        case "planner_complete": {
          addFeedEvent("planner_complete", event.data);
          break;
        }
        case "memory_started": {
          addFeedEvent("memory_started", event.data);
          break;
        }
        case "memory_complete": {
          addFeedEvent("memory_complete", event.data);
          break;
        }
        case "pattern_detected": {
          addFeedEvent("pattern_detected", event.data);
          break;
        }
        case "playbook_selected": {
          addFeedEvent("playbook_selected", event.data);
          break;
        }
        case "confidence_breakdown": {
          const cb = event.data as { breakdown?: any[]; score?: number; label?: string };
          if (cb.breakdown) setConfidenceBreakdown(cb.breakdown);
          break;
        }
        case "context_completeness": {
          const cc = event.data as {
            score?: number; class?: string;
            provided_fields?: string[]; missing_fields?: string[];
            field_scores?: Record<string, number>;
          };
          setContextFields(
            cc.field_scores ?? {},
            cc.provided_fields ?? [],
            cc.missing_fields ?? []
          );
          addFeedEvent("context_completeness", event.data);
          break;
        }
        case "domain_detection": {
          setDomainDetection(event.data as any);
          addFeedEvent("domain_detection", event.data);
          break;
        }
        case "progress_check": {
          setProgressCheckResult(event.data as any);
          addFeedEvent("progress_check", event.data);
          break;
        }
        // ── Existing events ────────────────────────────────────────────
        case "pattern_detection": {
          setDetectedPatterns(event.data as any);
          addFeedEvent("pattern_detection", event.data);
          break;
        }
        case "playbook_selection": {
          setSelectedPlaybook(event.data as any);
          addFeedEvent("playbook_selection", event.data);
          break;
        }
        case "text": {
          const t = (event.data as { content?: string }).content ?? "";
          buf += t; appendStreamText(t); break;
        }
        case "plan": {
          setExecutionPlan(event.data as any);
          break;
        }
        case "live_update": {
          const msg = (event.data as { message: string }).message;
          setLiveThought(msg);
          addFeedEvent("live_update", event.data);
          break;
        }
        case "agent_start": {
          const d = event.data as { agent_name: string };
          updateAgentStatus(d.agent_name, "running");
          addFeedEvent("agent_start", event.data);
          setAgentLines((p) => {
            if (p.find((l) => l.agent_name === d.agent_name))
              return p.map((l) => l.agent_name === d.agent_name ? { ...l, status: "running" } : l);
            return [...p, { agent_name: d.agent_name, status: "running", summary: "Running…" }];
          });
          break;
        }
        case "agent_complete": {
          const d = event.data as { agent_name: string; latency_ms?: number; output?: Record<string, unknown>; status?: string };
          const status = (d.status === "skipped" ? "skipped" : "completed") as AgentLine["status"];
          updateAgentStatus(d.agent_name, status, d.output, d.latency_ms);
          const summary = d.output ? getAgentSummary(d.agent_name, d.output) : (status === "skipped" ? "Skipped — insufficient context" : "Complete");
          setAgentLines((p) => p.map((l) => l.agent_name === d.agent_name ? { ...l, status, summary } : l));
          addFeedEvent("agent_complete", { ...event.data, status });
          if (d.agent_name === "memory_agent" && d.output) {
            const cases = ((d.output as { similar_cases?: unknown[] }).similar_cases ?? []);
            if (cases.length > 0)
              setMemoryDiscovery({ found: true, count: cases.length, cases: cases as Parameters<typeof setMemoryDiscovery>[0] extends { cases: infer C } ? C : never });
          }
          if (d.agent_name === "information_completeness" && d.output) {
            const items = ((d.output as { checklist?: Array<{name:string;status:string;required:boolean}> }).checklist ?? []);
            const dims  = items.slice(0,6).map((i) => ({ label: i.name, score: i.status==="available"?100:i.status==="partial"?50:0 }));
            const avg   = dims.length ? dims.reduce((a,d)=>a+d.score,0)/dims.length : 0;
            setDecisionReadiness({ score: Math.round(avg), dimensions: dims, missing: items.filter((i)=>i.status==="missing"&&i.required).map((i)=>i.name) });
          }
          break;
        }
        case "checklist": {
          const d = event.data as { checklist: unknown[] };
          setChecklist(d.checklist as Parameters<typeof setChecklist>[0]);
          setChecklistVisible(true); break;
        }
        case "recommendation": {
          const rec = event.data as unknown as Recommendation;
          setRecommendation(rec);
          if (rec.recommendation_updated) {
            setMemoryEvolution({
              updated: rec.recommendation_updated,
              previousRecommendation: rec.previous_recommendation ?? null,
              previousStatus: rec.previous_status ?? null,
              reasoningSummary: rec.reasoning_summary ?? ""
            });
          } else {
            setMemoryEvolution(null);
          }
          if (rec.detected_patterns) {
            setDetectedPatterns({ patterns: rec.detected_patterns, confidence: 0.85, evidence_signals: [] });
          }
          if (rec.selected_playbook) {
            setSelectedPlaybook({ selected_playbook: rec.selected_playbook, active_playbooks: [rec.selected_playbook], playbook_guidance: rec.playbook_guidance ?? {} });
          }
          setCurrentStage("needs_review");
          const cid = resolvedId ?? convId;
          if (cid) {
            const existing = useChatStore.getState().conversations.find((c) => c.id === cid);
            if (!existing || existing.title === "Untitled Analysis" || !existing.title) {
              if (rec.title) updateConversation(cid, { title: rec.title, status: "needs_review" });
            } else { updateConversation(cid, { status: "needs_review" }); }
          }
          break;
        }
        case "dashboard":
          setDashboard(event.data as unknown as Parameters<typeof setDashboard>[0]); break;
        case "hitl_phase": {
          // HITL Phase tracker — Phase 6 (Approval) and Phase 7 (Execution Planning)
          const hp = event.data as { phase: number; label: string; status: string; recommendation_id?: string; transition?: string };
          addHitlPhase({
            phase: hp.phase,
            label: hp.label,
            status: hp.status as 'running' | 'completed' | 'failed',
            recommendation_id: hp.recommendation_id,
            transition: hp.transition,
          });
          setLiveThought(`Phase ${hp.phase}: ${hp.label} — ${hp.status}`);
          break;
        }
        case "hitl_result": {
          const hr = event.data as any;
          setHitlResult(hr);
          // If approved, update conversation stage
          if (hr.action === 'approve' && hr.success) {
            const cid = resolvedId ?? convId;
            if (cid) updateConversation(cid, { status: 'approved' });
            setCurrentStage('approved');
          } else if (hr.action === 'reject' && hr.success) {
            const cid = resolvedId ?? convId;
            if (cid) updateConversation(cid, { status: 'needs_review' });
            setCurrentStage('needs_review');
          }
          break;
        }
        case "execution_plan": {
          // Full execution plan received after approval
          const plan = event.data as any;
          setExecutionPlan(plan);
          setCurrentStage('approved');
          toast.success('Execution plan generated', { icon: '⚡' });
          break;
        }
        case "error":
          toast.error((event.data as { message?: string }).message ?? "Analysis failed");
          setIsStreaming(false); setCurrentStage("gathering_context"); setLiveThought(""); break;
        case "done": {
          const d = event.data as any;
          resolvedId = d.conversation_id ?? convId;
          setPlannerSummary(d);
          setLiveThought("");
          setForceExecution(false);
          setWorkflowState(d.error ? "WAITING_FOR_INPUT" : "AWAITING_APPROVAL");

          if (!d.error && buf && resolvedId) {
            const aMsg = { id:`asst-${Date.now()}`, conversation_id:resolvedId, role:"assistant" as const, content:buf, metadata:{}, created_at:new Date().toISOString() };
            if (resolvedId !== convId && resolvedId) setMessages(resolvedId, [{ id:`tmp-${Date.now()-1}`,conversation_id:resolvedId,role:"user",content:message,metadata:{},created_at:new Date().toISOString() }, aMsg]);
            else if (resolvedId) addMessage(resolvedId, aMsg);
            if (!convId && resolvedId) setActiveConversation(resolvedId);
            fetchConversations().then((cs) => useChatStore.getState().setConversations(cs)).catch(()=>{});
            if (d.total_execution_ms) toast.success(`Done in ${(d.total_execution_ms/1000).toFixed(1)}s`, { icon:"⚡" });
          }
          clearStreamText(); setIsStreaming(false);
          setCurrentStage(d.error ? "gathering_context" : "completed"); break;
        }
      }
    }, abortRef.current.signal, forceExecution || useChatStore.getState().forceExecution);
  }, [activeConversationId, isStreaming, selectedDomain, inputValue, forceExecution]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  // File Upload Helper inside Canvas
  const handleCanvasFileUpload = async (file: File) => {
    if (!activeConversationId) return;
    try {
      const doc = await uploadDocument(activeConversationId, file);
      addUploadedDoc(activeConversationId, doc);
      toast.success(`Uploaded ${file.name}`);
      // Re-trigger analysis since we got new file evidence
      handleSend("Continuous analysis with newly uploaded evidence: " + file.name);
    } catch {
      toast.error(`Failed to upload ${file.name}`);
    }
  };

  const domainLabel = DOMAINS.find((d) => d.value === selectedDomain)?.label ?? "Domain";
  const showEmpty   = !isStreaming && threadMessages.length === 0 && !recommendation && agentLines.length === 0 && !loadingConv;

  return (
    <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 h-[64px] flex items-center justify-between px-8 border-b border-white/[0.08]"
        style={{ background: "rgba(7, 8, 20, 0.3)", backdropFilter: "blur(12px)" }}>
        <div className="flex items-center gap-2.5 min-w-0">
          <button className="text-slate-400 hover:text-white flex-shrink-0 transition-colors">
            <span className="text-lg">←</span>
          </button>
          {editingTitle ? (
            <div className="flex items-center gap-1.5">
              <input autoFocus value={titleDraft} onChange={(e)=>setTitleDraft(e.target.value)}
                onKeyDown={(e)=>{ if(e.key==="Enter")commitTitle(); if(e.key==="Escape")setEditingTitle(false); }}
                className="text-sm font-semibold text-white bg-white/[0.07] border border-indigo-500/40 rounded-lg px-2.5 py-1 outline-none w-52" />
              <button onClick={commitTitle} className="p-1 text-emerald-400"><Check className="w-3.5 h-3.5" /></button>
              <button onClick={()=>setEditingTitle(false)} className="p-1 text-slate-500"><X className="w-3.5 h-3.5" /></button>
            </div>
          ) : (
            <button className="group flex items-center gap-1.5 min-w-0"
              onClick={()=>{ setTitleDraft(activeConv?.title??""); setEditingTitle(true); }}>
              <span className="text-[13px] font-semibold text-white truncate max-w-[260px] group-hover:text-slate-200 transition-colors">
                {activeConv?.title ?? (isStreaming ? "Analyzing…" : "New Analysis")}
              </span>
              <Pencil className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </button>
          )}
          {activeConv && <StageBadge stage={activeConv.status ?? "gathering_context"} size="sm" />}
          {isStreaming && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-500/12 border border-indigo-500/20 animate-pulse">
              <Loader2 className="w-2.5 h-2.5 text-indigo-400 animate-spin" />
              <span className="text-[10px] text-indigo-400 font-medium">Streaming Analysis</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.07] text-slate-300 transition-all">
            <Share2 className="w-3.5 h-3.5 text-slate-400" /> Share
          </button>
          <button className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.07] text-slate-350 transition-all">
            •••
          </button>
          <button className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.07] text-slate-300 transition-all">
            Resume later
          </button>
          <button onClick={() => setApprovalModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20 transition-all">
            <Check className="w-3.5 h-3.5" /> Approve &amp; Complete
          </button>
        </div>
      </div>

      {recommendation && !showEmpty && (
        <div className="flex-shrink-0 px-5 py-2.5 bg-[#0E1020] border-b border-white/[0.08] flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-[#94A3B8]">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Domain:</span>
            <span className="font-semibold text-slate-200 capitalize">{selectedDomain.replace("_", " ")}</span>
          </div>
          <div className="h-3 w-px bg-white/[0.08]" />
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Confidence:</span>
            <span className="font-semibold text-[#22C55E]">{confPct}%</span>
          </div>
          <div className="h-3 w-px bg-white/[0.08]" />
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Agents:</span>
            <span className="font-semibold text-indigo-400">{agentTimeline.filter(a => a.status === 'completed').length} Active</span>
          </div>
          <div className="h-3 w-px bg-white/[0.08]" />
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Evidence:</span>
            <span className="font-semibold text-sky-450">{rec.evidence?.length ?? 4} Chips</span>
          </div>
          <div className="h-3 w-px bg-white/[0.08]" />
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Memory Count:</span>
            <span className="font-semibold text-purple-400">{memoryDiscovery?.cases?.length ?? 0} matches</span>
          </div>
          <div className="h-3 w-px bg-white/[0.08] ml-auto" />
          <div className="flex items-center gap-1 text-[10px] text-slate-500">
            <span>Created:</span>
            <span className="font-mono">{new Date().toLocaleDateString()}</span>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className={cn("max-w-2xl mx-auto px-6 py-8 space-y-6", showEmpty && "min-h-[72vh] flex flex-col justify-center")}>
          {loadingConv && <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-indigo-400/60 animate-spin" /></div>}
          
          {showEmpty && (
            <>
              {/* Continuous Conversation Welcome Back Banner */}
              {conversations.length > 0 && conversations[0].id !== activeConversationId && (
                <WelcomeBackBanner 
                  conv={conversations[0]} 
                  onResume={() => handleSelect(conversations[0].id)}
                  onUpload={() => { handleSelect(conversations[0].id); setShowUploadZone(true); }}
                />
              )}
              <EmptyState onSelect={(p,d)=>{ setSelectedDomain(d); setInputValue(p); textareaRef.current?.focus(); }} />
            </>
          )}

          {userMessages.length > 0 && (
            <motion.div initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-indigo-600/30 border border-indigo-500/25 flex items-center justify-center flex-shrink-0 mt-0.5">
                <User className="w-3.5 h-3.5 text-indigo-400" />
              </div>
              <div className="flex-1 px-4 py-3 rounded-2xl rounded-tl-sm bg-indigo-600/10 border border-indigo-500/15 text-sm text-slate-200 leading-relaxed shadow-sm">
                {userMessages[0].content}
              </div>
            </motion.div>
          )}

          {/* Real-time Progressive Execution Plan timeline */}
          {executionPlan && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.015] overflow-hidden p-4 space-y-3.5 backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-white/[0.04] pb-2">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-indigo-400 animate-pulse" />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-200">DecisionOS is thinking</span>
                    <span className="text-[9px] text-slate-500 font-medium">Streaming response...</span>
                  </div>
                </div>
                {isStreaming ? (
                  <button onClick={() => {
                    abortRef.current?.abort();
                    setIsStreaming(false);
                    setLiveThought("");
                    toast.success("Streaming halted.");
                  }} className="px-2 py-1 border border-red-500/30 hover:bg-red-500/10 rounded-lg text-[9px] font-semibold text-red-400 flex items-center gap-1 transition-all">
                    <X className="w-2.5 h-2.5" /> Stop streaming
                  </button>
                ) : (
                  <span className="text-[10px] text-slate-500 font-mono">
                    {(executionPlan as any).total_agents} Agents in {(executionPlan as any).total_phases} Phases
                  </span>
                )}
              </div>
              <div className="space-y-3">
                {(executionPlan as any).execution_plan?.map((phase: any, index: number) => {
                  // Determine phase status
                  const agentStatuses = phase.agents.map((name: string) => {
                    const found = agentTimeline.find(a => a.agent_name === name);
                    return found ? found.status : "pending";
                  });
                  const isPhaseRunning = agentStatuses.includes("running");
                  const isPhaseComplete = agentStatuses.every((s: string) => s === "completed" || s === "skipped");
                  const isPhaseQueued = agentStatuses.every((s: string) => s === "pending");

                  return (
                    <div key={index} className="space-y-1.5 pl-2 border-l border-white/[0.05]">
                      <div className="flex items-center gap-2">
                        <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-bold uppercase",
                          isPhaseComplete ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                          isPhaseRunning ? "bg-indigo-500/15 text-indigo-400 border border-indigo-500/25 animate-pulse" :
                          "bg-white/[0.03] text-slate-600"
                        )}>
                          Phase {phase.phase}
                        </span>
                        <span className="text-[11px] text-slate-400 font-medium">{phase.reason}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pl-2">
                        {phase.agents.map((agent: string) => {
                          const stateObj = agentTimeline.find(a => a.agent_name === agent);
                          const status = stateObj ? stateObj.status : "pending";
                          const isExpanded = expandedAgent === agent;
                          return (
                            <div key={agent} className="space-y-1">
                              <button onClick={() => {
                                if (status === "completed") {
                                  setExpandedAgent(isExpanded ? null : agent);
                                }
                              }}
                                className={cn("w-full flex items-center justify-between py-1.5 px-2.5 rounded-xl border transition-all text-xs",
                                  status === "running" ? "bg-indigo-500/8 border-indigo-500/30 text-indigo-300 shadow-lg shadow-indigo-500/5 animate-pulse" :
                                  status === "completed" ? "bg-emerald-500/4 border-emerald-500/15 text-slate-300 hover:bg-emerald-500/8" :
                                  status === "skipped" ? "bg-white/[0.01] border-white/[0.04] text-slate-600 line-through" :
                                  "bg-transparent border-transparent text-slate-600 cursor-default"
                                )}>
                                <div className="flex items-center gap-2">
                                  {status === "running" ? <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" /> :
                                   status === "completed" ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> :
                                   status === "skipped" ? <span className="text-slate-600 text-xs">⊘</span> :
                                   <div className="w-2.5 h-2.5 rounded-full border border-slate-700" />}
                                  <span className="font-medium capitalize">{agent.replace(/_/g, " ")}</span>
                                </div>
                                {status === "completed" && (
                                  <ChevronDown className={cn("w-3 h-3 text-slate-500 transition-transform", isExpanded && "rotate-180")} />
                                )}
                              </button>
                              {isExpanded && stateObj && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                                  className="p-2.5 rounded-xl border border-white/[0.05] bg-white/[0.01] text-[11px] text-slate-400 leading-relaxed font-mono space-y-1">
                                  <p className="text-slate-500"><span className="text-indigo-400 font-bold">Latency:</span> {stateObj.latency_ms ?? 0}ms</p>
                                  <p><span className="text-indigo-400 font-bold">Summary:</span> {getAgentSummary(agent, stateObj.output ?? {})}</p>
                                </motion.div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}


          {/* ─── STREAMING FEED: Live event log replaces all old spinners ─── */}
          {(isStreaming || feedEvents.length > 0) && !loadingConv && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="px-1"
            >
              <StreamingFeed
                events={feedEvents as FeedEvent[]}
                streamingText={streamingText}
                isStreaming={isStreaming}
                userMessage={userMessages[userMessages.length - 1]?.content}
              />
            </motion.div>
          )}

          {/* Context Sufficiency Routing Card */}
          {recommendation && isContextRequired && (
            <MidAnalysisContextCard 
              rec={recommendation} 
              onUploadClick={() => setShowUploadZone(true)}
              onSkip={() => setForceExecution(true)}
              onContinue={() => {
                const lastMsg = userMessages[userMessages.length - 1]?.content;
                if (lastMsg) {
                  setForceExecution(true);
                  setTimeout(() => handleSend(lastMsg), 50);
                }
              }}
              onSelect={(p, d) => {
                setSelectedDomain(d);
                setInputValue(p);
                setTimeout(() => textareaRef.current?.focus(), 30);
              }}
            />
          )}

          {/* Strategy Evolution — shown when memory updated */}
          {strategyEvolution.length > 0 && (
            <StrategyEvolutionCard
              entries={strategyEvolution}
              currentTitle={recommendation?.title}
            />
          )}

          {/* Lifecycle Timeline — always shown with a recommendation */}
          {recommendation && !isContextRequired && (
            <motion.div
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className="px-5 py-4 rounded-2xl border border-white/[0.06] bg-white/[0.015]"
            >
              <p className="section-label mb-3">Recommendation Lifecycle</p>
              <LifecycleTimeline
                currentStatus={recommendation.approval_status ?? recommendation.lifecycle_status ?? "pending_approval"}
                recommendationId={recommendation.recommendation_id ?? recommendation.id}
              />
            </motion.div>
          )}

          {/* Rich Recommendation Card */}
          {recommendation && !isContextRequired && (
            <RecCard 
              rec={recommendation} 
              onApprove={() => setApprovalModalOpen(true)} 
              activeConversationId={activeConversationId}
              updateConversation={updateConversation}
              setRecommendation={setRecommendation}
            />
          )}

          {/* HITL Active Phase Progress — shown while streaming HITL flow */}
          {isStreaming && hitlPhases.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-indigo-500/20 bg-indigo-950/20 p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">Planner Reactivated — HITL Workflow</span>
              </div>
              {hitlPhases.map((phase) => (
                <div key={phase.phase} className="flex items-center gap-3">
                  <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0",
                    phase.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                    phase.status === 'running'   ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 animate-pulse' :
                                                   'bg-white/5 text-white/30 border border-white/10')}>
                    {phase.status === 'completed' ? '✓' : phase.phase}
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-medium text-white/80">Phase {phase.phase} — {phase.label}</div>
                    {phase.transition && <div className="text-[10px] text-slate-400 mt-0.5">{phase.transition}</div>}
                  </div>
                  <div className={cn("text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full",
                    phase.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400' :
                    phase.status === 'running'   ? 'bg-indigo-500/15 text-indigo-400' :
                                                   'bg-white/5 text-white/30')}>
                    {phase.status}
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {/* Execution Plan Card — rendered after approval */}
          {executionPlan && (executionPlan as any).execution_steps && (
            <ExecutionPlanCard plan={executionPlan as any} />
          )}

          {/* Outcome Capture — shown after execution is complete or approved */}
          {executionPlan && (executionPlan as any).execution_steps && recommendation && !isStreaming && !outcomeCapture && (
            <OutcomeCaptureCard
              recommendationId={recommendation.recommendation_id ?? recommendation.id ?? "NBA-UNKNOWN"}
              recommendationTitle={recommendation.title ?? "Recommendation"}
              onSubmit={(outcome) => {
                setOutcomeCapture(outcome);
                // Add to strategy evolution memory
                addStrategyEntry({
                  recommendation_id: recommendation.recommendation_id ?? recommendation.id ?? "NBA-",
                  title: recommendation.title ?? "Recommendation",
                  playbook: recommendation.selected_playbook ?? "General Playbook",
                  status: "completed",
                  created_at: new Date().toISOString(),
                  confidence: recommendation.confidence_score,
                  outcome: outcome.outcome,
                });
                toast.success("Outcome captured — Memory updated!", { icon: "🧠" });
              }}
            />
          )}

          {/* Planner Completion Summary Card */}
          {recommendation && !isStreaming && plannerSummary && (
            <PlannerCompletionSummaryCard 
              metrics={plannerSummary} 
              onApproveAnalysis={() => {
                toast.success("Analysis confirmed and completed!", { icon: "✅" });
                if (activeConversationId) updateConversation(activeConversationId, { status: "completed" });
              }}
              onContinueAnalysis={() => {
                // Resume previous analysis session
                toast.success("Analysis resumed. Enter further questions below.", { icon: "🔄" });
                textareaRef.current?.focus();
              }}
            />
          )}

          {threadMessages.length > 1 && (
            <FollowUpThread messages={threadMessages.slice(1)} streamingText={isStreaming?streamingText:""} isStreaming={isStreaming} />
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {showUploadZone && activeConversationId && (
        <CanvasUploadZone 
          conversationId={activeConversationId} 
          onUpload={handleCanvasFileUpload}
          onClose={() => setShowUploadZone(false)}
        />
      )}

      <InputBar value={inputValue} onChange={setInputValue} onSend={() => handleSend()} onKeyDown={handleKeyDown}
        isStreaming={isStreaming} textareaRef={textareaRef}
        domainLabel={domainLabel} selectedDomain={selectedDomain}
        setSelectedDomain={setSelectedDomain} domainOpen={domainOpen} setDomainOpen={setDomainOpen} />
    </div>
  );

  function handleSelect(id: string) {
    if (activeConversationId === id) return;
    setActiveConversation(id);
    resetConversationState();
  }
}

// ── Continuous Workspace "Welcome Back" Banner ────────────────────────────────
function WelcomeBackBanner({ conv, onResume, onUpload }: { conv: any; onResume: () => void; onUpload: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="p-6 rounded-2xl border border-white/[0.05] bg-[#121324] shadow-2xl space-y-5">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
        <span className="text-sm font-bold text-white">Welcome Back</span>
      </div>
      <div className="space-y-2">
        <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Active Workspace</p>
        <h3 className="text-base font-bold text-slate-200 leading-snug">{conv.title}</h3>
        <div className="flex flex-wrap items-center gap-5 text-xs text-slate-400 pt-1.5">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span>Status:</span>
            <span className="font-semibold text-indigo-400 capitalize">{conv.status?.replace(/_/g, " ")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-450" />
            <span>Recommendations:</span>
            <span className="font-semibold text-emerald-400">1</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-white/[0.04]">
        <button onClick={onResume} className="w-full py-2.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-500/10 text-center">
          Resume Session
        </button>
        <button onClick={onUpload} className="w-full py-2.5 text-xs font-bold rounded-xl bg-white/[0.04] hover:bg-[#1c1e36] text-slate-200 border border-white/[0.08] transition-all text-center">
          Upload Missing Files
        </button>
      </div>
    </motion.div>
  );
}

// ── Mid-Analysis Onboarding Dashboard ────────────────────────────────────────
function MidAnalysisContextCard({ rec, onUploadClick, onSkip, onContinue, onSelect }: { 
  rec: any; 
  onUploadClick: () => void; 
  onSkip: () => void; 
  onContinue: () => void;
  onSelect: (p: string, d: string) => void;
}) {
  const missing = rec.missing_context ?? [];
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {/* Context Assessment Card */}
      <div className="p-4 rounded-xl border border-white/[0.06] bg-[#0e0e1a]/80 backdrop-blur-md grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 text-slate-350">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-350">Context Assessment</span>
            <HelpCircle className="w-3.5 h-3.5 text-slate-600" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Information Quality</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-500/10 text-yellow-500 border border-yellow-500/25">LOW</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Sources Available</span>
              <span className="text-slate-300 font-bold">0</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Context Completeness</span>
              <span className="text-slate-300 font-bold">5%</span>
            </div>
          </div>
        </div>
        <div className="pl-0 md:pl-4 border-t md:border-t-0 md:border-l border-white/[0.05] space-y-2">
          <h5 className="text-[11px] font-bold text-slate-400 uppercase">Why we need more information</h5>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            To provide you with accurate and actionable recommendations, we need more context about your B2B business situation, goals, and challenges.
          </p>
        </div>
      </div>

      {/* Onboarding Cards Zone */}
      <div className="p-4 rounded-xl border border-[#a855f7]/15 bg-gradient-to-r from-[#a855f7]/5 to-transparent space-y-3">
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-slate-200">Let's get started!</h4>
          <p className="text-[11px] text-slate-500">I'm here to help you make better decisions. To begin, you can:</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { title: "Upload Documents", desc: "Share files or docs", icon: "📁", action: onUploadClick },
            { title: "Paste Information", desc: "Add context or details", icon: "📝", action: () => onSelect("Paste customer notes and situation analysis details...", "customer_success") },
            { title: "Ask a Question", desc: "Get specific insights", icon: "❓", action: () => onSelect("What are the next best actions for customer renewals?", "customer_success") },
            { title: "Use a Template", desc: "Start with a template", icon: "⚡", action: () => onSelect("Use Customer Renewal Risk template to analyze account", "customer_success") },
          ].map((card, i) => (
            <button key={i} onClick={card.action}
              className="p-3 text-left rounded-xl border border-white/[0.05] bg-white/[0.01] hover:bg-white/[0.04] hover:border-[#a855f7]/40 transition-all flex flex-col justify-between h-24">
              <span className="text-lg">{card.icon}</span>
              <div>
                <h5 className="text-[11px] font-bold text-slate-350">{card.title}</h5>
                <p className="text-[9px] text-slate-500 mt-0.5 leading-snug">{card.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Suggested Next Steps */}
      <div className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.01] grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-200">Suggested Next Step</h4>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Tell me about your customer situation, upload documents, or paste notes to receive AI-powered recommendations.
          </p>
        </div>
        <div className="pl-0 md:pl-4 border-t md:border-t-0 md:border-l border-white/[0.05] space-y-2">
          <h4 className="text-xs font-bold text-slate-400">Examples of what you can share</h4>
          <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-500">
            <div>• Meeting transcripts</div>
            <div>• Support tickets</div>
            <div>• CRM updates</div>
            <div>• Sales conversations</div>
            <div>• Customer emails</div>
            <div>• Business documents</div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-3 border-t border-white/[0.04]">
        <button onClick={onUploadClick} className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all flex items-center gap-1.5">
          <Paperclip className="w-3.5 h-3.5" /> Upload CRM &amp; Transcripts
        </button>
        <button onClick={onContinue} className="px-4 py-2 text-xs font-bold rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 border border-white/[0.08] transition-all">
          Continue with Limited Context
        </button>
      </div>
    </motion.div>
  );
}

// ── Planner Completion Summary Card ──────────────────────────────────────────
function PlannerCompletionSummaryCard({ metrics, onApproveAnalysis, onContinueAnalysis }: { metrics: any; onApproveAnalysis: () => void; onContinueAnalysis: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="p-5 rounded-2xl border border-white/[0.06] bg-white/[0.01] backdrop-blur-md space-y-4">
      <div className="flex items-center justify-between border-b border-white/[0.05] pb-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold text-white">Planner Status: Completed</span>
        </div>
        <span className="text-[10px] text-slate-500 font-mono">Summary Metrics</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Agents Run", value: metrics.agents_executed },
          { label: "Evidence Count", value: metrics.evidence_sources },
          { label: "NBA Generated", value: metrics.recommendations_generated },
        ].map((m, i) => (
          <div key={i} className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] text-center space-y-0.5">
            <p className="text-[9px] text-slate-500 uppercase font-semibold">{m.label}</p>
            <p className="text-base font-bold text-white font-mono">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-bold text-slate-400">Is this analysis complete?</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={onApproveAnalysis} className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-500/10">
            Approve Analysis
          </button>
          <button onClick={onContinueAnalysis} className="px-4 py-2 text-xs font-bold rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 border border-white/[0.08] transition-all">
            Continue Analysis
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Execution Plan Card ───────────────────────────────────────────────────────
function ExecutionPlanCard({ plan }: { plan: {
  execution_id: string;
  recommendation_id: string;
  recommendation_title?: string;
  execution_steps: Array<{ day: number; action: string; description?: string; owner: string; priority: string; expected_output?: string }>;
  total_days: number;
  execution_confidence: number;
  key_milestones?: Array<{ day: number; milestone: string; status: string }>;
  success_criteria?: string[];
  estimated_arr_impact?: number;
  planner_state?: string;
  closed_loop_enabled?: boolean;
}}) {
  const priorityColor = (p: string) => ({
    'High':   'bg-red-500/15 text-red-400 border-red-500/20',
    'Medium': 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
    'Low':    'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  }[p] ?? 'bg-white/5 text-white/40 border-white/10');

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/30 to-slate-950/60 overflow-hidden shadow-lg shadow-emerald-500/5">

      {/* Header */}
      <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
            <span className="text-sm">⚡</span>
          </div>
          <div>
            <div className="text-sm font-bold text-white">Execution Plan Active</div>
            <div className="text-[11px] text-slate-400">{plan.recommendation_title ?? plan.recommendation_id} · {plan.execution_id}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/20 text-[10px] font-bold text-emerald-400 uppercase">APPROVED</span>
          <span className="px-2.5 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/20 text-[10px] font-bold text-indigo-400">{plan.execution_confidence}% Confidence</span>
        </div>
      </div>

      {/* Timeline Steps */}
      <div className="p-5 space-y-3">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-4">Execution Timeline — {plan.total_days} Days</div>
        <div className="relative">
          {/* Vertical connector line */}
          <div className="absolute left-[22px] top-6 bottom-2 w-px bg-gradient-to-b from-emerald-500/40 via-indigo-500/20 to-transparent" />
          <div className="space-y-4">
            {plan.execution_steps.map((step, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className="flex gap-4">
                {/* Day badge */}
                <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-slate-900 border border-white/[0.08] flex flex-col items-center justify-center z-10">
                  <span className="text-[8px] text-slate-500 font-semibold uppercase">Day</span>
                  <span className="text-sm font-bold text-white leading-tight">{step.day}</span>
                </div>
                {/* Content */}
                <div className="flex-1 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-sm font-semibold text-white">{step.action}</span>
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0", priorityColor(step.priority))}>
                      {step.priority}
                    </span>
                  </div>
                  {step.description && <p className="text-xs text-slate-400 leading-relaxed">{step.description}</p>}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="flex items-center gap-1 text-[10px] text-slate-500">
                      <span className="text-slate-600">Owner:</span>
                      <span className="text-slate-300 font-medium">{step.owner}</span>
                    </span>
                    {step.expected_output && (
                      <span className="flex items-center gap-1 text-[10px] text-slate-500">
                        <span className="text-slate-600">Output:</span>
                        <span className="text-slate-400">{step.expected_output}</span>
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Success Criteria */}
        {plan.success_criteria && plan.success_criteria.length > 0 && (
          <div className="mt-4 p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/15">
            <div className="text-[10px] font-semibold text-indigo-300 uppercase mb-2">Success Criteria</div>
            <div className="space-y-1">
              {plan.success_criteria.map((c, i) => (
                <div key={i} className="flex items-start gap-2 text-[11px] text-slate-400">
                  <span className="text-indigo-400 mt-0.5">◆</span> {c}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Metrics */}
        <div className="pt-3 border-t border-white/[0.05] grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Status', value: 'APPROVED', color: 'text-emerald-400' },
            { label: 'Execution', value: 'ACTIVE', color: 'text-indigo-400' },
            { label: 'Memory', value: 'UPDATED', color: 'text-violet-400' },
            { label: 'Closed Loop', value: plan.closed_loop_enabled ? 'ENABLED' : 'OFF', color: 'text-sky-400' },
          ].map((m, i) => (
            <div key={i} className="text-center p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
              <div className="text-[9px] text-slate-500 uppercase font-semibold">{m.label}</div>
              <div className={cn("text-[11px] font-bold mt-0.5", m.color)}>{m.value}</div>
            </div>
          ))}
        </div>
        {plan.estimated_arr_impact && plan.estimated_arr_impact > 0 ? (
          <div className="text-center text-[11px] text-slate-500 pt-1">
            Estimated ARR Impact: <span className="text-emerald-400 font-bold">${plan.estimated_arr_impact.toLocaleString()}</span>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}

// ── In-Canvas File Upload Panel ──────────────────────────────────────────────
function CanvasUploadZone({ conversationId, onUpload, onClose }: { conversationId: string; onUpload: (f: File) => void; onClose: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
      className="mx-5 mb-4 p-4 rounded-xl border border-dashed border-indigo-500/25 bg-indigo-500/4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-indigo-300">Upload Context File</span>
        <button onClick={onClose} className="text-slate-600 hover:text-slate-400"><X className="w-4 h-4" /></button>
      </div>
      <div className="flex flex-col items-center justify-center p-6 border border-white/[0.06] rounded-xl bg-[#0b0b14] cursor-pointer"
        onClick={() => document.getElementById("canvas-file-inp")?.click()}>
        <input id="canvas-file-inp" type="file" className="hidden" onChange={(e) => {
          const files = e.target.files;
          if (files?.length) onUpload(files[0]);
        }} />
        <TrendingUp className="w-8 h-8 text-indigo-400/60 mb-2 animate-bounce" />
        <p className="text-xs text-slate-400 font-semibold">Drop files here or click to browse</p>
        <p className="text-[10px] text-slate-600 mt-1">PDF, DOCX, CSV, TXT (Max 50MB)</p>
      </div>
    </motion.div>
  );
}

function EmptyState({ onSelect }: { onSelect:(p:string,d:string)=>void }) {
  const items = [
    { 
      icon: <Brain className="w-4 h-4 text-indigo-400" />, 
      title: "Describe a situation",           
      prompt: "Tell me about a customer or business challenge", 
      domain: "customer_success", 
      prefill: "Describe your customer or business situation: Acme Corp renewal is in 60 days. Usage dropped 40%, champion left." 
    },
    { 
      icon: <Paperclip className="w-4 h-4 text-emerald-400" />,   
      title: "Upload context",   
      prompt: "Meeting transcripts, CRM exports, or playbooks", 
      domain: "customer_success", 
      prefill: "Upload context: TechStart has 85% feature adoption, just hired 50 engineers." 
    },
    { 
      icon: <FileText className="w-4 h-4 text-sky-400" />,    
      title: "Paste notes",    
      prompt: "Email threads or customer renewal notes", 
      domain: "sales", 
      prefill: "Paste notes: GlobalBank deal stalled 6 weeks. Champion pushing, procurement blocking." 
    },
    { 
      icon: <Clock className="w-4 h-4 text-purple-400" />, 
      title: "Resume a session", 
      domain: "staffing",         
      prompt: "Continue tracking a previous recommendation", 
      prefill: "Resume a session: Final round ML Engineer. Strong technical, limited leadership. Hire or pass?" 
    },
  ];

  const badges = [
    { text: "🧠 10 Agents", color: "bg-indigo-500/8 text-indigo-300 border-indigo-500/20" },
    { text: "💾 Memory", color: "bg-emerald-500/8 text-emerald-300 border-emerald-500/20" },
    { text: "📋 HITL", color: "bg-amber-500/8 text-amber-300 border-amber-500/20" },
    { text: "🔍 Explainable", color: "bg-sky-500/8 text-sky-300 border-sky-500/20" },
    { text: "📈 Risk+Opp", color: "bg-rose-500/8 text-rose-300 border-rose-500/20" },
    { text: "⚡ Streaming", color: "bg-purple-500/8 text-purple-300 border-purple-500/20" },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 12 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="w-full flex flex-col items-center text-center space-y-8 py-6"
    >
      {/* Intro Header */}
      <div className="space-y-4">
        {/* Glow cube icon */}
        <div className="relative w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[#8B5CF6] to-[#6366F1] flex items-center justify-center shadow-lg shadow-indigo-500/25 border border-white/[0.1] group hover:scale-105 transition-all duration-200">
          <div className="absolute inset-0 bg-[#8B5CF6] rounded-2xl blur-[12px] opacity-20 group-hover:opacity-40 transition-opacity" />
          <Brain className="w-6 h-6 text-white relative z-10 animate-pulse" />
        </div>
        
        <h2 className="text-2xl md:text-[30px] font-extrabold text-white tracking-tight flex items-center justify-center gap-2">
          Hi <span className="animate-bounce">👋</span> I'm DecisionOS
        </h2>
        
        <p className="text-slate-400 text-sm max-w-lg mx-auto leading-relaxed">
          Your enterprise decision intelligence platform. I help teams identify risks, opportunities, and recommend next best actions backed by evidence, memory, and explainable AI.
        </p>
      </div>

      {/* Grid of templates */}
      <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl pt-2">
        {items.map((p, i) => (
          <motion.button 
            key={p.title} 
            initial={{ opacity: 0, y: 8 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.08 + i * 0.05, duration: 0.3 }}
            onClick={() => onSelect(p.prefill, p.domain)}
            className="flex items-start gap-3.5 p-5 text-left rounded-[18px] border border-white/[0.06] bg-[#0E1020]/45 hover:bg-[#131628]/60 hover:border-[#8B5CF6]/30 hover:scale-[1.01] hover:shadow-lg hover:shadow-indigo-500/[0.02] transition-all duration-200 group cursor-pointer"
          >
            <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] flex-shrink-0 group-hover:bg-indigo-500/10 group-hover:border-indigo-500/20 transition-all">
              {p.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-slate-200 group-hover:text-white mb-0.5">{p.title}</div>
              <div className="text-[10px] text-slate-400 leading-relaxed font-normal">{p.prompt}</div>
            </div>
          </motion.button>
        ))}
      </div>

      {/* Decorative badges */}
      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
        {badges.map((b) => (
          <div key={b.text} className={cn("py-1 px-3 rounded-full border text-center font-bold text-[9px] uppercase tracking-wider", b.color)}>
            {b.text}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ── Recommendation Card ────────────────────────────────────────────────────
function RecCard({ rec, onApprove, activeConversationId, updateConversation, setRecommendation }: { 
  rec: Recommendation; 
  onApprove:()=>void;
  activeConversationId: string | null;
  updateConversation: any;
  setRecommendation: any;
}) {
  const [copied, setCopied] = useState(false);
  const recExt = rec as Recommendation & { confidence_score?: number|null; risk_level?: string|null; insufficient_data?: boolean };
  const confScore   = recExt.confidence_score;
  const riskLevel   = recExt.risk_level ?? "unknown";
  const insufficient= recExt.insufficient_data;

  // Interactive review steps state
  const [reviewStep, setReviewStep] = useState<"accepted" | "executed" | "blocked" | "outcome" | "done">("accepted");
  const [comment, setComment] = useState("");
  const [modifiedText, setModifiedText] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [outcomeVal, setOutcomeVal] = useState("");

  const priorityColors: Record<string,string> = {
    critical:"bg-red-500/15 text-red-400 border-red-500/25",
    high:    "bg-orange-500/15 text-orange-400 border-orange-500/25",
    medium:  "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
    low:     "bg-slate-500/15 text-slate-400 border-slate-500/25",
  };
  const riskColors: Record<string,string> = {
    critical:"text-red-400", high:"text-orange-400", medium:"text-yellow-400", low:"text-green-400", unknown:"text-slate-500",
  };
  const pk = (rec.priority ?? "medium").toLowerCase();
  const rk = riskLevel.toLowerCase();

  const persistLifecycle = async (updates: {
    status: string;
    comment?: string;
    modifiedAction?: string;
    executionStatus?: string;
    blockedReason?: string;
    outcome?: string;
  }) => {
    if (!activeConversationId) return;
    try {
      await approveByConversation(
        activeConversationId,
        updates.status,
        updates.comment,
        updates.modifiedAction,
        undefined,
        "John Doe",
        updates.executionStatus,
        updates.blockedReason,
        updates.outcome
      );
      
      // Update recommendation locally
      setRecommendation({
        ...rec,
        approval_status: updates.status,
        lifecycle_status: updates.status,
        execution_status: updates.executionStatus,
        blocked_reason: updates.blockedReason,
        outcome: updates.outcome,
        approval: {
          status: updates.status,
          comment: updates.comment,
          modified_action: updates.modifiedAction,
          execution_status: updates.executionStatus,
          blocked_reason: updates.blockedReason,
          outcome: updates.outcome,
        }
      });
      
      // Update conversation stage
      let stage = "gathering_context";
      if (["approved", "assigned", "scheduled"].includes(updates.status)) stage = "approved";
      else if (updates.status === "in_progress") stage = "in_progress";
      else if (updates.status === "blocked") stage = "blocked";
      else if (["completed", "measured"].includes(updates.status)) stage = "completed";
      else stage = "needs_review";
      updateConversation(activeConversationId, { status: stage });
      
      toast.success("State synchronized with memory", { icon: "💾" });
    } catch {
      toast.error("Failed to persist state");
    }
  };

  return (
    <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} className="decision-card-border rounded-2xl overflow-hidden shadow-xl">
      <div className="px-5 py-4 bg-gradient-to-r from-indigo-500/8 via-purple-500/5 to-transparent border-b border-white/[0.04]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
              <span className="text-[10px] font-bold tracking-widest text-indigo-400 uppercase">Next Best Action</span>
              {rec.recommendation_id && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-slate-500 font-mono">
                  {rec.recommendation_id}{rec.version ? ` v${rec.version}` : ''}
                </span>
              )}
              {rec.planner_state && (
                <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider",
                  rec.planner_state === 'CLOSED_LOOP' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' :
                  rec.planner_state === 'REPLANNING_TRIGGERED' ? 'bg-orange-500/10 border border-orange-500/20 text-orange-400' :
                  'bg-yellow-500/10 border border-yellow-500/20 text-yellow-500'
                )}>
                  {rec.planner_state.replace(/_/g, ' ')}
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-white leading-snug">{rec.title}</h3>
          </div>
          <button onClick={()=>{ navigator.clipboard.writeText(rec.action??""); setCopied(true); setTimeout(()=>setCopied(false),2000); }}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-400 hover:bg-white/[0.06] transition-all flex-shrink-0">
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {rec.priority && (
            <span className={cn("text-[10px] px-2 py-1 rounded-lg border font-bold uppercase tracking-wide", priorityColors[pk]??priorityColors.medium)}>
              {rec.priority}
            </span>
          )}
          {rec.urgency && <span className="text-[10px] px-2 py-1 rounded-lg border border-white/[0.08] bg-white/[0.04] text-slate-400">{rec.urgency.replace(/_/g," ")}</span>}
          {rec.timeline && <span className="flex items-center gap-1 text-[10px] text-slate-400 bg-white/[0.04] px-2 py-1 rounded-lg border border-white/[0.08]"><Clock className="w-2.5 h-2.5"/>{rec.timeline}</span>}
          <span className="text-[10px] px-2 py-1 rounded-lg border border-white/[0.08] bg-white/[0.04] text-slate-400">
            Confidence: <span className={insufficient||confScore==null ? "text-slate-500 font-semibold" : "text-indigo-400 font-semibold"}>
              {insufficient||confScore==null ? "N/A" : `${Math.round(confScore*100)}%`}
            </span>
          </span>
          <span className={cn("text-[10px] px-2 py-1 rounded-lg border border-white/[0.08] bg-white/[0.04]", riskColors[rk]??"text-slate-500")}>
            Risk: {rk === "unknown" ? "UNKNOWN" : riskLevel.toUpperCase()}
          </span>
          {rec.evidence_strength && (
            <span className={cn("text-[10px] px-2 py-1 rounded-lg border font-bold uppercase",
              rec.evidence_strength === 'High' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
              rec.evidence_strength === 'Medium' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500' :
              'bg-red-500/10 border-red-500/20 text-red-400'
            )}>
              Evidence: {rec.evidence_strength}
            </span>
          )}
        </div>
      </div>

      <div className="divide-y divide-white/[0.05]">
        <div className="px-5 py-4">
          <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-2">Recommendation</p>
          <div className="prose-dark text-sm"><ReactMarkdown remarkPlugins={[remarkGfm]}>{rec.action}</ReactMarkdown></div>
        </div>

        {rec.selected_playbook && (
          <div className="px-5 py-4 bg-indigo-500/[0.015] border-t border-white/[0.04] space-y-3.5">
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Decision Pathway</p>
              <span className="text-[10px] text-indigo-400 font-semibold flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5" /> Playbook Alignment
              </span>
            </div>
            
            {rec.detected_patterns && rec.detected_patterns.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {rec.detected_patterns.map((pat) => (
                  <span key={pat} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/15 font-semibold">
                    ✓ {pat.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                ))}
              </div>
            )}

            <div className="p-3.5 rounded-xl border border-white/[0.05] bg-gradient-to-r from-indigo-500/5 to-purple-500/[0.02] space-y-2.5 shadow-md">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">
                  <Zap className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                </div>
                <h4 className="text-xs font-bold text-slate-200">{rec.selected_playbook}</h4>
              </div>
              {rec.reasoning_summary && (
                <p className="text-xs text-slate-400 leading-relaxed font-sans">{rec.reasoning_summary}</p>
              )}

              {/* Expected outcomes mapping if playbook details exist */}
              {rec.playbook_guidance?.expected_outcomes && rec.playbook_guidance.expected_outcomes.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-white/[0.04]">
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Expected Outcomes</p>
                  <div className="flex gap-2">
                    {rec.playbook_guidance.expected_outcomes.map((out: any, idx: number) => (
                      <div key={idx} className="flex-1 p-2 rounded-lg bg-white/[0.02] border border-white/[0.04] text-center">
                        <p className="text-[9px] text-slate-500 font-semibold truncate">{out.name}</p>
                        <p className={cn("text-xs font-bold mt-0.5", out.direction === "up" ? "text-emerald-400" : "text-rose-450")}>
                          {out.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Strategic Pillars mapping if playbook details exist */}
              {rec.playbook_guidance?.strategic_pillars && rec.playbook_guidance.strategic_pillars.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-white/[0.04]">
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Playbook Strategic Pillars</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {rec.playbook_guidance.strategic_pillars.map((pillar: string, idx: number) => (
                      <div key={idx} className="flex items-center gap-1.5 text-[10px] text-slate-355 font-sans">
                        <div className="w-1 h-1 rounded-full bg-indigo-400 flex-shrink-0" />
                        <span className="truncate" title={pillar}>{pillar}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {rec.recommendation_updated && (
          <div className="px-5 py-4 bg-purple-500/[0.015] border-t border-white/[0.04] space-y-3">
            <div className="flex items-center gap-1.5 text-purple-400">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Strategy Evolved</span>
            </div>
            
            <div className="p-3.5 rounded-xl border border-purple-500/15 bg-gradient-to-br from-purple-500/[0.06] to-transparent space-y-3 shadow-lg shadow-purple-950/10">
              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                Prior action is completed. DecisionOS memory has evolved the playbook strategy to the next enablement phase.
              </p>
              
              {/* Visual mini-timeline mapping the pivot */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-black/25 border border-white/[0.03] text-[11px] font-sans">
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-[8px] text-slate-500 font-bold uppercase">Completed Action</span>
                  <span className="font-semibold text-slate-450 line-through truncate max-w-[125px]" title={rec.previous_recommendation ?? ""}>
                    {rec.previous_recommendation}
                  </span>
                </div>
                <div className="text-purple-400 font-bold px-2.5">➔</div>
                <div className="flex flex-col text-right min-w-0 flex-1">
                  <span className="text-[8px] text-purple-400 font-bold uppercase">Next Evolved Phase</span>
                  <span className="font-bold text-purple-300 truncate max-w-[125px]" title={rec.title}>
                    {rec.title}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {(rec.supporting_actions?.length??0)>0 && (
          <div className="px-5 py-3">
            <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-2">Operational Actions</p>
            <div className="rounded-xl border border-white/[0.06] overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-0 text-[9px] font-bold text-slate-500 uppercase tracking-wider bg-white/[0.02] px-3 py-2 border-b border-white/[0.04]">
                <span>Action</span>
                <span className="text-center px-3">Owner</span>
                <span className="text-center px-3">Timeline</span>
                <span className="text-right px-1">ARR Protected</span>
              </div>
              {rec.supporting_actions?.slice(0,6).map((a,i)=>{
                const dot=a.priority?.toLowerCase()==="critical"?"bg-red-500":a.priority?.toLowerCase()==="high"?"bg-orange-500":"bg-yellow-400";
                return (
                  <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-0 items-center px-3 py-2.5 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0",dot)} />
                      <span className="text-xs text-slate-200 font-medium truncate">{a.action}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 px-3 text-center whitespace-nowrap">{a.owner}</span>
                    <span className="text-[10px] text-slate-500 px-3 text-center whitespace-nowrap">{a.timeline}</span>
                    <span className="text-[10px] text-emerald-400 font-bold px-1 text-right whitespace-nowrap">
                      {a.arr_protected ? `$${(a.arr_protected/1000).toFixed(0)}K` : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {rec.expected_outcome && (
          <div className="px-5 py-3">
            <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-2">Expected Outcome</p>
            <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-slate-300 leading-relaxed">{rec.expected_outcome}</p>
            </div>
          </div>
        )}

        {rec.roi_metrics && !insufficient && (
          <div className="px-5 py-4">
            <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-3">ROI Metrics</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="p-3 rounded-xl bg-gradient-to-br from-red-500/5 to-transparent border border-red-500/10 text-center">
                <p className="text-[9px] text-slate-500 font-semibold">ARR at Risk</p>
                <p className="text-sm font-bold text-red-400 mt-0.5">${(rec.roi_metrics.arr_at_risk/1000).toFixed(0)}K</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/5 to-transparent border border-emerald-500/10 text-center">
                <p className="text-[9px] text-slate-500 font-semibold">Retained Revenue</p>
                <p className="text-sm font-bold text-emerald-400 mt-0.5">${(rec.roi_metrics.potential_retained_revenue/1000).toFixed(0)}K</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/5 to-transparent border border-purple-500/10 text-center">
                <p className="text-[9px] text-slate-500 font-semibold">Expansion</p>
                <p className="text-sm font-bold text-purple-400 mt-0.5">${(rec.roi_metrics.expansion_potential/1000).toFixed(0)}K</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-500/5 to-transparent border border-indigo-500/10 text-center">
                <p className="text-[9px] text-slate-500 font-semibold">Projected ROI</p>
                <p className="text-sm font-bold text-indigo-400 mt-0.5">{rec.roi_metrics.projected_roi}</p>
              </div>
            </div>
            {rec.roi_estimate && (
              <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-white/[0.04]">
                <TrendingUp className="w-3.5 h-3.5 text-yellow-400" />
                <span className="text-[11px] text-slate-400 font-sans">{rec.roi_estimate}</span>
              </div>
            )}
          </div>
        )}
        {rec.roi_estimate && !rec.roi_metrics && !insufficient && (
          <div className="px-5 py-2.5 flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-xs text-slate-500">ROI:</span>
            <span className="text-xs font-semibold text-yellow-400">{rec.roi_estimate}</span>
          </div>
        )}

        {/* Redesigned Step-by-Step Human review and follow-up tracking flow */}
        <div className="px-5 py-4 bg-white/[0.015] border-t border-white/[0.04]">
          <div className="space-y-4">
            
            {reviewStep === "accepted" && (
              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-200 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-indigo-400" /> Was this recommendation accepted?
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => {
                    persistLifecycle({ status: "approved" });
                    setReviewStep("executed");
                  }} className="py-2 px-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/18 text-xs font-bold transition-all">
                    Approve
                  </button>
                  <button onClick={() => {
                    persistLifecycle({ status: "rejected" });
                    setReviewStep("done");
                  }} className="py-2 px-3 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/18 text-xs font-bold transition-all">
                    Reject
                  </button>
                  <button onClick={() => setReviewStep("blocked")} className="py-2 px-3 rounded-xl border border-orange-500/20 bg-orange-500/10 text-orange-400 hover:bg-orange-500/18 text-xs font-bold transition-all">
                    Modify / Escalate
                  </button>
                  <button onClick={() => {
                    persistLifecycle({ status: "pending", comment: "Needs further information" });
                    setReviewStep("done");
                  }} className="py-2 px-3 rounded-xl border border-white/[0.08] bg-white/[0.03] text-slate-400 hover:bg-white/[0.05] text-xs font-bold transition-all">
                    Need More Information
                  </button>
                </div>
              </div>
            )}

            {reviewStep === "executed" && (
              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-200 flex items-center gap-2">
                  <Play className="w-4 h-4 text-indigo-400" /> Has this recommendation been executed?
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => {
                    persistLifecycle({ status: "completed", executionStatus: "completed" });
                    setReviewStep("outcome");
                  }} className="py-2 px-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-400 text-xs font-bold hover:bg-emerald-500/18 transition-all">
                    Completed
                  </button>
                  <button onClick={() => {
                    persistLifecycle({ status: "scheduled", executionStatus: "scheduled" });
                    setReviewStep("done");
                  }} className="py-2 px-3 rounded-xl border border-indigo-500/25 bg-indigo-500/10 text-indigo-400 text-xs font-bold hover:bg-indigo-500/18 transition-all">
                    Scheduled
                  </button>
                  <button onClick={() => {
                    persistLifecycle({ status: "in_progress", executionStatus: "in_progress" });
                    setReviewStep("done");
                  }} className="py-2 px-3 rounded-xl border border-yellow-500/25 bg-yellow-500/10 text-yellow-400 text-xs font-bold hover:bg-yellow-500/18 transition-all">
                    In Progress
                  </button>
                  <button onClick={() => setReviewStep("blocked")} className="py-2 px-3 rounded-xl border border-red-500/25 bg-red-500/10 text-red-400 text-xs font-bold hover:bg-red-500/18 transition-all">
                    Blocked
                  </button>
                </div>
              </div>
            )}

            {reviewStep === "blocked" && (
              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-200">State: Blocked. Select Reason:</p>
                <div className="space-y-2">
                  <select 
                    value={blockReason} 
                    onChange={(e) => setBlockReason(e.target.value)}
                    className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl text-xs text-slate-300 outline-none">
                    <option value="" className="bg-[#0f0f1a]">Choose block reason...</option>
                    <option value="Waiting for customer" className="bg-[#0f0f1a]">Waiting for customer</option>
                    <option value="Waiting for budget" className="bg-[#0f0f1a]">Waiting for budget</option>
                    <option value="Waiting for stakeholder" className="bg-[#0f0f1a]">Waiting for stakeholder</option>
                    <option value="Need documentation" className="bg-[#0f0f1a]">Need documentation</option>
                    <option value="Need executive approval" className="bg-[#0f0f1a]">Need executive approval</option>
                    <option value="Other" className="bg-[#0f0f1a]">Other</option>
                  </select>
                  <div className="flex gap-2">
                    <button onClick={() => {
                      persistLifecycle({ status: "blocked", executionStatus: "blocked", blockedReason: blockReason });
                      setReviewStep("done");
                    }} disabled={!blockReason} className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold disabled:opacity-40">
                      Submit Block State
                    </button>
                    <button onClick={() => setReviewStep("accepted")} className="px-3 py-2 rounded-xl bg-white/[0.04] text-slate-400 text-xs">Back</button>
                  </div>
                </div>
              </div>
            )}

            {reviewStep === "outcome" && (
              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-200">Capture Outcome &amp; Measure Impact</p>
                <div className="flex gap-1.5">
                  {[
                    { val: "positive", label: "Positive 🟢" },
                    { val: "neutral", label: "Neutral 🟡" },
                    { val: "negative", label: "Negative 🔴" },
                  ].map((o) => (
                    <button key={o.val} onClick={() => setOutcomeVal(o.val)}
                      className={cn("flex-1 py-1.5 rounded-lg border text-[11px] font-semibold transition-all",
                        outcomeVal === o.val ? "bg-indigo-600/25 border-indigo-500/40 text-indigo-300" : "bg-white/[0.02] border-white/[0.06] text-slate-400")}>
                      {o.label}
                    </button>
                  ))}
                </div>
                <textarea 
                  value={comment} 
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Notes, metrics or revenue impacts achieved..."
                  rows={2}
                  className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl text-xs text-white placeholder:text-slate-600 outline-none focus:border-indigo-500/30"
                />
                <button onClick={() => {
                  persistLifecycle({ status: "measured", executionStatus: "completed", outcome: outcomeVal, comment });
                  setReviewStep("done");
                }} disabled={!outcomeVal} className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold disabled:opacity-40">
                  Save Outcome and Close Loop
                </button>
              </div>
            )}

            {reviewStep === "done" && (
              <div className="p-3.5 rounded-xl border border-emerald-500/15 bg-emerald-500/5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-200">Lifecycle Action Synced</p>
                  <p className="text-[10px] text-slate-500">Persisted successfully to memory.</p>
                </div>
                <button onClick={() => setReviewStep("accepted")} className="px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] text-[10px] font-semibold text-slate-400">
                  Update
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Follow-up thread ───────────────────────────────────────────────────────
interface ThreadMsg { id:string; role:string; content:string; created_at:string; }
function FollowUpThread({ messages, streamingText, isStreaming }: { messages:ThreadMsg[]; streamingText:string; isStreaming:boolean }) {
  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-white/[0.05]" />
        <span className="text-[9px] text-slate-700 uppercase tracking-widest">Follow-up</span>
        <div className="flex-1 h-px bg-white/[0.05]" />
      </div>
      {messages.map((msg)=>msg.role==="user" ? (
        <motion.div key={msg.id} initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} className="flex justify-end gap-2.5">
          <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tr-sm bg-indigo-600/18 border border-indigo-500/18 text-sm text-slate-200 leading-relaxed shadow-sm">{msg.content}</div>
          <div className="w-6 h-6 rounded-full bg-indigo-600/30 border border-indigo-500/25 flex items-center justify-center flex-shrink-0 mt-0.5"><User className="w-3 h-3 text-indigo-400"/></div>
        </motion.div>
      ) : (
        <motion.div key={msg.id} initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} className="flex gap-2.5">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 mt-0.5"><Bot className="w-3 h-3 text-white"/></div>
          <div className="flex-1 min-w-0 px-4 py-3 rounded-2xl rounded-tl-sm bg-white/[0.02] border border-white/[0.06] shadow-sm">
            <div className="prose-dark text-sm"><ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown></div>
          </div>
        </motion.div>
      ))}
      {isStreaming && streamingText && (
        <motion.div initial={{opacity:0}} animate={{opacity:1}} className="flex gap-2.5">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 mt-0.5"><Loader2 className="w-3 h-3 text-white animate-spin"/></div>
          <div className="flex-1 px-4 py-3 rounded-2xl rounded-tl-sm bg-white/[0.02] border border-white/[0.06] shadow-sm">
            <div className={cn("prose-dark text-sm","typing-cursor")}><ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingText}</ReactMarkdown></div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ── Input Bar ──────────────────────────────────────────────────────────────
function InputBar({ value, onChange, onSend, onKeyDown, isStreaming, textareaRef, domainLabel, selectedDomain, setSelectedDomain, domainOpen, setDomainOpen }: {
  value:string; onChange:(v:string)=>void; onSend:()=>void;
  onKeyDown:(e:React.KeyboardEvent<HTMLTextAreaElement>)=>void;
  isStreaming:boolean; textareaRef:React.RefObject<HTMLTextAreaElement|null>;
  domainLabel:string; selectedDomain:string; setSelectedDomain:(d:string)=>void;
  domainOpen:boolean; setDomainOpen:(v:boolean)=>void;
}) {
  const { toggleRightPanel } = useChatStore();
  return (
    <div className="flex-shrink-0 px-8 pb-6 pt-3 border-t border-white/[0.06]" style={{ background: "rgba(7, 8, 20, 0.2)", backdropFilter: "blur(8px)" }}>
      <div className="max-w-2xl mx-auto">
        {/* Centered target label above input bar ONLY when workspace is empty */}
        {useChatStore.getState().agentTimeline.length === 0 && !useChatStore.getState().recommendation && (
          <div className="text-center text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-3.5 animate-pulse">
            What decision are you working on today?
          </div>
        )}
        <div className={cn("rounded-[18px] border transition-all duration-200", "bg-[#131628]/45 border-white/[0.08]", "focus-within:border-[#8B5CF6]/50 focus-within:bg-[#131628]/75")}>
          <div className="flex items-start gap-2.5 px-4 pt-3.5">
            <textarea ref={textareaRef} value={value} onChange={(e)=>onChange(e.target.value)} onKeyDown={onKeyDown}
              placeholder="Ask anything or upload context..."
              disabled={isStreaming} rows={1}
              className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-500 outline-none resize-none leading-relaxed py-1" />
          </div>
          <div className="flex items-center justify-between px-4 pb-3 mt-2">
            <div className="flex items-center gap-2.5">
              <button 
                onClick={() => document.getElementById("canvas-file-inp")?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold text-slate-400 hover:text-white bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-all cursor-pointer"
                title="Attach Files"
              >
                <Paperclip className="w-3.5 h-3.5 text-slate-500" /> Attach
              </button>
              
              <div className="relative">
                <button onClick={()=>setDomainOpen(!domainOpen)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold text-slate-400 hover:text-white bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-all cursor-pointer">
                  <Zap className="w-3.5 h-3.5 text-[#8B5CF6]"/> {domainLabel}
                </button>
                <AnimatePresence>
                  {domainOpen && (
                    <motion.div initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} exit={{opacity:0,y:4}}
                      className="absolute bottom-full mb-2 left-0 z-50 w-44 rounded-xl border border-white/[0.08] overflow-hidden shadow-2xl" style={{background:"#0f0f1a"}}>
                      {DOMAINS.map((d)=>(
                        <button key={d.value} onClick={()=>{setSelectedDomain(d.value);setDomainOpen(false);}}
                          className={cn("w-full text-left px-3 py-2 text-xs transition-colors cursor-pointer",
                            selectedDomain===d.value?"bg-indigo-600/20 text-indigo-300":"text-slate-450 hover:bg-white/[0.05] hover:text-slate-200")}>
                          {d.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button onClick={toggleRightPanel} className="p-1.5 rounded-xl text-slate-500 hover:text-white hover:bg-white/[0.04] border border-transparent hover:border-white/[0.06] transition-all cursor-pointer" title="Toggle Intelligence sidebar">
                <LayoutDashboard className="w-4 h-4" />
              </button>
            </div>
            
            <button onClick={onSend} disabled={!value.trim()||isStreaming}
              className={cn("w-8 h-8 rounded-full flex items-center justify-center transition-all flex-shrink-0 cursor-pointer",
                value.trim()&&!isStreaming?"bg-[#8B5CF6] hover:bg-[#8B5CF6]/85 text-white shadow-lg shadow-indigo-500/20":"bg-white/[0.02] text-slate-600 cursor-not-allowed border border-white/[0.06]")}>
              <ArrowRight className="w-4 h-4"/>
            </button>
          </div>
        </div>
        <div className="text-center text-[10px] text-slate-500/60 mt-3.5">
          Powered by DecisionOS Planner · All responses are AI-generated
        </div>
      </div>
    </div>
  );
}
