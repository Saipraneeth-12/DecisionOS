"""
SQLAlchemy Database Models for DecisionOS
"""
from sqlalchemy import (
    Column, String, Text, Float, Boolean, Integer,
    DateTime, JSON, ForeignKey, Enum as SAEnum
)
from sqlalchemy.orm import relationship, DeclarativeBase
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime, timezone
import enum


def utcnow():
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class ConversationStatus(str, enum.Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class MessageRole(str, enum.Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"
    AGENT = "agent"


class ApprovalStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    MODIFIED = "modified"
    REJECTED = "rejected"
    ESCALATED = "escalated"


class AgentRunStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    role = Column(String(100), default="analyst")
    avatar_url = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    conversations = relationship("Conversation", back_populates="user")


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    title = Column(String(500), nullable=False)
    summary = Column(Text, nullable=True)
    domain = Column(String(100), default="customer_success")
    status = Column(SAEnum(ConversationStatus), default=ConversationStatus.ACTIVE)
    is_pinned = Column(Boolean, default=False)
    category = Column(String(100), nullable=True)
    tags = Column(JSON, default=list)
    metadata = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user = relationship("User", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")
    recommendations = relationship("Recommendation", back_populates="conversation")
    agent_runs = relationship("AgentRun", back_populates="conversation")
    documents = relationship("Document", back_populates="conversation")


class Message(Base):
    __tablename__ = "messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id"), nullable=False)
    role = Column(SAEnum(MessageRole), nullable=False)
    content = Column(Text, nullable=False)
    metadata = Column(JSON, default=dict)
    tokens_used = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    conversation = relationship("Conversation", back_populates="messages")


class AgentRun(Base):
    __tablename__ = "agent_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id"), nullable=False)
    message_id = Column(UUID(as_uuid=True), ForeignKey("messages.id"), nullable=True)
    agent_name = Column(String(100), nullable=False)
    status = Column(SAEnum(AgentRunStatus), default=AgentRunStatus.PENDING)
    input_data = Column(JSON, default=dict)
    output_data = Column(JSON, default=dict)
    error = Column(Text, nullable=True)
    latency_ms = Column(Integer, nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    conversation = relationship("Conversation", back_populates="agent_runs")


class Recommendation(Base):
    __tablename__ = "recommendations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id"), nullable=False)
    message_id = Column(UUID(as_uuid=True), ForeignKey("messages.id"), nullable=True)

    # Core recommendation
    title = Column(String(500), nullable=False)
    action = Column(Text, nullable=False)
    rationale = Column(Text, nullable=True)
    expected_outcome = Column(Text, nullable=True)
    priority = Column(String(50), default="medium")  # critical/high/medium/low
    urgency = Column(String(50), default="medium")
    timeline = Column(String(200), nullable=True)
    roi_estimate = Column(String(200), nullable=True)

    # Scores
    confidence_score = Column(Float, default=0.0)
    risk_score = Column(Float, default=0.0)
    impact_score = Column(Float, default=0.0)
    coverage_score = Column(Float, default=0.0)

    # Evidence & Context
    evidence = Column(JSON, default=list)
    sources = Column(JSON, default=list)
    business_rules = Column(JSON, default=list)
    memory_references = Column(JSON, default=list)
    risk_factors = Column(JSON, default=list)
    opportunities = Column(JSON, default=list)
    similar_cases = Column(JSON, default=list)

    # Domain context
    domain = Column(String(100), nullable=True)
    domain_insights = Column(JSON, default=dict)

    # Approval
    approval_status = Column(SAEnum(ApprovalStatus), default=ApprovalStatus.PENDING)

    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    conversation = relationship("Conversation", back_populates="recommendations")
    approval = relationship("Approval", back_populates="recommendation", uselist=False)


class Approval(Base):
    __tablename__ = "approvals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    recommendation_id = Column(UUID(as_uuid=True), ForeignKey("recommendations.id"), nullable=False)
    reviewer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    status = Column(SAEnum(ApprovalStatus), nullable=False)
    comment = Column(Text, nullable=True)
    modified_action = Column(Text, nullable=True)
    escalation_target = Column(String(255), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), default=utcnow)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    recommendation = relationship("Recommendation", back_populates="approval")


class Memory(Base):
    __tablename__ = "memory"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id"), nullable=True)
    memory_type = Column(String(50), nullable=False)  # session/episodic/organizational
    entity_type = Column(String(100), nullable=True)  # customer/deal/case
    entity_id = Column(String(255), nullable=True)
    content = Column(Text, nullable=False)
    summary = Column(Text, nullable=True)
    embedding_id = Column(String(255), nullable=True)  # Qdrant point ID
    importance_score = Column(Float, default=0.5)
    metadata = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    expires_at = Column(DateTime(timezone=True), nullable=True)


class Document(Base):
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id"), nullable=True)
    filename = Column(String(500), nullable=False)
    original_name = Column(String(500), nullable=False)
    file_type = Column(String(100), nullable=False)
    doc_type = Column(String(100), nullable=True)  # crm/transcript/playbook/contract/email
    file_size = Column(Integer, nullable=True)
    content = Column(Text, nullable=True)
    chunks_count = Column(Integer, default=0)
    is_indexed = Column(Boolean, default=False)
    metadata = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    conversation = relationship("Conversation", back_populates="documents")


class KnowledgeItem(Base):
    __tablename__ = "knowledge"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(500), nullable=False)
    content = Column(Text, nullable=False)
    category = Column(String(100), nullable=True)
    domain = Column(String(100), nullable=True)
    doc_type = Column(String(100), nullable=True)
    source = Column(String(500), nullable=True)
    embedding_id = Column(String(255), nullable=True)
    metadata = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), default=utcnow)


class Feedback(Base):
    __tablename__ = "feedback"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    recommendation_id = Column(UUID(as_uuid=True), ForeignKey("recommendations.id"), nullable=True)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id"), nullable=True)
    feedback_type = Column(String(50), nullable=False)  # approval/rejection/modification
    rating = Column(Integer, nullable=True)  # 1-5
    comment = Column(Text, nullable=True)
    outcome = Column(Text, nullable=True)
    outcome_achieved = Column(Boolean, nullable=True)
    metadata = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), default=utcnow)
