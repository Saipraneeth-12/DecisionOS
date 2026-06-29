import { create } from "zustand";
import type { Conversation, Message, Recommendation, DashboardData, AgentStatus, ExecutionPlan, HitlPhase, HitlResult } from "./api";
import type { ConversationStage } from "./utils";

interface AgentTimelineEntry {
  agent_name: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  output?: Record<string, unknown>;
  latency_ms?: number;
}

interface ChecklistItem {
  name: string;
  type: string;
  status: "available" | "missing" | "partial";
  required: boolean;
  description: string;
}

interface MemoryDiscoveryCase {
  entity_id?: string;
  summary: string;
  outcome: string;
  result: string;
  similarity: number;
  saved_value?: string;
  time_ago?: string;
}

interface MemoryDiscovery {
  found: boolean;
  count: number;
  cases: MemoryDiscoveryCase[];
}

interface DecisionReadinessDimension {
  label: string;
  score: number; // 0-100
}

interface DecisionReadiness {
  score: number; // 0-100
  dimensions: DecisionReadinessDimension[];
  missing: string[];
}

export interface OutcomeCapture {
  recommendation_id: string;
  outcome: "positive" | "neutral" | "negative";
  metrics?: {
    arr_impact?: number;
    retention_rate?: number;
    time_to_close?: number;
    notes?: string;
  };
  submitted_at: string;
}

export interface StrategyEvolutionEntry {
  recommendation_id: string;
  title: string;
  playbook: string;
  status: string;
  created_at: string;
  confidence?: number;
  outcome?: string;
}

// V2 additions
export interface ConfidenceBreakdownItem {
  label: string;
  points: number;
  sign: "positive" | "negative" | "neutral";
  status?: string;
}

export interface PlannerDecision {
  context_score: number;
  memory_found: boolean;
  continue_selected: boolean;
  execution_mode: "fast" | "standard" | "deep_analysis";
  next_stage: string;
  recommendation_authorized: boolean;
  missing_information_triggered: boolean;
}

export interface ContextFieldScore {
  label: string;
  points: number;
  provided: boolean;
}

export interface DomainDetection {
  detected_domain: string;
  confidence: number;
  activated_specialists: string[];
}

export interface ProgressCheckResult {
  has_updates: boolean;
  completed_actions: string[];
  blocked_actions: string[];
  improved_metrics: string[];
  outcome_signals: string[];
  new_risks: string[];
  new_stakeholders: string[];
  context_changes: string[];
  update_summary: string;
  recommendation_evolution: string;
  suggested_next_stage: string;
}

interface ChatState {
  // Conversations
  conversations: Conversation[];
  activeConversationId: string | null;
  setConversations: (c: Conversation[]) => void;
  addConversation: (c: Conversation) => void;
  updateConversation: (id: string, updates: Partial<Conversation>) => void;
  removeConversation: (id: string) => void;
  setActiveConversation: (id: string | null) => void;

  // Messages
  messages: Record<string, Message[]>;
  addMessage: (conversationId: string, msg: Message) => void;
  setMessages: (conversationId: string, msgs: Message[]) => void;

  // Streaming state
  isStreaming: boolean;
  streamingText: string;
  setIsStreaming: (v: boolean) => void;
  appendStreamText: (text: string) => void;
  clearStreamText: () => void;

  // Agent timeline
  agentTimeline: AgentTimelineEntry[];
  updateAgentStatus: (name: string, status: string, output?: Record<string, unknown>, latency?: number) => void;
  resetAgentTimeline: () => void;

  // Checklist
  checklist: ChecklistItem[];
  checklistVisible: boolean;
  setChecklist: (items: ChecklistItem[]) => void;
  setChecklistVisible: (v: boolean) => void;

  // Dashboard
  dashboard: DashboardData | null;
  setDashboard: (d: DashboardData | null) => void;
  recommendation: Recommendation | null;
  setRecommendation: (r: Recommendation | null) => void;

  // Stage
  currentStage: ConversationStage;
  setCurrentStage: (stage: ConversationStage) => void;

  // Memory discovery
  memoryDiscovery: MemoryDiscovery | null;
  setMemoryDiscovery: (m: MemoryDiscovery | null) => void;

  // Decision readiness
  decisionReadiness: DecisionReadiness | null;
  setDecisionReadiness: (r: DecisionReadiness | null) => void;

  // Observability panel
  observabilityOpen: boolean;
  toggleObservability: () => void;

  // UI state
  sidebarOpen: boolean;
  rightPanelOpen: boolean;
  selectedDomain: string;
  toggleSidebar: () => void;
  toggleRightPanel: () => void;
  setSelectedDomain: (d: string) => void;

  // Approval modal
  approvalModalOpen: boolean;
  setApprovalModalOpen: (v: boolean) => void;

  // Uploaded docs
  uploadedDocs: Record<string, unknown[]>;
  addUploadedDoc: (conversationId: string, doc: unknown) => void;

  // Execution plan (HITL post-approval plan)
  executionPlan: ExecutionPlan | null;
  setExecutionPlan: (plan: ExecutionPlan | null) => void;

  // Live thoughts
  liveThought: string;
  setLiveThought: (msg: string) => void;

  // Planner summary (done event stats)
  plannerSummary: {
    agents_executed: number;
    evidence_sources: number;
    recommendations_generated: number;
    pending_information: number;
    pending_reviews: number;
    total_execution_ms: number;
  } | null;
  setPlannerSummary: (s: any | null) => void;

  // Force execution (bypass context check)
  forceExecution: boolean;
  setForceExecution: (v: boolean) => void;

  // Explainability and playbooks
  detectedPatterns: { patterns: string[]; confidence: number; evidence_signals: string[] } | null;
  setDetectedPatterns: (v: { patterns: string[]; confidence: number; evidence_signals: string[] } | null) => void;
  selectedPlaybook: { selected_playbook: string; active_playbooks: string[]; playbook_guidance: Record<string, any> } | null;
  setSelectedPlaybook: (v: { selected_playbook: string; active_playbooks: string[]; playbook_guidance: Record<string, any> } | null) => void;
  memoryEvolution: { updated: boolean; previousRecommendation: string | null; previousStatus: string | null; reasoningSummary: string } | null;
  setMemoryEvolution: (v: { updated: boolean; previousRecommendation: string | null; previousStatus: string | null; reasoningSummary: string } | null) => void;

  // HITL lifecycle state
  hitlPhases: HitlPhase[];
  addHitlPhase: (phase: HitlPhase) => void;
  hitlResult: HitlResult | null;
  setHitlResult: (r: HitlResult | null) => void;
  clearHitlState: () => void;

  // Outcome capture
  outcomeCapture: OutcomeCapture | null;
  setOutcomeCapture: (o: OutcomeCapture | null) => void;

  // Strategy evolution
  strategyEvolution: StrategyEvolutionEntry[];
  addStrategyEntry: (entry: StrategyEvolutionEntry) => void;
  clearStrategyEvolution: () => void;

  // V2: Workflow State Machine
  workflowState: string;
  setWorkflowState: (state: string) => void;

  // V2: Planner Decision
  plannerDecision: PlannerDecision | null;
  setPlannerDecision: (d: PlannerDecision | null) => void;

  // V2: Confidence Breakdown (explainable)
  confidenceBreakdown: ConfidenceBreakdownItem[];
  setConfidenceBreakdown: (items: ConfidenceBreakdownItem[]) => void;

  // V2: Context field scores
  contextFieldScores: Record<string, number>;
  contextProvidedFields: string[];
  contextMissingFields: string[];
  setContextFields: (scores: Record<string, number>, provided: string[], missing: string[]) => void;

  // V2: Domain detection
  domainDetection: DomainDetection | null;
  setDomainDetection: (d: DomainDetection | null) => void;

  // V2: Progress check result
  progressCheckResult: ProgressCheckResult | null;
  setProgressCheckResult: (r: ProgressCheckResult | null) => void;

  // V2: Execution mode
  executionMode: "fast" | "standard" | "deep_analysis";
  setExecutionMode: (mode: "fast" | "standard" | "deep_analysis") => void;

  // V3: Streaming feed events (append-only live event log)
  feedEvents: Array<{ id: string; type: string; ts: number; data: Record<string, unknown> }>;
  addFeedEvent: (type: string, data: Record<string, unknown>) => void;
  clearFeedEvents: () => void;

  // General reset for conversation/session switches
  resetConversationState: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  setConversations: (conversations) => set({ conversations }),
  addConversation: (c) => set((s) => ({ conversations: [c, ...s.conversations] })),
  updateConversation: (id, updates) =>
    set((s) => ({
      conversations: s.conversations.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),
  removeConversation: (id) =>
    set((s) => ({
      conversations: s.conversations.filter((c) => c.id !== id),
      activeConversationId: s.activeConversationId === id ? null : s.activeConversationId,
    })),
  setActiveConversation: (id) => set({ activeConversationId: id }),

  messages: {},
  addMessage: (conversationId, msg) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [conversationId]: [...(s.messages[conversationId] ?? []), msg],
      },
    })),
  setMessages: (conversationId, msgs) =>
    set((s) => ({ messages: { ...s.messages, [conversationId]: msgs } })),

  isStreaming: false,
  streamingText: "",
  setIsStreaming: (v) => set({ isStreaming: v }),
  appendStreamText: (text) => set((s) => ({ streamingText: s.streamingText + text })),
  clearStreamText: () => set({ streamingText: "" }),

  agentTimeline: [],
  updateAgentStatus: (name, status, output, latency) =>
    set((s) => {
      const existing = s.agentTimeline.find((a) => a.agent_name === name);
      if (existing) {
        return {
          agentTimeline: s.agentTimeline.map((a) =>
            a.agent_name === name
              ? { ...a, status: status as AgentTimelineEntry["status"], output, latency_ms: latency }
              : a
          ),
        };
      }
      return {
        agentTimeline: [
          ...s.agentTimeline,
          { agent_name: name, status: status as AgentTimelineEntry["status"], output, latency_ms: latency },
        ],
      };
    }),
  resetAgentTimeline: () => set({ agentTimeline: [] }),

  checklist: [],
  checklistVisible: false,
  setChecklist: (items) => set({ checklist: items }),
  setChecklistVisible: (v) => set({ checklistVisible: v }),

  dashboard: null,
  setDashboard: (d) => set({ dashboard: d }),
  recommendation: null,
  setRecommendation: (r) => set({ recommendation: r }),

  currentStage: "gathering_context",
  setCurrentStage: (stage) => set({ currentStage: stage }),

  memoryDiscovery: null,
  setMemoryDiscovery: (m) => set({ memoryDiscovery: m }),

  decisionReadiness: null,
  setDecisionReadiness: (r) => set({ decisionReadiness: r }),

  observabilityOpen: false,
  toggleObservability: () => set((s) => ({ observabilityOpen: !s.observabilityOpen })),

  sidebarOpen: true,
  rightPanelOpen: true,
  selectedDomain: "customer_success",
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
  setSelectedDomain: (d) => set({ selectedDomain: d }),

  approvalModalOpen: false,
  setApprovalModalOpen: (v) => set({ approvalModalOpen: v }),

  uploadedDocs: {},
  addUploadedDoc: (conversationId, doc) =>
    set((s) => ({
      uploadedDocs: {
        ...s.uploadedDocs,
        [conversationId]: [...(s.uploadedDocs[conversationId] ?? []), doc],
      },
    })),

  executionPlan: null,
  setExecutionPlan: (plan) => set({ executionPlan: plan }),

  liveThought: "",
  setLiveThought: (msg) => set({ liveThought: msg }),

  plannerSummary: null,
  setPlannerSummary: (s) => set({ plannerSummary: s }),

  forceExecution: false,
  setForceExecution: (v) => set({ forceExecution: v }),

  detectedPatterns: null,
  setDetectedPatterns: (v) => set({ detectedPatterns: v }),
  selectedPlaybook: null,
  setSelectedPlaybook: (v) => set({ selectedPlaybook: v }),
  memoryEvolution: null,
  setMemoryEvolution: (v) => set({ memoryEvolution: v }),

  // HITL lifecycle
  hitlPhases: [],
  addHitlPhase: (phase) =>
    set((s) => ({
      hitlPhases: [
        ...s.hitlPhases.filter((p) => p.phase !== phase.phase),
        phase,
      ],
    })),
  hitlResult: null,
  setHitlResult: (r) => set({ hitlResult: r }),
  clearHitlState: () => set({ hitlPhases: [], hitlResult: null }),

  // Outcome capture
  outcomeCapture: null,
  setOutcomeCapture: (o) => set({ outcomeCapture: o }),

  // Strategy evolution
  strategyEvolution: [],
  addStrategyEntry: (entry) =>
    set((s) => ({
      strategyEvolution: [...s.strategyEvolution.filter((e) => e.recommendation_id !== entry.recommendation_id), entry],
    })),
  clearStrategyEvolution: () => set({ strategyEvolution: [] }),

  // V2: Workflow State Machine
  workflowState: "WAITING_FOR_INPUT",
  setWorkflowState: (state) => set({ workflowState: state }),

  // V2: Planner Decision
  plannerDecision: null,
  setPlannerDecision: (d) => set({ plannerDecision: d }),

  // V2: Confidence Breakdown
  confidenceBreakdown: [],
  setConfidenceBreakdown: (items) => set({ confidenceBreakdown: items }),

  // V2: Context field scores
  contextFieldScores: {},
  contextProvidedFields: [],
  contextMissingFields: [],
  setContextFields: (scores, provided, missing) =>
    set({ contextFieldScores: scores, contextProvidedFields: provided, contextMissingFields: missing }),

  // V2: Domain detection
  domainDetection: null,
  setDomainDetection: (d) => set({ domainDetection: d }),

  // V2: Progress check result
  progressCheckResult: null,
  setProgressCheckResult: (r) => set({ progressCheckResult: r }),

  // V2: Execution mode
  executionMode: "standard",
  setExecutionMode: (mode) => set({ executionMode: mode }),

  // V3: Streaming feed events
  feedEvents: [],
  addFeedEvent: (type, data) =>
    set((s) => ({
      feedEvents: [
        ...s.feedEvents,
        { id: `fe-${Date.now()}-${Math.random().toString(36).slice(2,7)}`, type, ts: Date.now(), data },
      ],
    })),
  clearFeedEvents: () => set({ feedEvents: [] }),

  resetConversationState: () => set({
    agentTimeline: [],
    checklist: [],
    checklistVisible: false,
    dashboard: null,
    recommendation: null,
    currentStage: "gathering_context",
    memoryDiscovery: null,
    decisionReadiness: null,
    executionPlan: null,
    liveThought: "",
    plannerSummary: null,
    detectedPatterns: null,
    selectedPlaybook: null,
    memoryEvolution: null,
    hitlPhases: [],
    hitlResult: null,
    outcomeCapture: null,
    strategyEvolution: [],
    workflowState: "WAITING_FOR_INPUT",
    plannerDecision: null,
    confidenceBreakdown: [],
    contextFieldScores: {},
    contextProvidedFields: [],
    contextMissingFields: [],
    domainDetection: null,
    progressCheckResult: null,
    executionMode: "standard",
    feedEvents: [],
    streamingText: "",
  }),
}));
