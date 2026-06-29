"""
Approval Agent — Phase 8 (Human Approval)
Transitions a recommendation from PENDING_APPROVAL → APPROVED.
"""
from typing import Dict, Any
from app.agents.base import BaseAgent
from app.services.conversation_service import conversation_store
from app.core.logging import logger
from datetime import datetime, timezone


class ApprovalAgent(BaseAgent):
    name = "approval_agent"
    description = "Handles recommendation approval transition"

    async def run(self, state: Dict[str, Any]) -> Dict[str, Any]:
        conversation_id = state.get("conversation_id")
        rec = state.get("recommendation", {})
        comment = state.get("comment", "Approved by human user")

        if not rec:
            # Try to retrieve from conversation store
            rec = conversation_store.get_latest_recommendation(conversation_id)

        if not rec:
            return {
                "success": False,
                "error": "No pending recommendation found",
                "status": "error"
            }

        rec_id = rec.get("id")
        nba_id = rec.get("recommendation_id")
        current_status = rec.get("approval_status", rec.get("lifecycle_status", "pending"))

        if current_status in ("approved", "executing", "monitoring", "completed"):
            return {
                "success": True,
                "recommendation_id": nba_id,
                "previous_status": current_status,
                "new_status": current_status,
                "message": "Recommendation already approved",
                "planner_state": "EXECUTING"
            }

        # Update in conversation store
        now = datetime.now(timezone.utc).isoformat()
        approval_record = {
            "action": "approve",
            "timestamp": now,
            "comment": comment,
            "status": "approved",
            "execution_status": "active"
        }

        # Save to store
        updated_rec = conversation_store.update_recommendation_approval(rec_id, approval_record)
        if updated_rec:
            updated_rec["approved_at"] = now
            updated_rec["status"] = "APPROVED"
            updated_rec["approval_status"] = "approved"
            updated_rec["lifecycle_status"] = "approved"
            updated_rec["planner_state"] = "EXECUTING"
            # Append approval history
            history = updated_rec.get("approvalHistory", [])
            history.append(approval_record)
            updated_rec["approvalHistory"] = history

        logger.info(
            "approval_agent_transition",
            recommendation_id=nba_id,
            previous_status=current_status,
            new_status="approved",
            comment=comment
        )

        return {
            "success": True,
            "recommendation_id": nba_id,
            "previous_status": current_status,
            "new_status": "approved",
            "planner_state": "EXECUTING",
            "updated_recommendation": updated_rec
        }
