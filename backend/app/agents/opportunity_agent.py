"""
Opportunity Agent - Detects upsell, cross-sell, expansion, and adoption opportunities
"""
from typing import Dict, Any, List
from app.agents.base import BaseAgent
from app.core.llm import build_messages, llm_provider
from app.core.logging import logger
import json
import re


OPPORTUNITY_PROMPT = """You are the Opportunity Detection Agent for DecisionOS.

Your job is to identify business opportunities that can be pursued alongside or after risk mitigation.

Opportunity Types:
1. UPSELL: Selling higher tier, more seats, more capacity
2. CROSS_SELL: Additional products or modules
3. EXPANSION: New departments, geographies, use cases
4. ADOPTION: Deeper product usage to increase stickiness and renewal probability
5. EXECUTIVE_SPONSORSHIP: Elevating to C-suite relationship for strategic partnership
6. REFERENCE_CUSTOMER: Converting to a reference, case study, or speaking opportunity
7. ADVISORY: Joining customer advisory board
8. CO_MARKETING: Joint marketing or PR opportunities

For each opportunity, assess:
- Type and specific description
- Revenue potential (quantify if possible)
- Probability of success (0-1)
- Required conditions/triggers
- Timing recommendation

Return JSON:
{
  "opportunities": [
    {
      "type": "UPSELL|CROSS_SELL|EXPANSION|ADOPTION|EXECUTIVE_SPONSORSHIP|REFERENCE_CUSTOMER",
      "title": "opportunity title",
      "description": "detailed description",
      "revenue_potential": "dollar range or percentage",
      "probability": 0.0-1.0,
      "timing": "now|after_renewal|60_days|90_days",
      "required_conditions": ["condition 1", "condition 2"],
      "recommended_action": "specific action to pursue"
    }
  ],
  "primary_opportunity": "the most valuable opportunity to pursue",
  "total_expansion_potential": "estimated total revenue opportunity",
  "opportunity_summary": "brief summary",
  "recommended_timing": "when to introduce opportunities"
}"""


class OpportunityAgent(BaseAgent):
    name = "opportunity_agent"
    description = "Identifies upsell, expansion, and cross-sell opportunities"

    async def run(self, state: Dict[str, Any]) -> Dict[str, Any]:
        user_message = state.get("user_message", "")
        domain = state.get("domain", "customer_success")
        domain_output = state.get("domain_specialist_output", {})
        memory_output = state.get("memory_agent_output", {})
        risk_output = state.get("risk_agent_output", {})
        knowledge_output = state.get("knowledge_agent_output", {})

        risk_level = risk_output.get("overall_risk_level", "medium")
        opportunities_from_domain = domain_output.get("opportunities", [])

        user_prompt = f"""Situation:
User Request: {user_message[:300]}
Domain: {domain}
Current Risk Level: {risk_level}
Health Score: {risk_output.get('health_score', 50)}

Domain Identified Opportunities:
{json.dumps(opportunities_from_domain, indent=2)[:600]}

Memory Context:
{memory_output.get('memory_summary', 'No memory context')}

Knowledge Points:
{chr(10).join(knowledge_output.get('key_recommendations_from_kb', [])[:3])}

Identify all relevant opportunities. Focus on what's achievable given the current risk level.
Note: If risk is high/critical, focus on ADOPTION and EXECUTIVE_SPONSORSHIP first."""

        messages = build_messages(OPPORTUNITY_PROMPT, user_prompt)

        try:
            response = await llm_provider.ainvoke(messages)
            content = response.content if hasattr(response, "content") else str(response)

            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
            else:
                result = self._fallback_opportunities(risk_level, domain)

        except Exception as e:
            logger.warning("opportunity_agent_llm_failed", error=str(e))
            result = self._fallback_opportunities(risk_level, domain)

        return result

    def _fallback_opportunities(self, risk_level: str, domain: str) -> Dict[str, Any]:
        opps = []

        if risk_level in ("low", "medium"):
            opps.append({
                "type": "UPSELL",
                "title": "Premium Tier Upgrade",
                "description": "Customer shows strong adoption signals suitable for premium tier",
                "revenue_potential": "15-25% ARR expansion",
                "probability": 0.55,
                "timing": "60_days",
                "required_conditions": ["Health score > 70", "Executive relationship established"],
                "recommended_action": "Present premium features ROI case in next EBR"
            })
            opps.append({
                "type": "EXPANSION",
                "title": "New Department Rollout",
                "description": "Success in current department creates expansion opportunity",
                "revenue_potential": "20-40% ARR expansion",
                "probability": 0.45,
                "timing": "90_days",
                "required_conditions": ["Current adoption > 70%", "Internal champion willing to sponsor"],
                "recommended_action": "Facilitate internal reference call with potential new department"
            })

        # Always relevant
        opps.append({
            "type": "EXECUTIVE_SPONSORSHIP",
            "title": "C-Suite Partnership Development",
            "description": "Elevate relationship to strategic executive level for long-term partnership",
            "revenue_potential": "3x higher retention probability",
            "probability": 0.65,
            "timing": "now",
            "required_conditions": ["CSM has access to current champion"],
            "recommended_action": "Request executive introduction through current champion"
        })

        return {
            "opportunities": opps,
            "primary_opportunity": opps[0]["title"] if opps else "No immediate opportunities",
            "total_expansion_potential": "15-40% ARR expansion potential identified",
            "opportunity_summary": f"Identified {len(opps)} opportunities for {domain} context",
            "recommended_timing": "after_risk_mitigation" if risk_level in ("critical", "high") else "now"
        }
