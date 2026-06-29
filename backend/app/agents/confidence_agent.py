"""
Confidence Agent V2 — Explainable, never arbitrary.

V2 Changes:
- Explainable breakdown with named contributors (Meeting Notes +12, CRM History +15, etc.)
- Deductions for missing procurement/stakeholder data
- Show breakdown as list of {label, points, sign} for frontend rendering
- Never output unsupported percentages
- Hard gate: evidence < 3 OR context score < 40 → "Insufficient Data"
"""
from typing import Dict, Any, List
from app.agents.base import BaseAgent
from app.core.logging import logger

MIN_EVIDENCE_FOR_CONFIDENCE = 3
MIN_CONTEXT_SCORE_FOR_RECOMMENDATION = 40


class ConfidenceAgent(BaseAgent):
    name = "confidence_agent"
    description = "Computes explainable confidence — refuses to score when evidence is insufficient"

    async def run(self, state: Dict[str, Any]) -> Dict[str, Any]:
        context_eval   = state.get("context_evaluator_output", {})
        completeness   = state.get("information_completeness_output", {})
        memory_output  = state.get("memory_agent_output", {})
        knowledge_output = state.get("knowledge_agent_output", {})
        risk_output    = state.get("risk_agent_output", {})
        domain_output  = state.get("domain_specialist_output", {})
        rec_output     = state.get("recommendation_agent_output", {})

        context_score = context_eval.get("context_score", 50)
        context_class = context_eval.get("context_class", "BUSINESS")
        provided_fields = context_eval.get("provided_fields", [])
        missing_fields = context_eval.get("missing_fields", [])

        # ── Hard gates ──────────────────────────────────────────────────
        evidence_count  = len(rec_output.get("evidence", []))
        sources_count   = len(rec_output.get("sources", []))
        business_rules  = len(rec_output.get("business_rules_applied", []))
        total_evidence  = evidence_count + sources_count + business_rules

        insufficient = (
            context_class == "INSUFFICIENT"
            or context_score < MIN_CONTEXT_SCORE_FOR_RECOMMENDATION
        )

        if insufficient or total_evidence < MIN_EVIDENCE_FOR_CONFIDENCE:
            low_score = round(0.30 + (context_score / 100) * 0.15, 2)
            label = (
                "Insufficient Data" if total_evidence < MIN_EVIDENCE_FOR_CONFIDENCE
                else "Low Information Available"
            )
            tips = self._build_improvement_tips(context_eval, completeness)
            breakdown_items = self._build_insufficient_breakdown(context_score, provided_fields, missing_fields)

            logger.info(
                "confidence_calibrated",
                result="INSUFFICIENT",
                context_score=context_score,
                evidence_count=total_evidence,
            )
            return {
                "confidence_score":  low_score,
                "confidence_label":  label,
                "confidence_level":  "insufficient",
                "evidence_strength": "Low",
                "risk_calibrated":   "UNKNOWN",
                "roi_calibrated":    "N/A — awaiting business context",
                "is_calibrated":     True,
                "insufficient_data": True,
                "score_breakdown": {
                    "data_coverage":     round(context_score / 200, 2),
                    "evidence_quality":  0.1,
                    "memory_similarity": 0.1,
                    "domain_confidence": 0.2,
                    "knowledge_coverage": 0.1,
                },
                "confidence_breakdown": breakdown_items,
                "evidence_count":          total_evidence,
                "memory_retrieval_count":  memory_output.get("total_retrieved", 0),
                "knowledge_items_count":   knowledge_output.get("total_retrieved", 0),
                "improvement_tips": tips,
                "calibration_notes": (
                    "Need additional context before generating business recommendations. "
                    "Please provide customer data, metrics, or a specific decision question."
                ),
            }

        # ── Full explainable scoring ─────────────────────────────────────
        breakdown_items = []
        running_score = 0

        # CRM / Meeting Notes / Data sources (+12 to +15 per category)
        mem_retrieved = memory_output.get("total_retrieved", 0)
        similar_cases = memory_output.get("similar_cases", [])

        if mem_retrieved > 0:
            pts = min(mem_retrieved * 3, 15)
            breakdown_items.append({"label": "CRM History / Memory", "points": pts, "sign": "positive"})
            running_score += pts

        knowledge_cnt = knowledge_output.get("total_retrieved", 0)
        if knowledge_cnt > 0:
            pts = min(knowledge_cnt * 3, 15)
            breakdown_items.append({"label": "Knowledge Documents", "points": pts, "sign": "positive"})
            running_score += pts

        if evidence_count > 0:
            pts = min(evidence_count * 4, 12)
            breakdown_items.append({"label": "Meeting Notes / Evidence", "points": pts, "sign": "positive"})
            running_score += pts

        if similar_cases:
            success_rate = sum(1 for c in similar_cases if c.get("outcome") == "success") / len(similar_cases)
            pts = round(min(len(similar_cases) * 3 + success_rate * 5, 10))
            breakdown_items.append({"label": "Historical Outcomes", "points": pts, "sign": "positive"})
            running_score += pts

        # Domain confidence
        domain_conf = domain_output.get("confidence_in_analysis", 0.75)
        if domain_conf >= 0.7:
            pts = round(domain_conf * 10)
            breakdown_items.append({"label": "Domain Analysis", "points": pts, "sign": "positive"})
            running_score += pts

        # Usage metrics
        if "Usage Metrics" in provided_fields or "usage" in str(context_eval).lower():
            breakdown_items.append({"label": "Usage Metrics", "points": 10, "sign": "positive"})
            running_score += 10

        # Risk analysis
        risk_level = risk_output.get("overall_risk_level", "unknown")
        if risk_level not in ("unknown", None):
            breakdown_items.append({"label": "Risk Analysis", "points": 8, "sign": "positive"})
            running_score += 8

        # Business rules
        if business_rules > 0:
            pts = min(business_rules * 2, 8)
            breakdown_items.append({"label": "Business Rules Applied", "points": pts, "sign": "positive"})
            running_score += pts

        # ── Deductions for missing data ──────────────────────────────────
        deductions = 0
        if "Procurement Process" in missing_fields or (
            not any("procurement" in f.lower() for f in provided_fields)
            and context_score < 85
        ):
            breakdown_items.append({"label": "Missing Procurement Data", "points": -6, "sign": "negative"})
            deductions += 6

        if "Stakeholder Map" in missing_fields or (
            not any("stakeholder" in f.lower() or "sponsor" in f.lower() for f in provided_fields)
        ):
            breakdown_items.append({"label": "Missing Stakeholder Map", "points": -5, "sign": "negative"})
            deductions += 5

        if "Budget Context" not in provided_fields and context_score < 80:
            breakdown_items.append({"label": "Missing Budget Details", "points": -4, "sign": "negative"})
            deductions += 4

        # ── Compute final score ──────────────────────────────────────────
        raw_score = running_score - deductions
        # Normalize to 0-100 scale then to 0-1 float
        normalized = min(max(raw_score, 0), 100)
        # Map context_score as a baseline floor
        baseline = context_score * 0.5
        overall = (normalized + baseline) / 200  # weighted average
        overall = min(max(overall, 0.30), 0.96)

        if overall >= 0.85:   lvl, lbl = "very_high", "Very High Confidence"
        elif overall >= 0.70: lvl, lbl = "high",      "High Confidence"
        elif overall >= 0.55: lvl, lbl = "medium",    "Medium Confidence"
        else:                 lvl, lbl = "low",        "Low Confidence — More Data Recommended"

        evidence_strength = (
            "High" if total_evidence >= 6 and running_score >= 40
            else "Medium" if total_evidence >= 3
            else "Low"
        )

        avail_docs = completeness.get("available_count", 0)
        total_docs = completeness.get("total_count", 6)
        data_coverage = min((avail_docs / max(total_docs, 1)), 1.0)
        evidence_score = min(total_evidence * 0.15, 1.0)
        memory_score = min(len(similar_cases) * 0.2 + mem_retrieved * 0.05, 1.0) if similar_cases else 0.2

        tips = self._build_improvement_tips(context_eval, completeness)

        logger.info(
            "confidence_v2_computed",
            overall=round(overall, 3),
            level=lvl,
            context_score=context_score,
            evidence=total_evidence,
            breakdown_items=len(breakdown_items),
        )

        return {
            "confidence_score":  round(overall, 3),
            "confidence_label":  lbl,
            "confidence_level":  lvl,
            "evidence_strength": evidence_strength,
            "risk_calibrated":   None,
            "roi_calibrated":    None,
            "is_calibrated":     True,
            "insufficient_data": False,
            "score_breakdown": {
                "data_coverage":     round(data_coverage,    3),
                "evidence_quality":  round(evidence_score,   3),
                "memory_similarity": round(memory_score,     3),
                "domain_confidence": round(domain_conf,      3),
                "knowledge_coverage": round(min(knowledge_cnt * 0.15, 0.9), 3),
            },
            "confidence_breakdown": breakdown_items,
            "evidence_count":          evidence_count,
            "memory_retrieval_count":  mem_retrieved,
            "knowledge_items_count":   knowledge_cnt,
            "improvement_tips":        tips,
            "calibration_notes":       self._calibration_notes(overall, similar_cases),
        }

    def _build_insufficient_breakdown(
        self, context_score: int, provided: List[str], missing: List[str]
    ) -> List[Dict]:
        items = []
        for f in provided[:5]:
            items.append({"label": f, "points": 0, "sign": "neutral", "status": "provided"})
        for f in missing[:5]:
            items.append({"label": f, "points": 0, "sign": "negative", "status": "missing"})
        return items

    def _build_improvement_tips(self, ctx: Dict, completeness: Dict) -> List[str]:
        tips = []
        score = ctx.get("context_score", 0)
        missing = ctx.get("missing_for_recommendation", [])
        if score < 40:
            tips.append("Share a specific customer or business situation to get started")
        if missing:
            for m in missing[:2]:
                tips.append(f"Provide: {m}")
        avail = completeness.get("available_count", 0)
        if avail == 0:
            tips.append("Upload CRM exports, meeting transcripts, or paste customer notes")
        return tips[:3]

    def _calibration_notes(self, score: float, similar_cases: List) -> str:
        if score >= 0.85:
            return "Strong evidence base with historical validation."
        elif score >= 0.70:
            return "Good evidence base. Recommendation well-supported by available context."
        elif score >= 0.55:
            return "Moderate confidence. Additional data would improve quality."
        else:
            sr = None
            if similar_cases:
                sr = sum(1 for c in similar_cases if c.get("outcome") == "success") / len(similar_cases)
            note = "Limited evidence. Recommendation based on best available context."
            if sr is not None:
                note += f" Historical success rate: {sr:.0%}."
            return note
