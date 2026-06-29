"""
Rejection Agent — Handles transitions from PENDING_APPROVAL → REJECTED.
Logs reason and initiates replanning state.
"""
from typing import Dict, Any
from app.agents.base import BaseAgent
from app.services.conversation_service import conversation_store
from app.core.logging import logger
from datetime import datetime, timezone


class RejectionAgent(BaseAgent):
    name = "rejection_agent"
    description = "Handles recommendation rejection transition and replanning triggers"

    async def run(self, state: Dict[str, Any]) -> Dict[str, Any]:
        conversation_id = state.get("conversation_id")
        rec = state.get("recommendation", {})
        comment = state.get("comment", "Rejected by human user")

        if not rec:
            rec = conversation_store.get_latest_recommendation(conversation_id)

        if not rec:
            return {
                "success": False,
                "error": "No recommendation found for rejection",
                "status": "error"
            }

        rec_id = rec.get("id")
        nba_id = rec.get("recommendation_id")
        current_status = rec.get("approval_status", rec.get("lifecycle_status", "pending"))

        now = datetime.now(timezone.utc).isoformat()
        rejection_record = {
            "action": "reject",
            "timestamp": now,
            "comment": comment,
            "status": "rejected"
        }

        updated_rec = conversation_store.update_recommendation_approval(rec_id, rejection_record)
        if updated_rec:
            updated_rec["status"] = "REJECTED"
            updated_rec["approval_status"] = "rejected"
            updated_rec["lifecycle_status"] = "rejected"
            updated_rec["planner_state"] = "REPLANNING_TRIGGERED"
            history = updated_rec.get("approvalHistory", [])
            history.append(rejection_record)
            updated_rec["approvalHistory"] = history

        logger.info(
            "rejection_agent_transition",
            recommendation_id=nba_id,
            previous_status=current_status,
            new_status="rejected",
            reason=comment
        )

        return {
            "success": True,
            "recommendation_id": nba_id,
            "previous_status": current_status,
            "new_status": "rejected",
            "reason": comment,
            "planner_state": "REPLANNING",
            "generate_alternative": True,
            "updated_recommendation": updated_rec
        }
