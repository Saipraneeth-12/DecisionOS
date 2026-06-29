"""
Conversations API Routes
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from typing import List, Optional
import json
import asyncio

from app.services.conversation_service import conversation_store
from app.services.document_service import document_service
from app.workflows.decision_workflow import decision_workflow
from app.core.logging import logger

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("")
async def list_conversations():
    convs = conversation_store.list_conversations()
    return {"conversations": convs, "total": len(convs)}


@router.post("")
async def create_conversation(body: dict):
    title = body.get("title", "New Conversation")
    domain = body.get("domain", "customer_success")
    conv = conversation_store.create_conversation(title=title, domain=domain)
    return conv


@router.get("/{conversation_id}")
async def get_conversation(conversation_id: str):
    conv = conversation_store.get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    messages = conversation_store.get_messages(conversation_id)
    docs = conversation_store.get_documents(conversation_id)
    return {**conv, "messages": messages, "documents": docs}


@router.patch("/{conversation_id}")
async def update_conversation(conversation_id: str, body: dict):
    conv = conversation_store.update_conversation(conversation_id, body)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


@router.delete("/{conversation_id}")
async def delete_conversation(conversation_id: str):
    ok = conversation_store.delete_conversation(conversation_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"success": True}


@router.get("/{conversation_id}/messages")
async def get_messages(conversation_id: str, limit: int = 50):
    msgs = conversation_store.get_messages(conversation_id, limit=limit)
    return {"messages": msgs}


@router.post("/{conversation_id}/documents")
async def upload_document(
    conversation_id: str,
    file: UploadFile = File(...),
):
    conv = conversation_store.get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    content = await file.read()
    if len(content) > 52_428_800:
        raise HTTPException(status_code=413, detail="File too large (max 50MB)")

    doc = await document_service.save_upload(content, file.filename, conversation_id)
    saved = conversation_store.add_document(conversation_id, doc)
    return saved


@router.get("/{conversation_id}/documents")
async def get_documents(conversation_id: str):
    docs = conversation_store.get_documents(conversation_id)
    return {"documents": docs}


@router.get("/{conversation_id}/recommendation")
async def get_recommendation(conversation_id: str):
    rec = conversation_store.get_latest_recommendation(conversation_id)
    if not rec:
        raise HTTPException(status_code=404, detail="No recommendation found")
    return rec


@router.post("/recommendations/{recommendation_id}/approve")
async def approve_recommendation(recommendation_id: str, body: dict):
    status = body.get("status")
    allowed_statuses = (
        "draft", "pending", "approved", "modified", "rejected", "escalated",
        "assigned", "scheduled", "in_progress", "blocked", "completed", "cancelled",
        "measured", "archived", "not_applicable"
    )
    if status and status not in allowed_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status: {status}")

    approval = {
        "reviewed_at": __import__("datetime").datetime.utcnow().isoformat(),
    }
    if status:
        approval["status"] = status
    for field in ("comment", "modified_action", "escalation_target", "execution_status", "blocked_reason", "outcome", "decision_owner"):
        if field in body:
            approval[field] = body[field]

    rec = conversation_store.update_recommendation_approval(recommendation_id, approval)
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    return rec


@router.post("/{conversation_id}/approve")
async def approve_by_conversation(conversation_id: str, body: dict):
    """Approve or update the latest recommendation lifecycle for a conversation."""
    status = body.get("status")
    allowed_statuses = (
        "draft", "pending", "approved", "modified", "rejected", "escalated",
        "assigned", "scheduled", "in_progress", "blocked", "completed", "cancelled",
        "measured", "archived", "not_applicable"
    )
    if status and status not in allowed_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status: {status}")

    rec = conversation_store.get_latest_recommendation(conversation_id)
    if not rec:
        raise HTTPException(status_code=404, detail="No recommendation found for this conversation")

    recommendation_id = rec.get("id")
    if not recommendation_id:
        raise HTTPException(status_code=404, detail="Recommendation has no ID")

    approval = {
        "reviewed_at": __import__("datetime").datetime.utcnow().isoformat(),
    }
    if status:
        approval["status"] = status
    for field in ("comment", "modified_action", "escalation_target", "execution_status", "blocked_reason", "outcome", "decision_owner"):
        if field in body:
            approval[field] = body[field]

    rec = conversation_store.update_recommendation_approval(recommendation_id, approval)
    return rec
