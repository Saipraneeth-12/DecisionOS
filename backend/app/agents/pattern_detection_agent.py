"""
Pattern Detection Agent - Analyzes input signals to classify B2B scenario patterns.
"""
from typing import Dict, Any, List
from app.agents.base import BaseAgent
from app.core.llm import build_messages, llm_provider
from app.core.logging import logger
import json
import re

PATTERN_PROMPT = """You are the Pattern Detection Agent for DecisionOS.

Your job is to analyze the user situation, conversation details, and context signals, and identify which B2B business patterns are active.

B2B Pattern Catalog:
1. RenewalRisk: Renewal under 120 days with declining usage, negative sentiment, or high support ticket count.
2. ProcurementDelay: Deal stuck in procurement stage, long review times, or silent procurement contacts.
3. ExpansionOpportunity: High adoption, growing usage, positive NPS, or interest in additional products/licenses.
4. AdoptionDecline: Decline in usage, low feature adoption, or incomplete onboarding/training.
5. CompetitiveThreat: Competitor mentioned, champion has weak influence, or stalled pipeline deals.
6. ChampionLoss: Champion has left, changed roles, or lost decision-making influence.
7. LowSentiment: Negative tone, complaints, low NPS/CSAT, or negative health indications.
8. MissingInformation: Critical data like budget, timeline, decision makers, or procurement steps are unknown.
9. SecurityBlocker: Security assessment, compliance audits, GDPR reviews, or privacy certifications are pending/blocking.
10. BudgetRisk: Client has budget cuts, budget is unapproved, or pricing complaints detected.
11. StakeholderGap: Executive sponsors, decision makers, or key stakeholders are missing from meetings.
12. TimelineUnclear: Project timeline, implementation schedule, or renewal dates are undefined or slipping.
13. DecisionMakerMissing: Main decision maker is not engaged or uncontactable.
14. ExecutiveChange: New executive sponsor, manager, or director hired, causing strategy changes.
15. UpsellSignal: Usage limit exceeded, seat limit reached, or pilot successful.
16. CrossSellSignal: New business units, sister companies, or product line interest.

Evaluate the inputs carefully. Return a structured JSON response:
{
  "patterns": ["Pattern1", "Pattern2"],
  "confidence": 0.0-1.0,
  "evidence_signals": [
    {
      "pattern": "PatternName",
      "signal": "evidence string from the context",
      "severity": "high|medium|low"
    }
  ],
  "reasoning_summary": "detailed explanation of why these patterns were classified"
}"""

class PatternDetectionAgent(BaseAgent):
    name = "pattern_detection_agent"
    description = "Classifies business scenario patterns from context signals"

    async def run(self, state: Dict[str, Any]) -> Dict[str, Any]:
        user_message = state.get("user_message", "")
        domain = state.get("domain", "customer_success")
        completeness_output = state.get("information_completeness_output", {})
        conversation_output = state.get("conversation_manager_output", {})
        memory_output = state.get("memory_agent_output", {})

        user_prompt = f"""Business Situation Analysis:
User Request: {user_message}
Domain: {domain}
Conversation Manager Output: {json.dumps(conversation_output, indent=2)}
Information Quality & Missing items: {json.dumps(completeness_output, indent=2)}
Episodic Memory Cases: {json.dumps(memory_output.get('similar_cases', []), indent=2)}

Detect all matching B2B scenario patterns from this context."""

        messages = build_messages(PATTERN_PROMPT, user_prompt)

        try:
            response = await llm_provider.ainvoke(messages)
            content = response.content if hasattr(response, "content") else str(response)

            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
            else:
                result = self._compute_fallback_patterns(user_message, completeness_output)
        except Exception as e:
            logger.warning("pattern_detection_llm_failed", error=str(e))
            result = self._compute_fallback_patterns(user_message, completeness_output)

        return result

    def _compute_fallback_patterns(self, message: str, completeness: Dict[str, Any]) -> Dict[str, Any]:
        """Simple rule-based heuristic fallback if LLM call fails."""
        patterns = []
        evidence = []
        msg_lower = message.lower()

        if "renew" in msg_lower or "days" in msg_lower:
            patterns.append("RenewalRisk")
            evidence.append({"pattern": "RenewalRisk", "signal": "Mention of renewal timing or urgency", "severity": "high"})
        
        if "procure" in msg_lower or "procurement" in msg_lower or "stalled" in msg_lower:
            patterns.append("ProcurementDelay")
            evidence.append({"pattern": "ProcurementDelay", "signal": "Stalled deal stage or procurement blocker", "severity": "medium"})

        if "usage" in msg_lower and ("down" in msg_lower or "drop" in msg_lower or "fall" in msg_lower):
            patterns.append("AdoptionDecline")
            evidence.append({"pattern": "AdoptionDecline", "signal": "Usage drop or decline activity trend", "severity": "high"})

        if "competitor" in msg_lower or "microsoft" in msg_lower or "aws" in msg_lower or "azure" in msg_lower:
            patterns.append("CompetitiveThreat")
            evidence.append({"pattern": "CompetitiveThreat", "signal": "Competitor mentioned directly", "severity": "high"})

        if "budget" in msg_lower or "cost" in msg_lower or "pricing" in msg_lower:
            patterns.append("BudgetRisk")
            evidence.append({"pattern": "BudgetRisk", "signal": "Discussion of budget constraints or pricing reviews", "severity": "medium"})

        if not patterns:
            # Check missing items
            missing = completeness.get("missing_items", [])
            if len(missing) > 1:
                patterns.append("MissingInformation")
                evidence.append({"pattern": "MissingInformation", "signal": "Multiple critical elements missing from request", "severity": "medium"})
            else:
                patterns.append("MissingInformation")
                evidence.append({"pattern": "MissingInformation", "signal": "Initial greeting or low context check", "severity": "low"})

        return {
            "patterns": patterns,
            "confidence": 0.75,
            "evidence_signals": evidence,
            "reasoning_summary": f"Fallback heuristic classification based on user request keywords. Classified: {', '.join(patterns)}."
        }
