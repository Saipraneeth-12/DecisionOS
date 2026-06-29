"use client";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { User, Bot, Copy, Check } from "lucide-react";
import { useState } from "react";
import { cn, formatDate } from "@/lib/utils";

interface MessageBubbleProps {
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: string;
  isStreaming?: boolean;
}

export function MessageBubble({ role, content, createdAt, isStreaming }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (role === "user") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-end gap-3 group"
      >
        <div className="max-w-[75%] flex flex-col items-end gap-1">
          <div className="px-4 py-3 rounded-2xl rounded-tr-sm bg-indigo-600/25 border border-indigo-500/25 text-sm text-slate-200 leading-relaxed">
            {content}
          </div>
          {createdAt && <span className="text-[10px] text-slate-600">{formatDate(createdAt)}</span>}
        </div>
        <div className="w-7 h-7 rounded-full bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center flex-shrink-0 mt-1">
          <User className="w-3.5 h-3.5 text-indigo-400" />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3 group"
    >
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 mt-1">
        <Bot className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="relative">
          <div className={cn(
            "prose-dark text-sm leading-relaxed",
            isStreaming && "typing-cursor"
          )}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ className, children, ...props }) {
                  const isBlock = className?.includes("language-");
                  if (isBlock) {
                    return (
                      <pre className="bg-black/40 border border-white/[0.08] rounded-lg p-3 overflow-x-auto my-2">
                        <code className={cn("text-xs font-mono text-slate-300", className)} {...props}>
                          {children}
                        </code>
                      </pre>
                    );
                  }
                  return (
                    <code className="bg-indigo-500/15 text-indigo-300 px-1.5 py-0.5 rounded text-[0.82em] font-mono" {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {content}
            </ReactMarkdown>
          </div>

          {/* Copy button */}
          {!isStreaming && content && (
            <button
              onClick={handleCopy}
              className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-500 hover:text-slate-300"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            </button>
          )}
        </div>
        {createdAt && !isStreaming && (
          <span className="text-[10px] text-slate-600 mt-1 block">{formatDate(createdAt)}</span>
        )}
      </div>
    </motion.div>
  );
}
