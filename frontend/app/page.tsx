"use client";
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { DecisionCanvas } from "@/components/canvas/DecisionCanvas";
import { RightPanel } from "@/components/canvas/RightPanel";
import { useChatStore } from "@/lib/store";
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";

export default function Home() {
  const { sidebarOpen, rightPanelOpen, toggleSidebar, toggleRightPanel } = useChatStore();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "b") { e.preventDefault(); toggleSidebar(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "i") { e.preventDefault(); toggleRightPanel(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleSidebar, toggleRightPanel]);

  return (
    <div className="flex h-screen w-screen overflow-hidden relative grid-bg" style={{ background: "#070814" }}>
      {/* Ambient glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden>
        <div className="absolute top-[-20%] left-[15%] w-[500px] h-[500px] bg-indigo-600/[0.04] rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[20%] w-[400px] h-[400px] bg-purple-600/[0.04] rounded-full blur-[100px]" />
        <div className="absolute top-[40%] left-[50%] w-[300px] h-[300px] bg-cyan-600/[0.02] rounded-full blur-[80px]" />
      </div>

      {/* Left Sidebar */}
      <AnimatePresence initial={false}>
        {sidebarOpen && <Sidebar />}
      </AnimatePresence>

      {/* Sidebar toggle */}
      <motion.button
        onClick={toggleSidebar}
        animate={{ left: sidebarOpen ? 300 : 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 220 }}
        className="fixed top-1/2 -translate-y-1/2 z-40 p-1.5 rounded-r-lg border border-l-0 border-white/[0.07] text-slate-500 hover:text-slate-300 transition-colors"
        style={{ background: "rgba(14,16,32,0.9)" }}
        aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
        title={sidebarOpen ? "Close sidebar (⌘B)" : "Open sidebar (⌘B)"}
      >
        {sidebarOpen ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeftOpen className="w-3.5 h-3.5" />}
      </motion.button>

      {/* Center: Decision Canvas */}
      <div className="flex-1 min-w-0 relative z-10 flex">
        <DecisionCanvas />
      </div>

      {/* Right: OS Intelligence Panel */}
      <AnimatePresence initial={false}>
        {rightPanelOpen && <RightPanel />}
      </AnimatePresence>

      {/* Right panel toggle */}
      <motion.button
        onClick={toggleRightPanel}
        animate={{ right: rightPanelOpen ? 320 : 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 220 }}
        className="fixed top-1/2 -translate-y-1/2 z-40 p-1.5 rounded-l-lg border border-r-0 border-white/[0.07] text-slate-600 hover:text-slate-400 transition-colors"
        style={{ background: "rgba(8,8,14,0.9)" }}
        aria-label={rightPanelOpen ? "Close intelligence panel" : "Open intelligence panel"}
        title={rightPanelOpen ? "Close intelligence panel (⌘I)" : "Open intelligence panel (⌘I)"}
      >
        {rightPanelOpen ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
      </motion.button>
    </div>
  );
}
