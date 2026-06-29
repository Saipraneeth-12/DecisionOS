"""
Chat API - SSE streaming endpoint for the decision workflow
"""
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from typing import Optional, List
import json
import uuid

from app.services.conversation_service import conversation_store
from app.workflows.decision_workflow import decision_workflow
from app.core.logging import logger

router = APIRouter(prefix="/chat", tags=["chat"])


async def event_stream(
    message: str,
    conversation_id: str,
    domain: str,
    document_ids: List[str],
    conversation_history: list,
    uploaded_documents: list,
):
    """Server-Sent Events generator for streaming workflow output."""
    try:
        async for event in decision_workflow.execute_streaming(
            user_message=message,
            conversation_id=conversation_id,
            domain=domain,
            uploaded_documents=uploaded_documents,
            conversation_history=conversation_history,
        ):
            yield f"data: {json.dumps(event)}\n\n"
    except Exception as e:
        error_event = {"type": "error", "data": {"message": str(e)}}
        yield f"data: {json.dumps(error_event)}\n\n"
        done_event = {"type": "done", "data": {"error": True}}
        yield f"data: {json.dumps(done_event)}\n\n"


@router.post("/stream")
async def chat_stream(request: Request):
    body = await request.json()
    message = body.get("message", "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")

    conversation_id = body.get("conversation_id")
    domain = body.get("domain", "customer_success")
    document_ids = body.get("document_ids", [])
    force_execution = body.get("force_execution", False)

    # Get or create conversation
    if conversation_id:
        conv = conversation_store.get_conversation(conversation_id)
        if not conv:
            # Auto-create
            title = message[:60] + ("..." if len(message) > 60 else "")
            conv = conversation_store.create_conversation(title=title, domain=domain)
            conversation_id = conv["id"]
    else:
        title = message[:60] + ("..." if len(message) > 60 else "")
        conv = conversation_store.create_conversation(title=title, domain=domain)
        conversation_id = conv["id"]

    # Store user message
    conversation_store.add_message(conversation_id, "user", message)

    # Load history and documents
    all_messages = conversation_store.get_messages(conversation_id, limit=20)
    history = [{"role": m["role"], "content": m["content"]} for m in all_messages]

    uploaded_docs = conversation_store.get_documents(conversation_id)

    logger.info("chat_stream_start", conversation_id=conversation_id, domain=domain, force_execution=force_execution)

    # Collect full assistant response for storage
    full_response_parts = []
    recommendation_data = None
    dashboard_data = None

    async def tracked_stream():
        nonlocal full_response_parts, recommendation_data, dashboard_data
        async for event in decision_workflow.execute_streaming(
            user_message=message,
            conversation_id=conversation_id,
            domain=domain,
            uploaded_documents=uploaded_docs,
            conversation_history=history,
            force_execution=force_execution,
        ):
            # Track response text
            if event["type"] == "text":
                full_response_parts.append(event["data"].get("content", ""))
            elif event["type"] == "recommendation":
                recommendation_data = event["data"]
            elif event["type"] == "dashboard":
                dashboard_data = event["data"]
            elif event["type"] == "done" and not event["data"].get("error"):
                # Store assistant message
                full_text = "".join(full_response_parts)
                if full_text:
                    conversation_store.add_message(
                        conversation_id, "assistant", full_text,
                        metadata={"has_recommendation": recommendation_data is not None}
                    )
                # Store recommendation
                if recommendation_data:
                    conversation_store.store_recommendation(conversation_id, recommendation_data)
                # Update conversation title with better title
                if recommendation_data and recommendation_data.get("title"):
                    conversation_store.update_conversation(
                        conversation_id,
                        {"summary": recommendation_data.get("action", "")[:200]}
                    )

            # Always add conversation_id to event
            event["data"]["conversation_id"] = conversation_id
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        tracked_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
            "X-Conversation-Id": conversation_id,
        },
    )


@router.post("/message")
async def chat_sync(request: Request):
    """Non-streaming fallback endpoint."""
    body = await request.json()
    message = body.get("message", "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")

    conversation_id = body.get("conversation_id") or str(uuid.uuid4())
    domain = body.get("domain", "customer_success")

    force_execution = body.get("force_execution", False)
    conv = conversation_store.get_conversation(conversation_id)
    if not conv:
        title = message[:60]
        conv = conversation_store.create_conversation(title=title, domain=domain)
        conversation_id = conv["id"]

    conversation_store.add_message(conversation_id, "user", message)
    history = [{"role": m["role"], "content": m["content"]}
               for m in conversation_store.get_messages(conversation_id, limit=20)]
    uploaded_docs = conversation_store.get_documents(conversation_id)

    text_parts = []
    recommendation = None
    dashboard = None

    async for event in decision_workflow.execute_streaming(
        user_message=message,
        conversation_id=conversation_id,
        domain=domain,
        uploaded_documents=uploaded_docs,
        conversation_history=history,
        force_execution=force_execution,
    ):
        if event["type"] == "text":
            text_parts.append(event["data"].get("content", ""))
        elif event["type"] == "recommendation":
            recommendation = event["data"]
        elif event["type"] == "dashboard":
            dashboard = event["data"]

    full_text = "".join(text_parts)
    conversation_store.add_message(conversation_id, "assistant", full_text)
    if recommendation:
        conversation_store.store_recommendation(conversation_id, recommendation)

    return {
        "conversation_id": conversation_id,
        "response": full_text,
        "recommendation": recommendation,
        "dashboard": dashboard,
    }
