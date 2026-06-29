"use client";
import { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Paperclip, Mic, Square, Sparkles, ChevronDown } from "lucide-react";
import { useChatStore } from "@/lib/store";
import { cn, DOMAINS } from "@/lib/utils";

interface ChatInputProps {
  onSend: (message: string) => void;
  onUpload: () => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, onUpload, disabled }: ChatInputProps) {
  const { isStreaming, selectedDomain, setSelectedDomain } = useChatStore();
  const [value, setValue] = useState("");
  const [domainOpen, setDomainOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 140) + "px";
  }, [value]);

  function handleSubmit() {
    const msg = value.trim();
    if (!msg || disabled || isStreaming) return;
    setValue("");
    onSend(msg);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  const currentDomain = DOMAINS.find(d => d.value === selectedDomain)?.label ?? "Domain";

  return (
    <div className="relative">
      <div className={cn(
        "flex flex-col gap-0 rounded-2xl border transition-all duration-200",
        "bg-white/[0.03] border-white/[0.08]",
        "focus-within:border-indigo-500/40 focus-within:bg-white/[0.04]",
        disabled && "opacity-60"
      )}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe your decision challenge... (e.g. 'Acme Corp is at risk of churning, renewal in 45 days')"
          disabled={disabled || isStreaming}
          rows={1}
          className="w-full px-4 pt-3.5 pb-2 bg-transparent text-sm text-slate-200 placeholder:text-slate-600 outline-none resize-none leading-relaxed"
        />

        <div className="flex items-center justify-between px-3 pb-3">
          <div className="flex items-center gap-2">
            {/* Upload */}
            <button
              onClick={onUpload}
              disabled={disabled}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] transition-all"
              title="Upload documents"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Domain selector */}
            <div className="relative">
              <button
                onClick={() => setDomainOpen(!domainOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-slate-400 hover:text-slate-200 bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.06] transition-all"
              >
                <Sparkles className="w-3 h-3 text-indigo-400" />
                {currentDomain}
                <ChevronDown className="w-3 h-3" />
              </button>
              <AnimatePresence>
                {domainOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    className="absolute bottom-full mb-2 left-0 z-50 w-48 rounded-xl glass border border-white/[0.08] overflow-hidden shadow-xl"
                  >
                    {DOMAINS.map(d => (
                      <button
                        key={d.value}
                        onClick={() => { setSelectedDomain(d.value); setDomainOpen(false); }}
                        className={cn(
                          "w-full text-left px-3 py-2 text-xs transition-colors",
                          selectedDomain === d.value
                            ? "bg-indigo-600/20 text-indigo-300"
                            : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
                        )}
                      >
                        {d.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {value.length > 0 && (
              <span className="text-[10px] text-slate-600">{value.length} chars</span>
            )}
          </div>

          {/* Send / Stop */}
          <button
            onClick={isStreaming ? undefined : handleSubmit}
            disabled={disabled || (!isStreaming && !value.trim())}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all",
              isStreaming
                ? "bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30"
                : value.trim()
                  ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                  : "bg-white/[0.04] text-slate-600 cursor-not-allowed"
            )}
          >
            {isStreaming ? (
              <><Square className="w-3 h-3" /> Stop</>
            ) : (
              <><Send className="w-3 h-3" /> Analyze</>
            )}
          </button>
        </div>
      </div>

      {/* Enter hint */}
      <p className="text-center text-[10px] text-slate-700 mt-1.5">
        Press <kbd className="px-1 py-0.5 rounded bg-white/[0.06] text-slate-600">Enter</kbd> to analyze · <kbd className="px-1 py-0.5 rounded bg-white/[0.06] text-slate-600">Shift+Enter</kbd> for newline
      </p>
    </div>
  );
}
