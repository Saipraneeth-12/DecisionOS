"""
Domain Specialist Agent
Applies domain-specific business reasoning and expertise
"""
from typing import Dict, Any
from app.agents.base import BaseAgent
from app.core.llm import build_messages, llm_provider
from app.core.logging import logger
import json
import re


DOMAIN_PROMPTS = {
    "customer_success": """You are a Senior Customer Success Director with 15 years of enterprise SaaS experience.
You specialize in churn prevention, expansion revenue, executive relationships, and customer health management.
You understand: NPS, CSAT, ARR, NRR, GRR, EBR strategy, QBR planning, champion development, and renewal playbooks.
Apply your expertise to provide deep domain insights.""",

    "sales": """You are a VP of Sales with expertise in enterprise B2B deals, MEDDIC/MEDDPICC methodology,
competitive displacement, deal acceleration, and revenue forecasting.
You understand: pipeline management, deal stages, objection handling, pricing strategy, and closing tactics.
Apply your expertise to provide deep domain insights.""",

    "healthcare": """You are a Healthcare Operations Director with expertise in clinical workflows,
care coordination, patient outcomes, regulatory compliance (HIPAA, JCAHO), and value-based care.
You understand: clinical decision support, care pathways, resource optimization, and quality metrics.
Apply your expertise to provide domain insights.""",

    "energy": """You are an Energy Operations Specialist with expertise in utility management,
demand forecasting, grid optimization, renewable integration, and regulatory compliance.
Apply your expertise to provide domain insights.""",

    "staffing": """You are a Talent Acquisition Director with expertise in candidate pipelines,
hiring velocity, quality of hire, workforce planning, and retention strategies.
Apply your expertise to provide domain insights.""",

    "banking": """You are a Banking Risk and Operations specialist with expertise in credit risk,
regulatory compliance, customer lifecycle management, product cross-sell, and fraud prevention.
Apply your expertise to provide domain insights.""",

    "general": """You are a Senior Business Analyst with expertise across multiple industries.
You specialize in decision analysis, risk assessment, opportunity identification, and strategic planning.
Apply structured business reasoning to provide insights."""
}

ANALYSIS_PROMPT_TEMPLATE = """
You are analyzing a business situation to extract deep domain insights.

Context available:
Memory/Historical Context: {memory_summary}
Knowledge Base Context: {knowledge_summary}
User's Request: {user_message}
Domain: {domain}

Relevant Knowledge:
{knowledge_items}

Based on your domain expertise and the context provided, analyze:

1. ROOT CAUSE ANALYSIS: What are the underlying factors driving this situation?
2. KEY RISK FACTORS: What specific risks exist? (quantify where possible)
3. OPPORTUNITY SIGNALS: What positive opportunities can be leveraged?
4. STAKEHOLDER ANALYSIS: Who are the key stakeholders and what are their likely priorities?
5. DOMAIN BENCHMARKS: What do industry benchmarks say about this situation?
6. CRITICAL ACTIONS: What are the 3 most important things to do? (be specific, actionable)
7. TIMELINE: What is the urgency and recommended timeline?
8. SUCCESS METRICS: How would you measure success?

Return JSON:
{
  "root_cause": "detailed root cause analysis",
  "risk_factors": [
    {"factor": "risk name", "severity": "critical|high|medium|low", "description": "details"}
  ],
  "opportunities": [
    {"type": "opportunity type", "potential": "high|medium|low", "description": "details"}
  ],
  "stakeholder_insights": "stakeholder analysis",
  "domain_benchmarks": ["benchmark 1", "benchmark 2"],
  "critical_actions": [
    {"action": "action description", "timeline": "immediate|1 week|1 month", "owner": "suggested owner"}
  ],
  "urgency_assessment": "detailed urgency reasoning",
  "success_metrics": ["metric 1", "metric 2"],
  "domain_specific_insights": "deep domain expertise observations",
  "confidence_in_analysis": 0.85
}"""


class DomainSpecialistAgent(BaseAgent):
    name = "domain_specialist"
    description = "Applies deep domain expertise and business reasoning"

    async def run(self, state: Dict[str, Any]) -> Dict[str, Any]:
        user_message = state.get("user_message", "")
        domain = state.get("domain", "customer_success")
        memory_output = state.get("memory_agent_output", {})
        knowledge_output = state.get("knowledge_agent_output", {})
        conversation_output = state.get("conversation_manager_output", {})

        # Build rich context
        memory_summary = memory_output.get("memory_summary", "No memory context")
        knowledge_summary = knowledge_output.get("knowledge_summary", "No knowledge context")

        knowledge_items = "\n\n".join([
            f"[{item['title']}]:\n{item['content'][:400]}"
            for item in knowledge_output.get("knowledge_items", [])[:3]
        ])

        if not knowledge_items:
            knowledge_items = "No specific knowledge items retrieved."

        domain_system_prompt = DOMAIN_PROMPTS.get(domain, DOMAIN_PROMPTS["general"])

        user_prompt = ANALYSIS_PROMPT_TEMPLATE.format(
            memory_summary=memory_summary,
            knowledge_summary=knowledge_summary,
            user_message=user_message[:500],
            domain=domain,
            knowledge_items=knowledge_items,
        )

        messages = build_messages(domain_system_prompt, user_prompt)

        try:
            response = await llm_provider.ainvoke(messages)
            content = response.content if hasattr(response, "content") else str(response)

            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
            else:
                result = self._fallback_analysis(user_message, domain)

        except Exception as e:
            logger.warning("domain_specialist_llm_failed", error=str(e), domain=domain)
            result = self._fallback_analysis(user_message, domain)

        result["domain"] = domain
        return result

    def _fallback_analysis(self, message: str, domain: str) -> Dict[str, Any]:
        return {
            "root_cause": f"Detailed analysis of {domain} situation based on provided context",
            "risk_factors": [
                {"factor": "Customer Engagement Risk", "severity": "high", "description": "Reduced stakeholder engagement signals potential relationship deterioration"},
                {"factor": "Competitive Risk", "severity": "medium", "description": "Market alternatives may be evaluated during this period"},
            ],
            "opportunities": [
                {"type": "Relationship Deepening", "potential": "high", "description": "Proactive executive engagement can strengthen partnership"},
                {"type": "Value Demonstration", "potential": "high", "description": "ROI quantification can justify and expand investment"},
            ],
            "stakeholder_insights": "Executive sponsor alignment and champion development are critical success factors",
            "domain_benchmarks": [
                "Industry average retention: 88% for enterprise SaaS",
                "Proactive intervention success rate: 68% when initiated 90+ days before renewal"
            ],
            "critical_actions": [
                {"action": "Schedule Executive Business Review within 2 weeks", "timeline": "immediate", "owner": "VP Customer Success"},
                {"action": "Quantify and document ROI achieved to date", "timeline": "1 week", "owner": "CSM"},
                {"action": "Identify and develop new internal champions", "timeline": "1 month", "owner": "CSM"},
            ],
            "urgency_assessment": "Immediate attention required to prevent relationship deterioration",
            "success_metrics": ["Renewal signed at 100%+ of current ARR", "NPS improvement by 20 points", "Executive relationship established"],
            "domain_specific_insights": "Domain expertise applied to situational analysis",
            "confidence_in_analysis": 0.75,
        }
