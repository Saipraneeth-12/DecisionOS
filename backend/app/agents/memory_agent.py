"""
Memory Agent - Retrieves relevant organizational and episodic memory
"""
from typing import Dict, Any, List
from app.agents.base import BaseAgent
from app.memory.memory_manager import memory_manager
from app.core.logging import logger


class MemoryAgent(BaseAgent):
    name = "memory_agent"
    description = "Retrieves relevant past decisions, outcomes, and similar cases from organizational memory"

    async def run(self, state: Dict[str, Any]) -> Dict[str, Any]:
        user_message = state.get("user_message", "")
        conversation_id = state.get("conversation_id")
        conversation_output = state.get("conversation_manager_output", {})
        domain = state.get("domain", "customer_success")

        # Build rich search query
        entities = conversation_output.get("entities", {})
        customers = entities.get("customers", [])
        topics = entities.get("topics", [])
        intent = conversation_output.get("intent", "")

        query_parts = [user_message[:200], intent]
        query_parts.extend(customers[:3])
        query_parts.extend(topics[:3])
        query = " ".join(filter(None, query_parts))

        # Retrieve relevant memories
        memories = memory_manager.retrieve_relevant_memory(
            query=query,
            conversation_id=str(conversation_id) if conversation_id else None,
            top_k=6
        )

        # Separate by type
        org_memories = [m for m in memories if m["type"] == "organizational"]
        episodic_memories = [m for m in memories if m["type"] == "episodic"]
        session_memories = [m for m in memories if m["type"] == "session"]

        # Get similar historical cases
        signals = entities.get("topics", []) + [conversation_output.get("urgency", "medium")]
        similar_cases = memory_manager.get_historical_similar_cases(domain, signals)

        # Get business rules and playbooks
        playbooks = [m for m in org_memories if m.get("metadata", {}).get("type") in ("playbook", "business_rule")]
        past_outcomes = [m for m in org_memories if m.get("metadata", {}).get("outcome")]

        # Session context
        session_ctx = memory_manager.get_session_context(str(conversation_id) if conversation_id else "")

        logger.info(
            "memory_retrieval_complete",
            total=len(memories),
            org=len(org_memories),
            episodic=len(episodic_memories),
            similar_cases=len(similar_cases)
        )

        return {
            "total_retrieved": len(memories),
            "organizational_memories": org_memories[:4],
            "episodic_memories": episodic_memories[:3],
            "session_context": session_ctx[-3:] if session_ctx else [],
            "similar_cases": similar_cases,
            "playbooks": playbooks,
            "past_outcomes": past_outcomes[:3],
            "memory_summary": self._build_summary(memories, similar_cases),
        }

    def _build_summary(self, memories: List[Dict], similar_cases: List[Dict]) -> str:
        parts = []
        if memories:
            parts.append(f"Retrieved {len(memories)} relevant memory entries.")
        if similar_cases:
            success = sum(1 for c in similar_cases if c.get("outcome") == "success")
            parts.append(f"Found {len(similar_cases)} similar historical cases ({success} successful outcomes).")
        return " ".join(parts) if parts else "No relevant memory found."
