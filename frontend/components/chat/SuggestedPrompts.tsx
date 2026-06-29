"use client";
import { motion } from "framer-motion";
import { SUGGESTED_PROMPTS } from "@/lib/utils";
import { useChatStore } from "@/lib/store";

interface SuggestedPromptsProps {
  onSelect: (prompt: string, domain: string) => void;
}

export function SuggestedPrompts({ onSelect }: SuggestedPromptsProps) {
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Hero */}
      <div className="text-center space-y-3">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25"
        >
          <span className="text-2xl">⚡</span>
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-2xl font-bold gradient-text"
        >
          DecisionOS
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-slate-400 text-sm max-w-md mx-auto"
        >
          Your agentic decision intelligence platform. Describe your business challenge and get
          explainable Next Best Actions powered by multi-agent AI.
        </motion.p>
      </div>

      {/* Suggested prompts */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-2 gap-3"
      >
        {SUGGESTED_PROMPTS.map((p, i) => (
          <motion.button
            key={p.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + i * 0.07 }}
            onClick={() => onSelect(p.prompt, p.domain)}
            className="text-left p-4 rounded-xl border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.05] hover:border-indigo-500/30 transition-all group"
          >
            <div className="text-xl mb-2">{p.icon}</div>
            <div className="text-sm font-medium text-slate-200 group-hover:text-white mb-1">{p.title}</div>
            <div className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{p.prompt}</div>
            <div className="mt-2 text-[10px] text-indigo-500 font-medium uppercase tracking-wide">{p.domain.replace(/_/g, " ")}</div>
          </motion.button>
        ))}
      </motion.div>

      {/* Capabilities */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="grid grid-cols-3 gap-2 text-center"
      >
        {[
          { icon: "🧠", label: "10 Specialized Agents" },
          { icon: "💾", label: "Organizational Memory" },
          { icon: "📋", label: "Human-in-the-Loop" },
          { icon: "🔍", label: "Explainable AI" },
          { icon: "📈", label: "Risk & Opportunity" },
          { icon: "⚡", label: "Parallel Execution" },
        ].map(cap => (
          <div key={cap.label} className="px-2 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
            <div className="text-base mb-1">{cap.icon}</div>
            <div className="text-[10px] text-slate-500">{cap.label}</div>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
