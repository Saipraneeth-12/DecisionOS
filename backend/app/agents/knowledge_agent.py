"""
Knowledge Agent - RAG over enterprise documents
Searches playbooks, contracts, policies, emails, CRM exports
"""
from typing import Dict, Any, List
from app.agents.base import BaseAgent
from app.core.logging import logger


# Demo knowledge base for hackathon
DEMO_KNOWLEDGE_BASE = [
    {
        "id": "kb_001",
        "title": "Customer Success Churn Prevention Playbook",
        "category": "playbook",
        "domain": "customer_success",
        "content": """Churn Prevention Protocol:
1. Early Warning System: Monitor NPS < 7, usage decline > 20%, support tickets spike
2. Immediate Actions (0-30 days): Schedule Executive Business Review, assign dedicated CSM, create success plan
3. Engagement Tactics: Quantify ROI achieved, demonstrate roadmap alignment, identify new champions
4. Escalation Path: If no response in 7 days, escalate to VP Customer Success
5. Win-back Playbook: Executive sponsor engagement, custom pricing consideration, roadmap commitment
Success Rate: 68% when initiated 90+ days before renewal""",
        "relevance_keywords": ["churn", "retention", "risk", "renewal", "customer success"]
    },
    {
        "id": "kb_002",
        "title": "Account Health Scoring Model",
        "category": "policy",
        "domain": "customer_success",
        "content": """Health Score Components:
- Product Usage (30%): Daily active users, feature adoption depth, API calls
- Engagement (25%): Meeting frequency, email response rate, NPS score
- Business Outcomes (25%): ROI realized, value milestones achieved, use case expansion
- Support Health (20%): Open ticket count, CSAT score, escalation frequency

Score Ranges:
- 80-100: Green (healthy, expansion candidate)
- 60-79: Yellow (monitor, proactive outreach)
- 40-59: Orange (at-risk, intervention needed)
- 0-39: Red (critical, executive escalation)""",
        "relevance_keywords": ["health score", "account health", "usage", "nps", "csat"]
    },
    {
        "id": "kb_003",
        "title": "Upsell and Expansion Playbook",
        "category": "playbook",
        "domain": "sales",
        "content": """Expansion Revenue Playbook:
1. Identify Signals: 70%+ feature adoption, positive NPS, new use cases mentioned, team growth
2. Timing: Best window is 60-90 days before renewal or after major success milestone
3. Approach: Lead with customer success story, ROI data, new use case workshop
4. Packaging: Present 3 options (current, expansion, enterprise)
5. Champion Strategy: Identify internal sponsor, arm with business case
Average expansion deal: 23% of existing ARR
Success rate with proper timing: 61%""",
        "relevance_keywords": ["upsell", "expansion", "cross-sell", "growth", "revenue"]
    },
    {
        "id": "kb_004",
        "title": "Executive Business Review (EBR) Framework",
        "category": "playbook",
        "domain": "customer_success",
        "content": """EBR Structure:
1. Opening (5 min): Relationship appreciation, agenda overview
2. Business Review (15 min): Customer's business goals, market context, key challenges
3. Value Delivered (20 min): ROI metrics, success milestones, case studies from similar companies
4. Product Roadmap (10 min): Upcoming features aligned to customer goals
5. Joint Success Plan (10 min): Next 90-day plan, mutual commitments
Key Success Factors: Executive attendance from both sides, pre-prepared ROI data, personalized agenda
Recommended frequency: Quarterly for strategic accounts, Semi-annual for standard""",
        "relevance_keywords": ["ebr", "executive", "business review", "quarterly", "meeting"]
    },
    {
        "id": "kb_005",
        "title": "Risk Escalation Policy",
        "category": "policy",
        "domain": "general",
        "content": """Risk Escalation Framework:
CRITICAL (Score 0-39): Immediate VP escalation within 24 hours, CEO-to-CEO outreach if >$500K ARR
HIGH (Score 40-59): Director-level engagement within 48 hours, dedicated rescue plan
MEDIUM (Score 60-69): CSM-led intervention within 1 week, enhanced monitoring
LOW (Score 70-79): Proactive outreach within 2 weeks, check-in call

Documentation Required: Risk assessment form, root cause analysis, action plan with dates
Review Cadence: Daily tracking for critical, weekly for high, bi-weekly for medium""",
        "relevance_keywords": ["escalation", "risk", "critical", "high risk", "intervention"]
    },
    {
        "id": "kb_006",
        "title": "Customer Champion Development Guide",
        "category": "playbook",
        "domain": "customer_success",
        "content": """Champion Development Strategy:
1. Identify Potential Champions: High platform usage, positive feedback, cross-team influence
2. Enablement Program: Dedicated training, certification program, peer community access
3. Internal Visibility: Help champion showcase wins internally, provide presentation materials
4. Recognition Program: Reference customer program, speaking opportunities, advisory board
5. Succession Planning: Always develop 2+ champions per account
Warning Signs of Champion Loss: Reduced meeting attendance, less responsive, new stakeholder introduced
Response to Champion Loss: Immediate executive outreach, new champion identification sprint""",
        "relevance_keywords": ["champion", "stakeholder", "engagement", "internal sponsor"]
    },
    {
        "id": "kb_007",
        "title": "Renewal Negotiation Best Practices",
        "category": "playbook",
        "domain": "sales",
        "content": """Renewal Success Framework:
Early Engagement (120+ days): Value review, success metrics baseline, roadmap alignment
Mid-Cycle (90 days): Renewal proposal with expansion options, legal review initiated
Critical Period (60 days): Executive alignment, final terms, legal finalization
Close (30 days): Signed agreement, onboarding for any new modules

Price Negotiation Guidelines:
- Never discount without value justification
- Lead with ROI data before price discussions
- Multi-year commitments: 10-15% discount acceptable
- Expansion at renewal: Reduce base discount, focus on total value""",
        "relevance_keywords": ["renewal", "contract", "negotiation", "pricing", "discount"]
    },
]


class KnowledgeAgent(BaseAgent):
    name = "knowledge_agent"
    description = "Searches enterprise knowledge base including playbooks, policies, and contracts"

    async def run(self, state: Dict[str, Any]) -> Dict[str, Any]:
        user_message = state.get("user_message", "")
        domain = state.get("domain", "customer_success")
        conversation_output = state.get("conversation_manager_output", {})
        uploaded_docs = state.get("uploaded_documents", [])

        # Build search query
        intent = conversation_output.get("intent", "")
        topics = conversation_output.get("entities", {}).get("topics", [])
        query_parts = [user_message[:200], intent] + topics[:3]
        query = " ".join(filter(None, query_parts)).lower()

        # Search knowledge base
        results = self._search_knowledge_base(query, domain)

        # Include uploaded document summaries
        uploaded_summaries = []
        for doc in uploaded_docs[:5]:
            if doc.get("content"):
                uploaded_summaries.append({
                    "title": doc.get("original_name", "Uploaded Document"),
                    "category": doc.get("doc_type", "document"),
                    "content": doc.get("content", "")[:500],
                    "source": "uploaded",
                })

        all_knowledge = results + uploaded_summaries

        logger.info("knowledge_retrieval_complete", results=len(results), uploaded=len(uploaded_summaries))

        return {
            "knowledge_items": results,
            "uploaded_context": uploaded_summaries,
            "total_retrieved": len(all_knowledge),
            "playbooks_found": [r for r in results if r["category"] == "playbook"],
            "policies_found": [r for r in results if r["category"] == "policy"],
            "knowledge_summary": self._build_summary(all_knowledge),
            "key_recommendations_from_kb": self._extract_key_points(results),
        }

    def _search_knowledge_base(self, query: str, domain: str) -> List[Dict]:
        """Simple keyword-based search (replace with vector search in production)."""
        results = []

        for item in DEMO_KNOWLEDGE_BASE:
            # Domain filter (include general domain always)
            if item["domain"] != domain and item["domain"] != "general":
                continue

            # Score by keyword overlap
            score = 0
            for keyword in item["relevance_keywords"]:
                if keyword.lower() in query:
                    score += 1

            # Also score by content
            content_words = set(item["content"].lower().split())
            query_words = set(query.split())
            overlap = len(content_words & query_words)
            score += overlap * 0.1

            if score > 0:
                results.append({
                    **item,
                    "relevance_score": round(score, 2),
                    "content": item["content"],
                })

        # Sort by relevance and return top 4
        results.sort(key=lambda x: x["relevance_score"], reverse=True)
        return results[:4]

    def _build_summary(self, items: List[Dict]) -> str:
        if not items:
            return "No relevant knowledge retrieved."
        categories = {}
        for item in items:
            cat = item.get("category", "document")
            categories[cat] = categories.get(cat, 0) + 1
        parts = [f"{v} {k}(s)" for k, v in categories.items()]
        return f"Retrieved {len(items)} knowledge items: {', '.join(parts)}."

    def _extract_key_points(self, items: List[Dict]) -> List[str]:
        points = []
        for item in items[:3]:
            # Extract first meaningful line as key point
            lines = [l.strip() for l in item["content"].split("\n") if l.strip() and not l.strip().endswith(":")]
            if lines:
                points.append(f"[{item['title']}]: {lines[0][:150]}")
        return points
