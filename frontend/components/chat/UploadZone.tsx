"use client";
import { useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, X, FileText, CheckCircle2, Loader2 } from "lucide-react";
import { uploadDocument } from "@/lib/api";
import { useChatStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface UploadZoneProps {
  conversationId: string;
  onClose: () => void;
}

const DOC_TYPES = [
  { icon: "📊", label: "CRM Export", ext: ".csv, .xlsx" },
  { icon: "📝", label: "Meeting Transcript", ext: ".txt, .docx, .pdf" },
  { icon: "📋", label: "Playbook / Policy", ext: ".pdf, .docx" },
  { icon: "📄", label: "Contract / SOW", ext: ".pdf, .docx" },
  { icon: "📧", label: "Email Thread", ext: ".txt, .eml" },
];

export function UploadZone({ conversationId, onClose }: UploadZoneProps) {
  const { addUploadedDoc } = useChatStore();
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<string[]>([]);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    const newUploaded: string[] = [];

    for (const file of Array.from(files)) {
      try {
        const doc = await uploadDocument(conversationId, file);
        addUploadedDoc(conversationId, doc);
        newUploaded.push(file.name);
        toast.success(`Uploaded: ${file.name}`);
      } catch {
        toast.error(`Failed to upload: ${file.name}`);
      }
    }
    setUploaded(prev => [...prev, ...newUploaded]);
    setUploading(false);
  }, [conversationId]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="mx-4 mb-3 rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <span className="text-xs font-medium text-slate-300">Upload Context Documents</span>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-3">
        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "relative border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer",
            dragging
              ? "border-indigo-500/60 bg-indigo-500/10"
              : "border-white/[0.08] hover:border-indigo-500/30 hover:bg-white/[0.02]"
          )}
          onClick={() => document.getElementById("file-input")?.click()}
        >
          <input
            id="file-input"
            type="file"
            multiple
            className="hidden"
            accept=".pdf,.docx,.doc,.txt,.csv,.xlsx,.xls,.eml"
            onChange={e => handleFiles(e.target.files)}
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
              <p className="text-sm text-slate-400">Uploading & parsing...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-8 h-8 text-slate-600" />
              <p className="text-sm text-slate-400">Drop files here or <span className="text-indigo-400">browse</span></p>
              <p className="text-xs text-slate-600">PDF, DOCX, TXT, CSV, XLSX</p>
            </div>
          )}
        </div>

        {/* Document type hints */}
        <div className="grid grid-cols-3 gap-1.5">
          {DOC_TYPES.map(dt => (
            <div key={dt.label} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
              <span className="text-xs">{dt.icon}</span>
              <div>
                <p className="text-[10px] text-slate-400 font-medium">{dt.label}</p>
                <p className="text-[9px] text-slate-600">{dt.ext}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Uploaded list */}
        {uploaded.length > 0 && (
          <div className="space-y-1">
            {uploaded.map(name => (
              <div key={name} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span className="text-xs text-emerald-300 truncate">{name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
