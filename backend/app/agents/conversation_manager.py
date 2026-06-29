"""
Conversation Manager Agent
Handles: intent detection, session tracking, conversation continuity
"""
from typing import Dict, Any, Optional
from app.agents.base import BaseAgent
from app.core.llm import build_messages, llm_provider
from app.core.logging import logger
import json
import re


CONVERSATION_MANAGER_PROMPT = """You are the Conversation Manager for DecisionOS, an enterprise decision intelligence platform.

Your job is to analyze the user's message and determine:
1. The PRIMARY INTENT (what are they trying to decide or understand?)
2. The DOMAIN (customer_success / sales / healthcare / energy / staffing / insurance / banking / general)
3. The CONVERSATION TYPE (new_topic / continuation / follow_up / clarification)
4. KEY ENTITIES mentioned (customer names, deal names, case IDs, etc.)
5. URGENCY level (critical / high / medium / low)
6. Missing context that would help

Return a JSON object with this exact structure:
{
  "intent": "brief description of user intent",
  "domain": "domain name",
  "conversation_type": "new_topic|continuation|follow_up|clarification",
  "entities": {
    "customers": ["list of customer names"],
    "deals": ["list of deal/opportunity names"],
    "topics": ["key topics"],
    "metrics": ["mentioned metrics or values"]
  },
  "urgency": "critical|high|medium|low",
  "urgency_reason": "why this urgency level",
  "required_context": ["list of information types needed"],
  "is_decision_request": true/false,
  "decision_question": "the core decision question being asked"
}

Be precise and structured. This output drives the entire agent pipeline."""


class ConversationManagerAgent(BaseAgent):
    name = "conversation_manager"
    description = "Detects intent, domain, entities and conversation context"

    async def run(self, state: Dict[str, Any]) -> Dict[str, Any]:
        user_message = state.get("user_message", "")
        conversation_history = state.get("conversation_history", [])
        conversation_id = state.get("conversation_id")

        # Build context from history
        history_context = ""
        if conversation_history:
            last_turns = conversation_history[-4:]
            history_context = "\n".join([
                f"{m['role'].upper()}: {m['content'][:200]}"
                for m in last_turns
            ])

        user_prompt = f"""Conversation History (last turns):
{history_context if history_context else "No previous history - this is a new conversation"}

Current User Message:
"{user_message}"

Analyze and return the JSON structure."""

        messages = build_messages(CONVERSATION_MANAGER_PROMPT, user_prompt)

        try:
            response = await llm_provider.ainvoke(messages)
            content = response.content if hasattr(response, "content") else str(response)

            # Extract JSON
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
            else:
                result = self._fallback_analysis(user_message)

        except Exception as e:
            logger.warning("conversation_manager_llm_failed", error=str(e))
            result = self._fallback_analysis(user_message)

        return result

    def _fallback_analysis(self, message: str) -> Dict[str, Any]:
        """Fallback when LLM is unavailable."""
        message_lower = message.lower()

        domain = "customer_success"
        if any(w in message_lower for w in ["health", "patient", "clinical", "medical"]):
            domain = "healthcare"
        elif any(w in message_lower for w in ["energy", "utility", "solar", "grid"]):
            domain = "energy"
        elif any(w in message_lower for w in ["hire", "candidate", "recruit", "staffing"]):
            domain = "staffing"
        elif any(w in message_lower for w in ["loan", "credit", "bank", "mortgage"]):
            domain = "banking"

        urgency = "medium"
        if any(w in message_lower for w in ["urgent", "critical", "asap", "immediately", "today"]):
            urgency = "critical"
        elif any(w in message_lower for w in ["churn", "risk", "loss", "escalat"]):
            urgency = "high"

        # Detect if this is a business/decision request vs greeting/social
        business_words = ["churn", "risk", "renewal", "customer", "deal", "account",
                          "upsell", "revenue", "arr", "contract", "opportunity", "hire",
                          "candidate", "patient", "energy", "analysis", "recommend"]
        is_decision = any(w in message_lower for w in business_words) or len(message.split()) > 8

        return {
            "intent": f"User wants decision support: {message[:100]}" if is_decision else "Social interaction",
            "domain": domain,
            "conversation_type": "new_topic",
            "entities": {
                "customers": [],
                "deals": [],
                "topics": [message[:50]],
                "metrics": []
            },
            "urgency": urgency,
            "urgency_reason": "Based on keywords in message",
            "required_context": ["CRM data", "Historical data", "Playbooks"],
            "is_decision_request": is_decision,
            "decision_question": message[:200] if is_decision else ""
        }
