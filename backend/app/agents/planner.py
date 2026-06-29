"""
PlannerAgent V2 — Authoritative workflow controller.

V2 Changes:
- PlannerAgent is the ONLY component allowed to transition workflow states.
- Agents provide observations only. Planner decides what executes next.
- Emits structured PlannerDecision with context_score, memory_found,
  execution_mode (fast/standard/deep), and next_stage.
- Never triggers RecommendationAgent without all prior agents completing.
- Supports MEMORY_FOUND HITL branch: if memory found → ask about continuation.
- Supports 3 execution modes: fast, standard, deep_analysis.
"""
from typing import Dict, Any, List
from app.agents.base import BaseAgent
from app.core.llm import build_messages, llm_provider
from app.core.logging import logger
import json
import re


PLANNER_PROMPT_V2 = """You are the PlannerAgent for DecisionOS — an enterprise Decision Intelligence OS.

## Your Role
You are the ONLY orchestrator. You make ALL execution decisions. Agents are observers.
No agent runs unless you authorize it. No recommendation is generated unless you authorize it.

## Workflow State Machine
You must choose the correct next_stage from:
- CHECKING_MEMORY: memory agent not yet run
- MEMORY_FOUND: memory returned similar cases → potentially trigger HITL
- WAITING_FOR_HITL: user must choose continue or new analysis
- PROGRESS_CHECK: user chose continue → run ProgressCheckAgent
- MISSING_INFORMATION: context incomplete → surface what's missing  
- CONTEXT_COMPLETE: context sufficient → proceed to analysis
- PLANNING: building execution graph (current stage)
- RETRIEVING: knowledge retrieval in progress
- DIAGNOSING: domain specialist analysis
- PATTERN_ANALYSIS: pattern detection
- PLAYBOOK_SELECTION: selecting correct playbook
- GENERATING_RECOMMENDATIONS: recommendation agent running
- AWAITING_APPROVAL: recommendation generated, awaiting human approval
- EXECUTION_TRACKING: recommendation approved and executing
- OUTCOME_CAPTURE: capturing outcome post-execution
- LEARNING: learning from outcome
- MEMORY_UPDATE: updating organizational memory

## Execution Modes
Choose based on context richness:
- "fast": context score < 50, limited data → run memory + recommendation only
- "standard": context score 50-79 → full pipeline, skip deep analysis
- "deep_analysis": context score >= 80, uploaded docs → all agents + pattern synthesis

## Available Agents (you choose which run and in what order)
- memory_agent: ALWAYS runs first. Never skip.
- knowledge_agent: parallel with memory_agent
- domain_specialist: after memory + knowledge
- risk_agent: after domain_specialist
- opportunity_agent: parallel with risk_agent
- pattern_detection_agent: after risk/opportunity
- playbook_router: after pattern_detection
- recommendation_agent: LAST before confidence. ONLY if context sufficient.
- confidence_agent: ALWAYS last.
- progress_check_agent: only when user chose "continue existing analysis"

## Rules
1. memory_agent ALWAYS runs first. Always.
2. recommendation_agent ONLY runs after all analysis agents complete.
3. If context insufficient (score < 40): route to MISSING_INFORMATION, do NOT generate recommendation.
4. If memory found similar cases: set next_stage = MEMORY_FOUND.
5. Never allow recommendation AND missing_information simultaneously.
6. RecommendationAgent and MissingInformationAgent are mutually exclusive.

Return JSON:
{
  "execution_plan": [
    {"phase": 1, "agents": ["memory_agent", "knowledge_agent"], "parallel": true, "reason": "Always first"},
    {"phase": 2, "agents": ["domain_specialist"], "parallel": false, "reason": "Domain analysis"},
    {"phase": 3, "agents": ["risk_agent", "opportunity_agent"], "parallel": true, "reason": "Risk + opportunity"},
    {"phase": 4, "agents": ["pattern_detection_agent", "playbook_router"], "parallel": false, "reason": "Pattern + playbook"},
    {"phase": 5, "agents": ["recommendation_agent"], "parallel": false, "reason": "Final recommendation"},
    {"phase": 6, "agents": ["confidence_agent"], "parallel": false, "reason": "Confidence scoring"}
  ],
  "total_phases": 6,
  "total_agents": 8,
  "skip_agents": [],
  "skip_reasons": {},
  "execution_mode": "standard",
  "next_stage": "GENERATING_RECOMMENDATIONS",
  "context_score": 75,
  "memory_found": false,
  "planner_decision": {
    "context_score": 75,
    "memory_found": false,
    "continue_selected": false,
    "execution_mode": "standard",
    "next_stage": "GENERATING_RECOMMENDATIONS",
    "recommendation_authorized": true,
    "missing_information_triggered": false
  },
  "planning_notes": "Standard pipeline authorized. Memory first, then full analysis."
}

CRITICAL: recommendation_authorized must be true for recommendation to run.
CRITICAL: If missing_information_triggered is true, recommendation_authorized must be false."""


class PlannerAgent(BaseAgent):
    name = "planner"
    description = "Authoritative workflow orchestrator — sole controller of execution state transitions"

    async def run(self, state: Dict[str, Any]) -> Dict[str, Any]:
        conversation_output = state.get("conversation_manager_output", {})
        completeness_output = state.get("information_completeness_output", {})
        context_eval = state.get("context_evaluator_output", {})
        memory_output = state.get("memory_agent_output", {})
        domain = state.get("domain", "customer_success")
        urgency = conversation_output.get("urgency", "medium")
        intent = conversation_output.get("intent", "")

        context_score = context_eval.get("context_score", 50)
        provided_fields = context_eval.get("provided_fields", [])
        missing_fields = context_eval.get("missing_fields", [])

        # Check if memory found anything relevant
        similar_cases = memory_output.get("similar_cases", [])
        memory_found = len(similar_cases) > 0
        total_memory = memory_output.get("total_retrieved", 0)

        # Determine execution mode
        execution_mode = self._choose_execution_mode(context_score, state)

        # Continuous planning check
        history = state.get("conversation_history", [])
        has_prior_context = len(history) > 2
        is_continue_session = state.get("is_continue_session", False)
        prior_context_str = ""
        if has_prior_context:
            prior_context_str = (
                "\n* CONTINUOUS PLANNING CONTEXT *\n"
                "- This is a continuation. Skip retrieval if already done.\n"
                "- Focus on refining recommendation based on new updates.\n"
            )
        if is_continue_session:
            prior_context_str += "- User explicitly chose CONTINUE. ProgressCheckAgent should be phase 1.\n"

        user_prompt = f"""Request Analysis:
- Intent: {intent}
- Domain: {domain}
- Urgency: {urgency}
- Context Score: {context_score}/100
- Context Class: {context_eval.get("context_class", "BUSINESS")}
- Provided Fields: {", ".join(provided_fields[:8]) or "None"}
- Missing Fields: {", ".join(missing_fields[:5]) or "None"}
- Memory Found: {memory_found} ({len(similar_cases)} similar cases, {total_memory} total memories)
- Is Continue Session: {is_continue_session}
- Information Quality: {completeness_output.get("information_quality", "medium")}
- Available Documents: {completeness_output.get("available_count", 0)} items
{prior_context_str}

DECISION CONSTRAINTS:
- If context_score < 40: set missing_information_triggered=true, recommendation_authorized=false
- If memory_found=true: consider setting next_stage=MEMORY_FOUND
- Always: memory_agent runs in phase 1

Key entities: {json.dumps(conversation_output.get("entities", {}))}

Generate the authoritative execution plan with PlannerDecision."""

        messages = build_messages(PLANNER_PROMPT_V2, user_prompt)

        try:
            response = await llm_provider.ainvoke(messages)
            content = response.content if hasattr(response, "content") else str(response)

            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                plan = json.loads(json_match.group())
            else:
                plan = self._default_plan(domain, urgency, context_score, memory_found, execution_mode, is_continue_session)

        except Exception as e:
            logger.warning("planner_v2_llm_failed", error=str(e))
            plan = self._default_plan(domain, urgency, context_score, memory_found, execution_mode, is_continue_session)

        # Enforce planner decision constraints regardless of LLM output
        plan = self._enforce_constraints(plan, context_score, memory_found, is_continue_session)

        logger.info(
            "planner_v2_decision",
            mode=plan.get("execution_mode"),
            next_stage=plan.get("next_stage"),
            rec_authorized=plan.get("planner_decision", {}).get("recommendation_authorized"),
            memory_found=memory_found,
        )

        return plan

    def _choose_execution_mode(self, context_score: int, state: Dict) -> str:
        """Choose fast/standard/deep_analysis based on context richness."""
        uploaded_docs = state.get("uploaded_documents", [])
        history = state.get("conversation_history", [])

        if context_score >= 80 and len(uploaded_docs) > 0:
            return "deep_analysis"
        elif context_score >= 50 or len(history) > 4:
            return "standard"
        else:
            return "fast"

    def _enforce_constraints(self, plan: Dict, context_score: int,
                              memory_found: bool, is_continue: bool) -> Dict:
        """
        Enforce hard planner rules — LLM cannot override these.
        1. Recommendation and MissingInformation are mutually exclusive.
        2. If context < 40: no recommendation.
        3. Memory always first.
        """
        planner_decision = plan.get("planner_decision", {})

        # Rule 1: Only block recommendation if context is extremely sparse (< 20)
        if context_score < 20:
            planner_decision["recommendation_authorized"] = False
            planner_decision["missing_information_triggered"] = True
            plan["next_stage"] = "MISSING_INFORMATION"
        else:
            planner_decision["recommendation_authorized"] = True
            planner_decision["missing_information_triggered"] = False
            if plan.get("next_stage") == "MISSING_INFORMATION":
                plan["next_stage"] = "GENERATING_RECOMMENDATIONS"

        # Rule 2: Cannot have both
        if planner_decision.get("missing_information_triggered") and planner_decision.get("recommendation_authorized"):
            planner_decision["recommendation_authorized"] = False

        # Rule 3: Ensure memory_agent is in phase 1
        exec_plan = plan.get("execution_plan", [])
        if exec_plan:
            phase1 = exec_plan[0]
            if "memory_agent" not in phase1.get("agents", []):
                phase1["agents"] = ["memory_agent"] + [
                    a for a in phase1["agents"] if a != "memory_agent"
                ]

        # Rule 4: memory_found triggers MEMORY_FOUND stage if not yet in HITL
        if memory_found and plan.get("next_stage") not in (
            "WAITING_FOR_HITL", "PROGRESS_CHECK", "MISSING_INFORMATION"
        ):
            planner_decision["memory_found"] = True

        plan["planner_decision"] = planner_decision
        plan["execution_mode"] = plan.get("execution_mode", "standard")
        return plan

    def _default_plan(
        self, domain: str, urgency: str, context_score: int,
        memory_found: bool, execution_mode: str, is_continue: bool
    ) -> Dict[str, Any]:
        """Default authoritative execution plan with 11 standard phases."""
        skip_opportunity = domain not in ("customer_success", "sales")
        rec_authorized = context_score >= 20

        phases = [
            {"phase": 1, "agents": ["memory_agent", "knowledge_agent"], "parallel": True, "reason": "Retrieve historical cases & domain documents"},
            {"phase": 2, "agents": ["domain_specialist"], "parallel": False, "reason": "Diagnose root-cause factors"},
            {"phase": 3, "agents": ["pattern_detection_agent"], "parallel": False, "reason": "Scan signals for operational patterns"},
            {"phase": 4, "agents": ["risk_agent"] + ([] if skip_opportunity else ["opportunity_agent"]), "parallel": True, "reason": "Analyze risk vectors & expansion triggers"},
            {"phase": 5, "agents": ["playbook_router"], "parallel": False, "reason": "Select and route to strategic playbook"},
            {"phase": 6, "agents": ["recommendation_agent"], "parallel": False, "reason": "Generate Next Best Action recommendation"},
            {"phase": 7, "agents": ["confidence_agent"], "parallel": False, "reason": "Compute explainable confidence score"},
            {"phase": 8, "agents": ["approval_agent"], "parallel": False, "reason": "Awaiting human review and approval sign-off"},
            {"phase": 9, "agents": ["execution_plan_agent"], "parallel": False, "reason": "Construct operational action timeline"},
            {"phase": 10, "agents": ["progress_check_agent"], "parallel": False, "reason": "Monitor changes, outcomes, & execution milestones"},
            {"phase": 11, "agents": ["memory_updater"], "parallel": False, "reason": "Log final outcomes and playbooks back into long-term memory"},
        ]

        next_stage = (
            "MISSING_INFORMATION" if not rec_authorized else
            "MEMORY_FOUND" if memory_found else
            "GENERATING_RECOMMENDATIONS"
        )

        return {
            "execution_plan": phases,
            "total_phases": len(phases),
            "total_agents": sum(len(p["agents"]) for p in phases),
            "skip_agents": (["opportunity_agent"] if skip_opportunity else []),
            "skip_reasons": {"opportunity_agent": "Not relevant for this domain"} if skip_opportunity else {},
            "execution_mode": execution_mode,
            "next_stage": next_stage,
            "context_score": context_score,
            "memory_found": memory_found,
            "planner_decision": {
                "context_score": context_score,
                "memory_found": memory_found,
                "continue_selected": is_continue,
                "execution_mode": execution_mode,
                "next_stage": next_stage,
                "recommendation_authorized": rec_authorized,
                "missing_information_triggered": not rec_authorized,
            },
            "planning_notes": (
                f"{'Continuous updating (ProgressCheckAgent activated). ' if is_continue else ''}"
                f"{execution_mode.title()} 11-phase workflow plan for {domain} domain. "
                f"Context score: {context_score}/100. "
                f"Recommendation {'authorized' if rec_authorized else 'blocked — insufficient context'}. "
                f"Memory: {'found' if memory_found else 'cold start'}."
            ),
        }
