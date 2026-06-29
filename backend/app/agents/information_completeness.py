"""
Information Completeness Agent
Determines required information and detects what's missing
"""
from typing import Dict, Any, List
from app.agents.base import BaseAgent
from app.core.llm import build_messages, llm_provider
from app.core.logging import logger
import json
import re


COMPLETENESS_PROMPT = """You are the Information Completeness Agent for DecisionOS.

Your job is to determine what information is REQUIRED to make a high-quality decision recommendation for the given request.

Domain-specific required information:

CUSTOMER SUCCESS:
- Required: CRM data (account health, ARR, contract), Usage metrics
- Important: Meeting transcripts, Customer communication, Renewal date
- Helpful: Playbooks, Stakeholder map, Support tickets

SALES:
- Required: CRM opportunity data, Company info
- Important: Meeting notes, Email threads, Budget/timeline
- Helpful: Competitor intel, Decision criteria, Stakeholder map

HEALTHCARE:
- Required: Patient/case data, Clinical notes
- Important: Medical history, Test results, Treatment protocols
- Helpful: Insurance info, Specialist notes

GENERAL:
- Required: Problem context, Historical data
- Important: Business rules, Stakeholder info
- Helpful: Benchmarks, Competitive data

Given the user's request and domain, determine:
1. What information is REQUIRED (block recommendation without it)
2. What information is IMPORTANT (significantly improve quality)
3. What information is AVAILABLE (from the message or uploaded docs)
4. What is MISSING
5. Can we proceed with minimum viable information?

Return JSON:
{
  "can_proceed": true/false,
  "minimum_satisfied": true/false,
  "checklist": [
    {
      "name": "CRM Data",
      "type": "crm",
      "status": "available|missing|partial",
      "required": true/false,
      "description": "Account health, ARR, contract details"
    }
  ],
  "available_count": 3,
  "missing_required": ["list of missing required items"],
  "missing_important": ["list of missing important items"],
  "user_prompt": "If information is missing, a friendly message to request it from user",
  "can_infer": ["list of things we can infer from context"],
  "information_quality": "high|medium|low"
}"""


DOMAIN_CHECKLISTS = {
    "customer_success": [
        {"name": "CRM Data", "type": "crm", "required": True, "description": "Account health, ARR, renewal date"},
        {"name": "Usage Metrics", "type": "usage", "required": True, "description": "Feature adoption, login frequency, active users"},
        {"name": "Meeting Transcript", "type": "transcript", "required": False, "description": "Recent customer calls or EBR notes"},
        {"name": "Contract Details", "type": "contract", "required": False, "description": "Contract value, terms, renewal date"},
        {"name": "Playbooks", "type": "playbook", "required": False, "description": "CSM playbooks and best practices"},
        {"name": "Support Tickets", "type": "support", "required": False, "description": "Open issues and ticket history"},
        {"name": "Email History", "type": "email", "required": False, "description": "Recent customer communications"},
    ],
    "sales": [
        {"name": "Opportunity Data", "type": "crm", "required": True, "description": "Deal stage, ARR, close date"},
        {"name": "Account Info", "type": "account", "required": True, "description": "Company size, industry, stakeholders"},
        {"name": "Meeting Notes", "type": "transcript", "required": False, "description": "Discovery and demo notes"},
        {"name": "Proposal/Quote", "type": "proposal", "required": False, "description": "Current proposal details"},
        {"name": "Competitor Intel", "type": "competitor", "required": False, "description": "Competitive positioning"},
        {"name": "Sales Playbook", "type": "playbook", "required": False, "description": "Sales methodology and plays"},
    ],
    "healthcare": [
        {"name": "Patient/Case Data", "type": "case", "required": True, "description": "Patient demographics and case summary"},
        {"name": "Clinical Notes", "type": "clinical", "required": True, "description": "Clinical assessment and notes"},
        {"name": "Medical History", "type": "history", "required": False, "description": "Relevant medical history"},
        {"name": "Lab Results", "type": "lab", "required": False, "description": "Recent test results"},
        {"name": "Treatment Protocol", "type": "protocol", "required": False, "description": "Standard care protocols"},
    ],
    "general": [
        {"name": "Problem Context", "type": "context", "required": True, "description": "Detailed problem description"},
        {"name": "Historical Data", "type": "historical", "required": False, "description": "Past decisions and outcomes"},
        {"name": "Business Rules", "type": "rules", "required": False, "description": "Relevant policies and constraints"},
        {"name": "Stakeholder Info", "type": "stakeholders", "required": False, "description": "Key decision makers"},
    ]
}


class InformationCompletenessAgent(BaseAgent):
    name = "information_completeness"
    description = "Determines required information and identifies gaps"

    async def run(self, state: Dict[str, Any]) -> Dict[str, Any]:
        user_message = state.get("user_message", "")
        domain = state.get("domain", "customer_success")
        uploaded_docs = state.get("uploaded_documents", [])
        conversation_context = state.get("conversation_manager_output", {})

        # Get domain checklist
        checklist_template = DOMAIN_CHECKLISTS.get(domain, DOMAIN_CHECKLISTS["general"])

        # Determine status of each item based on uploaded docs and message
        doc_types = {doc.get("doc_type", "").lower() for doc in uploaded_docs}
        message_lower = user_message.lower()

        checklist = []
        available_count = 0
        missing_required = []
        missing_important = []

        for item in checklist_template:
            status = "missing"

            # Check if document was uploaded
            if item["type"] in doc_types:
                status = "available"
            # Check if info seems to be in the message text
            elif any(keyword in message_lower for keyword in self._get_keywords(item["type"])):
                status = "partial"

            if status in ("available", "partial"):
                available_count += 1
            elif item["required"]:
                missing_required.append(item["name"])
            else:
                missing_important.append(item["name"])

            checklist.append({
                **item,
                "status": status
            })

        can_proceed = len(missing_required) == 0 or len(uploaded_docs) > 0 or available_count >= 1
        minimum_satisfied = available_count >= 1

        # Build user prompt for missing info
        user_prompt = ""
        if not can_proceed and missing_required:
            user_prompt = (
                f"To provide a high-quality recommendation, I need a few more details. "
                f"Could you share: {', '.join(missing_required[:2])}? "
                f"You can upload documents or paste the information directly."
            )

        # Information quality
        total = len(checklist_template)
        ratio = available_count / total if total > 0 else 0
        if ratio >= 0.6:
            quality = "high"
        elif ratio >= 0.3:
            quality = "medium"
        else:
            quality = "low"

        return {
            "can_proceed": can_proceed,
            "minimum_satisfied": minimum_satisfied,
            "checklist": checklist,
            "available_count": available_count,
            "total_count": total,
            "missing_required": missing_required,
            "missing_important": missing_important,
            "user_prompt": user_prompt,
            "can_infer": self._get_inferable_context(user_message, domain),
            "information_quality": quality,
        }

    def _get_keywords(self, doc_type: str) -> List[str]:
        keyword_map = {
            "crm": ["arr", "renewal", "contract value", "account health", "mrr", "customer since"],
            "usage": ["usage", "adoption", "active users", "logins", "features used", "dau", "mau"],
            "transcript": ["meeting", "call", "discussed", "conversation", "transcript", "notes"],
            "contract": ["contract", "agreement", "renewal date", "terms", "sla", "signed"],
            "playbook": ["playbook", "process", "methodology", "best practice", "framework"],
            "email": ["email", "wrote", "replied", "communication", "message"],
            "support": ["ticket", "issue", "bug", "complaint", "support case"],
        }
        return keyword_map.get(doc_type, [])

    def _get_inferable_context(self, message: str, domain: str) -> List[str]:
        inferred = []
        msg_lower = message.lower()

        if any(w in msg_lower for w in ["churn", "at risk", "worried", "concern"]):
            inferred.append("Risk signal detected from message context")
        if any(w in msg_lower for w in ["upsell", "expand", "grow", "opportunity"]):
            inferred.append("Opportunity signal detected from message context")
        if any(w in msg_lower for w in ["renew", "renewal", "contract end"]):
            inferred.append("Renewal context inferred from message")

        return inferred
