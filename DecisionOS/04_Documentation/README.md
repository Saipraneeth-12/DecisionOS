# ⚡ DecisionOS — Agentic Decision Intelligence Platform

> **Enterprise decision operating system powered by multi-agent AI orchestration.**
> Transform customer interactions, enterprise knowledge, and business reasoning into explainable Next Best Actions.

[![Python](https://img.shields.io/badge/Python-3.12-blue)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-green)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://typescriptlang.org)

---

## 👥 Team

| Name | Branch |
|------|--------|
| **Abhijna Adapa** | CSE (Data Science) |
| **Sai Praneeth** | CSE (AI & ML) |
| **Deepthi** | CSE (Data Science) |

---

## 🔗 GitHub Repository

[https://github.com/Saipraneeth-12/DecisionOS](https://github.com/Saipraneeth-12/DecisionOS)

---

## 📌 Project Overview

DecisionOS is an enterprise-grade agentic decision intelligence platform that orchestrates **10+ specialized AI agents** in a coordinated pipeline. It transforms raw business inputs — CRM data, meeting transcripts, uploaded documents, and contextual queries — into explainable **Next Best Actions (NBA)** with full audit trail and human-in-the-loop approval.

**Core capabilities:**
- Multi-agent orchestration with parallel execution
- Hierarchical memory (session → episodic → organizational)
- Full explainability — every recommendation shows evidence, sources, and business rules
- Human-in-the-loop — Approve, Modify, Reject, or Escalate decisions
- Real-time agent streaming so users see reasoning as it happens
- Multi-domain support: Customer Success, Sales, Healthcare, Energy, Staffing, Banking

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

See `02_Architecture/Architecture.md` for the full detailed architecture.

---

## 🚀 Setup Instructions

### Prerequisites
- Python 3.12+
- Node.js 20+
- A Gemini API key (free at [ai.google.dev](https://ai.google.dev)) OR Groq API key

### 1. Backend Setup

```bash
cd backend

# Copy and configure environment
copy .env.example .env
# Edit .env — add your GEMINI_API_KEY or GROQ_API_KEY

# Install dependencies
pip install -r requirements.txt

# Run the backend
uvicorn app.main:app --reload --port 8000
```

API available at `http://localhost:8000` — interactive docs at `http://localhost:8000/docs`.

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run the frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 3. Docker (Full Stack — easiest)

```bash
# From the project root
echo "GEMINI_API_KEY=your_key_here" > .env

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
2. Click "Get API key" → Create key in Google AI Studio
3. Paste in `.env` as `GEMINI_API_KEY=...`

---

## 🎯 Demo Scenarios

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
| **Planner** | Pure orchestration — builds execution graph with parallelization |
| **Memory Agent** | Retrieves org memory, similar cases, episodic history |
| **Knowledge Agent** | RAG over playbooks, policies, contracts, uploaded docs |
| **Domain Specialist** | Deep domain reasoning (CS, Sales, Healthcare, Energy…) |
| **Risk Agent** | Churn probability, health score, urgency, escalation |
| **Opportunity Agent** | Upsell, expansion, cross-sell detection |
| **Recommendation Agent** | Next Best Action with full explainability |
| **Confidence Agent** | Evidence quality scoring, calibration, data coverage |

---

## 🛠️ Tech Stack

**Backend:** FastAPI + Pydantic v2, LangGraph-inspired orchestration, Gemini/Groq/OpenAI LLM abstraction, PyMuPDF, python-docx

**Frontend:** Next.js 15 (App Router), Tailwind CSS, Framer Motion, Zustand, SSE streaming

**Infrastructure (optional):** PostgreSQL, Redis, Qdrant, Langfuse

---

## 📁 Project Structure

```
DecisionOS/
├── 01_Demo_Video/       → Demo.mp4 (add manually)
├── 02_Architecture/     → Architecture.md
├── 03_Code/             → SourceCode.zip
└── 04_Documentation/    → README.md (this file)
```

---

## 📝 Additional Notes

- The source code zip (`03_Code/SourceCode.zip`) excludes `node_modules/`, `.venv/`, and other dependency folders per submission guidelines.
- The backend runs fully in-memory for the demo — no database setup required.
- LLM provider is configurable via `.env` — Gemini Flash is recommended (free tier available).
- All agent executions are streamed live to the frontend via SSE.
