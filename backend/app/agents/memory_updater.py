"""
Memory Updater Agent — Phase 11 (Memory Updates)
Saves the final recommendation lifecycle updates, execution states,
and outcomes into long-term organizational memory.
"""
from typing import Dict, Any
from app.agents.base import BaseAgent
from app.memory.memory_manager import memory_manager
from app.core.logging import logger


class MemoryUpdater(BaseAgent):
    name = "memory_updater"
    description = "Saves approved decision lifecycle outcomes and execution milestones to memory"

    async def run(self, state: Dict[str, Any]) -> Dict[str, Any]:
        rec = state.get("recommendation", {})
        conversation_id = state.get("conversation_id")

        if not rec:
            return {"success": False, "message": "No recommendation context to update memory"}

        nba_id = rec.get("recommendation_id", "NBA-")
        title = rec.get("title", "")
        playbook = rec.get("selected_playbook", "")
        status = rec.get("approval_status", "pending")
        version = rec.get("version", "1.0")

        # Save to memory manager
        content = (
            f"Decision OS Lifecycle Event: Approved Recommendation '{title}' ({nba_id}) "
            f"under playbook '{playbook}'. Status: {status.upper()}. Version: {version}. "
            f"Confidence: {int((rec.get('confidence_score') or 0)*100)}%. "
            f"Execution Status: {rec.get('execution_status', 'active')}."
        )

        memory_manager.store_organizational_memory(
            content=content,
            entity_type="recommendation_lifecycle",
            entity_id=nba_id,
            importance=0.9,
            metadata={
                "conversation_id": conversation_id,
                "playbook": playbook,
                "status": status,
                "version": version,
                "confidence": rec.get("confidence_score")
            }
        )

        logger.info(
            "memory_updater_complete",
            recommendation_id=nba_id,
            playbook=playbook,
            status=status,
            version=version
        )

        return {
            "success": True,
            "recommendation_id": nba_id,
            "memory_updated": True,
            "memory_status": "UPDATED"
        }
