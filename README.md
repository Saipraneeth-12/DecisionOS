# ⚡ DecisionOS — Agentic Decision Intelligence Platform

> A next-generation AI-powered decision intelligence platform designed to help enterprises turn scattered business data into explainable, actionable outcomes.

[![Python](https://img.shields.io/badge/Python-3.12-blue)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-green)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://typescriptlang.org)

---

## 📌 HR Screening Summary

DecisionOS is an enterprise decision-support system that uses multiple AI agents to analyze customer, sales, hiring, and operational scenarios and recommend the best next action with reasoning. The platform is designed for real business use cases where teams need faster decision-making, clearer explanation, and structured action plans.

This project demonstrates:
- AI-driven business decision support for real-world domains
- Multi-agent orchestration for specialized reasoning
- Human-in-the-loop decision approval workflow
- Explainable recommendations backed by evidence and context
- Enterprise-ready design for customer success, sales, staffing, and operations

DecisionOS was built as a collaborative student innovation project with a strong focus on applied AI, full-stack development, and product thinking.

---

## 🎯 Problem We Solved

Modern organizations deal with fragmented information across CRM data, documents, customer conversations, and internal knowledge. Teams often struggle to:
- identify the right next step from incomplete or noisy inputs
- evaluate risk, opportunity, and urgency together
- understand why a recommendation was made
- coordinate decisions across teams without delays

DecisionOS addresses this by combining AI reasoning, document understanding, memory, and workflow orchestration into one decision platform.

---

## 🧠 What the Product Does

DecisionOS acts like an intelligent operational assistant for business decisions. It can:
- understand business context from user prompts and uploaded documents
- detect intent, domain, urgency, and missing information
- retrieve relevant organizational memory and domain knowledge
- analyze risk and opportunity in parallel
- generate an explainable recommendation or "Next Best Action"
- allow human approval, modification, or rejection of decisions

This makes it suitable for scenarios such as:
- customer churn prevention
- upsell and expansion planning
- candidate evaluation
- deal acceleration
- operational support and decision auditing

---

## 🏗️ Architecture Overview

```text
┌──────────────────────────────────────────────────────────────────────┐
│                        DecisionOS                                     │
├──────────────────┬──────────────────────┬────────────────────────────┤
│   Frontend       │      Backend         │    Infrastructure          │
│   Next.js 15     │      FastAPI         │    PostgreSQL             │
│   Tailwind CSS   │      LangGraph       │    Redis                  │
│   Framer Motion  │      LLM Layer       │    Qdrant (vectors)       │
│   Zustand        │      Memory Layer    │    Langfuse               │
└──────────────────┴──────────────────────┴────────────────────────────┘
```

The platform follows an agentic workflow:

1. User input is interpreted and structured
2. Missing information is identified
3. Relevant knowledge and memory are retrieved
4. Specialized agents analyze risk, opportunity, and domain context
5. The recommendation engine proposes a decision
6. Human users validate, modify, or reject it
7. Outcomes are stored for future learning

---

## 🤖 Core Agent System

DecisionOS uses a coordinated multi-agent architecture with specialized roles:

| Agent | Responsibility |
|-------|----------------|
| Conversation Manager | Understand intent, entities, and urgency |
| Information Completeness | Identify missing context and gaps |
| Planner | Build execution strategy and coordination flow |
| Memory Agent | Retrieve previous experience and similar cases |
| Knowledge Agent | Search knowledge and document repositories |
| Domain Specialist | Apply domain-specific reasoning |
| Risk Agent | Evaluate threats and escalation conditions |
| Opportunity Agent | Find growth and expansion potential |
| Recommendation Agent | Produce explainable next-best actions |
| Confidence Agent | Assess evidence quality and decision confidence |

---

## 💼 Business Impact

This project is designed to demonstrate how AI can support business operations by:
- reducing decision delay for complex situations
- improving transparency in recommendation systems
- combining structured data, documents, and memory for better judgment
- empowering teams with faster, evidence-backed actions
- enabling human oversight for critical decisions

In short, DecisionOS is a practical example of AI solving real business coordination and reasoning problems rather than just answering generic questions.

---

## 🛠️ Technology Stack

**Backend:**
- Python 3.12+
- FastAPI
- Pydantic
- LangGraph-inspired orchestration
- LLM abstraction for Gemini / Groq / OpenAI

**Frontend:**
- Next.js 15
- TypeScript
- Tailwind CSS
- Framer Motion
- Zustand

**Infrastructure (optional/demo-ready):**
- PostgreSQL
- Redis
- Qdrant
- Langfuse

---

## 🚀 Quick Start

### Prerequisites
- Python 3.12+
- Node.js 20+
- Gemini API key or Groq API key

### Backend Setup
```bash
cd backend
copy .env.example .env
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

Open the app at: http://localhost:3000

---

## 🌍 Demo Use Cases

DecisionOS can be demonstrated using scenarios such as:

### Customer Success
- churn-risk analysis
- renewal prioritization
- account health monitoring

### Sales
- upsell planning
- deal acceleration
- opportunity prioritization

### Staffing
- candidate evaluation for hiring decisions

### Banking / Enterprise Operations
- risk-informed recommendations with evidence and reasoning

---

## 👥 Team

| Name | Domain/Focus |
|------|--------------|
| **Abhijna Adapa** | CSE (Data Science) |
| **Sai Praneeth** | CSE (AI & ML) |
| **Deepthi** | CSE (Data Science) |

---

## 📁 Project Structure

```text
decision-os/
├── backend/
│   ├── app/
│   ├── data/
│   ├── scripts/
│   └── requirements.txt
├── frontend/
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── package.json
├── docker-compose.yml
├── README.md
└── .env.example
```

---

## 🔗 Repository

https://github.com/Saipraneeth-12/DecisionOS

---

## 🏆 Why This Project Stands Out

DecisionOS combines multiple important skills in one project:
- AI/ML application design
- LLM integration and orchestration
- full-stack product development
- workflow planning and system architecture
- business-focused problem solving
- user-centric design with explainability

This project reflects a strong understanding of how artificial intelligence can be used to support decision-making in real organizations, not just as a static demo.

---

## ✨ Closing Note

DecisionOS is a practical AI product prototype built to showcase the ability to merge product thinking, machine intelligence, business logic, and software engineering into a single, impactful system.

It is well suited for evaluation by recruiters, technical screening panels, and hiring teams looking for a candidate/team with interest in AI-driven enterprise solutions.
