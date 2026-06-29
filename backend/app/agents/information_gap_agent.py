"""
Information Gap Agent — Activated when user requests "Need more information".
Generates contextual discovery questions (e.g. Budget, Technical blockers, Stakeholder alignment).
"""
from typing import Dict, Any, List
from app.agents.base import BaseAgent
from app.core.llm import build_messages, llm_provider
from app.core.logging import logger
import json
import re


INFO_GAP_PROMPT = """You are the Information Gap Agent for DecisionOS.

The user wants more information about a decision recommendation.
Your job is to identify the critical gaps in context and generate 3 clarifying questions.

Return JSON format:
{
  "missing_information": [
    "Category of missing data (e.g. Budget details, Procurement timeline, Champion alignment)"
  ],
  "questions": [
    "Specific, direct question to ask the user"
  ],
  "estimated_timeline": "3 business days",
  "recommendation_status": "PENDING_APPROVAL"
}"""


class InformationGapAgent(BaseAgent):
    name = "information_gap_agent"
    description = "Generates specific clarifying questions for recommendations requiring more information"

    async def run(self, state: Dict[str, Any]) -> Dict[str, Any]:
        rec = state.get("recommendation", {})
        user_message = state.get("user_message", "")

        title = rec.get("title", "Recommendation")
        playbook = rec.get("selected_playbook", "General Playbook")

        user_prompt = f"""Recommendation Title: {title}
Playbook: {playbook}
User Message: {user_message}

Identify the missing information gaps and generate 3 highly relevant questions."""

        messages = build_messages(INFO_GAP_PROMPT, user_prompt)

        try:
            response = await llm_provider.ainvoke(messages)
            content = response.content if hasattr(response, "content") else str(response)

            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
            else:
                result = self._default_gap()
        except Exception as e:
            logger.warning("information_gap_agent_failed", error=str(e))
            result = self._default_gap()

        return result

    def _default_gap(self) -> Dict[str, Any]:
        return {
            "missing_information": ["Budget context", "Technical integration blockers", "Executive sponsor alignment"],
            "questions": [
                "Who owns the budget approval for this renewal?",
                "Are there any technical blockers delaying integration?",
                "Has the executive sponsor been engaged directly in the save plan?"
            ],
            "estimated_timeline": "3 business days",
            "recommendation_status": "PENDING_APPROVAL"
        }
