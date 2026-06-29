# ⚡ DecisionOS — Agentic Decision Intelligence Platform

> **Enterprise decision operating system powered by multi-agent AI orchestration.**
> Transform customer interactions, enterprise knowledge, and business reasoning into explainable Next Best Actions.

[![Python](https://img.shields.io/badge/Python-3.12-blue)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-green)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://typescriptlang.org)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        DecisionOS                               │
├──────────────────┬──────────────────────┬───────────────────────┤
│   Frontend       │      Backend         │    Infrastructure     │
│   Next.js 15     │      FastAPI         │    PostgreSQL         │
│   Tailwind CSS   │      LangGraph       │    Redis              │
│   Framer Motion  │      LLM Abstraction │    Qdrant (vectors)   │
│   Zustand        │      Memory Layer    │    Langfuse           │
└──────────────────┴──────────────────────┴───────────────────────┘

Agent Execution Pipeline:
┌─────────────────────────────────────────────────────────────────┐
│ User Input                                                      │
│    ↓                                                            │
│ [Conversation Manager] → intent, domain, entities, urgency      │
│    ↓                                                            │
│ [Information Completeness Agent] → checklist, gaps, quality     │
│    ↓                                                            │
│ [Planner Agent] → execution graph, parallelization plan         │
│    ↓                                                            │
│ ┌─────────────────┐  ┌──────────────────┐  (PARALLEL)         │
│ │  Memory Agent   │  │  Knowledge Agent │                      │
│ │  org memory     │  │  RAG over docs   │                      │
│ └─────────────────┘  └──────────────────┘                      │
│    ↓                                                            │
│ [Domain Specialist] → root cause, risks, domain insights        │
│    ↓                                                            │
│ ┌─────────────────┐  ┌──────────────────┐  (PARALLEL)         │
│ │   Risk Agent    │  │ Opportunity Agent│                      │
│ │   churn prob    │  │   upsell / exp   │                      │
│ └─────────────────┘  └──────────────────┘                      │
│    ↓                                                            │
│ [Recommendation Agent] → Next Best Action with full explainability│
│    ↓                                                            │
│ [Confidence Agent] → score calibration, evidence quality        │
│    ↓                                                            │
│ [Human-in-the-Loop] → Approve / Modify / Reject / Escalate     │
│    ↓                                                            │
│ [Memory Update] → store outcome, update organizational memory   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- Python 3.12+
- Node.js 20+
- A Gemini API key (free at [ai.google.dev](https://ai.google.dev)) OR Groq API key

### 1. Backend Setup

```bash
cd decision-os/backend

# Copy and configure environment
copy .env.example .env
# Edit .env and add your GEMINI_API_KEY or GROQ_API_KEY

# Install dependencies
pip install -r requirements.txt

# Run the backend
uvicorn app.main:app --reload --port 8000
```

The API will be at `http://localhost:8000` with docs at `http://localhost:8000/docs`.

### 2. Frontend Setup

```bash
cd decision-os/frontend

# Install dependencies
npm install

# Run the frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 3. Docker (Full Stack)

```bash
cd decision-os

# Create .env file with your API keys
echo "GEMINI_API_KEY=your_key_here" > .env
echo "GROQ_API_KEY=your_key_here" >> .env

docker-compose up --build
```

---

## 🔑 Configuration

Edit `backend/.env`:

```env
# Choose your LLM provider
LLM_PROVIDER=gemini          # or: groq, openai
LLM_MODEL=gemini-1.5-flash   # or: llama-3.1-70b-versatile, gpt-4o-mini

# Add your API key
GEMINI_API_KEY=your_key_here
# GROQ_API_KEY=your_key_here
```

**Getting a free Gemini API key:**
1. Go to https://ai.google.dev/
2. Click "Get API key"
3. Create key in Google AI Studio
4. Paste in `.env` as `GEMINI_API_KEY=...`

---

## 🎯 Demo Scenarios

Try these prompts in DecisionOS:

### 🔴 Churn Risk (Customer Success)
```
We are worried about churn risk for Acme Corp. Their $380K annual contract 
renews in 60 days. Platform usage dropped 62%, our champion just left the 
company, and a competitor has a demo scheduled next week.
```

### 📈 Upsell Opportunity (Sales)
```
TechStart has been on our platform 18 months with 85% feature adoption 
and NPS of 9. They just hired 50 new engineers across 3 departments. 
What's the best expansion strategy?
```

### ⚡ Deal Acceleration (Sales)
```
The GlobalBank deal ($450K ARR) has been in final stage for 6 weeks. 
The champion is pushing but procurement is blocking. A competitor just 
got added to the shortlist. How do I close this?
```

### 👤 Candidate Review (Staffing)
```
Final round candidate for Senior ML Engineer. 8 years experience, 
strong LLM and MLOps background, but limited team leadership. 
Should we extend an offer for this senior IC role?
```

---

## 🧠 Agents

| Agent | Role |
|-------|------|
| **Conversation Manager** | Intent detection, domain classification, entity extraction |
| **Information Completeness** | Determine required info, detect gaps, show checklist |
| **Planner** | Pure orchestration - builds execution graph with parallelization |
| **Memory Agent** | Retrieves org memory, similar cases, episodic history |
| **Knowledge Agent** | RAG over playbooks, policies, contracts, uploaded docs |
| **Domain Specialist** | Deep domain reasoning (CS, Sales, Healthcare, Energy...) |
| **Risk Agent** | Churn probability, health score, urgency, escalation |
| **Opportunity Agent** | Upsell, expansion, cross-sell detection |
| **Recommendation Agent** | Next Best Action with full explainability |
| **Confidence Agent** | Evidence quality scoring, calibration, data coverage |

---

## 📁 Project Structure

```
decision-os/
├── backend/
│   ├── app/
│   │   ├── agents/          # All 10 AI agents
│   │   ├── api/routes/      # FastAPI routes (chat, conversations)
│   │   ├── core/            # Config, LLM abstraction, logging
│   │   ├── db/              # SQLAlchemy models + database
│   │   ├── memory/          # Hierarchical memory manager
│   │   ├── services/        # Conversation + document services
│   │   └── workflows/       # Main decision orchestration workflow
│   ├── data/sample/         # Sample CRM/transcript data
│   ├── scripts/             # Seed scripts
│   └── requirements.txt
├── frontend/
│   ├── app/                 # Next.js app router
│   ├── components/
│   │   ├── agents/          # Agent timeline, checklist
│   │   ├── chat/            # Chat panel, messages, input, upload
│   │   ├── dashboard/       # Decision dashboard, approval modal
│   │   ├── sidebar/         # Conversation sidebar
│   │   └── ui/              # Badges, progress, score rings
│   ├── lib/
│   │   ├── api.ts           # API client with SSE streaming
│   │   ├── store.ts         # Zustand global state
│   │   └── utils.ts         # Helpers, constants
│   └── package.json
├── docker-compose.yml
└── README.md
```

---

## 🛠️ Tech Stack

**Backend:**
- FastAPI + Pydantic v2 (async)
- LangGraph-inspired orchestration
- LLM abstraction: Gemini Flash / Groq / OpenAI with fallback
- In-memory store (no DB setup required for demo)
- Document parsing: PyMuPDF, python-docx

**Frontend:**
- Next.js 15 (App Router)
- Tailwind CSS + custom glassmorphism
- Framer Motion (animations)
- Zustand (state management)
- React Markdown + remark-gfm
- Server-Sent Events (SSE) streaming

**Infrastructure (optional for demo):**
- PostgreSQL (full persistence)
- Redis (caching)
- Qdrant (vector search)
- Langfuse (LLM observability)

---

## 👥 Team

| Name | Branch |
|------|--------|
| **Abhijna Adapa** | CSE (Data Science) |
| **Sai Praneeth** | CSE (AI & ML) |
| **Deepthi** | CSE (Data Science) |

---

## 🏆 Hackathon Highlights

- **10 specialized AI agents** running in coordinated pipeline
- **Planner-based orchestration** with parallel execution
- **Hierarchical memory** (session → episodic → organizational)
- **Full explainability** — every recommendation shows evidence, sources, business rules, memory refs
- **Human-in-the-loop** — Approve, Modify, Reject, Escalate with audit trail
- **Real-time streaming** — see agents execute live
- **Multi-domain** — Customer Success, Sales, Healthcare, Energy, Staffing, Banking
- **Document upload** — ingest CRM exports, transcripts, playbooks, contracts
- **Demo-ready** — 5 pre-seeded conversations, suggested prompts, beautiful dark UI
