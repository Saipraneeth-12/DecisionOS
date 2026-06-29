const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export interface Conversation {
  id: string;
  title: string;
  summary?: string;
  domain: string;
  status: string;
  is_pinned: boolean;
  category?: string;
  tags: string[];
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system" | "agent";
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ExecutionStep {
  day: number;
  action: string;
  description?: string;
  owner: string;
  priority: 'High' | 'Medium' | 'Low';
  expected_output?: string;
  dependencies?: string[];
}

export interface ExecutionPlan {
  execution_id: string;
  recommendation_id: string;
  recommendation_title?: string;
  execution_steps: ExecutionStep[];
  total_days: number;
  execution_confidence: number;
  key_milestones?: Array<{ day: number; milestone: string; status: string }>;
  success_criteria?: string[];
  risk_mitigations?: string[];
  estimated_arr_impact?: number;
  planner_state: string;
  memory_updated?: boolean;
  closed_loop_enabled?: boolean;
}

export interface HitlPhase {
  phase: number;
  label: string;
  status: 'running' | 'completed' | 'failed';
  recommendation_id?: string;
  transition?: string;
}

export interface HitlResult {
  action: string;
  success?: boolean;
  reason?: string;
  message?: string;
  recommendation_id?: string;
  title?: string;
  current_status?: string;
  new_status?: string;
  planner_state?: string;
  execution_confidence?: number;
  execution_id?: string;
  memory_updated?: boolean;
  confidence_score?: number;
  selected_playbook?: string;
  created_at?: string;
}

export interface RoiMetrics {

  arr_at_risk: number;
  potential_retained_revenue: number;
  expansion_potential: number;
  intervention_cost: number;
  projected_roi: string;
  revenue_velocity_increase_pct?: number;
  sales_cycle_reduction_pct?: number;
  expansion_probability_pct?: number;
}

export interface PatternWithScore {
  pattern: string;
  score: number;
}

export interface Recommendation {
  id?: string;
  title: string;
  action: string;
  rationale?: string;
  supporting_actions?: Array<{ action: string; owner: string; timeline: string; priority: string; expected_impact?: string; arr_protected?: number }>;
  expected_outcome?: string;
  if_not_actioned?: string;
  priority: string;
  urgency: string;
  timeline?: string;
  roi_estimate?: string;
  roi_metrics?: RoiMetrics;
  confidence_score: number;
  confidence_label?: string;
  risk_score: number;
  risk_level: string;
  health_score: number;
  impact_score: number;
  coverage_score: number;
  evidence: string[];
  evidence_strength?: 'Low' | 'Medium' | 'High';
  sources: string[];
  business_rules: string[];
  memory_references: string[];
  risk_factors: string[];
  opportunities: string[];
  similar_cases: Array<{ entity_id: string; summary: string; outcome: string; action: string; result: string; similarity: number }>;
  domain: string;
  domain_insights: Record<string, unknown>;
  approval_status: string;
  lifecycle_status?: string;
  execution_status?: string;
  blocked_reason?: string;
  outcome?: string;
  approval?: Record<string, unknown>;
  is_context_required?: boolean;
  missing_context?: string[];
  score_breakdown?: Record<string, number>;
  alternative_actions?: Array<{ action: string; why_not_primary: string }>;
  key_risks_if_delayed?: string[];
  detected_patterns?: string[];
  patterns_with_scores?: PatternWithScore[];
  selected_playbook?: string;
  playbook_guidance?: Record<string, any>;
  playbook_score?: number;
  recommendation_updated?: boolean;
  previous_recommendation?: string | null;
  previous_status?: string | null;
  reasoning_summary?: string;
  // Enterprise lifecycle fields
  recommendation_id?: string;
  version?: string;
  planner_state?: string;
  memory_status?: string;
  execution_plan_generated?: boolean;
  memory_updated?: boolean;
  closed_loop_completed?: boolean;
  // Enterprise metrics
  decision_health_score?: number;
  business_impact?: number;
  evidence_sources_count?: number;
  context_completeness?: number;
  recommendation_type?: string;
  memory_coverage?: number;
}

export interface AgentStatus {
  agent_name: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  output?: Record<string, unknown>;
  latency_ms?: number;
}

export interface DashboardData {
  recommendation: Recommendation;
  agents_executed: AgentStatus[];
  risk_score: number;
  confidence_score: number;
  impact_score: number;
  health_score: number;
  evidence_count: number;
  memory_refs_count: number;
  similar_cases_count: number;
  knowledge_items_count: number;
  execution_time_ms: number;
  approval_status: string;
  score_breakdown: Record<string, number>;
  improvement_tips: string[];
  insufficient_data?: boolean;
}

export interface StreamEvent {
  type: "text" | "agent_start" | "agent_complete" | "checklist" | "recommendation" | "dashboard" | "error" | "done" | "plan" | "live_update" | "pattern_detection" | "playbook_selection" | "hitl_phase" | "hitl_result" | "execution_plan"
    // V2 event types
    | "workflow_state" | "planner_decision" | "confidence_breakdown" | "context_completeness"
    | "domain_detection" | "progress_check"
    // V3 event types
    | "planner_started" | "planner_complete" | "memory_started" | "memory_complete" | "pattern_detected" | "playbook_selected";
  data: Record<string, unknown>;
  timestamp: string;
}

// ---- Conversations ----

export async function fetchConversations(): Promise<Conversation[]> {
  const res = await fetch(`${API_BASE}/conversations`);
  if (!res.ok) throw new Error("Failed to fetch conversations");
  const data = await res.json();
  return data.conversations ?? [];
}

export async function fetchConversation(id: string): Promise<Conversation & { messages: Message[]; documents: unknown[] }> {
  const res = await fetch(`${API_BASE}/conversations/${id}`);
  if (!res.ok) throw new Error("Failed to fetch conversation");
  return res.json();
}

export async function createConversation(title: string, domain: string): Promise<Conversation> {
  const res = await fetch(`${API_BASE}/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, domain }),
  });
  if (!res.ok) throw new Error("Failed to create conversation");
  return res.json();
}

export async function updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation> {
  const res = await fetch(`${API_BASE}/conversations/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error("Failed to update conversation");
  return res.json();
}

export async function deleteConversation(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/conversations/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete conversation");
}

export async function uploadDocument(conversationId: string, file: File): Promise<unknown> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/conversations/${conversationId}/documents`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error("Failed to upload document");
  return res.json();
}

export async function approveRecommendation(
  recommendationId: string,
  status: string,
  comment?: string,
  modifiedAction?: string,
  escalationTarget?: string
): Promise<unknown> {
  const res = await fetch(`${API_BASE}/conversations/recommendations/${recommendationId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, comment, modified_action: modifiedAction, escalation_target: escalationTarget }),
  });
  if (!res.ok) throw new Error("Failed to submit approval");
  return res.json();
}

/**
 * Approve the latest recommendation for a conversation.
 * Use this when you don't have the recommendation ID available client-side.
 */
export async function approveByConversation(
  conversationId: string,
  status: string,
  comment?: string,
  modifiedAction?: string,
  escalationTarget?: string,
  decisionOwner?: string,
  executionStatus?: string,
  blockedReason?: string,
  outcome?: string
): Promise<unknown> {
  const res = await fetch(`${API_BASE}/conversations/${conversationId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      status,
      comment,
      modified_action: modifiedAction,
      escalation_target: escalationTarget,
      decision_owner: decisionOwner,
      execution_status: executionStatus,
      blocked_reason: blockedReason,
      outcome: outcome,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "Unknown error");
    throw new Error(`Failed to submit approval: ${detail}`);
  }
  return res.json();
}

// ---- Chat Streaming ----

export function streamChat(
  message: string,
  conversationId: string | null,
  domain: string,
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal,
  forceExecution?: boolean
): void {
  const body = JSON.stringify({
    message,
    conversation_id: conversationId,
    domain,
    document_ids: [],
    stream: true,
    force_execution: forceExecution,
  });

  fetch(`${API_BASE}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    signal,
  }).then(async (res) => {
    if (!res.ok || !res.body) {
      onEvent({ type: "error", data: { message: "Stream failed" }, timestamp: new Date().toISOString() });
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const event = JSON.parse(line.slice(6)) as StreamEvent;
            onEvent(event);
          } catch {
            // skip malformed
          }
        }
      }
    }
  }).catch((err) => {
    if (err?.name !== "AbortError") {
      onEvent({ type: "error", data: { message: err.message }, timestamp: new Date().toISOString() });
    }
  });
}
