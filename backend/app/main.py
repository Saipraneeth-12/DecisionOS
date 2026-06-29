"""
DecisionOS — FastAPI Application
Startup is instant. LLM connects lazily on first request.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.core.config import settings
from app.core.logging import setup_logging, logger
from app.api.routes import health, conversations, chat


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    logger.info("decisionos_starting", version=settings.APP_VERSION, provider=settings.LLM_PROVIDER)

    # Pre-create LLM client objects synchronously (fast, no network)
    from app.core.llm import llm_provider
    llm_provider.initialize()

    logger.info("decisionos_ready")
    yield
    logger.info("decisionos_shutdown")


app = FastAPI(
    title="DecisionOS API",
    description="Agentic Decision Intelligence Platform",
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "http://localhost:3001", 
        "http://127.0.0.1:3000", 
        "http://127.0.0.1:3001",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8080",
        "http://127.0.0.1:8080"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Conversation-Id"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

app.include_router(health.router)
app.include_router(chat.router, prefix="/api/v1")
app.include_router(conversations.router, prefix="/api/v1")
