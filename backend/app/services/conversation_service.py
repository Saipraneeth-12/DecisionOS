"""
Conversation Service - manages conversations with in-memory store for demo
(Replace with full DB in production)
"""
import uuid
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone


def utcnow_str():
    return datetime.now(timezone.utc).isoformat()


class ConversationStore:
    """
    In-memory conversation store for hackathon demo.
    In production: replace with async SQLAlchemy queries.
    """
    def __init__(self):
        self._conversations: Dict[str, Dict] = {}
        self._messages: Dict[str, List[Dict]] = {}
        self._documents: Dict[str, List[Dict]] = {}
        self._recommendations: Dict[str, Dict] = {}
        self._approvals: Dict[str, Dict] = {}

    # ---- Conversations ----

    def list_conversations(self) -> List[Dict]:
        convs = list(self._conversations.values())
        convs.sort(key=lambda c: c.get("is_pinned", False), reverse=True)
        convs.sort(key=lambda c: c["updated_at"], reverse=True)
        # Pinned first, then by updated_at descending
        pinned = [c for c in convs if c.get("is_pinned", False)]
        unpinned = [c for c in convs if not c.get("is_pinned", False)]
        return pinned + unpinned

    def get_conversation(self, conversation_id: str) -> Optional[Dict]:
        return self._conversations.get(conversation_id)

    def create_conversation(
        self,
        title: str = "Untitled Analysis",
        domain: str = "customer_success",
        initial_status: str = "gathering_context",
    ) -> Dict:
        cid = str(uuid.uuid4())
        now = utcnow_str()
        conv = {
            "id": cid,
            "title": title if title else "Untitled Analysis",
            "domain": domain,
            "category": None,
            "summary": None,
            "is_pinned": False,
            "status": initial_status,
            "tags": [],
            "message_count": 0,
            "created_at": now,
            "updated_at": now,
        }
        self._conversations[cid] = conv
        self._messages[cid] = []
        self._documents[cid] = []
        return conv

    def update_conversation(self, conversation_id: str, updates: Dict) -> Optional[Dict]:
        if conversation_id not in self._conversations:
            return None
        self._conversations[conversation_id].update(updates)
        self._conversations[conversation_id]["updated_at"] = utcnow_str()
        return self._conversations[conversation_id]

    def delete_conversation(self, conversation_id: str) -> bool:
        if conversation_id in self._conversations:
            del self._conversations[conversation_id]
            self._messages.pop(conversation_id, None)
            self._documents.pop(conversation_id, None)
            return True
        return False

    # ---- Messages ----

    def add_message(self, conversation_id: str, role: str, content: str, metadata: Dict = None) -> Dict:
        msg = {
            "id": str(uuid.uuid4()),
            "conversation_id": conversation_id,
            "role": role,
            "content": content,
            "metadata": metadata or {},
            "created_at": utcnow_str(),
        }
        if conversation_id not in self._messages:
            self._messages[conversation_id] = []
        self._messages[conversation_id].append(msg)

        # Update conversation message count and timestamp
        if conversation_id in self._conversations:
            self._conversations[conversation_id]["message_count"] = len(self._messages[conversation_id])
            self._conversations[conversation_id]["updated_at"] = utcnow_str()

        return msg

    def get_messages(self, conversation_id: str, limit: int = 50) -> List[Dict]:
        msgs = self._messages.get(conversation_id, [])
        return msgs[-limit:]

    # ---- Documents ----

    def add_document(self, conversation_id: str, doc: Dict) -> Dict:
        if conversation_id not in self._documents:
            self._documents[conversation_id] = []
        self._documents[conversation_id].append(doc)
        return doc

    def get_documents(self, conversation_id: str) -> List[Dict]:
        return self._documents.get(conversation_id, [])

    # ---- Recommendations ----

    def store_recommendation(self, conversation_id: str, recommendation: Dict) -> Dict:
        rec_id = str(uuid.uuid4())
        
        # Display ID generator matching enterprise look (e.g. NBA-1042)
        nba_id = recommendation.get("recommendation_id")
        if not nba_id:
            import random
            nba_id = f"NBA-{random.randint(1040, 1999)}"

        rec = {
            **recommendation,
            "id": rec_id,
            "recommendation_id": nba_id,
            "conversation_id": conversation_id,
            "created_at": utcnow_str(),
            "version": recommendation.get("version", "1.3"),
            "planner_state": recommendation.get("planner_state", "WAITING_FOR_HUMAN"),
            "memory_status": recommendation.get("memory_status", "STAGED"),
        }
        self._recommendations[rec_id] = rec

        # Link to conversation and auto-generate title from recommendation if still "Untitled Analysis"
        if conversation_id in self._conversations:
            self._conversations[conversation_id]["latest_recommendation_id"] = rec_id
            current_title = self._conversations[conversation_id].get("title", "")
            if current_title in ("Untitled Analysis", "", None):
                rec_title = recommendation.get("title", "")
                if rec_title:
                    self._conversations[conversation_id]["title"] = rec_title
            # Promote status to "analyzing" -> "completed" after first recommendation
            current_status = self._conversations[conversation_id].get("status", "gathering_context")
            if current_status in ("gathering_context", "analyzing", "in_progress"):
                self._conversations[conversation_id]["status"] = "completed"
            self._conversations[conversation_id]["updated_at"] = utcnow_str()

        return rec

    def get_recommendation(self, recommendation_id: str) -> Optional[Dict]:
        return self._recommendations.get(recommendation_id)

    def update_recommendation_approval(self, recommendation_id: str, approval: Dict) -> Optional[Dict]:
        rec = self._recommendations.get(recommendation_id)
        if rec:
            status = approval.get("status", "pending")
            # Store all lifecycle fields in recommendation
            rec["approval_status"] = status
            rec["lifecycle_status"] = status
            if "execution_status" in approval:
                rec["execution_status"] = approval["execution_status"]
            if "blocked_reason" in approval:
                rec["blocked_reason"] = approval["blocked_reason"]
            if "outcome" in approval:
                rec["outcome"] = approval["outcome"]

            # Map Approval Lifecycle transitions
            if status == "approved":
                rec["planner_state"] = "CLOSED_LOOP"
                rec["memory_status"] = "UPDATED"
                rec["execution_plan_generated"] = True
                rec["memory_updated"] = True
                rec["closed_loop_completed"] = True
            elif status == "rejected":
                rec["planner_state"] = "REPLANNING_TRIGGERED"
                rec["planner_replanning"] = True
            elif status == "modified":
                rec["planner_state"] = "WAITING_FOR_HUMAN"
                rec["memory_status"] = "UPDATED"
                try:
                    v = float(rec.get("version", "1.3"))
                    rec["version"] = f"{v + 0.1:.1f}"
                except:
                    rec["version"] = "1.4"
                rec["previous_recommendation_archived"] = True
                rec["memory_updated"] = True
            
            rec["approval"] = {**rec.get("approval", {}), **approval}
            rec["updated_at"] = utcnow_str()
            self._approvals[recommendation_id] = rec["approval"]

            # Store decision into memory
            from app.memory.memory_manager import memory_manager
            memory_manager.store_organizational_memory(
                content=f"Decision lifecycle update for '{rec.get('title')}' in conversation {rec.get('conversation_id')}. "
                        f"Status: {status}. Execution: {approval.get('execution_status', 'N/A')}. "
                        f"Blocked Reason: {approval.get('blocked_reason', 'N/A')}. Outcome: {approval.get('outcome', 'N/A')}. "
                        f"Comment: {approval.get('comment', '')}",
                entity_type="recommendation_lifecycle",
                entity_id=recommendation_id,
                importance=0.8,
                metadata={
                    "conversation_id": rec.get("conversation_id"),
                    "status": status,
                    "execution_status": approval.get("execution_status"),
                    "blocked_reason": approval.get("blocked_reason"),
                    "outcome": approval.get("outcome"),
                    "comment": approval.get("comment")
                }
            )

            # Also update conversation status when approved/rejected/escalated/blocked/completed
            conv_id = rec.get("conversation_id")
            if conv_id and conv_id in self._conversations:
                # Map lifecycle/approval status to conversation stage
                conv_stage = "gathering_context"
                if status in ("approved", "assigned", "scheduled"):
                    conv_stage = "approved"
                elif status in ("in_progress", "scheduled"):
                    conv_stage = "in_progress"
                elif status == "blocked":
                    conv_stage = "blocked"
                elif status in ("completed", "measured"):
                    conv_stage = "completed"
                elif status == "rejected":
                    conv_stage = "needs_review"
                elif status == "modified":
                    conv_stage = "needs_review"
                elif status == "escalated":
                    conv_stage = "escalated"
                else:
                    conv_stage = "needs_review"
                
                self._conversations[conv_id]["status"] = conv_stage
                self._conversations[conv_id]["updated_at"] = utcnow_str()

        return rec

    def get_latest_recommendation(self, conversation_id: str) -> Optional[Dict]:
        conv = self._conversations.get(conversation_id, {})
        rec_id = conv.get("latest_recommendation_id")
        if rec_id:
            return self._recommendations.get(rec_id)
        return None


# Singleton
conversation_store = ConversationStore()
