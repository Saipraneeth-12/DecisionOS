"""
Memory Manager - Hierarchical memory system for DecisionOS
Layers: Session → Conversation → Episodic → Organizational
"""
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import json
import hashlib
from app.core.logging import logger


class MemoryEntry:
    def __init__(
        self,
        content: str,
        memory_type: str,
        entity_type: Optional[str] = None,
        entity_id: Optional[str] = None,
        importance: float = 0.5,
        metadata: Dict = None,
    ):
        self.id = hashlib.md5(f"{content}{datetime.now().isoformat()}".encode()).hexdigest()
        self.content = content
        self.memory_type = memory_type
        self.entity_type = entity_type
        self.entity_id = entity_id
        self.importance = importance
        self.metadata = metadata or {}
        self.created_at = datetime.now(timezone.utc).isoformat()


class MemoryManager:
    """
    Hierarchical memory system with semantic retrieval.
    
    Memory Types:
    - session: Current conversation context (in-memory)
    - conversation: Cross-turn summaries (persisted)
    - episodic: Past recommendations/outcomes (persisted)
    - organizational: Company-wide knowledge patterns (persisted)
    """

    def __init__(self):
        # In-memory session storage
        self._session_memory: Dict[str, List[MemoryEntry]] = {}
        # Organizational memory cache
        self._org_memory: List[MemoryEntry] = []
        # Initialized with demo data
        self._load_demo_memory()

    def _load_demo_memory(self):
        """Load demo organizational memory for hackathon demo."""
        demo_entries = [
            MemoryEntry(
                content="Acme Corp showed churn signals 3 months before renewal. Proactive EBR and executive sponsor engagement reversed the churn. Contract renewed at 15% expansion.",
                memory_type="organizational",
                entity_type="customer",
                entity_id="acme_corp",
                importance=0.9,
                metadata={
                    "outcome": "success",
                    "action_taken": "Executive Business Review + Champion re-engagement",
                    "result": "Renewed + 15% expansion",
                    "signals": ["low usage", "support tickets", "champion left"],
                    "date": "2025-03-15"
                }
            ),
            MemoryEntry(
                content="TechStart Inc had similar usage decline pattern. Dedicated CSM engagement and new use case training led to adoption recovery in 6 weeks.",
                memory_type="organizational",
                entity_type="customer",
                entity_id="techstart_inc",
                importance=0.85,
                metadata={
                    "outcome": "success",
                    "action_taken": "Adoption workshop + new use case enablement",
                    "result": "Usage increased 40%",
                    "signals": ["low login rate", "single team adoption"],
                    "date": "2025-01-20"
                }
            ),
            MemoryEntry(
                content="GlobalBank renewal was lost due to delayed engagement. Champion left, no executive relationship, competitor entered 90 days before renewal. Loss of $450K ARR.",
                memory_type="organizational",
                entity_type="customer",
                entity_id="globalbank",
                importance=0.95,
                metadata={
                    "outcome": "churn",
                    "action_taken": "Too late - reactive only",
                    "result": "Churned - $450K lost",
                    "signals": ["champion departure", "no exec sponsor", "competitor evaluation"],
                    "date": "2024-11-10"
                }
            ),
            MemoryEntry(
                content="Playbook: High-churn-risk accounts require immediate EBR within 30 days. Engage C-suite, quantify ROI achieved, present roadmap. Success rate: 72%.",
                memory_type="organizational",
                entity_type="playbook",
                entity_id="churn_risk_playbook",
                importance=0.95,
                metadata={"type": "playbook", "domain": "customer_success", "success_rate": 0.72}
            ),
            MemoryEntry(
                content="Business Rule: Accounts with NPS < 6 AND usage decline > 30% are classified as critical churn risk. Requires VP-level escalation within 48 hours.",
                memory_type="organizational",
                entity_type="business_rule",
                entity_id="churn_classification_rule",
                importance=1.0,
                metadata={"type": "business_rule", "domain": "customer_success"}
            ),
            MemoryEntry(
                content="Upsell pattern: Customers using 3+ modules with high adoption (>70% active users) are strong expansion candidates. Average expansion: 23% ARR.",
                memory_type="organizational",
                entity_type="playbook",
                entity_id="upsell_playbook",
                importance=0.8,
                metadata={"type": "playbook", "domain": "sales", "avg_expansion": "23%"}
            ),
            MemoryEntry(
                content="DataFlow Systems successfully identified as upsell opportunity. Analytics module demo led to $180K new ARR within 60 days.",
                memory_type="episodic",
                entity_type="customer",
                entity_id="dataflow_systems",
                importance=0.8,
                metadata={
                    "outcome": "success",
                    "action_taken": "Analytics module demo + POC",
                    "result": "$180K expansion",
                    "date": "2025-05-01"
                }
            ),
            MemoryEntry(
                content="Healthcare domain: HIPAA compliance reviews often trigger procurement delays. Proactive security questionnaire and compliance docs reduce delays by 60%.",
                memory_type="organizational",
                entity_type="domain_insight",
                entity_id="healthcare_compliance",
                importance=0.85,
                metadata={"domain": "healthcare", "type": "domain_insight"}
            ),
        ]
        self._org_memory = demo_entries

    def store_session_memory(self, conversation_id: str, content: str, metadata: Dict = None):
        """Store memory for current session."""
        if conversation_id not in self._session_memory:
            self._session_memory[conversation_id] = []

        entry = MemoryEntry(
            content=content,
            memory_type="session",
            metadata=metadata or {},
        )
        self._session_memory[conversation_id].append(entry)

        # Keep last 20 session memories
        if len(self._session_memory[conversation_id]) > 20:
            self._session_memory[conversation_id] = self._session_memory[conversation_id][-20:]

    def store_organizational_memory(
        self,
        content: str,
        entity_type: str = None,
        entity_id: str = None,
        importance: float = 0.7,
        metadata: Dict = None,
    ):
        """Store organizational/long-term memory."""
        entry = MemoryEntry(
            content=content,
            memory_type="organizational",
            entity_type=entity_type,
            entity_id=entity_id,
            importance=importance,
            metadata=metadata or {},
        )
        self._org_memory.append(entry)
        logger.info("memory_stored", entity_id=entity_id, type="organizational")

    def retrieve_relevant_memory(self, query: str, conversation_id: str = None, top_k: int = 5) -> List[Dict]:
        """
        Retrieve relevant memories using keyword matching.
        In production this would use vector similarity search via Qdrant.
        """
        query_lower = query.lower()
        query_words = set(query_lower.split())

        candidates = []

        # Search organizational memory
        for entry in self._org_memory:
            content_lower = entry.content.lower()
            content_words = set(content_lower.split())
            overlap = len(query_words & content_words)
            score = overlap / max(len(query_words), 1) * entry.importance
            if score > 0.1:
                candidates.append((score, entry))

        # Search session memory
        if conversation_id and conversation_id in self._session_memory:
            for entry in self._session_memory[conversation_id]:
                content_lower = entry.content.lower()
                content_words = set(content_lower.split())
                overlap = len(query_words & content_words)
                score = overlap / max(len(query_words), 1) * 0.8
                if score > 0.05:
                    candidates.append((score, entry))

        # Sort by score, return top_k
        candidates.sort(key=lambda x: x[0], reverse=True)
        results = []
        for score, entry in candidates[:top_k]:
            results.append({
                "id": entry.id,
                "content": entry.content,
                "type": entry.memory_type,
                "entity_type": entry.entity_type,
                "entity_id": entry.entity_id,
                "importance": entry.importance,
                "similarity_score": round(score, 3),
                "metadata": entry.metadata,
                "created_at": entry.created_at,
            })

        logger.info("memory_retrieved", query_len=len(query), results=len(results))
        return results

    def get_session_context(self, conversation_id: str) -> List[Dict]:
        """Get all session memory for a conversation."""
        if conversation_id not in self._session_memory:
            return []
        return [
            {
                "content": e.content,
                "metadata": e.metadata,
                "created_at": e.created_at,
            }
            for e in self._session_memory[conversation_id]
        ]

    def get_historical_similar_cases(self, domain: str, signals: List[str]) -> List[Dict]:
        """Retrieve historically similar cases."""
        query = f"{domain} {' '.join(signals)}"
        memories = self.retrieve_relevant_memory(query, top_k=3)
        cases = []
        for m in memories:
            if m.get("metadata", {}).get("outcome"):
                cases.append({
                    "entity_id": m.get("entity_id", ""),
                    "summary": m["content"][:200],
                    "outcome": m["metadata"].get("outcome", "unknown"),
                    "action": m["metadata"].get("action_taken", ""),
                    "result": m["metadata"].get("result", ""),
                    "similarity": m["similarity_score"],
                })
        return cases


# Singleton
memory_manager = MemoryManager()
