import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date) {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

export function truncate(str: string, n: number) {
  return str.length > n ? str.slice(0, n) + "…" : str;
}

export function getRiskColor(level: string) {
  switch (level?.toLowerCase()) {
    case "critical": return "text-red-400";
    case "high":     return "text-orange-400";
    case "medium":   return "text-yellow-400";
    case "low":      return "text-green-400";
    default:         return "text-slate-400";
  }
}

export function getRiskBg(level: string) {
  switch (level?.toLowerCase()) {
    case "critical": return "bg-red-500/20 border-red-500/30";
    case "high":     return "bg-orange-500/20 border-orange-500/30";
    case "medium":   return "bg-yellow-500/20 border-yellow-500/30";
    case "low":      return "bg-green-500/20 border-green-500/30";
    default:         return "bg-slate-500/20 border-slate-500/30";
  }
}

export function getPriorityColor(priority: string) {
  switch (priority?.toLowerCase()) {
    case "critical": return "text-red-400 bg-red-500/15";
    case "high":     return "text-orange-400 bg-orange-500/15";
    case "medium":   return "text-yellow-400 bg-yellow-500/15";
    case "low":      return "text-slate-400 bg-slate-500/15";
    default:         return "text-slate-400 bg-slate-500/15";
  }
}

export function getConfidenceColor(score: number) {
  if (score >= 0.85) return "text-emerald-400";
  if (score >= 0.70) return "text-green-400";
  if (score >= 0.55) return "text-yellow-400";
  return "text-red-400";
}

export function getDomainLabel(domain: string) {
  const map: Record<string, string> = {
    customer_success: "Customer Success",
    sales: "Sales",
    healthcare: "Healthcare",
    energy: "Energy",
    staffing: "Staffing",
    banking: "Banking",
    general: "General",
  };
  return map[domain] ?? domain;
}

// ---- Conversation Stage ----

export type ConversationStage =
  | "gathering_context"
  | "analyzing"
  | "needs_review"
  | "approved"
  | "escalated"
  | "completed"
  | "in_progress"
  | "blocked";

export function getStageColor(stage: string): string {
  switch (stage) {
    case "gathering_context": return "bg-slate-500/15 text-slate-400 border-slate-500/25";
    case "analyzing":         return "bg-indigo-500/15 text-indigo-400 border-indigo-500/30 stage-active";
    case "needs_review":      return "bg-yellow-500/15 text-yellow-400 border-yellow-500/30";
    case "approved":          return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "escalated":         return "bg-orange-500/15 text-orange-400 border-orange-500/30";
    case "completed":         return "bg-slate-500/10 text-slate-400 border-slate-500/20";
    case "in_progress":       return "bg-blue-500/15 text-blue-400 border-blue-500/30";
    case "blocked":           return "bg-red-500/15 text-red-400 border-red-500/30";
    default:                  return "bg-slate-500/15 text-slate-400 border-slate-500/25";
  }
}

export function getStageLabel(stage: string): string {
  switch (stage) {
    case "gathering_context": return "Gathering Context";
    case "analyzing":         return "Analyzing";
    case "needs_review":      return "Needs Review";
    case "approved":          return "Approved";
    case "escalated":         return "Escalated";
    case "completed":         return "Completed";
    case "in_progress":       return "In Progress";
    case "blocked":           return "Blocked";
    default:                  return stage ?? "Unknown";
  }
}

export function getStageIcon(stage: string): string {
  switch (stage) {
    case "gathering_context": return "○";
    case "analyzing":         return "◈";
    case "needs_review":      return "◇";
    case "approved":          return "✓";
    case "escalated":         return "↑";
    case "completed":         return "●";
    case "in_progress":       return "◉";
    case "blocked":           return "🛑";
    default:                  return "○";
  }
}

// ---- Constants ----

export const DOMAINS = [
  { value: "customer_success", label: "Customer Success" },
  { value: "sales", label: "Sales" },
  { value: "healthcare", label: "Healthcare" },
  { value: "energy", label: "Energy" },
  { value: "staffing", label: "Staffing" },
  { value: "banking", label: "Banking" },
  { value: "general", label: "General" },
];

export const SUGGESTED_PROMPTS = [
  {
    title: "Churn Risk Analysis",
    prompt: "We are worried about churn risk for Acme Corp. Their renewal is in 60 days, usage has dropped 40% and our champion just left the company.",
    domain: "customer_success",
    icon: "🔴",
  },
  {
    title: "Upsell Opportunity",
    prompt: "TechStart has been using our platform for 18 months with 85% feature adoption. They just hired 50 new engineers. What's the best upsell strategy?",
    domain: "customer_success",
    icon: "📈",
  },
  {
    title: "Deal Acceleration",
    prompt: "The GlobalBank deal has been in final stage for 6 weeks. The champion is pushing but procurement is blocking. How do I accelerate closure?",
    domain: "sales",
    icon: "⚡",
  },
  {
    title: "Candidate Evaluation",
    prompt: "We have a final round candidate for Senior ML Engineer. Strong technical background but limited leadership experience. Should we extend an offer?",
    domain: "staffing",
    icon: "👤",
  },
];

export interface DecisionTemplate {
  id: string;
  title: string;
  description: string;
  domain: string;
  icon: string;
  prompt: string;
  tags: string[];
}

export const DECISION_TEMPLATES: DecisionTemplate[] = [
  {
    id: "customer-renewal-risk",
    title: "Customer Renewal Risk",
    description: "Analyze renewal probability and recommend intervention strategy",
    domain: "customer_success",
    icon: "🔄",
    prompt: "Analyze the renewal risk for [Customer Name]. Their contract expires in [X] days. Key signals: [usage trends, health score, stakeholder changes]. What intervention is needed?",
    tags: ["renewal", "retention", "cs"],
  },
  {
    id: "deal-acceleration",
    title: "Deal Acceleration",
    description: "Unstick stalled deals with targeted next-best actions",
    domain: "sales",
    icon: "⚡",
    prompt: "The [Account Name] deal has been in [Stage] for [X] weeks. Champion: [Name]. Blockers: [procurement/legal/budget]. How do I accelerate to close?",
    tags: ["sales", "pipeline", "acceleration"],
  },
  {
    id: "churn-prevention",
    title: "Churn Prevention",
    description: "Identify at-risk accounts and build a save plan",
    domain: "customer_success",
    icon: "🛡️",
    prompt: "Account [Customer Name] is showing churn signals: [usage drop, support tickets, sponsor departure]. ARR at risk: $[Amount]. What is the optimal save strategy?",
    tags: ["churn", "save", "retention"],
  },
  {
    id: "candidate-evaluation",
    title: "Candidate Evaluation",
    description: "Data-driven hiring recommendation with risk assessment",
    domain: "staffing",
    icon: "👥",
    prompt: "Evaluate candidate [Name] for [Role]. Background: [experience summary]. Team fit considerations: [culture, skills gap]. Recommend: hire, pass, or further assess?",
    tags: ["hiring", "staffing", "evaluation"],
  },
  {
    id: "contract-review",
    title: "Contract Review",
    description: "Identify risks, opportunities, and negotiation leverage",
    domain: "sales",
    icon: "📋",
    prompt: "Review the contract for [Account Name]. Key terms: [pricing, SLA, term length]. Renewal date: [date]. Our leverage: [usage data, expansion potential]. Recommend negotiation strategy.",
    tags: ["contract", "negotiation", "legal"],
  },
  {
    id: "expansion-opportunity",
    title: "Expansion Opportunity",
    description: "Identify upsell/cross-sell timing and best approach",
    domain: "customer_success",
    icon: "🚀",
    prompt: "Identify expansion opportunities for [Customer Name]. Current ARR: $[Amount]. Usage: [metrics]. Recent triggers: [new hires, funding, product adoption]. What is the best expansion play?",
    tags: ["expansion", "upsell", "growth"],
  },
];
