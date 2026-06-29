"use client";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Circle, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useChatStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useState } from "react";

export function ChecklistPanel() {
  const { checklist, checklistVisible } = useChatStore();
  const [collapsed, setCollapsed] = useState(false);

  if (!checklistVisible || checklist.length === 0) return null;

  const available = checklist.filter(c => c.status === "available").length;
  const total = checklist.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-4 mb-3 rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden"
    >
      <div
        className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-white/[0.02]"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-300">Information Checklist</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
            {available}/{total}
          </span>
        </div>
        {collapsed ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronUp className="w-3.5 h-3.5 text-slate-500" />}
      </div>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 grid grid-cols-2 gap-1.5">
              {checklist.map((item) => (
                <div
                  key={item.name}
                  className={cn(
                    "flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs",
                    item.status === "available" && "bg-emerald-500/10 text-emerald-400",
                    item.status === "partial" && "bg-yellow-500/10 text-yellow-400",
                    item.status === "missing" && item.required && "bg-red-500/10 text-red-400",
                    item.status === "missing" && !item.required && "bg-slate-500/10 text-slate-500",
                  )}
                >
                  {item.status === "available" && <CheckCircle2 className="w-3 h-3 flex-shrink-0" />}
                  {item.status === "partial" && <AlertCircle className="w-3 h-3 flex-shrink-0" />}
                  {item.status === "missing" && <Circle className="w-3 h-3 flex-shrink-0" />}
                  <span className="truncate">{item.name}</span>
                  {item.required && item.status === "missing" && (
                    <span className="text-[8px] text-red-500 ml-auto flex-shrink-0">req</span>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
