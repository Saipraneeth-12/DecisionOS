"""
Risk Agent - Computes risk scores, health scores, urgency and escalation
"""
from typing import Dict, Any, List
from app.agents.base import BaseAgent
from app.core.llm import build_messages, llm_provider
from app.core.logging import logger
import json
import re


RISK_PROMPT = """You are the Risk Assessment Agent for DecisionOS.

Your job is to compute precise risk scores based on available data and context.

Risk Dimensions:
1. CHURN/LOSS RISK (0-100): Probability of losing the customer/deal/case
2. URGENCY SCORE (0-100): How time-sensitive is action required
3. IMPACT SCORE (0-100): Business impact if risk materializes (financial, operational)
4. HEALTH SCORE (0-100): Overall health of the relationship/situation (higher = healthier)
5. ESCALATION SCORE (0-100): Whether this needs escalation beyond standard process

Risk Signals to evaluate:
- Engagement signals (communication frequency, response rates, meeting attendance)
- Usage/activity signals (platform usage, adoption depth, activity trends)
- Sentiment signals (NPS, CSAT, tone of communications)
- Financial signals (budget discussions, competitor evaluations, procurement delays)
- Relationship signals (champion status, executive access, stakeholder changes)

Return JSON:
{
  "overall_risk_level": "critical|high|medium|low",
  "churn_probability": 0.0-1.0,
  "urgency_score": 0-100,
  "impact_score": 0-100,
  "health_score": 0-100,
  "escalation_needed": true/false,
  "escalation_level": "none|manager|director|vp|executive",
  "risk_factors": [
    {
      "name": "risk factor name",
      "severity": "critical|high|medium|low",
      "evidence": "what evidence supports this",
      "mitigation": "suggested mitigation"
    }
  ],
  "positive_signals": ["list of positive factors"],
  "potential_loss": "estimated financial impact description",
  "time_to_decision": "estimated time before situation becomes irreversible",
  "risk_reasoning": "detailed explanation of risk assessment",
  "recommended_escalation": "specific escalation recommendation if needed"
}"""


class RiskAgent(BaseAgent):
    name = "risk_agent"
    description = "Computes risk scores, health scores, and escalation requirements"

    async def run(self, state: Dict[str, Any]) -> Dict[str, Any]:
        user_message = state.get("user_message", "")
        domain = state.get("domain", "customer_success")
        domain_output = state.get("domain_specialist_output", {})
        memory_output = state.get("memory_agent_output", {})
        conversation_output = state.get("conversation_manager_output", {})

        urgency = conversation_output.get("urgency", "medium")
        risk_factors_from_domain = domain_output.get("risk_factors", [])
        similar_cases = memory_output.get("similar_cases", [])

        # Build churn cases context
        churn_cases = [c for c in similar_cases if c.get("outcome") == "churn"]
        success_cases = [c for c in similar_cases if c.get("outcome") == "success"]

        user_prompt = f"""Situation Analysis:
User Request: {user_message[:400]}
Domain: {domain}
Urgency Level (from Conversation Manager): {urgency}

Domain Specialist Risk Factors:
{json.dumps(risk_factors_from_domain, indent=2)[:800]}

Historical Context:
- Similar churn cases: {len(churn_cases)} found
- Similar success cases: {len(success_cases)} found
- Memory summary: {memory_output.get('memory_summary', 'N/A')}

Compute comprehensive risk assessment."""

        messages = build_messages(RISK_PROMPT, user_prompt)

        try:
            response = await llm_provider.ainvoke(messages)
            content = response.content if hasattr(response, "content") else str(response)

            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
            else:
                result = self._compute_fallback_risk(urgency, risk_factors_from_domain, churn_cases)

        except Exception as e:
            logger.warning("risk_agent_llm_failed", error=str(e))
            result = self._compute_fallback_risk(urgency, risk_factors_from_domain, churn_cases)

        return result

    def _compute_fallback_risk(self, urgency: str, risk_factors: List, churn_cases: List) -> Dict[str, Any]:
        """Rule-based fallback risk computation."""
        urgency_scores = {"critical": 90, "high": 70, "medium": 50, "low": 25}
        urgency_score = urgency_scores.get(urgency, 50)

        # Escalation based on urgency
        escalation_needed = urgency in ("critical", "high")
        escalation_level = {
            "critical": "vp",
            "high": "director",
            "medium": "manager",
            "low": "none"
        }.get(urgency, "none")

        churn_probability = {
            "critical": 0.75,
            "high": 0.55,
            "medium": 0.30,
            "low": 0.10
        }.get(urgency, 0.30)

        return {
            "overall_risk_level": urgency,
            "churn_probability": churn_probability,
            "urgency_score": urgency_score,
            "impact_score": urgency_score - 10,
            "health_score": 100 - urgency_score,
            "escalation_needed": escalation_needed,
            "escalation_level": escalation_level,
            "risk_factors": risk_factors or [
                {
                    "name": "Engagement Decline",
                    "severity": urgency,
                    "evidence": "Detected from context analysis",
                    "mitigation": "Proactive executive outreach"
                }
            ],
            "positive_signals": ["Existing relationship", "Historical success patterns available"],
            "potential_loss": "Estimated $200K-$500K ARR at risk based on urgency level",
            "time_to_decision": "30-60 days based on urgency" if urgency in ("critical", "high") else "90+ days",
            "risk_reasoning": f"Risk assessment based on {urgency} urgency signal and {len(churn_cases)} similar churn cases in memory",
            "recommended_escalation": f"Escalate to {escalation_level} level" if escalation_needed else "Standard CSM handling"
        }
