"""
DecisionOS Main Workflow V2 — Stateful, Planner-Authoritative.

V2 Changes:
  1. PLANNER IS AUTHORITATIVE: Only planner transitions workflow states.
  2. MEMORY ALWAYS FIRST: MemoryAgent runs before Planner makes any decision.
  3. STATE MACHINE: Explicit WorkflowState enum persisted per conversation.
  4. HITL FIX: "continue" → ProgressCheckAgent → Planner → Recommendation.
  5. RECOMMENDATION CONSISTENCY: Never generate recommendation AND missing-info simultaneously.
  6. STREAMING: Pervasive workflow_state events, planner_decision events, domain_detection.
  7. CONFIDENCE: Emits explainable breakdown via confidence_breakdown events.

Routing:
  HITL_FLOW           → hitl_flow    (approve/reject/modify/escalate/status — lifecycle)
  HITL_CONTINUE       → continue_flow (user chose Continue → ProgressCheck → re-plan)
  GREETING_FLOW       → greeting_flow (social, 2 agents, natural response)
  CONTEXT_REQUEST     → context_request_flow (low info, ask for more)
  PARTIAL_PIPELINE    → partial_flow  (memory+knowledge+rec, no risk/opportunity)
  FULL_PIPELINE       → full_flow     (all agents, planner-authorized)
"""
from typing import Dict, Any, List, AsyncIterator
import asyncio, json, time
from datetime import datetime, timezone
from enum import Enum

from app.agents.context_evaluator      import ContextEvaluator
from app.agents.conversation_manager   import ConversationManagerAgent
from app.agents.information_completeness import InformationCompletenessAgent
from app.agents.planner                import PlannerAgent
from app.agents.memory_agent           import MemoryAgent
from app.agents.knowledge_agent        import KnowledgeAgent
from app.agents.domain_specialist      import DomainSpecialistAgent
from app.agents.risk_agent             import RiskAgent
from app.agents.opportunity_agent      import OpportunityAgent
from app.agents.recommendation_agent  import RecommendationAgent
from app.agents.confidence_agent       import ConfidenceAgent
from app.agents.pattern_detection_agent import PatternDetectionAgent
from app.agents.playbook_router         import PlaybookRouter
from app.agents.execution_plan_agent   import ExecutionPlanAgent
from app.agents.progress_check_agent   import ProgressCheckAgent

# V2 HITL Agents
from app.agents.approval_agent         import ApprovalAgent
from app.agents.rejection_agent        import RejectionAgent
from app.agents.modification_agent     import ModificationAgent
from app.agents.escalation_agent       import EscalationAgent
from app.agents.information_gap_agent import InformationGapAgent
from app.agents.memory_updater         import MemoryUpdater

from app.memory.memory_manager         import memory_manager
from app.services.conversation_service import conversation_store
from app.core.logging                  import logger


# ── Workflow State Machine ─────────────────────────────────────────────────
class WFState(str, Enum):
    WAITING_FOR_INPUT      = "WAITING_FOR_INPUT"
    CHECKING_MEMORY        = "CHECKING_MEMORY"
    MEMORY_FOUND           = "MEMORY_FOUND"
    WAITING_FOR_HITL       = "WAITING_FOR_HITL"
    PROGRESS_CHECK         = "PROGRESS_CHECK"
    MISSING_INFORMATION    = "MISSING_INFORMATION"
    CONTEXT_COMPLETE       = "CONTEXT_COMPLETE"
    PLANNING               = "PLANNING"
    RETRIEVING             = "RETRIEVING"
    DIAGNOSING             = "DIAGNOSING"
    PATTERN_ANALYSIS       = "PATTERN_ANALYSIS"
    PLAYBOOK_SELECTION     = "PLAYBOOK_SELECTION"
    GENERATING_RECOMMENDATIONS = "GENERATING_RECOMMENDATIONS"
    AWAITING_APPROVAL      = "AWAITING_APPROVAL"
    EXECUTION_TRACKING     = "EXECUTION_TRACKING"
    OUTCOME_CAPTURE        = "OUTCOME_CAPTURE"
    LEARNING               = "LEARNING"
    MEMORY_UPDATE          = "MEMORY_UPDATE"


# Per-conversation session state store (in-memory for demo)
_session_states: Dict[str, str] = {}


class WorkflowStateObj:
    def __init__(self, user_message, conversation_id, domain,
                 uploaded_documents, conversation_history):
        self.user_message        = user_message
        self.conversation_id     = conversation_id
        self.domain              = domain
        self.uploaded_documents  = uploaded_documents  or []
        self.conversation_history= conversation_history or []
        # Agent outputs
        self.context_evaluator_output:        Dict = {}
        self.conversation_manager_output:     Dict = {}
        self.information_completeness_output: Dict = {}
        self.planner_output:                  Dict = {}
        self.memory_agent_output:             Dict = {}
        self.knowledge_agent_output:          Dict = {}
        self.domain_specialist_output:        Dict = {}
        self.risk_agent_output:               Dict = {}
        self.opportunity_agent_output:        Dict = {}
        self.pattern_detection_output:        Dict = {}
        self.playbook_router_output:          Dict = {}
        self.recommendation_agent_output:     Dict = {}
        self.confidence_agent_output:         Dict = {}
        self.progress_check_output:           Dict = {}
        self.agent_timeline: List[Dict] = []
        self.total_start_time = time.time()
        self.workflow_state = WFState.WAITING_FOR_INPUT
        self.is_continue_session = False

    def to_dict(self) -> Dict[str, Any]:
        d = {k: v for k, v in self.__dict__.items()
             if not k.startswith("_") and k != "total_start_time"}
        d["workflow_state"] = self.workflow_state.value
        return d

    def set_state(self, state: WFState):
        self.workflow_state = state
        if self.conversation_id:
            _session_states[self.conversation_id] = state.value


# ── Main Workflow ─────────────────────────────────────────────────────────

class DecisionWorkflow:
    def __init__(self):
        self.context_evaluator      = ContextEvaluator()
        self.conversation_manager   = ConversationManagerAgent()
        self.info_completeness      = InformationCompletenessAgent()
        self.planner                = PlannerAgent()
        self.memory_agent           = MemoryAgent()
        self.knowledge_agent        = KnowledgeAgent()
        self.domain_specialist      = DomainSpecialistAgent()
        self.risk_agent             = RiskAgent()
        self.opportunity_agent      = OpportunityAgent()
        self.pattern_detection      = PatternDetectionAgent()
        self.playbook_router        = PlaybookRouter()
        self.recommendation_agent   = RecommendationAgent()
        self.confidence_agent       = ConfidenceAgent()
        self.execution_plan_agent   = ExecutionPlanAgent()
        self.progress_check_agent   = ProgressCheckAgent()

        # V2 HITL agents
        self.approval_agent         = ApprovalAgent()
        self.rejection_agent        = RejectionAgent()
        self.modification_agent     = ModificationAgent()
        self.escalation_agent       = EscalationAgent()
        self.information_gap_agent = InformationGapAgent()
        self.memory_updater         = MemoryUpdater()

    # ── public entry point ────────────────────────────────────────────────
    async def execute_streaming(
        self,
        user_message: str,
        conversation_id: str,
        domain: str = "customer_success",
        uploaded_documents: List[Dict] = None,
        conversation_history: List[Dict] = None,
        force_execution: bool = False,
    ) -> AsyncIterator[Dict[str, Any]]:
        state = WorkflowStateObj(user_message, conversation_id, domain,
                                  uploaded_documents, conversation_history)
        state.force_execution = force_execution
        try:
            async for evt in self._route(state):
                yield evt
        except Exception as e:
            logger.error("workflow_error_v2", error=str(e))
            yield self._evt("error", {"message": str(e)})
            yield self._evt("done",  {"error": True, "conversation_id": conversation_id})

    # ── router ────────────────────────────────────────────────────────────
    async def _route(self, state: WorkflowStateObj) -> AsyncIterator[Dict]:
        # ── Step 0: Emit initial workflow state ──────────────────────────
        yield self._evt("workflow_state", {
            "state": WFState.WAITING_FOR_INPUT.value,
            "label": "Waiting for Input",
            "conversation_id": state.conversation_id,
        })

        # ── Step 1: Context Evaluator (always, no LLM) ───────────────────
        yield self._evt("agent_start", {"agent_name": "context_evaluator", "status": "running"})
        yield self._evt("live_update", {"message": "Evaluating context and detecting workflow intent..."})
        r = await self.context_evaluator.execute(state.to_dict())
        state.context_evaluator_output = r.output
        state.agent_timeline.append(r.to_dict())
        ctx = r.output
        yield self._evt("agent_complete", {
            "agent_name": "context_evaluator",
            "status": r.status,
            "output": {
                "context_score": ctx.get("context_score"),
                "context_class": ctx.get("context_class"),
                "routing":       ctx.get("routing"),
                "provided_fields": ctx.get("provided_fields", []),
                "missing_fields":  ctx.get("missing_fields", []),
                "field_scores":    ctx.get("field_scores", {}),
            },
            "latency_ms": r.latency_ms,
        })

        # Emit context completeness event with field scores
        yield self._evt("context_completeness", {
            "score": ctx.get("context_score", 0),
            "class": ctx.get("context_class", "INSUFFICIENT"),
            "provided_fields": ctx.get("provided_fields", []),
            "missing_fields":  ctx.get("missing_fields", []),
            "field_scores":    ctx.get("field_scores", {}),
        })

        routing = ctx.get("routing", "FULL_PIPELINE")
        hitl_intent = ctx.get("hitl_intent", {})

        # ── HITL: "continue" → ProgressCheck flow ───────────────────────
        if routing == "HITL_FLOW" and hitl_intent.get("action") == "continue":
            state.is_continue_session = True
            async for evt in self._continue_flow(state, ctx):
                yield evt
            return

        # ── HITL: approve/reject/modify/status → lifecycle commands ──────
        if routing == "HITL_FLOW":
            async for evt in self._hitl_flow(state, ctx):
                yield evt
            return

        # Bypass context block if forced
        if getattr(state, "force_execution", False) and routing == "CONTEXT_REQUEST":
            routing = "PARTIAL_PIPELINE"

        if routing == "GREETING_FLOW":
            async for evt in self._greeting_flow(state, ctx):
                yield evt
        elif routing == "CONTEXT_REQUEST":
            async for evt in self._context_request_flow(state, ctx):
                yield evt
        elif routing == "PARTIAL_PIPELINE":
            async for evt in self._partial_flow(state, ctx):
                yield evt
        else:
            async for evt in self._full_flow(state, ctx):
                yield evt

    # ─────────────────────────────────────────────────────────────────────
    # FLOW: Continue Existing Analysis → ProgressCheck → Full Pipeline
    # ─────────────────────────────────────────────────────────────────────
    async def _continue_flow(self, state: WorkflowStateObj, ctx: Dict) -> AsyncIterator[Dict]:
        """User chose 'Continue' — run ProgressCheckAgent, then re-plan."""
        conv_id = state.conversation_id
        state.set_state(WFState.PROGRESS_CHECK)
        yield self._evt("workflow_state", {
            "state": WFState.PROGRESS_CHECK.value,
            "label": "Progress Check",
            "message": "Checking what has changed since the last recommendation...",
        })

        yield self._evt("live_update", {"message": "Planner reactivated — checking progress since last session..."})
        yield self._evt("hitl_phase", {"phase": 0, "label": "Progress Check", "status": "running"})

        # Get previous recommendation for context
        prev_rec = conversation_store.get_latest_recommendation(conv_id) or {}
        state_dict = state.to_dict()
        state_dict["previous_recommendation"] = prev_rec

        # Run ProgressCheckAgent
        yield self._evt("agent_start", {"agent_name": "progress_check_agent", "status": "running"})
        yield self._evt("live_update", {"message": "ProgressCheckAgent: What changed since the last recommendation?"})
        pc_r = await self.progress_check_agent.execute(state_dict)
        state.progress_check_output = pc_r.output
        state.agent_timeline.append(pc_r.to_dict())
        yield self._evt("agent_complete", {
            "agent_name": "progress_check_agent",
            "status": pc_r.status,
            "output": {
                "has_updates": pc_r.output.get("has_updates"),
                "completed_actions": pc_r.output.get("completed_actions", []),
                "blocked_actions": pc_r.output.get("blocked_actions", []),
                "update_summary": pc_r.output.get("update_summary", ""),
                "suggested_next_stage": pc_r.output.get("suggested_next_stage", "continue_strategy"),
            },
            "latency_ms": pc_r.latency_ms,
        })
        yield self._evt("hitl_phase", {"phase": 0, "label": "Progress Check", "status": "completed"})
        yield self._evt("progress_check", pc_r.output)

        # Stream a progress summary
        summary = pc_r.output.get("update_summary", "Continuing from previous analysis.")
        update_text = (
            f"## 🔄 Progress Check Complete\n\n"
            f"{summary}\n\n"
            f"**Suggested next stage:** {pc_r.output.get('suggested_next_stage', 'continue_strategy').replace('_', ' ').title()}\n\n"
            f"Re-engaging Planner to generate updated recommendation...\n\n"
        )
        for word in update_text.split(" "):
            yield self._evt("text", {"content": word + " "})
            await asyncio.sleep(0.008)

        # Now run the full pipeline with progress context
        state.set_state(WFState.PLANNING)
        async for evt in self._full_flow(state, ctx):
            yield evt

    # ─────────────────────────────────────────────────────────────────────
    # FLOW 0 — HITL: approve/reject/modify/escalate/status
    # ─────────────────────────────────────────────────────────────────────
    async def _hitl_flow(self, state: WorkflowStateObj, ctx: Dict) -> AsyncIterator[Dict]:
        """Handle human lifecycle commands using dedicated V2 HITL agents."""
        hitl_intent = ctx.get("hitl_intent", {})
        action      = hitl_intent.get("action", "approve")
        modifier    = hitl_intent.get("modifier")
        conv_id     = state.conversation_id

        yield self._evt("live_update", {"message": f"Planner Reactivated — Phase 8: Approval Processing ({action.upper()})..."})
        yield self._evt("workflow_state", {"state": WFState.WAITING_FOR_HITL.value, "label": f"Human Approval ({action.upper()})"})
        yield self._evt("hitl_phase", {"phase": 8, "label": "Human Approval Processing", "status": "running"})

        # Retrieve target recommendation
        rec = conversation_store.get_latest_recommendation(conv_id)

        if not rec:
            yield self._evt("hitl_phase", {"phase": 8, "label": "Human Approval Processing", "status": "failed"})
            no_rec_text = (
                "## ⚠️ No Pending Recommendation Found\n\n"
                "There is no active recommendation in this session to act upon.\n\n"
                "Please describe the scenario or upload customer metrics first."
            )
            for word in no_rec_text.split(" "):
                yield self._evt("text", {"content": word + " "})
                await asyncio.sleep(0.005)
            yield self._evt("hitl_result", {"action": action, "success": False, "reason": "no_recommendation"})
            yield self._evt("done", {"conversation_id": conv_id, "flow": "hitl", "total_execution_ms": 100})
            return

        nba_id     = rec.get("recommendation_id", "NBA-UNKNOWN")
        rec_title  = rec.get("title", "Recommendation")
        rec_status = rec.get("approval_status", rec.get("lifecycle_status", "pending"))
        current_planner_state = rec.get("planner_state", "WAITING_FOR_HUMAN")

        # Emit lookups for UI tracking
        yield self._evt("hitl_result", {
            "action": "lookup", "recommendation_id": nba_id, "title": rec_title,
            "current_status": rec_status, "planner_state": current_planner_state,
        })

        # Check for status query
        if action == "status":
            yield self._evt("hitl_phase", {"phase": 8, "label": "Status Retrieval", "status": "completed"})
            status_text = (
                f"## 📊 Recommendation Status\n\n"
                f"**{rec_title}**\n\n"
                f"| Field | Value |\n|---|---|\n"
                f"| ID | `{nba_id}` |\n"
                f"| Status | **{rec_status.upper()}** |\n"
                f"| Playbook | {rec.get('selected_playbook', 'N/A')} |\n"
                f"| Confidence | {int((rec.get('confidence_score') or 0)*100)}% |\n"
                f"| Planner State | `{current_planner_state}` |\n"
                f"| Memory Links | `{conv_id}` |\n\n"
                f"_Send `approve`, `reject`, or `modify recommendation` to trigger actions._"
            )
            for word in status_text.split(" "):
                yield self._evt("text", {"content": word + " "})
                await asyncio.sleep(0.005)
            yield self._evt("done", {"conversation_id": conv_id, "flow": "hitl", "total_execution_ms": 150})
            return

        # ── 1. Executing APPROVAL agent flow ──────────────────────────────────
        if action == "approve":
            yield self._evt("agent_start", {"agent_name": "approval_agent", "status": "running"})
            state_dict = state.to_dict()
            state_dict["recommendation"] = rec
            state_dict["comment"] = modifier or "Approved via HITL action"

            app_res = await self.approval_agent.run(state_dict)
            updated_rec = app_res.get("updated_recommendation", rec)

            yield self._evt("agent_complete", {
                "agent_name": "approval_agent", "status": "completed",
                "output": app_res, "latency_ms": 250
            })
            yield self._evt("hitl_phase", {"phase": 8, "label": "Human Approval Processing", "status": "completed"})

            # Proceed to Phase 9: Execution Planning
            yield self._evt("workflow_state", {"state": WFState.EXECUTION_TRACKING.value, "label": "Execution Planning"})
            yield self._evt("hitl_phase", {"phase": 9, "label": "Execution Planning", "status": "running"})
            yield self._evt("agent_start", {"agent_name": "execution_plan_agent", "status": "running"})

            exec_state = {"approved_recommendation": updated_rec, "hitl_intent": hitl_intent, "conversation_id": conv_id}
            exec_res = await self.execution_plan_agent.execute(exec_state)
            exec_plan = exec_res.output

            yield self._evt("agent_complete", {
                "agent_name": "execution_plan_agent", "status": "completed",
                "output": exec_plan, "latency_ms": 350
            })
            yield self._evt("hitl_phase", {"phase": 9, "label": "Execution Planning", "status": "completed"})

            # Store plan on the recommendation
            updated_rec["execution_plan"] = exec_plan
            updated_rec["execution_status"] = "active"
            updated_rec["planner_state"] = "EXECUTING"
            if updated_rec.get("id"):
                conversation_store.update_recommendation_approval(updated_rec["id"], {
                    "status": "approved", "execution_status": "active",
                    "execution_plan": exec_plan, "planner_state": "EXECUTING"
                })

            # Proceed to Phase 11: Memory Updates
            yield self._evt("workflow_state", {"state": WFState.MEMORY_UPDATE.value, "label": "Memory Updates"})
            yield self._evt("hitl_phase", {"phase": 11, "label": "Memory Updates", "status": "running"})
            yield self._evt("agent_start", {"agent_name": "memory_updater", "status": "running"})

            mem_state = {"recommendation": updated_rec, "conversation_id": conv_id}
            mem_res = await self.memory_updater.run(mem_state)

            yield self._evt("agent_complete", {
                "agent_name": "memory_updater", "status": "completed",
                "output": mem_res, "latency_ms": 150
            })
            yield self._evt("hitl_phase", {"phase": 11, "label": "Memory Updates", "status": "completed"})

            # Finalize approval text response
            steps = exec_plan.get("execution_steps", [])
            exec_id = exec_plan.get("execution_id", "EXP-1042")
            exec_conf = exec_plan.get("execution_confidence", 91)

            response_md = (
                f"## ✅ Recommendation Approved\n\n"
                f"**Planner Reactivated** — Lifecycle transition complete.\n\n"
                f"### 🔍 Phase 8 — Human Approval\n"
                f"- **Agent:** `ApprovalAgent`\n"
                f"- **Recommendation ID:** `{nba_id}`\n"
                f"- **Status Transition:** `PENDING_APPROVAL` ➔ **APPROVED** ✅\n\n"
                f"### ⚡ Phase 9 — Execution Planning\n"
                f"- **Agent:** `ExecutionAgent` (`{exec_id}`)\n"
                f"- **Generating execution strategy...**\n\n"
                f"#### Execution Timeline\n"
            )
            for step in steps:
                pri_emoji = {"High": "🔴", "Medium": "🟡", "Low": "🟢"}.get(step.get("priority", "Medium"), "⚪")
                response_md += f"- **Day {step.get('day')}:** {step.get('action')} (Owner: *{step.get('owner')}* · Priority: {pri_emoji} {step.get('priority')})\n"

            response_md += (
                f"\n---\n\n"
                f"| Parameter | Status |\n"
                f"|---|---|\n"
                f"| Recommendation Status | **APPROVED** |\n"
                f"| Execution Status | **ACTIVE** |\n"
                f"| Execution Confidence | **{exec_conf}%** |\n"
                f"| Memory Updated | **YES** (Phase 11) |\n"
                f"| Planner State | `EXECUTING` |\n"
            )
            for word in response_md.split(" "):
                yield self._evt("text", {"content": word + " "})
                await asyncio.sleep(0.005)

            yield self._evt("recommendation", updated_rec)
            yield self._evt("execution_plan", {**exec_plan, "recommendation_id": nba_id, "recommendation_title": rec_title})
            yield self._evt("hitl_result", {
                "action": "approve", "success": True, "recommendation_id": nba_id,
                "new_status": "approved", "planner_state": "EXECUTING", "memory_updated": True
            })
            yield self._evt("workflow_state", {"state": WFState.EXECUTION_TRACKING.value, "label": "Approved — Executing"})
            yield self._evt("done", {
                "conversation_id": conv_id, "flow": "hitl", "total_execution_ms": int((time.time() - state.total_start_time)*1000),
                "agents_executed": 3
            })
            return

        # ── 2. Executing REJECTION agent flow ─────────────────────────────────
        elif action == "reject":
            yield self._evt("agent_start", {"agent_name": "rejection_agent", "status": "running"})
            state_dict = state.to_dict()
            state_dict["recommendation"] = rec
            state_dict["comment"] = modifier or "Awaiting explanation"

            rej_res = await self.rejection_agent.run(state_dict)
            updated_rec = rej_res.get("updated_recommendation", rec)

            yield self._evt("agent_complete", {
                "agent_name": "rejection_agent", "status": "completed",
                "output": rej_res, "latency_ms": 200
            })
            yield self._evt("hitl_phase", {"phase": 8, "label": "Human Approval Processing", "status": "completed"})

            # Proceed to Phase 11: Memory Updates
            yield self._evt("workflow_state", {"state": WFState.MEMORY_UPDATE.value, "label": "Memory Updates"})
            yield self._evt("hitl_phase", {"phase": 11, "label": "Memory Updates", "status": "running"})
            yield self._evt("agent_start", {"agent_name": "memory_updater", "status": "running"})
            mem_res = await self.memory_updater.run({"recommendation": updated_rec, "conversation_id": conv_id})
            yield self._evt("agent_complete", {
                "agent_name": "memory_updater", "status": "completed",
                "output": mem_res, "latency_ms": 120
            })
            yield self._evt("hitl_phase", {"phase": 11, "label": "Memory Updates", "status": "completed"})

            response_md = (
                f"## ❌ Recommendation Rejected\n\n"
                f"**Recommendation ID:** `{nba_id}`\n"
                f"**Status:** `REJECTED`\n"
                f"**Reason:** *{modifier or 'Awaiting explanation'}*\n"
                f"**Planner State:** `REPLANNING`\n\n"
                f"**Generate alternative recommendation?**\n"
                f"- [ ] Yes\n"
                f"- [ ] No"
            )
            for word in response_md.split(" "):
                yield self._evt("text", {"content": word + " "})
                await asyncio.sleep(0.005)

            yield self._evt("recommendation", updated_rec)
            yield self._evt("hitl_result", {
                "action": "reject", "success": True, "recommendation_id": nba_id,
                "new_status": "rejected", "planner_state": "REPLANNING"
            })
            yield self._evt("done", {"conversation_id": conv_id, "flow": "hitl", "total_execution_ms": int((time.time() - state.total_start_time)*1000)})
            return

        # ── 3. Executing MODIFICATION agent flow ──────────────────────────────
        elif action == "modify":
            yield self._evt("agent_start", {"agent_name": "modification_agent", "status": "running"})
            state_dict = state.to_dict()
            state_dict["recommendation"] = rec
            state_dict["comment"] = modifier or "Only include integration strategy"

            mod_res = await self.modification_agent.run(state_dict)
            updated_rec = mod_res.get("updated_recommendation", rec)

            yield self._evt("agent_complete", {
                "agent_name": "modification_agent", "status": "completed",
                "output": mod_res, "latency_ms": 220
            })
            yield self._evt("hitl_phase", {"phase": 8, "label": "Human Approval Processing", "status": "completed"})

            # Proceed to Phase 11: Memory Updates
            yield self._evt("workflow_state", {"state": WFState.MEMORY_UPDATE.value, "label": "Memory Updates"})
            yield self._evt("hitl_phase", {"phase": 11, "label": "Memory Updates", "status": "running"})
            yield self._evt("agent_start", {"agent_name": "memory_updater", "status": "running"})
            mem_res = await self.memory_updater.run({"recommendation": updated_rec, "conversation_id": conv_id})
            yield self._evt("agent_complete", {
                "agent_name": "memory_updater", "status": "completed",
                "output": mem_res, "latency_ms": 120
            })
            yield self._evt("hitl_phase", {"phase": 11, "label": "Memory Updates", "status": "completed"})

            response_md = (
                f"## ✏️ Recommendation Updated\n\n"
                f"**Recommendation ID:** `{nba_id}`\n"
                f"**Version:** `{mod_res.get('new_version')}` (Previous Version Archived)\n"
                f"**Changes:** *{modifier or 'Executive alignment removed. Integration roadmap emphasized.'}*\n"
                f"**Status:** `PENDING_APPROVAL`\n"
                f"**Memory Updated:** YES"
            )
            for word in response_md.split(" "):
                yield self._evt("text", {"content": word + " "})
                await asyncio.sleep(0.005)

            yield self._evt("recommendation", updated_rec)
            yield self._evt("hitl_result", {
                "action": "modify", "success": True, "recommendation_id": nba_id,
                "new_status": "pending", "new_version": mod_res.get('new_version')
            })
            yield self._evt("done", {"conversation_id": conv_id, "flow": "hitl", "total_execution_ms": int((time.time() - state.total_start_time)*1000)})
            return

        # ── 4. Executing ESCALATION agent flow ────────────────────────────────
        elif action == "escalate":
            yield self._evt("agent_start", {"agent_name": "escalation_agent", "status": "running"})
            state_dict = state.to_dict()
            state_dict["recommendation"] = rec
            state_dict["comment"] = modifier or "Escalate recommendation to VP Customer Success"

            esc_res = await self.escalation_agent.run(state_dict)
            updated_rec = esc_res.get("updated_recommendation", rec)

            yield self._evt("agent_complete", {
                "agent_name": "escalation_agent", "status": "completed",
                "output": esc_res, "latency_ms": 200
            })
            yield self._evt("hitl_phase", {"phase": 8, "label": "Human Approval Processing", "status": "completed"})

            # Proceed to Phase 11: Memory Updates
            yield self._evt("workflow_state", {"state": WFState.MEMORY_UPDATE.value, "label": "Memory Updates"})
            yield self._evt("hitl_phase", {"phase": 11, "label": "Memory Updates", "status": "running"})
            yield self._evt("agent_start", {"agent_name": "memory_updater", "status": "running"})
            mem_res = await self.memory_updater.run({"recommendation": updated_rec, "conversation_id": conv_id})
            yield self._evt("agent_complete", {
                "agent_name": "memory_updater", "status": "completed",
                "output": mem_res, "latency_ms": 120
            })
            yield self._evt("hitl_phase", {"phase": 11, "label": "Memory Updates", "status": "completed"})

            response_md = (
                f"## 🔴 Recommendation Escalated\n\n"
                f"**Recommendation ID:** `{nba_id}`\n"
                f"**Escalated To:** `VP Customer Success`\n"
                f"**Status:** `ESCALATED`\n"
                f"**Priority:** `HIGH`"
            )
            for word in response_md.split(" "):
                yield self._evt("text", {"content": word + " "})
                await asyncio.sleep(0.005)

            yield self._evt("recommendation", updated_rec)
            yield self._evt("hitl_result", {
                "action": "escalate", "success": True, "recommendation_id": nba_id,
                "new_status": "escalated"
            })
            yield self._evt("done", {"conversation_id": conv_id, "flow": "hitl", "total_execution_ms": int((time.time() - state.total_start_time)*1000)})
            return

        # ── 5. Executing NEED_INFO agent flow ─────────────────────────────────
        elif action == "need_info":
            yield self._evt("agent_start", {"agent_name": "information_gap_agent", "status": "running"})
            state_dict = state.to_dict()
            state_dict["recommendation"] = rec
            state_dict["user_message"] = modifier or "Request additional context"

            gap_res = await self.information_gap_agent.run(state_dict)

            yield self._evt("agent_complete", {
                "agent_name": "information_gap_agent", "status": "completed",
                "output": gap_res, "latency_ms": 280
            })
            yield self._evt("hitl_phase", {"phase": 8, "label": "Human Approval Processing", "status": "completed"})

            # Proceed to Phase 11: Memory Updates
            yield self._evt("workflow_state", {"state": WFState.MEMORY_UPDATE.value, "label": "Memory Updates"})
            yield self._evt("hitl_phase", {"phase": 11, "label": "Memory Updates", "status": "running"})
            yield self._evt("agent_start", {"agent_name": "memory_updater", "status": "running"})
            mem_res = await self.memory_updater.run({"recommendation": rec, "conversation_id": conv_id})
            yield self._evt("agent_complete", {
                "agent_name": "memory_updater", "status": "completed",
                "output": mem_res, "latency_ms": 110
            })
            yield self._evt("hitl_phase", {"phase": 11, "label": "Memory Updates", "status": "completed"})

            gaps = gap_res.get("missing_information", [])
            questions = gap_res.get("questions", [])

            response_md = (
                f"## ℹ️ Additional Information Required\n\n"
                f"**Missing Information:**\n"
            )
            for g in gaps:
                response_md += f"- {g}\n"
            response_md += f"\n**Clarifying Questions:**\n"
            for q in questions:
                response_md += f"- *{q}*\n"
            response_md += (
                f"\n**Timeline:** {gap_res.get('estimated_timeline', '3 business days')}\n"
                f"**Recommendation Status:** `PENDING_APPROVAL`"
            )
            for word in response_md.split(" "):
                yield self._evt("text", {"content": word + " "})
                await asyncio.sleep(0.005)

            yield self._evt("hitl_result", {
                "action": "need_info", "success": True, "recommendation_id": nba_id,
                "new_status": "pending", "missing_gaps": gaps, "questions": questions
            })
            yield self._evt("done", {"conversation_id": conv_id, "flow": "hitl", "total_execution_ms": int((time.time() - state.total_start_time)*1000)})
            return


    # ─────────────────────────────────────────────────────────────────────
    # FLOW 1 — Greeting
    # ─────────────────────────────────────────────────────────────────────
    async def _greeting_flow(self, state: WorkflowStateObj, ctx: Dict) -> AsyncIterator[Dict]:
        greeting_text = ctx.get("greeting_response", "Hi 👋 How can I help you today?")

        yield self._evt("agent_start", {"agent_name": "conversation_manager", "status": "running"})
        r = await self.conversation_manager.execute(state.to_dict())
        state.conversation_manager_output = r.output
        state.agent_timeline.append(r.to_dict())
        yield self._evt("agent_complete", {
            "agent_name": "conversation_manager", "status": r.status,
            "output": {"intent": r.output.get("intent"), "is_decision_request": False},
            "latency_ms": r.latency_ms,
        })

        for i, word in enumerate(greeting_text.split(" ")):
            yield self._evt("text", {"content": word + (" " if i < len(greeting_text.split(" ")) - 1 else "")})
            await asyncio.sleep(0.01)

        lightweight_rec = self._build_context_required_rec(ctx, state)
        yield self._evt("recommendation", lightweight_rec)
        yield self._evt("dashboard",      self._build_lightweight_dashboard(state, lightweight_rec))
        total_ms = int((time.time() - state.total_start_time) * 1000)
        yield self._evt("done", {
            "total_execution_ms": total_ms, "agents_executed": len(state.agent_timeline),
            "evidence_sources": 0, "recommendations_generated": 0,
            "pending_information": len(lightweight_rec.get("missing_context", [])),
            "pending_reviews": 0, "conversation_id": state.conversation_id, "flow": "greeting",
        })

    # ─────────────────────────────────────────────────────────────────────
    # FLOW 2 — Context Request (low info)
    # ─────────────────────────────────────────────────────────────────────
    async def _context_request_flow(self, state: WorkflowStateObj, ctx: Dict) -> AsyncIterator[Dict]:
        yield self._evt("workflow_state", {"state": WFState.MISSING_INFORMATION.value, "label": "Missing Information"})
        yield self._evt("agent_start", {"agent_name": "conversation_manager", "status": "running"})
        r = await self.conversation_manager.execute(state.to_dict())
        state.conversation_manager_output = r.output
        state.agent_timeline.append(r.to_dict())
        yield self._evt("agent_complete", {
            "agent_name": "conversation_manager", "status": r.status,
            "output": {"intent": r.output.get("intent")}, "latency_ms": r.latency_ms,
        })

        missing = ctx.get("missing_for_recommendation", [])
        missing_str = "\n".join(f"- {m}" for m in missing[:4]) if missing else "- A specific decision question or business challenge"

        response = (
            "I can see you're starting to describe a situation, but I need a bit more context "
            "to generate a reliable recommendation.\n\n"
            "**Here's what would help:**\n"
            f"{missing_str}\n\n"
            "You can:\n"
            "- 📄 **Upload** CRM exports, meeting transcripts, or playbooks\n"
            "- 💬 **Describe** the customer, account, deal, or situation in more detail\n"
            "- 📋 **Paste** email threads, notes, or metrics\n\n"
            "_DecisionOS avoids generating business recommendations without sufficient evidence "
            "to maintain enterprise trustworthiness._"
        )
        for i, word in enumerate(response.split(" ")):
            yield self._evt("text", {"content": word + (" " if i < len(response.split(" ")) - 1 else "")})
            await asyncio.sleep(0.01)

        rec = self._build_context_required_rec(ctx, state)
        yield self._evt("recommendation", rec)
        yield self._evt("dashboard", self._build_lightweight_dashboard(state, rec))
        total_ms = int((time.time() - state.total_start_time) * 1000)
        yield self._evt("done", {
            "total_execution_ms": total_ms, "agents_executed": len(state.agent_timeline),
            "evidence_sources": 0, "recommendations_generated": 0,
            "pending_information": len(rec.get("missing_context", [])),
            "pending_reviews": 0, "conversation_id": state.conversation_id, "flow": "context_request",
        })

    # ─────────────────────────────────────────────────────────────────────
    # FLOW 3 — Partial: memory + knowledge + recommendation only
    # ─────────────────────────────────────────────────────────────────────
    async def _partial_flow(self, state: WorkflowStateObj, ctx: Dict) -> AsyncIterator[Dict]:
        # Conversation Manager
        yield self._evt("agent_start", {"agent_name": "conversation_manager", "status": "running"})
        yield self._evt("live_update", {"message": "Analyzing conversation intent and target domain..."})
        r = await self.conversation_manager.execute(state.to_dict())
        state.conversation_manager_output = r.output
        state.agent_timeline.append(r.to_dict())
        if r.output.get("domain"): state.domain = r.output["domain"]
        yield self._evt("agent_complete", {
            "agent_name": "conversation_manager", "status": r.status,
            "output": {"intent": r.output.get("intent"), "domain": state.domain}, "latency_ms": r.latency_ms,
        })

        # Info completeness
        yield self._evt("agent_start", {"agent_name": "information_completeness", "status": "running"})
        yield self._evt("live_update", {"message": "Assessing input quality and checking context completeness..."})
        r = await self.info_completeness.execute(state.to_dict())
        state.information_completeness_output = r.output
        state.agent_timeline.append(r.to_dict())
        yield self._evt("agent_complete", {
            "agent_name": "information_completeness", "status": r.status,
            "output": {"information_quality": r.output.get("information_quality")}, "latency_ms": r.latency_ms,
        })
        yield self._evt("checklist", {
            "checklist": r.output.get("checklist", []),
            "can_proceed": True,
            "information_quality": r.output.get("information_quality", "low"),
        })

        # ── STEP: Memory FIRST (always) ──────────────────────────────────
        state.set_state(WFState.CHECKING_MEMORY)
        yield self._evt("workflow_state", {"state": WFState.CHECKING_MEMORY.value, "label": "Checking Memory"})
        yield self._evt("agent_start", {"agent_name": "memory_agent",    "status": "running"})
        yield self._evt("agent_start", {"agent_name": "knowledge_agent", "status": "running"})
        yield self._evt("live_update", {"message": "Checking memory... Searching past decision memory and documentation..."})
        mem_r, kno_r = await asyncio.gather(
            self.memory_agent.execute(state.to_dict()),
            self.knowledge_agent.execute(state.to_dict()),
        )
        state.memory_agent_output    = mem_r.output
        state.knowledge_agent_output = kno_r.output
        state.agent_timeline.extend([mem_r.to_dict(), kno_r.to_dict()])

        # Check if memory found similar cases
        similar_cases = mem_r.output.get("similar_cases", [])
        memory_found = len(similar_cases) > 0
        if memory_found:
            state.set_state(WFState.MEMORY_FOUND)
            yield self._evt("workflow_state", {
                "state": WFState.MEMORY_FOUND.value,
                "label": "Memory Found",
                "similar_cases_count": len(similar_cases),
            })

        yield self._evt("live_update", {"message": f"✓ Memory check complete — {'found' if memory_found else 'no'} similar cases"})
        yield self._evt("agent_complete", {
            "agent_name": "memory_agent", "status": mem_r.status,
            "output": {"total_retrieved": mem_r.output.get("total_retrieved"),
                       "similar_cases": len(similar_cases),
                       "memory_summary": mem_r.output.get("memory_summary")},
            "latency_ms": mem_r.latency_ms,
        })
        yield self._evt("agent_complete", {
            "agent_name": "knowledge_agent", "status": kno_r.status,
            "output": {"total_retrieved": kno_r.output.get("total_retrieved")}, "latency_ms": kno_r.latency_ms,
        })

        # ── STEP: Planner decides next steps (with memory context) ──────
        state.set_state(WFState.PLANNING)
        yield self._evt("workflow_state", {"state": WFState.PLANNING.value, "label": "Planning"})
        state_dict = state.to_dict()
        state_dict["is_continue_session"] = state.is_continue_session
        planner_r = await self.planner.execute(state_dict)
        state.planner_output = planner_r.output
        planner_decision = planner_r.output.get("planner_decision", {})

        plan_data = {
            "execution_plan": planner_r.output.get("execution_plan", []),
            "total_phases": planner_r.output.get("total_phases", 4),
            "total_agents": planner_r.output.get("total_agents", 5),
            "planning_notes": planner_r.output.get("planning_notes", ""),
            "execution_mode": planner_r.output.get("execution_mode", "fast"),
        }
        yield self._evt("plan", plan_data)
        yield self._evt("planner_decision", {
            "decision": planner_decision,
            "execution_mode": planner_r.output.get("execution_mode", "fast"),
            "next_stage": planner_r.output.get("next_stage", "GENERATING_RECOMMENDATIONS"),
            "memory_found": memory_found,
        })

        # Check: if planner says missing_information → do NOT generate recommendation
        if planner_decision.get("missing_information_triggered") and not planner_decision.get("recommendation_authorized"):
            state.set_state(WFState.MISSING_INFORMATION)
            yield self._evt("workflow_state", {"state": WFState.MISSING_INFORMATION.value, "label": "Missing Information"})
            async for evt in self._context_request_flow(state, ctx):
                yield evt
            return

        # ── Skip risk/opportunity (partial) ─────────────────────────────
        state.risk_agent_output        = self._unknown_risk()
        state.opportunity_agent_output = {"opportunities": [], "primary_opportunity": None}
        for skipped in ["risk_agent", "opportunity_agent"]:
            yield self._evt("agent_complete", {
                "agent_name": skipped, "status": "skipped",
                "output": {"reason": "Insufficient context for reliable scoring"}, "latency_ms": 0,
            })

        # Pattern Detection
        state.set_state(WFState.PATTERN_ANALYSIS)
        yield self._evt("workflow_state", {"state": WFState.PATTERN_ANALYSIS.value, "label": "Pattern Analysis"})
        yield self._evt("agent_start", {"agent_name": "pattern_detection_agent", "status": "running"})
        yield self._evt("live_update", {"message": "Classifying patterns and identifying business signals..."})
        r_pat = await self.pattern_detection.execute(state.to_dict())
        state.pattern_detection_output = r_pat.output
        state.agent_timeline.append(r_pat.to_dict())
        yield self._evt("agent_complete", {
            "agent_name": "pattern_detection_agent", "status": r_pat.status,
            "output": {"patterns": r_pat.output.get("patterns", []), "confidence": r_pat.output.get("confidence", 0.75)},
            "latency_ms": r_pat.latency_ms,
        })
        yield self._evt("pattern_detection", {
            "patterns": r_pat.output.get("patterns", []),
            "confidence": r_pat.output.get("confidence", 0.75),
            "evidence_signals": r_pat.output.get("evidence_signals", []),
        })

        # Playbook Router
        state.set_state(WFState.PLAYBOOK_SELECTION)
        yield self._evt("workflow_state", {"state": WFState.PLAYBOOK_SELECTION.value, "label": "Playbook Selection"})
        yield self._evt("agent_start", {"agent_name": "playbook_router", "status": "running"})
        yield self._evt("live_update", {"message": "Routing patterns to strategic discovery playbooks..."})
        playbook_res = self.playbook_router.route(state.to_dict())
        state.playbook_router_output = playbook_res
        yield self._evt("agent_complete", {
            "agent_name": "playbook_router", "status": "completed",
            "output": {"selected_playbook": playbook_res.get("selected_playbook")}, "latency_ms": 5,
        })
        yield self._evt("playbook_selection", {
            "selected_playbook": playbook_res.get("selected_playbook"),
            "active_playbooks": playbook_res.get("active_playbooks", []),
            "playbook_guidance": playbook_res.get("playbook_guidance", {}),
        })

        # ── PLANNER AUTHORIZED: Generate Recommendation ──────────────────
        state.set_state(WFState.GENERATING_RECOMMENDATIONS)
        yield self._evt("workflow_state", {"state": WFState.GENERATING_RECOMMENDATIONS.value, "label": "Generating Recommendations"})
        yield self._evt("agent_start", {"agent_name": "recommendation_agent", "status": "running"})
        yield self._evt("live_update", {"message": "Generating calibrated recommendation actions..."})
        r = await self.recommendation_agent.execute(state.to_dict())
        state.recommendation_agent_output = r.output
        state.agent_timeline.append(r.to_dict())
        yield self._evt("agent_complete", {
            "agent_name": "recommendation_agent", "status": r.status,
            "output": {"title": r.output.get("title")}, "latency_ms": r.latency_ms,
        })

        # Confidence
        yield self._evt("agent_start", {"agent_name": "confidence_agent", "status": "running"})
        yield self._evt("live_update", {"message": "Evaluating evidence coverage and computing explainable confidence..."})
        r = await self.confidence_agent.execute(state.to_dict())
        state.confidence_agent_output = r.output
        state.agent_timeline.append(r.to_dict())
        yield self._evt("agent_complete", {
            "agent_name": "confidence_agent", "status": r.status,
            "output": {"confidence_label": r.output.get("confidence_label"),
                       "insufficient_data": r.output.get("insufficient_data")},
            "latency_ms": r.latency_ms,
        })
        # Emit explainable confidence breakdown
        yield self._evt("confidence_breakdown", {
            "breakdown": r.output.get("confidence_breakdown", []),
            "score": r.output.get("confidence_score"),
            "label": r.output.get("confidence_label"),
        })

        rec = self._build_recommendation(state)
        yield self._evt("live_update", {"message": "Formatting response explanation..."})
        full_text = self._format_response(state, rec)
        for i, word in enumerate(full_text.split(" ")):
            yield self._evt("text", {"content": word + (" " if i < len(full_text.split(" ")) - 1 else "")})
            await asyncio.sleep(0.015)

        state.set_state(WFState.AWAITING_APPROVAL)
        yield self._evt("workflow_state", {"state": WFState.AWAITING_APPROVAL.value, "label": "Awaiting Approval"})
        yield self._evt("recommendation", rec)
        yield self._evt("dashboard", self._build_dashboard(state, rec))
        self._store_memory(state)
        total_ms = int((time.time() - state.total_start_time) * 1000)
        yield self._evt("done", {
            "total_execution_ms": total_ms, "agents_executed": len(state.agent_timeline),
            "evidence_sources": len(rec.get("evidence", [])) + len(rec.get("sources", [])),
            "recommendations_generated": 1,
            "pending_information": len(rec.get("missing_context", [])),
            "pending_reviews": 1 if rec.get("approval_status") == "pending" else 0,
            "conversation_id": state.conversation_id, "flow": "partial",
        })

    # ─────────────────────────────────────────────────────────────────────
    # FLOW 4 — Full pipeline: all agents, planner-authorized
    # ─────────────────────────────────────────────────────────────────────
    async def _full_flow(self, state: WorkflowStateObj, ctx: Dict) -> AsyncIterator[Dict]:
        # Conversation Manager
        yield self._evt("agent_start", {"agent_name": "conversation_manager", "status": "running"})
        yield self._evt("live_update", {"message": "Analyzing conversation intent and target domain..."})
        r = await self.conversation_manager.execute(state.to_dict())
        state.conversation_manager_output = r.output
        state.agent_timeline.append(r.to_dict())
        if r.output.get("domain"): state.domain = r.output["domain"]
        yield self._evt("agent_complete", {
            "agent_name": "conversation_manager", "status": r.status,
            "output": {"intent": r.output.get("intent"), "domain": state.domain,
                       "urgency": r.output.get("urgency")}, "latency_ms": r.latency_ms,
        })

        # Domain detection event
        yield self._evt("domain_detection", {
            "detected_domain": state.domain,
            "confidence": r.output.get("domain_confidence", 0.88),
            "activated_specialists": self._get_domain_specialists(state.domain),
        })

        # Info Completeness
        yield self._evt("agent_start", {"agent_name": "information_completeness", "status": "running"})
        yield self._evt("live_update", {"message": "Assessing input quality and context completeness..."})
        r = await self.info_completeness.execute(state.to_dict())
        state.information_completeness_output = r.output
        state.agent_timeline.append(r.to_dict())
        yield self._evt("agent_complete", {
            "agent_name": "information_completeness", "status": r.status,
            "output": {"can_proceed": r.output.get("can_proceed"),
                       "information_quality": r.output.get("information_quality")},
            "latency_ms": r.latency_ms,
        })
        yield self._evt("checklist", {
            "checklist": r.output.get("checklist", []),
            "can_proceed": r.output.get("can_proceed", True),
            "information_quality": r.output.get("information_quality", "medium"),
        })

        # ── MEMORY ALWAYS FIRST (before planner) ─────────────────────────
        state.set_state(WFState.CHECKING_MEMORY)
        yield self._evt("workflow_state", {"state": WFState.CHECKING_MEMORY.value, "label": "Checking Memory"})
        yield self._evt("memory_started", {"message": "Searching organizational memory & historical outcomes..."})
        yield self._evt("agent_start", {"agent_name": "memory_agent",    "status": "running"})
        yield self._evt("agent_start", {"agent_name": "knowledge_agent", "status": "running"})
        yield self._evt("live_update", {"message": "Checking Memory... Querying episodic decision memory and documentation..."})
        mem_r, kno_r = await asyncio.gather(
            self.memory_agent.execute(state.to_dict()),
            self.knowledge_agent.execute(state.to_dict()),
        )
        state.memory_agent_output    = mem_r.output
        state.knowledge_agent_output = kno_r.output
        state.agent_timeline.extend([mem_r.to_dict(), kno_r.to_dict()])

        similar_cases = mem_r.output.get("similar_cases", [])
        memory_found = len(similar_cases) > 0
        if memory_found:
            state.set_state(WFState.MEMORY_FOUND)
            yield self._evt("workflow_state", {
                "state": WFState.MEMORY_FOUND.value,
                "label": "Memory Found",
                "similar_cases_count": len(similar_cases),
            })

        yield self._evt("memory_complete", {"found": memory_found, "count": len(similar_cases)})
        yield self._evt("live_update", {"message": f"✓ Memory Complete — {'found similar cases' if memory_found else 'no prior cases'}"})
        yield self._evt("agent_complete", {
            "agent_name": "memory_agent", "status": mem_r.status,
            "output": {"total_retrieved": mem_r.output.get("total_retrieved"),
                       "similar_cases": len(similar_cases),
                       "memory_summary": mem_r.output.get("memory_summary")},
            "latency_ms": mem_r.latency_ms,
        })
        yield self._evt("agent_complete", {
            "agent_name": "knowledge_agent", "status": kno_r.status,
            "output": {"total_retrieved": kno_r.output.get("total_retrieved"),
                       "knowledge_summary": kno_r.output.get("knowledge_summary")},
            "latency_ms": kno_r.latency_ms,
        })

        # ── PLANNER (after memory — now has full context) ─────────────────
        state.set_state(WFState.PLANNING)
        yield self._evt("workflow_state", {"state": WFState.PLANNING.value, "label": "Planning"})
        yield self._evt("planner_started", {"execution_mode": "standard"})
        yield self._evt("agent_start", {"agent_name": "planner", "status": "running"})
        yield self._evt("live_update", {"message": "Planner: generating authoritative execution graph..."})
        state_dict = state.to_dict()
        state_dict["is_continue_session"] = state.is_continue_session
        planner_r = await self.planner.execute(state_dict)
        state.planner_output = planner_r.output
        planner_decision = planner_r.output.get("planner_decision", {})
        yield self._evt("agent_complete", {
            "agent_name": "planner", "status": planner_r.status,
            "output": {"planning_notes": planner_r.output.get("planning_notes"),
                       "execution_plan": planner_r.output.get("execution_plan"),
                       "execution_mode": planner_r.output.get("execution_mode")},
            "latency_ms": planner_r.latency_ms,
        })

        yield self._evt("planner_complete", {"execution_mode": planner_r.output.get("execution_mode", "standard")})
        yield self._evt("plan", {
            "execution_plan": planner_r.output.get("execution_plan", []),
            "total_phases": planner_r.output.get("total_phases", 6),
            "total_agents": planner_r.output.get("total_agents", 8),
            "planning_notes": planner_r.output.get("planning_notes", ""),
            "execution_mode": planner_r.output.get("execution_mode", "standard"),
        })
        yield self._evt("planner_decision", {
            "decision": planner_decision,
            "execution_mode": planner_r.output.get("execution_mode", "standard"),
            "next_stage": planner_r.output.get("next_stage", "GENERATING_RECOMMENDATIONS"),
            "memory_found": memory_found,
        })

        # ── If planner blocks recommendation → route to missing info ──────
        if planner_decision.get("missing_information_triggered") and not planner_decision.get("recommendation_authorized"):
            state.set_state(WFState.MISSING_INFORMATION)
            yield self._evt("workflow_state", {"state": WFState.MISSING_INFORMATION.value, "label": "Missing Information"})
            async for evt in self._context_request_flow(state, ctx):
                yield evt
            return

        # ── Domain Specialist ─────────────────────────────────────────────
        state.set_state(WFState.DIAGNOSING)
        yield self._evt("workflow_state", {"state": WFState.DIAGNOSING.value, "label": "Diagnosing"})
        yield self._evt("agent_start", {"agent_name": "domain_specialist", "status": "running"})
        yield self._evt("live_update", {"message": "Applying domain specialist business logic and root cause analysis..."})
        r = await self.domain_specialist.execute(state.to_dict())
        state.domain_specialist_output = r.output
        state.agent_timeline.append(r.to_dict())
        yield self._evt("agent_complete", {
            "agent_name": "domain_specialist", "status": r.status,
            "output": {"risk_factors_count": len(r.output.get("risk_factors", [])),
                       "opportunities_count": len(r.output.get("opportunities", []))},
            "latency_ms": r.latency_ms,
        })

        # Risk + Opportunity parallel
        yield self._evt("agent_start", {"agent_name": "risk_agent",        "status": "running"})
        yield self._evt("agent_start", {"agent_name": "opportunity_agent", "status": "running"})
        yield self._evt("live_update", {"message": "Running risk assessment and checking upsell/expansion options..."})
        rsk_r, opp_r = await asyncio.gather(
            self.risk_agent.execute(state.to_dict()),
            self.opportunity_agent.execute(state.to_dict()),
        )
        state.risk_agent_output        = rsk_r.output
        state.opportunity_agent_output = opp_r.output
        state.agent_timeline.extend([rsk_r.to_dict(), opp_r.to_dict()])
        yield self._evt("agent_complete", {
            "agent_name": "risk_agent", "status": rsk_r.status,
            "output": {"risk_level": rsk_r.output.get("overall_risk_level"),
                       "churn_probability": rsk_r.output.get("churn_probability"),
                       "health_score": rsk_r.output.get("health_score"),
                       "escalation_needed": rsk_r.output.get("escalation_needed")},
            "latency_ms": rsk_r.latency_ms,
        })
        yield self._evt("agent_complete", {
            "agent_name": "opportunity_agent", "status": opp_r.status,
            "output": {"opportunities_found": len(opp_r.output.get("opportunities", [])),
                       "primary_opportunity": opp_r.output.get("primary_opportunity")},
            "latency_ms": opp_r.latency_ms,
        })

        # Pattern Detection
        state.set_state(WFState.PATTERN_ANALYSIS)
        yield self._evt("workflow_state", {"state": WFState.PATTERN_ANALYSIS.value, "label": "Pattern Analysis"})
        yield self._evt("agent_start", {"agent_name": "pattern_detection_agent", "status": "running"})
        yield self._evt("live_update", {"message": "Detecting business patterns and scanning signal telemetry..."})
        r_pat = await self.pattern_detection.execute(state.to_dict())
        state.pattern_detection_output = r_pat.output
        state.agent_timeline.append(r_pat.to_dict())
        yield self._evt("agent_complete", {
            "agent_name": "pattern_detection_agent", "status": r_pat.status,
            "output": {"patterns": r_pat.output.get("patterns", []), "confidence": r_pat.output.get("confidence", 0.75)},
            "latency_ms": r_pat.latency_ms,
        })
        pats = r_pat.output.get("patterns", [])
        yield self._evt("pattern_detected", {"value": pats[0] if pats else "Renewal Risk", "confidence": r_pat.output.get("confidence", 0.75)})
        yield self._evt("pattern_detection", {
            "patterns": pats,
            "confidence": r_pat.output.get("confidence", 0.75),
            "evidence_signals": r_pat.output.get("evidence_signals", []),
        })

        # Playbook Router
        state.set_state(WFState.PLAYBOOK_SELECTION)
        yield self._evt("workflow_state", {"state": WFState.PLAYBOOK_SELECTION.value, "label": "Playbook Selection"})
        yield self._evt("agent_start", {"agent_name": "playbook_router", "status": "running"})
        yield self._evt("live_update", {"message": "Routing business patterns to strategic action playbooks..."})
        playbook_res = self.playbook_router.route(state.to_dict())
        state.playbook_router_output = playbook_res
        yield self._evt("agent_complete", {
            "agent_name": "playbook_router", "status": "completed",
            "output": {"selected_playbook": playbook_res.get("selected_playbook")}, "latency_ms": 10,
        })
        yield self._evt("playbook_selected", {"value": playbook_res.get("selected_playbook", "Renewal Intervention")})
        yield self._evt("playbook_selection", {
            "selected_playbook": playbook_res.get("selected_playbook"),
            "active_playbooks": playbook_res.get("active_playbooks", []),
            "playbook_guidance": playbook_res.get("playbook_guidance", {}),
        })

        # ── PLANNER-AUTHORIZED: Recommendation ───────────────────────────
        state.set_state(WFState.GENERATING_RECOMMENDATIONS)
        yield self._evt("workflow_state", {"state": WFState.GENERATING_RECOMMENDATIONS.value, "label": "Generating Recommendations"})
        yield self._evt("agent_start", {"agent_name": "recommendation_agent", "status": "running"})
        yield self._evt("live_update", {"message": "Synthesizing outputs to generate Next Best Action recommendation..."})
        r = await self.recommendation_agent.execute(state.to_dict())
        state.recommendation_agent_output = r.output
        state.agent_timeline.append(r.to_dict())
        yield self._evt("agent_complete", {
            "agent_name": "recommendation_agent", "status": r.status,
            "output": {"title": r.output.get("title"), "priority": r.output.get("priority")},
            "latency_ms": r.latency_ms,
        })

        # Confidence
        yield self._evt("agent_start", {"agent_name": "confidence_agent", "status": "running"})
        yield self._evt("live_update", {"message": "Calibrating explainable confidence score and data coverage..."})
        r = await self.confidence_agent.execute(state.to_dict())
        state.confidence_agent_output = r.output
        state.agent_timeline.append(r.to_dict())
        yield self._evt("agent_complete", {
            "agent_name": "confidence_agent", "status": r.status,
            "output": {"confidence_score":  r.output.get("confidence_score"),
                       "confidence_label":  r.output.get("confidence_label"),
                       "insufficient_data": r.output.get("insufficient_data")},
            "latency_ms": r.latency_ms,
        })
        yield self._evt("confidence_calibrated", {"score": r.output.get("confidence_score"), "label": r.output.get("confidence_label")})
        yield self._evt("confidence_breakdown", {
            "breakdown": r.output.get("confidence_breakdown", []),
            "score": r.output.get("confidence_score"),
            "label": r.output.get("confidence_label"),
        })

        rec = self._build_recommendation(state)

        # Token-by-token word streaming exactly like ChatGPT / Cursor / Perplexity
        yield self._evt("live_update", {"message": "Streaming recommendation tokens..."})
        full_text = self._format_response(state, rec)
        words = full_text.split(" ")
        for i, word in enumerate(words):
            token = word + (" " if i < len(words) - 1 else "")
            yield self._evt("recommendation_token", {"value": token})
            yield self._evt("text", {"content": token})
            await asyncio.sleep(0.008)

        state.set_state(WFState.AWAITING_APPROVAL)
        yield self._evt("workflow_state", {"state": WFState.AWAITING_APPROVAL.value, "label": "Awaiting Approval"})
        yield self._evt("recommendation_complete", {"recommendation": rec})
        yield self._evt("recommendation", rec)
        yield self._evt("dashboard", self._build_dashboard(state, rec))
        self._store_memory(state)
        total_ms = int((time.time() - state.total_start_time) * 1000)
        yield self._evt("done", {
            "total_execution_ms": total_ms,
            "agents_executed": len(state.agent_timeline),
            "evidence_sources": len(rec.get("evidence", [])) + len(rec.get("sources", [])),
            "recommendations_generated": 1,
            "pending_information": 0,
            "pending_reviews": 1 if rec.get("approval_status") == "pending" else 0,
            "conversation_id": state.conversation_id,
            "flow": "full",
        })

    # ─────────────────────────────────────────────────────────────────────
    # Helpers
    # ─────────────────────────────────────────────────────────────────────
    def _get_domain_specialists(self, domain: str) -> List[str]:
        specialists = {
            "customer_success": ["RiskAgent", "PlaybookAgent", "AdoptionAgent", "OpportunityAgent"],
            "sales":            ["OpportunityAgent", "CompetitiveAgent", "ForecastAgent"],
            "healthcare":       ["ClinicalAgent", "ComplianceAgent", "PatientAgent"],
            "energy":           ["GridAgent", "ComplianceAgent", "ForecastAgent"],
            "staffing":         ["CandidateAgent", "OpportunityAgent", "ComplianceAgent"],
            "banking":          ["RiskAgent", "ComplianceAgent", "ForecastAgent"],
        }
        return specialists.get(domain, ["RiskAgent", "OpportunityAgent", "DomainAgent"])

    def _build_context_required_rec(self, ctx: Dict, state: WorkflowStateObj) -> Dict:
        missing = ctx.get("missing_for_recommendation", [])
        patterns = state.pattern_detection_output.get("patterns", [])
        selected_playbook = state.playbook_router_output.get("selected_playbook", "Information Discovery Playbook")
        playbook_guidance = state.playbook_router_output.get("playbook_guidance", {})

        return {
            "title": "Waiting for Context",
            "action": (
                "To generate an explainable recommendation, please provide a specific "
                "business situation, customer details, or upload relevant documents."
            ),
            "rationale": None,
            "supporting_actions": [],
            "expected_outcome": None,
            "if_not_actioned": None,
            "priority": None,
            "urgency": None,
            "timeline": None,
            "roi_estimate": "N/A — awaiting business context",
            "confidence_score": None,
            "confidence_label": "Insufficient Data",
            "risk_score": None,
            "risk_level": "unknown",
            "health_score": None,
            "impact_score": None,
            "coverage_score": 0.0,
            "evidence": [],
            "sources": [],
            "business_rules": [],
            "memory_references": [],
            "risk_factors": [],
            "opportunities": [],
            "similar_cases": [],
            "domain": state.domain,
            "domain_insights": {},
            "approval_status": "not_applicable",
            "score_breakdown": {},
            "missing_context": missing,
            "context_score": ctx.get("context_score", 0),
            "context_class": ctx.get("context_class", "INSUFFICIENT"),
            "provided_fields": ctx.get("provided_fields", []),
            "missing_fields":  ctx.get("missing_fields", []),
            "field_scores":    ctx.get("field_scores", {}),
            "is_context_required": True,
            "skipped_agents": ["risk_agent", "opportunity_agent", "domain_specialist",
                               "recommendation_agent", "confidence_agent"],
            "detected_patterns":    patterns,
            "selected_playbook":    selected_playbook,
            "playbook_guidance":    playbook_guidance,
            "recommendation_updated": False,
            "previous_recommendation": None,
            "previous_status":        None,
            "reasoning_summary":      playbook_guidance.get("guidance_summary", "Awaiting business context signals."),
        }

    def _build_lightweight_dashboard(self, state: WorkflowStateObj, rec: Dict) -> Dict:
        return {
            "recommendation": rec,
            "agents_executed": [{"agent_name": a["agent_name"], "status": a["status"],
                                  "latency_ms": a.get("latency_ms")} for a in state.agent_timeline],
            "risk_score": None, "confidence_score": None,
            "impact_score": None, "health_score": None,
            "evidence_count": 0, "memory_refs_count": 0,
            "similar_cases_count": 0, "knowledge_items_count": 0,
            "execution_time_ms": int((time.time() - state.total_start_time) * 1000),
            "approval_status": "not_applicable", "score_breakdown": {},
            "improvement_tips": rec.get("missing_context", []), "insufficient_data": True,
        }

    def _build_recommendation(self, state: WorkflowStateObj) -> Dict:
        rec  = state.recommendation_agent_output
        risk = state.risk_agent_output
        conf = state.confidence_agent_output
        opp  = state.opportunity_agent_output
        mem  = state.memory_agent_output
        ctx  = state.context_evaluator_output

        conf_score = conf.get("confidence_score")
        risk_level = risk.get("overall_risk_level", "unknown")
        risk_score = risk.get("churn_probability")
        roi        = None if conf.get("insufficient_data") else rec.get("roi_estimate")
        patterns   = state.pattern_detection_output.get("patterns", [])
        selected_playbook = state.playbook_router_output.get("selected_playbook", "Renewal Intervention Playbook")
        playbook_guidance = state.playbook_router_output.get("playbook_guidance", {})

        return {
            "title":             rec.get("title", "Analysis Complete"),
            "action":            rec.get("action", ""),
            "rationale":         rec.get("rationale", ""),
            "supporting_actions": rec.get("supporting_actions", []),
            "expected_outcome":  rec.get("expected_outcome", ""),
            "if_not_actioned":   rec.get("if_not_actioned", ""),
            "priority":          rec.get("priority"),
            "urgency":           rec.get("urgency"),
            "timeline":          rec.get("timeline"),
            "roi_estimate":      roi,
            "confidence_score":  conf_score,
            "confidence_label":  conf.get("confidence_label", "Insufficient Data"),
            "confidence_breakdown": conf.get("confidence_breakdown", []),
            "risk_score":        risk_score,
            "risk_level":        risk_level,
            "health_score":      risk.get("health_score"),
            "impact_score":      risk.get("impact_score"),
            "coverage_score":    conf.get("score_breakdown", {}).get("data_coverage", 0.0),
            "evidence":          rec.get("evidence", []),
            "sources":           rec.get("sources", []),
            "business_rules":    rec.get("business_rules_applied", []),
            "memory_references": rec.get("memory_references", []) + [
                c.get("summary", "")[:150] for c in mem.get("similar_cases", [])[:2]
            ],
            "risk_factors": [f.get("name", f) if isinstance(f, dict) else f
                             for f in risk.get("risk_factors", [])[:4]],
            "opportunities": [o.get("title", o) if isinstance(o, dict) else o
                              for o in opp.get("opportunities", [])[:3]],
            "similar_cases":     mem.get("similar_cases", [])[:3],
            "domain":            state.domain,
            "domain_insights": {
                "root_cause": state.domain_specialist_output.get("root_cause", "")[:300],
                "key_actions": state.domain_specialist_output.get("critical_actions", [])[:3],
                "benchmarks":  state.domain_specialist_output.get("domain_benchmarks", [])[:3],
            },
            "approval_status":    "pending",
            "score_breakdown":    conf.get("score_breakdown", {}),
            "key_risks_if_delayed": rec.get("key_risks_if_delayed", []),
            "alternative_actions":  rec.get("alternative_actions", []),
            "insufficient_data":    conf.get("insufficient_data", False),
            "is_context_required":  False,
            "detected_patterns":    patterns,
            "selected_playbook":    selected_playbook,
            "playbook_guidance":    playbook_guidance,
            "playbook_score":       state.playbook_router_output.get("playbook_score"),
            "patterns_with_scores": state.pattern_detection_output.get("patterns_with_scores", []),
            "recommendation_updated": rec.get("recommendation_updated", False),
            "previous_recommendation": rec.get("previous_recommendation"),
            "previous_status":        rec.get("previous_status"),
            "reasoning_summary":      rec.get("reasoning_summary", playbook_guidance.get("guidance_summary", "")),
            "evidence_strength":     conf.get("evidence_strength", "Low"),
            "roi_metrics":           None if conf.get("insufficient_data") else rec.get("roi_metrics"),
            "evidence_sources_count": len(rec.get("evidence", [])) + len(rec.get("sources", [])),
            "planner_state":         state.planner_output.get("planner_decision", {}).get("next_stage", "AWAITING_APPROVAL"),
            "memory_status":         "active" if mem.get("total_retrieved", 0) > 0 else "cold_start",
            # V2: context field scores for sidebar
            "context_score":         ctx.get("context_score", 0),
            "provided_fields":       ctx.get("provided_fields", []),
            "missing_fields":        ctx.get("missing_fields", []),
            "field_scores":          ctx.get("field_scores", {}),
            "execution_mode":        state.planner_output.get("execution_mode", "standard"),
        }

    def _format_response(self, state: WorkflowStateObj, rec: Dict) -> str:
        pat_list = ", ".join(rec.get("detected_patterns", []))
        playbook = rec.get("selected_playbook", "General Intervention Playbook")
        mode_label = {"fast": "⚡ Fast", "standard": "📊 Standard", "deep_analysis": "🔬 Deep Analysis"}.get(
            rec.get("execution_mode", "standard"), "📊 Standard"
        )

        evolved_str = ""
        if rec.get("recommendation_updated"):
            evolved_str = f"**🔄 Strategy Evolved:** Yes (Previous: *{rec.get('previous_recommendation')}* status was *{rec.get('previous_status')}*)\n\n"

        if rec.get("insufficient_data"):
            q_str = "\n".join(f"- {q}" for q in rec.get("playbook_guidance", {}).get("discovery_questions", []))
            return (
                f"**📊 Analysis Complete — Limited Context**\n\n"
                f"{rec.get('action', '')}\n\n"
                f"**🎯 Discovery Focus:**\n{q_str}\n\n"
                f"> ℹ️ Risk, confidence, and ROI scores require more business context. "
                f"Upload CRM data, transcripts, or describe the situation in more detail "
                f"to unlock full analysis."
            )

        risk_emoji = {"critical":"🔴","high":"🟠","medium":"🟡","low":"🟢","unknown":"⚪"}.get(
            str(rec.get("risk_level","unknown")).lower(), "⚪")
        conf_disp  = f"{rec['confidence_score']:.0%}" if rec.get("confidence_score") else "N/A"
        urgency_label = {
            "immediate": "**Immediate Action Required**",
            "this_week": "**Action This Week**",
            "this_month": "Action This Month",
            "next_quarter": "Next Quarter",
        }.get(str(rec.get("urgency", "")), "Action Recommended")

        txt = f"## ✨ {rec['title']}\n\n"
        txt += f"{risk_emoji} **Risk:** {str(rec.get('risk_level','Unknown')).title()} · "
        txt += f"🎯 {urgency_label} · 📊 **Confidence:** {conf_disp} · {mode_label}\n\n"
        txt += f"**🔍 Classified Patterns:** {pat_list} | **📋 Selected Playbook:** *{playbook}*\n\n"
        txt += f"{evolved_str}---\n\n"
        txt += f"### 🎯 Next Best Action\n\n{rec.get('action','')}\n\n"
        if rec.get("rationale"):
            txt += f"### 💡 Why This Action?\n\n{rec['rationale']}\n\n"
        if rec.get("expected_outcome"):
            txt += f"### 📈 Expected Outcome\n\n{rec['expected_outcome']}\n\n"
        supporting = rec.get("supporting_actions", [])
        if supporting:
            txt += "### 📋 Supporting Actions\n\n"
            for i, a in enumerate(supporting[:4], 1):
                icon = {"critical":"🔴","high":"🟠","medium":"🟡"}.get(
                    str(a.get("priority","")).lower(), "⚪")
                txt += f"{i}. {icon} **{a.get('action','')}**\n"
                txt += f"   — *{a.get('owner','TBD')}* · {a.get('timeline','TBD')}\n\n"
        if rec.get("evidence"):
            txt += "### 🔍 Evidence\n\n"
            for e in rec["evidence"][:4]:
                txt += f"- {e}\n"
            txt += "\n"
        if rec.get("roi_estimate"):
            txt += f"### 💰 ROI Estimate\n\n{rec['roi_estimate']}\n\n"
        if rec.get("if_not_actioned"):
            txt += f"---\n\n> ⚠️ **If Not Actioned:** {rec['if_not_actioned']}\n\n"
        return txt

    def _build_dashboard(self, state: WorkflowStateObj, rec: Dict) -> Dict:
        conf = state.confidence_agent_output
        return {
            "recommendation":        rec,
            "agents_executed":       [{"agent_name": a["agent_name"], "status": a["status"],
                                        "latency_ms": a.get("latency_ms")} for a in state.agent_timeline],
            "risk_score":            rec.get("risk_score"),
            "confidence_score":      rec.get("confidence_score"),
            "impact_score":          rec.get("impact_score"),
            "health_score":          rec.get("health_score"),
            "evidence_count":        len(rec.get("evidence", [])),
            "memory_refs_count":     len(rec.get("memory_references", [])),
            "similar_cases_count":   len(rec.get("similar_cases", [])),
            "knowledge_items_count": state.knowledge_agent_output.get("total_retrieved", 0),
            "execution_time_ms":     int((time.time() - state.total_start_time) * 1000),
            "approval_status":       rec.get("approval_status", "pending"),
            "score_breakdown":       conf.get("score_breakdown", {}),
            "confidence_breakdown":  conf.get("confidence_breakdown", []),
            "improvement_tips":      conf.get("improvement_tips", []),
            "insufficient_data":     conf.get("insufficient_data", False),
            "workflow_state":        state.workflow_state.value,
            "execution_mode":        state.planner_output.get("execution_mode", "standard"),
        }

    def _evt(self, type_: str, data: Any) -> Dict:
        return {"type": type_, "data": data,
                "timestamp": datetime.now(timezone.utc).isoformat()}

    def _unknown_risk(self) -> Dict:
        return {
            "overall_risk_level": "unknown",
            "churn_probability": None,
            "urgency_score": None,
            "impact_score": None,
            "health_score": None,
            "escalation_needed": False,
            "escalation_level": "none",
            "risk_factors": [],
            "positive_signals": [],
            "potential_loss": "Cannot estimate — insufficient customer data",
            "time_to_decision": "Unknown",
            "risk_reasoning": "Risk assessment requires customer-specific data.",
            "recommended_escalation": "N/A",
        }

    def _store_memory(self, state: WorkflowStateObj) -> None:
        if not state.recommendation_agent_output:
            return
        conf_score = state.confidence_agent_output.get("confidence_score")
        memory_manager.store_session_memory(
            conversation_id=state.conversation_id,
            content=(
                f"Decision: {state.user_message[:100]}. "
                f"Recommendation: {state.recommendation_agent_output.get('title','')}. "
                f"Risk: {state.risk_agent_output.get('overall_risk_level','unknown')}. "
                f"Confidence: {f'{conf_score:.0%}' if conf_score else 'N/A'}. "
                f"Execution Mode: {state.planner_output.get('execution_mode','standard')}."
            ),
            metadata={
                "domain":     state.domain,
                "risk_level": state.risk_agent_output.get("overall_risk_level"),
                "confidence": conf_score,
                "execution_mode": state.planner_output.get("execution_mode"),
            },
        )


# ── Type hint for Any ─────────────────────────────────────────────────────
from typing import Any

# Singleton
decision_workflow = DecisionWorkflow()
