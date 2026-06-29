from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID
from enum import Enum


class ConversationStatus(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"
    AGENT = "agent"


class ApprovalStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    MODIFIED = "modified"
    REJECTED = "rejected"
    ESCALATED = "escalated"


class MessageCreate(BaseModel):
    content: str
    role: MessageRole = MessageRole.USER


class MessageResponse(BaseModel):
    id: UUID
    conversation_id: UUID
    role: MessageRole
    content: str
    metadata: Dict[str, Any] = {}
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationCreate(BaseModel):
    title: Optional[str] = None
    domain: str = "customer_success"
    initial_message: Optional[str] = None


class ConversationUpdate(BaseModel):
    title: Optional[str] = None
    is_pinned: Optional[bool] = None
    category: Optional[str] = None
    status: Optional[ConversationStatus] = None


class ConversationSummary(BaseModel):
    id: UUID
    title: str
    summary: Optional[str] = None
    domain: str
    status: ConversationStatus
    is_pinned: bool
    category: Optional[str] = None
    tags: List[str] = []
    created_at: datetime
    updated_at: datetime
    message_count: int = 0

    class Config:
        from_attributes = True


class ConversationDetail(ConversationSummary):
    messages: List[MessageResponse] = []


class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    domain: str = "customer_success"
    document_ids: List[str] = []
    stream: bool = True


class AgentStatus(BaseModel):
    agent_name: str
    status: str  # pending/running/completed/failed/skipped
    output: Optional[Dict[str, Any]] = None
    latency_ms: Optional[int] = None


class RiskLevel(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class RecommendationResponse(BaseModel):
    id: UUID
    title: str
    action: str
    rationale: Optional[str] = None
    expected_outcome: Optional[str] = None
    priority: str
    urgency: str
    timeline: Optional[str] = None
    roi_estimate: Optional[str] = None
    confidence_score: float
    risk_score: float
    impact_score: float
    coverage_score: float
    evidence: List[str] = []
    sources: List[str] = []
    business_rules: List[str] = []
    memory_references: List[str] = []
    risk_factors: List[str] = []
    opportunities: List[str] = []
    similar_cases: List[Dict[str, Any]] = []
    domain: Optional[str] = None
    domain_insights: Dict[str, Any] = {}
    approval_status: ApprovalStatus

    class Config:
        from_attributes = True


class ApprovalRequest(BaseModel):
    status: ApprovalStatus
    comment: Optional[str] = None
    modified_action: Optional[str] = None
    escalation_target: Optional[str] = None


class DecisionDashboard(BaseModel):
    recommendation: Optional[RecommendationResponse] = None
    agents_executed: List[AgentStatus] = []
    risk_score: float = 0.0
    confidence_score: float = 0.0
    impact_score: float = 0.0
    evidence_count: int = 0
    memory_refs_count: int = 0
    similar_cases_count: int = 0
    execution_time_ms: int = 0
    approval_status: ApprovalStatus = ApprovalStatus.PENDING


class StreamEvent(BaseModel):
    type: str  # text/agent_update/recommendation/dashboard/error/done
    data: Any
