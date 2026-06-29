"""
Modification Agent — Phase 8 (Human Approval - Modification)
User: "modify recommendation ... only include integration strategy"
Transitions recommendation status to MODIFIED, increments version,
and archives the previous version.
"""
from typing import Dict, Any
from app.agents.base import BaseAgent
from app.services.conversation_service import conversation_store
from app.core.logging import logger
from datetime import datetime, timezone


class ModificationAgent(BaseAgent):
    name = "modification_agent"
    description = "Handles recommendation modification, archiving old version and initiating version increments"

    async def run(self, state: Dict[str, Any]) -> Dict[str, Any]:
        conversation_id = state.get("conversation_id")
        rec = state.get("recommendation", {})
        comment = state.get("comment", "Modified by human user")

        if not rec:
            rec = conversation_store.get_latest_recommendation(conversation_id)

        if not rec:
            return {
                "success": False,
                "error": "No recommendation found for modification",
                "status": "error"
            }

        rec_id = rec.get("id")
        nba_id = rec.get("recommendation_id")
        current_status = rec.get("approval_status", rec.get("lifecycle_status", "pending"))
        current_version = rec.get("version", "1.0")

        try:
            v_num = float(current_version)
            new_version = f"{v_num + 0.1:.1f}"
        except ValueError:
            new_version = "1.1"

        now = datetime.now(timezone.utc).isoformat()
        modification_record = {
            "action": "modify",
            "timestamp": now,
            "comment": comment,
            "status": "modified",
            "previous_version": current_version,
            "new_version": new_version
        }

        updated_rec = conversation_store.update_recommendation_approval(rec_id, modification_record)
        if updated_rec:
            updated_rec["status"] = "PENDING_APPROVAL"
            updated_rec["approval_status"] = "pending"
            updated_rec["lifecycle_status"] = "pending"
            updated_rec["version"] = new_version
            updated_rec["previous_recommendation_archived"] = True
            history = updated_rec.get("approvalHistory", [])
            history.append(modification_record)
            updated_rec["approvalHistory"] = history

        logger.info(
            "modification_agent_transition",
            recommendation_id=nba_id,
            previous_status=current_status,
            previous_version=current_version,
            new_version=new_version,
            instructions=comment
        )

        return {
            "success": True,
            "recommendation_id": nba_id,
            "previous_status": current_status,
            "new_status": "pending",
            "previous_version": current_version,
            "new_version": new_version,
            "changes_summary": comment,
            "updated_recommendation": updated_rec
        }
