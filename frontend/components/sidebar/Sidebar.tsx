"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, Trash2, MessageSquare, Settings,
  Zap, BarChart3, Users, Cpu, Globe, Building, Activity,
  ChevronRight, Pin, X, LayoutTemplate, Filter,
} from "lucide-react";
import { useChatStore } from "@/lib/store";
import {
  fetchConversations, createConversation, deleteConversation, type Conversation,
} from "@/lib/api";
import { cn, formatDate, getDomainLabel, DOMAINS, DECISION_TEMPLATES, type DecisionTemplate } from "@/lib/utils";
import { StageBadge } from "../ui/stage-badge";
import toast from "react-hot-toast";

const DOMAIN_DOT: Record<string, string> = {
  customer_success: "bg-emerald-400",
  sales:            "bg-blue-400",
  healthcare:       "bg-pink-400",
  energy:           "bg-yellow-400",
  staffing:         "bg-purple-400",
  banking:          "bg-cyan-400",
  general:          "bg-slate-400",
};
const DOMAIN_TEXT: Record<string, string> = {
  customer_success: "text-emerald-400",
  sales:            "text-blue-400",
  healthcare:       "text-pink-400",
  energy:           "text-yellow-400",
  staffing:         "text-purple-400",
  banking:          "text-cyan-400",
  general:          "text-slate-400",
};

export function Sidebar() {
  const {
    conversations, setConversations, addConversation, removeConversation,
    updateConversation, activeConversationId, setActiveConversation,
    sidebarOpen, selectedDomain, setSelectedDomain,
    resetConversationState, setMessages,
  } = useChatStore();

  const [search,        setSearch]        = useState("");
  const [showNewForm,   setShowNewForm]   = useState(false);
  const [newTitle,      setNewTitle]      = useState("");
  const [loading,       setLoading]       = useState(false);
  const [activeSection, setActiveSection] = useState<"conversations" | "templates">("conversations");
  const prevActiveId = useRef<string | null>(null);

  useEffect(() => { loadConversations(); }, []);

  useEffect(() => {
    const cur = activeConversationId;
    if (cur && cur !== prevActiveId.current) {
      prevActiveId.current = cur;
      const exists = useChatStore.getState().conversations.some((c) => c.id === cur);
      if (!exists) loadConversations();
    }
  }, [activeConversationId]);

  async function loadConversations() {
    try { const c = await fetchConversations(); setConversations(c); } catch {}
  }

  async function handleNew() {
    const title = newTitle.trim() || "Untitled Analysis";
    setLoading(true);
    try {
      const conv = await createConversation(title, selectedDomain);
      addConversation(conv);
      setActiveConversation(conv.id);
      setShowNewForm(false); setNewTitle("");
      resetState();
    } catch { toast.error("Failed to create analysis"); }
    setLoading(false);
  }

  async function handleTemplate(t: DecisionTemplate) {
    setLoading(true);
    try {
      const conv = await createConversation(t.title, t.domain);
      addConversation(conv);
      setActiveConversation(conv.id);
      setSelectedDomain(t.domain);
      resetState();
      toast.success(`${t.icon} Template loaded`);
    } catch { toast.error("Failed to load template"); }
    setLoading(false);
    setActiveSection("conversations");
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await deleteConversation(id);
      removeConversation(id);
      if (activeConversationId === id) { setActiveConversation(null); resetState(); }
      toast.success("Deleted");
    } catch { toast.error("Failed"); }
  }

  function handleSelect(id: string) {
    if (activeConversationId === id) return;
    setActiveConversation(id);
    resetState();
  }

  function resetState() {
    resetConversationState();
  }

  const filtered = conversations.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return c.title.toLowerCase().includes(q) || (c.summary ?? "").toLowerCase().includes(q);
  });
  const pinned = filtered.filter((c) => c.is_pinned);
  const recent = filtered.filter((c) => !c.is_pinned);

  if (!sidebarOpen) return null;

  return (
    <motion.aside initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }}
      transition={{ type: "spring", damping: 28, stiffness: 220 }}
      className="w-[300px] flex-shrink-0 h-full flex flex-col border-r border-white/[0.08] overflow-hidden bg-[#0E1020]/95 backdrop-blur-md">

      {/* ── Logo & New Analysis ── */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-white/[0.06] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Cpu className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-[13px] font-bold text-white tracking-tight leading-none">DecisionOS</h1>
              <p className="text-[9px] text-slate-500 mt-0.5">Agentic Intelligence</p>
            </div>
          </div>
          <button className="p-1.5 rounded-lg text-slate-600 hover:text-slate-400 hover:bg-white/[0.04] transition-all" title="Settings">
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
        <button onClick={() => { setShowNewForm(true); setActiveSection("conversations"); }}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-500/20">
          <Plus className="w-3.5 h-3.5" />New Analysis
        </button>
      </div>

      {/* ── New form ── */}
      <AnimatePresence>
        {showNewForm && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-b border-white/[0.06] flex-shrink-0">
            <div className="px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">New Analysis</span>
                <button onClick={() => setShowNewForm(false)} className="text-slate-600 hover:text-slate-400 transition-colors"><X className="w-3.5 h-3.5" /></button>
              </div>
              <input autoFocus value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleNew()}
                placeholder="Title (optional)…"
                className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl text-xs text-white placeholder:text-slate-600 outline-none focus:border-indigo-500/50" />
              <select value={selectedDomain} onChange={(e) => setSelectedDomain(e.target.value)}
                className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl text-xs text-slate-300 outline-none focus:border-indigo-500/50">
                {DOMAINS.map((d) => <option key={d.value} value={d.value} className="bg-[#0f0f1a]">{d.label}</option>)}
              </select>
              <div className="flex gap-2">
                <button onClick={handleNew} disabled={loading}
                  className="flex-1 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold disabled:opacity-40">
                  {loading ? "Creating…" : "Create"}
                </button>
                <button onClick={() => setShowNewForm(false)}
                  className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] text-slate-400 text-xs">Cancel</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Tabs ── */}
      <div className="flex-shrink-0 flex px-3 pt-2.5 pb-2 gap-1">
        {[["conversations", "Conversations", <MessageSquare key="c" className="w-3 h-3" />] as const,
          ["templates",     "Templates",     <LayoutTemplate key="t" className="w-3 h-3" />] as const,
        ].map(([val, label, icon]) => (
          <button key={val} onClick={() => setActiveSection(val)}
            className={cn("flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-semibold border transition-all",
              activeSection === val ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/30" : "bg-white/[0.02] text-slate-500 border-white/[0.06] hover:text-slate-400")}>
            {icon}{label}
          </button>
        ))}
      </div>

      {/* ── Search (conversations tab) ── */}
      {activeSection === "conversations" && (
        <div className="flex-shrink-0 px-3 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search analyses & metrics…"
              className="w-full pl-9 pr-3 py-1.5 bg-[#131628] border border-white/[0.08] rounded-xl text-xs text-white placeholder:text-slate-500 outline-none focus:border-[#8B5CF6]/50 focus:ring-1 focus:ring-[#8B5CF6]/50 shadow-inner transition-all duration-200" />
          </div>
        </div>
      )}

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">
        {activeSection === "conversations" && (
          <div className="px-2 pb-4">
            {pinned.length > 0 && (
              <div className="mb-1">
                <div className="flex items-center gap-1.5 px-2 py-1.5">
                  <Pin className="w-2.5 h-2.5 text-indigo-400" />
                  <span className="text-[9px] uppercase tracking-widest text-slate-600 font-semibold">Pinned</span>
                </div>
                {pinned.map((c) => <ConvItem key={c.id} conv={c} active={activeConversationId === c.id} onSelect={handleSelect} onDelete={handleDelete} />)}
              </div>
            )}
            {recent.length > 0 && (
              <div>
                {pinned.length > 0 && (
                  <div className="flex items-center gap-1.5 px-2 py-1.5 mt-1">
                    <span className="text-[9px] uppercase tracking-widest text-slate-600 font-semibold">Recent</span>
                  </div>
                )}
                {recent.map((c) => <ConvItem key={c.id} conv={c} active={activeConversationId === c.id} onSelect={handleSelect} onDelete={handleDelete} />)}
              </div>
            )}
            {filtered.length === 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-10 text-center px-4 space-y-3">
                <div className="w-10 h-10 mx-auto rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-slate-600" />
                </div>
                <p className="text-xs text-slate-500 font-medium">No analyses yet</p>
                <p className="text-[10px] text-slate-700 leading-relaxed">Create your first analysis or pick a template.</p>
                <button onClick={() => setShowNewForm(true)}
                  className="w-full py-2 rounded-xl border border-indigo-500/30 bg-indigo-500/8 text-indigo-400 text-xs font-semibold hover:bg-indigo-500/18 transition-all">
                  + New Analysis
                </button>
              </motion.div>
            )}
          </div>
        )}

        {activeSection === "templates" && (
          <div className="px-3 pb-4 space-y-2 pt-1">
            <p className="text-[10px] text-slate-700 px-1">Click to start a pre-configured analysis.</p>
            {DECISION_TEMPLATES.map((t, i) => (
              <motion.button key={t.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                onClick={() => handleTemplate(t)}
                className="w-full text-left p-3 rounded-xl border border-white/[0.06] bg-white/[0.015] hover:bg-white/[0.04] hover:border-indigo-500/20 transition-all group">
                <div className="flex items-start gap-2.5">
                  <span className="text-base flex-shrink-0 mt-0.5">{t.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="text-[11px] font-semibold text-slate-200 group-hover:text-white truncate">{t.title}</span>
                      <ChevronRight className="w-3 h-3 text-slate-600 group-hover:text-indigo-400 flex-shrink-0 transition-colors" />
                    </div>
                    <p className="text-[10px] text-slate-600 line-clamp-2 leading-relaxed">{t.description}</p>
                    <span className={cn("inline-block mt-1.5 text-[9px] px-1.5 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06]", DOMAIN_TEXT[t.domain] ?? "text-slate-500")}>
                      {getDomainLabel(t.domain)}
                    </span>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="flex-shrink-0 p-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-white/[0.03] transition-colors cursor-pointer">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">JD</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white font-medium leading-none truncate">John Doe</p>
            <p className="text-[10px] text-slate-500 mt-0.5 truncate">Senior Analyst</p>
          </div>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
        </div>
      </div>
    </motion.aside>
  );
}

// ── Conversation Item ─────────────────────────────────────────────────────

function ConvItem({ conv, active, onSelect, onDelete }: {
  conv: Conversation; active: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
}) {
  return (
    <motion.div onClick={() => onSelect(conv.id)} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
      className={cn("group relative flex flex-col gap-1.5 px-3.5 py-3 rounded-xl cursor-pointer transition-all duration-200 border",
        active 
          ? "bg-gradient-to-r from-indigo-500/8 via-purple-550/4 to-transparent border-white/[0.08] border-l-2 border-l-[#8B5CF6]" 
          : "hover:bg-white/[0.02] border-transparent hover:border-white/[0.06] hover:translate-x-0.5"
      )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <span className={cn("w-2 h-2 rounded-full flex-shrink-0 mt-0.5", DOMAIN_DOT[conv.domain] ?? "bg-slate-400")} />
          <span className="text-xs font-semibold text-slate-200 group-hover:text-white truncate leading-tight">{conv.title}</span>
        </div>
        <button onClick={(e) => onDelete(conv.id, e)}
          className="opacity-0 group-hover:opacity-100 transition-all duration-200 flex-shrink-0 p-0.5 hover:text-red-400 text-slate-500 rounded">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex items-center gap-2 pl-4.5">
        <StageBadge stage={conv.status ?? "gathering_context"} size="xs" />
        <span className="text-[9px] text-slate-500 ml-auto font-mono">{formatDate(conv.updated_at)}</span>
      </div>
      {conv.message_count > 0 && (
        <div className="pl-4.5 flex items-center gap-1.5 text-[9px] text-slate-500">
          <span>{getDomainLabel(conv.domain)}</span>
          <span>•</span>
          <span>{conv.message_count} msg{conv.message_count !== 1 ? "s" : ""}</span>
        </div>
      )}
    </motion.div>
  );
}
