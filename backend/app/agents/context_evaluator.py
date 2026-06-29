"""
Context Evaluator Agent — Context Sufficiency Framework v2.

Key fixes in V2:
  - Field-by-field scoring (+10 Customer, +10 ARR, +15 Usage, etc.)
  - Only surfaces truly missing fields
  - Detects "continue" intent → routes to ProgressCheckAgent (HITL)
  - HITL commands always detected first
  - No more hardcoded 5% for rich inputs
"""
import re
from typing import Dict, Any, List, Optional
from app.agents.base import BaseAgent
from app.core.logging import logger

# ── Greeting / social phrases ────────────────────────────────────────────
GREETING_PATTERNS = {
    r"^(hi|hello|hey|howdy|hiya|yo|sup|whats up|what's up|greetings|good morning|good afternoon|good evening|gm|gn|morning|evening)\W*$",
    r"^(thanks?|thank you|ty|thx|cheers|ok|okay|k|sure|cool|great|awesome|sounds good)\W*$",
    r"^(how are you|how r u|how are things|how's it going|what's new|how do you do)\W*$",
    r"^[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF\s]+$",  # emoji only
    r"^[^a-zA-Z0-9]*$",  # no alphanumeric content
}

# ── HITL command patterns ─────────────────────────────────────────────────
HITL_COMMANDS = {
    "approve": [
        r"\bapprove\b",
        r"\baccept\b.{0,20}\b(rec|recommendation|nba|plan|action)\b",
        r"\b(go ahead|proceed|greenlight|green.?light|sign.?off|looks good)\b",
        r"\bconfirm\b.{0,20}\b(rec|recommendation|action|plan)\b",
        r"\b(yes|yep|yeah|absolutely),?\s*(approve|proceed|go ahead|do it)\b",
    ],
    "reject": [
        r"\breject\b",
        r"\bdecline\b.{0,20}\b(rec|recommendation|nba|plan|action)\b",
        r"\b(don'?t proceed|cancel|not approved|won'?t approve)\b",
        r"\b(no|nope),?\s*(reject|decline|cancel|don'?t)\b",
    ],
    "modify": [
        r"\b(modify|revise)\b.{0,30}\b(rec|recommendation|nba|plan|action)\b",
        r"\bmodify\b",
        r"\b(change|update|adjust|alter|tweak)\b.{0,20}\b(recommendation|nba|plan)\b",
    ],
    "escalate": [
        r"\bescalate\b",
        r"\b(flag|raise|urgent)\b.{0,20}\b(rec|recommendation|issue|situation)\b",
    ],
    "need_info": [
        r"\bneed\s+(more|additional|extra|further)\s*(info|information|context|detail|data)\b",
        r"\bmore\s+(info|information|context|detail)\b",
        r"\b(what is|what's)\s+(missing|needed|required)\b",
    ],
    "status": [
        r"\bstatus\b.{0,30}\b(recommendation|nba|approval|execution|plan)\b",
        r"\b(check|get|what is|what'?s)\s+(the\s+)?(status|progress)\b",
        r"\bwhere\s+(is|are)\b.{0,20}\b(recommendation|plan|approval)\b",
        r"\b(current status|latest status)\b",
    ],
    # NEW — "continue" triggers ProgressCheckAgent
    "continue": [
        r"\b(continue|resume|pick up where|continue (the|this|our|my)|carry on)\b.{0,30}(analysis|session|recommendation|strategy|plan)?\b",
        r"\bwhat('s| is) (the )?next\b.{0,20}(step|action)\b",
        r"\bstart new analysis\b",
    ],
}

# ── Field-score table (V2: explicit per-field scoring) ────────────────────
# Each tuple: (keywords_to_detect, score_contribution, field_label)
FIELD_SCORES = [
    # Core business identifiers
    (["customer", "client", "company", "account", "acme", "corp", "inc", "ltd"], 10, "Customer/Account"),
    (["arr", "mrr", "revenue", "contract value", "$", "k arr", "m arr"], 10, "ARR/Revenue"),
    (["renewal", "renewal date", "contract end", "expiry", "expires"], 10, "Renewal Date"),
    # Usage & health
    (["usage", "adoption", "active users", "login", "dau", "mau", "seats", "utilization"], 15, "Usage Metrics"),
    # Support & satisfaction
    (["ticket", "support", "csat", "nps", "satisfaction", "complaint", "issue", "bug"], 10, "Support/Satisfaction"),
    # Stakeholders
    (["stakeholder", "champion", "sponsor", "executive sponsor", "vp", "ceo", "cfo", "cto", "decision maker"], 10, "Sponsor/Champion"),
    # Feedback
    (["feedback", "sentiment", "review", "comment", "response", "note", "meeting", "call"], 10, "Feedback/Notes"),
    # Objective / intent
    (["objective", "goal", "target", "kpi", "outcome", "success criteria", "want to", "trying to", "need to"], 10, "Objective"),
    # Integrations / tech
    (["integration", "api", "connector", "system", "tool", "software", "stack", "crm", "salesforce", "hubspot"], 5, "Integrations/Tech"),
    # Financial context
    (["budget", "spend", "cost", "investment", "roi", "procurement", "purchase"], 5, "Budget Context"),
    # Timeline
    (["timeline", "deadline", "quarter", "q1", "q2", "q3", "q4", "fy", "this month", "next month", "days"], 5, "Timeline"),
]

# Optional enhancement fields (surfaced when core is complete)
OPTIONAL_FIELDS = [
    "Procurement Process",
    "Budget Details",
    "Stakeholder Map",
    "Decision Committee",
    "Champion Network",
]


class ContextEvaluator(BaseAgent):
    """
    Evaluates context sufficiency before routing to the full agent pipeline.

    V2 Changes:
    - Field-by-field scoring (explicit +10, +15 per field)
    - Properly detects rich inputs (90% for 9 fields provided)
    - 'continue' HITL intent routes to ProgressCheckAgent
    - Missing fields only surfaced when truly absent

    Routing priority:
      1. HITL_FLOW      — approve/reject/modify/escalate/status/continue commands
      2. GREETING_FLOW  — social greetings
      3. CONTEXT_REQUEST — insufficient context
      4. PARTIAL_PIPELINE — partial context
      5. FULL_PIPELINE  — rich business context
    """

    name = "context_evaluator"
    description = "Classifies input quality and routes to appropriate pipeline"

    async def run(self, state: Dict[str, Any]) -> Dict[str, Any]:
        user_message: str = state.get("user_message", "")
        uploaded_docs: List[Dict] = state.get("uploaded_documents", [])
        conversation_history: List[Dict] = state.get("conversation_history", [])

        msg = user_message.strip()
        msg_lower = msg.lower()

        # ── 0. HITL detection — HIGHEST priority ──────────────────────────
        hitl_intent = self._detect_hitl_command(msg_lower)
        if hitl_intent:
            action = hitl_intent["action"]
            logger.info("context_evaluator_hitl", action=action, message=msg[:60])

            # "continue" is a special HITL that re-engages the planner
            routing = "HITL_FLOW"

            return {
                "context_score": 100,
                "context_class": "HITL",
                "is_greeting": False,
                "can_run_full_pipeline": True,
                "can_run_risk_agents": True,
                "can_run_recommendation": True,
                "greeting_response": None,
                "missing_for_recommendation": [],
                "routing": routing,
                "hitl_intent": hitl_intent,
                "signal_hits": 0,
                "entity_hits": 0,
                "field_scores": {},
                "provided_fields": [],
                "missing_fields": [],
            }

        # ── 1. Greeting detection ────────────────────────────────────────
        is_greeting = self._is_greeting(msg_lower)
        if is_greeting:
            logger.info("context_evaluator", result="GREETING", message=msg[:40])
            return {
                "context_score": 5,
                "context_class": "INSUFFICIENT",
                "is_greeting": True,
                "can_run_full_pipeline": False,
                "can_run_risk_agents": False,
                "can_run_recommendation": False,
                "greeting_response": self._build_greeting_response(),
                "missing_for_recommendation": [
                    "Customer or account context",
                    "Business metrics (ARR, usage, NPS)",
                    "Decision question or challenge",
                    "Domain-specific data",
                ],
                "routing": "GREETING_FLOW",
                "field_scores": {},
                "provided_fields": [],
                "missing_fields": ["Customer/Account", "ARR/Revenue", "Usage Metrics", "Objective"],
            }

        # ── 2. Field-by-field scoring (V2) ──────────────────────────────
        # Build a combined text from message + conversation history
        history_text = " ".join(
            m.get("content", "")
            for m in conversation_history[-6:]
        ).lower()
        combined_text = msg_lower + " " + history_text

        field_score_breakdown: Dict[str, int] = {}
        provided_fields: List[str] = []
        missing_fields: List[str] = []

        total_field_score = 0
        for keywords, score, label in FIELD_SCORES:
            if any(kw in combined_text for kw in keywords):
                field_score_breakdown[label] = score
                provided_fields.append(label)
                total_field_score += score
            else:
                missing_fields.append(label)

        # Bonus for uploaded documents
        doc_bonus = min(len(uploaded_docs) * 8, 15)
        if uploaded_docs:
            field_score_breakdown["Uploaded Documents"] = doc_bonus
            total_field_score += doc_bonus
            provided_fields.append(f"Uploaded Documents ({len(uploaded_docs)})")

        # Cap at 100
        score = min(total_field_score, 100)

        # ── 3. Classification ────────────────────────────────────────────
        if score < 20:       ctx_class = "INSUFFICIENT"
        elif score < 50:     ctx_class = "PARTIAL"
        elif score < 80:     ctx_class = "BUSINESS"
        else:                ctx_class = "RICH"

        can_full      = ctx_class in ("BUSINESS", "RICH")
        can_risk      = score >= 30
        can_recommend = score >= 40

        # Only surface fields that are genuinely missing (not provided)
        # For RICH inputs — only surface optional enhancements
        if ctx_class == "RICH":
            truly_missing = OPTIONAL_FIELDS  # Only nice-to-haves
        else:
            # Surface core missing fields — but not already provided ones
            truly_missing = [f for f in missing_fields if f in [
                "Customer/Account", "ARR/Revenue", "Renewal Date",
                "Usage Metrics", "Objective",
            ]]

        routing = "FULL_PIPELINE" if can_full else (
            "PARTIAL_PIPELINE" if can_risk else "CONTEXT_REQUEST"
        )

        logger.info(
            "context_evaluator_v2",
            score=score,
            cls=ctx_class,
            routing=routing,
            provided_count=len(provided_fields),
            missing_count=len(truly_missing),
            msg_preview=msg[:60],
        )

        return {
            "context_score":   score,
            "context_class":   ctx_class,
            "is_greeting":     False,
            "can_run_full_pipeline":  can_full,
            "can_run_risk_agents":    can_risk,
            "can_run_recommendation": can_recommend,
            "greeting_response": None,
            "missing_for_recommendation": truly_missing,
            "routing": routing,
            "field_scores": field_score_breakdown,
            "provided_fields": provided_fields,
            "missing_fields": truly_missing,
            "signal_hits": len(provided_fields),
            "entity_hits": len(provided_fields),
        }

    def _detect_hitl_command(self, msg_lower: str) -> Optional[Dict[str, Any]]:
        """Detect lifecycle commands. Returns hitl_intent dict or None."""
        for action, patterns in HITL_COMMANDS.items():
            for pattern in patterns:
                if re.search(pattern, msg_lower, re.IGNORECASE):
                    modifier = None
                    comment_match = re.search(
                        r"(?:with comment|note|reason|because|since)[:\s]+(.+)", msg_lower
                    )
                    if comment_match:
                        modifier = comment_match.group(1).strip()
                    return {
                        "action": action,
                        "raw_command": msg_lower[:100],
                        "modifier": modifier,
                    }
        return None

    def _is_greeting(self, msg_lower: str) -> bool:
        for pattern in GREETING_PATTERNS:
            if re.match(pattern, msg_lower.strip()):
                return True
        return False

    def _build_greeting_response(self) -> str:
        return (
            "Hi 👋 I'm **DecisionOS** — your enterprise decision intelligence platform.\n\n"
            "I help teams identify risks, opportunities, and recommend next best actions "
            "backed by evidence, memory, and explainable AI.\n\n"
            "**To get started, you can:**\n"
            "- 📊 Describe a customer situation or business challenge\n"
            "- 📄 Upload meeting transcripts, CRM exports, or playbooks\n"
            "- 📋 Paste email threads or customer notes\n"
            "- 💬 Share deal updates or renewal concerns\n\n"
            "Once I have enough context, I'll analyze risks, identify opportunities, "
            "and generate an explainable Next Best Action recommendation.\n\n"
            "*What decision are you working on today?*"
        )
