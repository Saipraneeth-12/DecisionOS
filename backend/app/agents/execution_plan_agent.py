"""
Execution Plan Agent — Generates a day-by-day execution timeline
from an approved recommendation.

Called during Phase 7 (Human Approval Processing) after a recommendation
transitions from PENDING_APPROVAL → APPROVED.
"""
from typing import Dict, Any, List
from app.agents.base import BaseAgent
from app.core.llm import build_messages, llm_provider
from app.core.logging import logger
import json
import re
import uuid


EXECUTION_PLAN_PROMPT = """You are the Execution Plan Agent for DecisionOS.

A recommendation has been approved by a human decision-maker.
Your job is to generate a concrete, realistic execution timeline.

Generate a JSON execution plan in this exact format:
{
  "execution_steps": [
    {
      "day": 1,
      "action": "Specific action title (short, imperative)",
      "description": "2-sentence description of what needs to happen",
      "owner": "Role/Team (e.g. CSM, Solutions Consultant, Product Team, Customer Success, Executive Sponsor)",
      "priority": "High|Medium|Low",
      "expected_output": "What this step produces",
      "dependencies": []
    }
  ],
  "total_days": 14,
  "execution_confidence": 87,
  "key_milestones": [
    { "day": 1, "milestone": "Kickoff", "status": "PENDING" },
    { "day": 7, "milestone": "Mid-check", "status": "PENDING" }
  ],
  "success_criteria": [
    "Measurable success criterion 1",
    "Measurable success criterion 2"
  ],
  "risk_mitigations": [
    "Risk mitigation measure"
  ],
  "estimated_arr_impact": 0,
  "planner_state": "EXECUTING"
}

Rules:
- Generate 4-7 execution steps spread over 7-21 days depending on urgency
- Steps must be concrete and actionable, not vague
- Owners must be specific roles, not generic "team"
- execution_confidence: 70-95 based on recommendation confidence
- estimated_arr_impact: realistic dollar figure based on ROI metrics in recommendation
- Steps must flow logically (e.g. alignment before action, measurement last)
- For renewal/churn: focus on EBR, champion engagement, success plan
- For expansion: focus on discovery, demo, proposal, close
- For procurement: focus on security docs, legal review, executive alignment"""


class ExecutionPlanAgent(BaseAgent):
    name = "execution_plan_agent"
    description = "Generates concrete day-by-day execution plan for an approved recommendation"

    async def run(self, state: Dict[str, Any]) -> Dict[str, Any]:
        rec = state.get("approved_recommendation", {})
        hitl_intent = state.get("hitl_intent", {})

        if not rec:
            return self._default_plan()

        title = rec.get("title", "Approved Recommendation")
        action = rec.get("action", "")
        playbook = rec.get("selected_playbook", "General Intervention Playbook")
        roi_metrics = rec.get("roi_metrics", {})
        supporting = rec.get("supporting_actions", [])
        urgency = rec.get("urgency", "this_week")
        domain = rec.get("domain", "customer_success")
        confidence = rec.get("confidence_score", 0.8)

        # Estimate ARR impact from ROI metrics
        arr_impact = 0
        if roi_metrics:
            arr_impact = roi_metrics.get("potential_retained_revenue", 0) + roi_metrics.get("expansion_potential", 0)

        supporting_str = ""
        if supporting:
            supporting_str = "\n".join(
                f"- {a.get('action','')} ({a.get('owner','TBD')}, {a.get('timeline','TBD')})"
                for a in supporting[:5]
            )

        user_prompt = f"""Approved Recommendation Details:
Title: {title}
Primary Action: {action[:400]}
Playbook: {playbook}
Domain: {domain}
Urgency: {urgency}
Confidence Score: {int((confidence or 0.8) * 100)}%
ARR at Risk: ${roi_metrics.get('arr_at_risk', 0):,}
Expansion Potential: ${roi_metrics.get('expansion_potential', 0):,}
Modifier/Comment from approver: {hitl_intent.get('modifier', 'None')}

Supporting Actions identified:
{supporting_str or 'None specified'}

Generate a realistic execution plan for this approved recommendation."""

        messages = build_messages(EXECUTION_PLAN_PROMPT, user_prompt)

        try:
            response = await llm_provider.ainvoke(messages)
            content = response.content if hasattr(response, "content") else str(response)
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                plan = json.loads(json_match.group())
            else:
                plan = self._default_plan()
        except Exception as e:
            logger.warning("execution_plan_agent_failed", error=str(e))
            plan = self._default_plan_for_rec(rec)

        # Add execution metadata
        plan["execution_id"] = f"EXP-{str(uuid.uuid4())[:6].upper()}"
        plan["recommendation_id"] = rec.get("recommendation_id", "NBA-UNKNOWN")
        plan["planner_state"] = "EXECUTING"
        plan["memory_updated"] = True
        plan["closed_loop_enabled"] = True

        if arr_impact > 0 and not plan.get("estimated_arr_impact"):
            plan["estimated_arr_impact"] = arr_impact

        logger.info(
            "execution_plan_generated",
            steps=len(plan.get("execution_steps", [])),
            confidence=plan.get("execution_confidence"),
            execution_id=plan["execution_id"],
        )
        return plan

    def _default_plan(self) -> Dict[str, Any]:
        return {
            "execution_steps": [
                {"day": 1, "action": "Executive Alignment Meeting", "description": "Schedule and conduct executive business review with key stakeholders. Align on goals, success metrics, and timeline.", "owner": "CSM", "priority": "High", "expected_output": "Aligned executive sponsor and agreed action plan", "dependencies": []},
                {"day": 3, "action": "Adoption Assessment", "description": "Audit current product usage across teams. Identify adoption gaps and quick wins.", "owner": "Solutions Consultant", "priority": "High", "expected_output": "Adoption gap report with prioritized recommendations", "dependencies": ["Executive Alignment Meeting"]},
                {"day": 5, "action": "Integration Review", "description": "Review existing integrations and identify untapped capabilities. Present expansion roadmap.", "owner": "Product Team", "priority": "Medium", "expected_output": "Integration roadmap and use case expansion plan", "dependencies": []},
                {"day": 7, "action": "Adoption Sprint Launch", "description": "Kick off structured adoption sprint with customer team leads. Assign champions and set weekly check-ins.", "owner": "Customer Success", "priority": "High", "expected_output": "Active adoption sprint with measurable KPIs", "dependencies": ["Adoption Assessment"]},
                {"day": 14, "action": "Success Measurement & Reporting", "description": "Measure adoption metrics and business outcomes achieved. Generate executive report.", "owner": "CSM", "priority": "Medium", "expected_output": "Outcome report with next steps and renewal recommendation", "dependencies": []},
            ],
            "total_days": 14,
            "execution_confidence": 87,
            "key_milestones": [
                {"day": 1, "milestone": "Executive Alignment", "status": "PENDING"},
                {"day": 7, "milestone": "Sprint Launch", "status": "PENDING"},
                {"day": 14, "milestone": "Outcome Measurement", "status": "PENDING"},
            ],
            "success_criteria": [
                "Executive sponsor re-engaged within 48 hours",
                "Usage rate increased by 20% within 14 days",
                "Renewal confirmed or commitment obtained",
            ],
            "risk_mitigations": [
                "Escalate to VP level if executive not responsive within 48h",
                "Prepare competitive battlecard in case of competitive evaluation",
            ],
            "estimated_arr_impact": 0,
            "planner_state": "EXECUTING",
        }

    def _default_plan_for_rec(self, rec: Dict) -> Dict[str, Any]:
        """Build a default plan seeded with supporting_actions from the recommendation."""
        plan = self._default_plan()
        supporting = rec.get("supporting_actions", [])
        if supporting:
            plan["execution_steps"] = [
                {
                    "day": (i + 1) * 2,
                    "action": a.get("action", f"Step {i+1}"),
                    "description": f"Execute: {a.get('action', '')}",
                    "owner": a.get("owner", "CSM"),
                    "priority": a.get("priority", "Medium"),
                    "expected_output": a.get("expected_impact", "Action completed"),
                    "dependencies": [],
                }
                for i, a in enumerate(supporting[:6])
            ]
            plan["total_days"] = max(step["day"] for step in plan["execution_steps"]) + 3
        return plan
