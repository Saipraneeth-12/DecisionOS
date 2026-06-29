"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useChatStore } from "@/lib/store";
import { streamChat, fetchConversation } from "@/lib/api";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import { SuggestedPrompts } from "./SuggestedPrompts";
import { UploadZone } from "./UploadZone";
import { ChecklistPanel } from "../agents/ChecklistPanel";
import { Loader2, LayoutDashboard, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

export function ChatPanel() {
  const {
    activeConversationId, messages, setMessages, addMessage,
    isStreaming, setIsStreaming,
    streamingText, appendStreamText, clearStreamText,
    updateAgentStatus, resetAgentTimeline,
    setChecklist, setChecklistVisible,
    setDashboard, setRecommendation, dashboard,
    selectedDomain, setSelectedDomain,
    toggleRightPanel, rightPanelOpen,
    updateConversation,
  } = useChatStore();

  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [loadingConv, setLoadingConv] = useState(false);

  const activeMessages = activeConversationId ? (messages[activeConversationId] ?? []) : [];

  // Load conversation messages when switching
  useEffect(() => {
    if (!activeConversationId) return;
    if (messages[activeConversationId]) return; // already loaded
    loadConversation(activeConversationId);
  }, [activeConversationId]);

  async function loadConversation(id: string) {
    setLoadingConv(true);
    try {
      const data = await fetchConversation(id);
      setMessages(id, data.messages ?? []);
    } catch {
      // silently fail
    }
    setLoadingConv(false);
  }

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages.length, streamingText]);

  const handleSend = useCallback((message: string, domain?: string) => {
    if (isStreaming) return;
    const useDomain = domain ?? selectedDomain;

    // Optimistically add user message
    const tempUserMsg = {
      id: `tmp-${Date.now()}`,
      conversation_id: activeConversationId ?? "new",
      role: "user" as const,
      content: message,
      metadata: {},
      created_at: new Date().toISOString(),
    };

    let convId = activeConversationId;

    if (!convId) {
      // We'll get it from the stream
      addMessage("new", tempUserMsg);
    } else {
      addMessage(convId, tempUserMsg);
    }

    // Reset state for new execution
    resetAgentTimeline();
    clearStreamText();
    setDashboard(null);
    setRecommendation(null);
    setChecklistVisible(false);
    setIsStreaming(true);

    abortRef.current = new AbortController();

    let resolvedConvId: string | null = convId;
    let streamBuffer = "";

    streamChat(
      message,
      convId,
      useDomain,
      (event) => {
        switch (event.type) {
          case "text": {
            const text = (event.data as { content?: string }).content ?? "";
            streamBuffer += text;
            appendStreamText(text);
            break;
          }

          case "agent_start": {
            const d = event.data as { agent_name: string };
            updateAgentStatus(d.agent_name, "running");
            break;
          }

          case "agent_complete": {
            const d = event.data as { agent_name: string; latency_ms?: number; output?: Record<string, unknown> };
            updateAgentStatus(d.agent_name, "completed", d.output, d.latency_ms);
            break;
          }

          case "checklist": {
            const d = event.data as { checklist: unknown[]; can_proceed: boolean };
            setChecklist((d.checklist as Parameters<typeof setChecklist>[0]));
            setChecklistVisible(true);
            break;
          }

          case "recommendation": {
            setRecommendation(event.data as unknown as Parameters<typeof setRecommendation>[0]);
            break;
          }

          case "dashboard": {
            setDashboard(event.data as unknown as Parameters<typeof setDashboard>[0]);
            break;
          }

          case "error": {
            const d = event.data as { message?: string };
            toast.error(d.message ?? "An error occurred");
            setIsStreaming(false);
            break;
          }

          case "done": {
            const d = event.data as { conversation_id?: string; error?: boolean; total_execution_ms?: number };
            resolvedConvId = d.conversation_id ?? convId;

            if (!d.error && streamBuffer) {
              const assistantMsg = {
                id: `asst-${Date.now()}`,
                conversation_id: resolvedConvId ?? "new",
                role: "assistant" as const,
                content: streamBuffer,
                metadata: {},
                created_at: new Date().toISOString(),
              };
              if (resolvedConvId) {
                addMessage(resolvedConvId, assistantMsg);
                // Sync user message to correct conv id
                if (resolvedConvId !== "new" && resolvedConvId !== convId) {
                  const updatedUser = { ...tempUserMsg, conversation_id: resolvedConvId };
                  setMessages(resolvedConvId, [updatedUser, assistantMsg]);
                }
              }
              if (d.total_execution_ms) {
                toast.success(`Completed in ${(d.total_execution_ms / 1000).toFixed(1)}s`, { icon: "⚡" });
              }
            }
            clearStreamText();
            setIsStreaming(false);
            break;
          }
        }
      },
      abortRef.current.signal
    );
  }, [activeConversationId, isStreaming, selectedDomain]);

  const handleSuggestedPrompt = (prompt: string, domain: string) => {
    setSelectedDomain(domain);
    handleSend(prompt, domain);
  };

  const hasMessages = activeMessages.length > 0;
  const showEmpty = !hasMessages && !isStreaming;

  return (
    <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
      {/* Top bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-medium text-slate-200">
            {activeConversationId
              ? useChatStore.getState().conversations.find(c => c.id === activeConversationId)?.title ?? "Conversation"
              : "DecisionOS"}
          </span>
          {isStreaming && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/20">
              <Loader2 className="w-2.5 h-2.5 text-indigo-400 animate-spin" />
              <span className="text-[10px] text-indigo-400">Analyzing...</span>
            </div>
          )}
        </div>
        <button
          onClick={toggleRightPanel}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all",
            rightPanelOpen
              ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
              : "bg-white/[0.04] text-slate-400 hover:text-slate-200 border border-white/[0.06]"
          )}
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          Dashboard
        </button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6">
          {loadingConv && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
            </div>
          )}

          {showEmpty && !loadingConv && (
            <SuggestedPrompts onSelect={handleSuggestedPrompt} />
          )}

          {!loadingConv && (
            <div className="space-y-6">
              {activeMessages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  role={msg.role as "user" | "assistant"}
                  content={msg.content}
                  createdAt={msg.created_at}
                />
              ))}

              {/* Streaming message */}
              {isStreaming && streamingText && (
                <MessageBubble
                  role="assistant"
                  content={streamingText}
                  isStreaming={true}
                />
              )}

              {/* Typing indicator when streaming but no text yet */}
              {isStreaming && !streamingText && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-3"
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                    <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                  </div>
                  <div className="flex items-center gap-1.5 px-4 py-3 rounded-2xl rounded-tl-sm bg-white/[0.04] border border-white/[0.06]">
                    {[0, 1, 2].map(i => (
                      <motion.div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-slate-400"
                        animate={{ y: [0, -4, 0] }}
                        transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15 }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Checklist */}
      <ChecklistPanel />

      {/* Upload zone */}
      <AnimatePresence>
        {showUpload && activeConversationId && (
          <UploadZone
            conversationId={activeConversationId}
            onClose={() => setShowUpload(false)}
          />
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="flex-shrink-0 px-4 pb-4 pt-2 border-t border-white/[0.06]">
        <div className="max-w-3xl mx-auto">
          <ChatInput
            onSend={(msg) => handleSend(msg)}
            onUpload={() => setShowUpload(!showUpload)}
            disabled={!activeConversationId && false}
          />
        </div>
      </div>
    </div>
  );
}
