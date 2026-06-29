"""
ProgressCheckAgent — Activated when user selects "Continue Existing Analysis"
in the Human-in-the-Loop flow.

Asks what changed since the previous recommendation was generated:
- Completed actions?
- Blocked steps?
- Improved metrics?
- New outcome data?
- Additional risks?
- New stakeholders?

Then feeds this into the Planner for re-recommendation.
"""
from typing import Dict, Any, List
from app.agents.base import BaseAgent
from app.core.llm import build_messages, llm_provider
from app.core.logging import logger
import json
import re


PROGRESS_CHECK_PROMPT = """You are the ProgressCheckAgent for DecisionOS.

The user has chosen to CONTINUE an existing analysis session. A previous recommendation exists.

Your job is to extract an update summary from the user's message that captures:
1. What has been COMPLETED since the last recommendation?
2. What is BLOCKED or has encountered obstacles?
3. What has IMPROVED (metrics, relationships, usage, etc.)?
4. What OUTCOME was observed (positive, neutral, negative)?
5. Any ADDITIONAL RISKS or new threats identified?
6. Any NEW STAKEHOLDERS introduced?
7. What CHANGED in the business context?

Return JSON:
{
  "has_updates": true/false,
  "completed_actions": ["list of completed items"],
  "blocked_actions": ["list of blocked items"],
  "improved_metrics": ["metric: old → new"],
  "outcome_signals": ["positive/neutral/negative signal descriptions"],
  "new_risks": ["new risk identified"],
  "new_stakeholders": ["new stakeholder name/role"],
  "context_changes": ["what changed in the overall situation"],
  "update_summary": "One-paragraph summary of what has changed",
  "recommendation_evolution": "brief: how the recommendation should evolve based on this update",
  "suggested_next_stage": "one of: continue_strategy, escalate, modify_approach, close_out"
}

Be precise. Only include items clearly mentioned or implied by the user's message.
If the user hasn't provided specific updates, return has_updates=false and ask clarifying questions."""


class ProgressCheckAgent(BaseAgent):
    name = "progress_check_agent"
    description = "Checks what has changed since the last recommendation for continuous planning sessions"

    async def run(self, state: Dict[str, Any]) -> Dict[str, Any]:
        user_message = state.get("user_message", "")
        previous_recommendation = state.get("previous_recommendation", {})
        conversation_history = state.get("conversation_history", [])

        # Build context string from previous recommendation
        prev_title = previous_recommendation.get("title", "Previous Recommendation")
        prev_action = previous_recommendation.get("action", "")
        prev_status = previous_recommendation.get("approval_status", "pending")
        prev_playbook = previous_recommendation.get("selected_playbook", "")

        user_prompt = f"""PREVIOUS RECOMMENDATION:
Title: {prev_title}
Primary Action: {prev_action[:200] if prev_action else 'N/A'}
Status: {prev_status}
Playbook: {prev_playbook}

USER UPDATE MESSAGE:
{user_message}

RECENT CONVERSATION CONTEXT:
{self._summarize_history(conversation_history)}

Extract the progress update and return JSON."""

        messages = build_messages(PROGRESS_CHECK_PROMPT, user_prompt)

        try:
            response = await llm_provider.ainvoke(messages)
            content = response.content if hasattr(response, "content") else str(response)

            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
            else:
                result = self._default_progress_check(user_message)

        except Exception as e:
            logger.warning("progress_check_agent_failed", error=str(e))
            result = self._default_progress_check(user_message)

        logger.info(
            "progress_check_complete",
            has_updates=result.get("has_updates"),
            completed=len(result.get("completed_actions", [])),
            blocked=len(result.get("blocked_actions", [])),
        )

        return result

    def _summarize_history(self, history: List[Dict]) -> str:
        if not history:
            return "No prior conversation."
        recent = history[-4:]
        parts = []
        for msg in recent:
            role = msg.get("role", "user")
            content = msg.get("content", "")[:120]
            parts.append(f"{role.upper()}: {content}")
        return "\n".join(parts)

    def _default_progress_check(self, user_message: str) -> Dict[str, Any]:
        """Fallback when LLM fails — extract signals from message."""
        msg_lower = user_message.lower()

        completed = []
        blocked = []
        improved = []

        # Simple signal detection
        if any(w in msg_lower for w in ["completed", "done", "finished", "resolved"]):
            completed.append("User indicated completion of prior actions")
        if any(w in msg_lower for w in ["blocked", "stuck", "issue", "problem", "can't"]):
            blocked.append("User indicated a blocker or obstacle")
        if any(w in msg_lower for w in ["improved", "better", "increased", "up", "positive"]):
            improved.append("User indicated improvement in metrics or sentiment")

        has_updates = bool(completed or blocked or improved or len(user_message.split()) > 10)

        return {
            "has_updates": has_updates,
            "completed_actions": completed,
            "blocked_actions": blocked,
            "improved_metrics": improved,
            "outcome_signals": [],
            "new_risks": [],
            "new_stakeholders": [],
            "context_changes": ["User provided updated context for continuous analysis"],
            "update_summary": f"User provided an update: {user_message[:150]}",
            "recommendation_evolution": "Refresh recommendation based on updated context",
            "suggested_next_stage": "continue_strategy",
        }
