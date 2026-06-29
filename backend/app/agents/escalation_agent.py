"""
Escalation Agent — Transitions status from PENDING_APPROVAL → ESCALATED.
Assigns review ownership to VP Customer Success.
"""
from typing import Dict, Any
from app.agents.base import BaseAgent
from app.services.conversation_service import conversation_store
from app.core.logging import logger
from datetime import datetime, timezone


class EscalationAgent(BaseAgent):
    name = "escalation_agent"
    description = "Handles recommendation escalation to executives"

    async def run(self, state: Dict[str, Any]) -> Dict[str, Any]:
        conversation_id = state.get("conversation_id")
        rec = state.get("recommendation", {})
        comment = state.get("comment", "Escalated to VP Customer Success")

        if not rec:
            rec = conversation_store.get_latest_recommendation(conversation_id)

        if not rec:
            return {
                "success": False,
                "error": "No recommendation found for escalation",
                "status": "error"
            }

        rec_id = rec.get("id")
        nba_id = rec.get("recommendation_id")
        current_status = rec.get("approval_status", rec.get("lifecycle_status", "pending"))

        now = datetime.now(timezone.utc).isoformat()
        escalation_record = {
            "action": "escalate",
            "timestamp": now,
            "comment": comment,
            "status": "escalated",
            "assigned_to": "VP Customer Success"
        }

        updated_rec = conversation_store.update_recommendation_approval(rec_id, escalation_record)
        if updated_rec:
            updated_rec["status"] = "ESCALATED"
            updated_rec["approval_status"] = "escalated"
            updated_rec["lifecycle_status"] = "escalated"
            updated_rec["planner_state"] = "ESCALATED"
            updated_rec["owner"] = "VP Customer Success"
            updated_rec["priority"] = "critical"
            history = updated_rec.get("approvalHistory", [])
            history.append(escalation_record)
            updated_rec["approvalHistory"] = history

        logger.info(
            "escalation_agent_transition",
            recommendation_id=nba_id,
            previous_status=current_status,
            new_status="escalated",
            assigned_to="VP Customer Success"
        )

        return {
            "success": True,
            "recommendation_id": nba_id,
            "previous_status": current_status,
            "new_status": "escalated",
            "assigned_to": "VP Customer Success",
            "priority": "HIGH",
            "updated_recommendation": updated_rec
        }
