# DecisionOS — Architecture

## Overview

DecisionOS is an enterprise-grade agentic decision intelligence platform. It orchestrates multiple specialized AI agents in a coordinated pipeline to transform raw business inputs (CRM data, meeting transcripts, documents, emails, APIs) into explainable Next Best Actions with human-in-the-loop approval.

---

## High-Level Architecture Diagram

```
Enterprise Inputs
(CRM • Meetings • Docs • Emails • APIs)
              │
              ▼
        ┌───────────┐
        │Domain Agent│
        └───────────┘
              │
              ▼
      ┌──────────────────┐
      │Conversation Manager│
      └──────────────────┘
              │
              ▼
        ┌───────────┐
        │Memory Agent│
        └───────────┘
              │
              ▼
      ◆ Decision Session ◆
       /              \
      [info]        [inference]
      │                 │
      ▼                 ▼
┌────────────────┐   (loopback)
│  Information   │
│   Validation   │
└────────────────┘
      │
      ▼
┌──────────────┐
│ Planner Agent│
└──────────────┘
      │
      ├──────────────────┬────────────────┬──────────────────┐
      ▼                  ▼                ▼                  ▼
┌─────────────┐  ┌──────────────┐  ┌────────────────┐  ┌────────────────┐
│Knowledge    │  │Customer Agent│  │Analytics Agent │  │Resume Workflow │
│Agent        │  │              │  │                │  │                │
└─────────────┘  └──────────────┘  └────────────────┘  └────────────────┘
      │
      ▼
┌──────────────────────┐
│  Decision Context Bus │
└──────────────────────┘
      │
      ├─────────────┬──────────────────┬──────────────┐
      ▼             ▼                  ▼              ▼
┌──────────┐ ┌───────────────┐ ┌────────────────┐ ┌─────────────┐
│Risk Agent│ │Opportunity    │ │Root Cause Agent│ │Impact Agent │
│          │ │Agent          │ │                │ │             │
└──────────┘ └───────────────┘ └────────────────┘ └─────────────┘
      │
      ▼
┌─────────────────────────┐
│  Business Reasoning     │
│  Engine                 │
└─────────────────────────┘
      │
      ▼
┌─────────────────────────┐
│  Recommendation Engine  │
└─────────────────────────┘
      │
      ▼                              ┌──────────────────────┐
┌───────────────────┐   [Feedback Loop]  │  Adaptive Expert    │
│Confidence Evaluator│ ────────────────► │  Council            │
└───────────────────┘                └──────────────────────┘
      │                                       │
      ▼                              ┌─────────────────┐
┌──────────────────────┐             │Consensus Builder│
│ Complexity Classifier │            └─────────────────┘
└──────────────────────┘
      │
      ├── [low] ──────────────────────────────┐
      │                                       │
      ├── [medium/high] ──────────────────────┤
      │                                       ▼
      ▼                             ┌──────────────────┐
┌──────────────────┐                │  Human Approval  │
│  Human Approval  │ ◄──────────────┤                  │
└──────────────────┘                └──────────────────┘
      │
      ▼
┌───────────┐
│ Execution │
└───────────┘
      │
      ▼
┌──────────────────┐
│ Outcome Monitor  │
└──────────────────┘
      │
      ▼
┌──────────────────────────┐
│ Organizational Memory    │
└──────────────────────────┘
      │
      ▼
┌──────────────────────┐
│  Continuous Learning │
└──────────────────────┘
```

---

## System Components

### Frontend Layer
| Component | Technology |
|-----------|-----------|
| Framework | Next.js 15 (App Router) |
| Styling | Tailwind CSS + glassmorphism |
| Animations | Framer Motion |
| State | Zustand |
| Streaming | Server-Sent Events (SSE) |

### Backend Layer
| Component | Technology |
|-----------|-----------|
| API Server | FastAPI + Pydantic v2 (async) |
| Orchestration | LangGraph-inspired multi-agent pipeline |
| LLM Abstraction | Gemini Flash / Groq / OpenAI with fallback |
| Memory | Hierarchical (session → episodic → organizational) |
| Document Parsing | PyMuPDF, python-docx |

### Infrastructure (optional for demo)
| Component | Technology |
|-----------|-----------|
| Database | PostgreSQL |
| Cache | Redis |
| Vector Search | Qdrant |
| LLM Observability | Langfuse |

---

## Agent Pipeline

### Stage 1 — Input Processing
- **Domain Agent** — Classifies the business domain (CS, Sales, HR, etc.)
- **Conversation Manager** — Intent detection, entity extraction, urgency scoring
- **Memory Agent** — Loads relevant org memory, similar past cases

### Stage 2 — Information Validation
- **Information Completeness Agent** — Builds checklist, identifies gaps, requests missing data
- Loops back to user if information is insufficient

### Stage 3 — Planning & Routing
- **Planner Agent** — Builds parallelized execution graph based on domain + intent
- Routes to: Knowledge Agent, Customer Agent, Analytics Agent, or Resume Workflow

### Stage 4 — Decision Context Assembly
- **Decision Context Bus** — Aggregates all agent outputs into unified context
- **Risk Agent** — Churn probability, health score, urgency
- **Opportunity Agent** — Upsell, expansion, cross-sell signals
- **Root Cause Agent** — Deep causal analysis
- **Impact Agent** — Business impact quantification

### Stage 5 — Reasoning & Recommendation
- **Business Reasoning Engine** — Applies domain rules and business logic
- **Recommendation Engine** — Generates Next Best Actions with full explainability
- **Confidence Evaluator** — Scores evidence quality and calibrates confidence
- **Complexity Classifier** — Determines if human approval is needed

### Stage 6 — Expert Review (Complex Cases)
- **Adaptive Expert Council** — Simulates multiple expert perspectives
- **Consensus Builder** — Reconciles conflicting expert views

### Stage 7 — Human-in-the-Loop
- **Human Approval** — Approve / Modify / Reject / Escalate
- Full audit trail of every decision

### Stage 8 — Execution & Learning
- **Execution** — Action dispatch
- **Outcome Monitor** — Tracks results over time
- **Organizational Memory** — Stores outcomes for future reference
- **Continuous Learning** — Updates models and heuristics from feedback

---

## Key Design Decisions

1. **Planner-based orchestration** — A dedicated Planner agent decides which agents run and in what order, enabling parallelization and domain-specific routing without hard-coded flows.

2. **LLM provider abstraction** — A unified LLM client supports Gemini, Groq, and OpenAI with automatic fallback, making the system provider-agnostic.

3. **Hierarchical memory** — Three-tier memory (session, episodic, organizational) gives agents both immediate context and long-term institutional knowledge.

4. **Human-in-the-loop by design** — Every recommendation routes through an approval gate. Complexity Classifier determines whether it's auto-approved or escalated to humans.

5. **Full explainability** — Every NBA includes evidence chain, sources cited, business rules applied, and memory references used.

6. **Streaming-first UI** — SSE streaming shows agents executing in real time, giving users visibility into the reasoning process as it happens.
