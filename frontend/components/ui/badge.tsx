import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "outline" | "success" | "warning" | "danger" | "info" | "purple" | "orange" | "cyan";
  size?: "sm" | "md" | "lg";
  dot?: boolean;
  className?: string;
}

const variants = {
  default:  "bg-slate-700/60 text-slate-300 border-slate-600/40",
  outline:  "bg-transparent text-slate-400 border-slate-600/60",
  success:  "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  warning:  "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  danger:   "bg-red-500/15 text-red-400 border-red-500/30",
  info:     "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
  purple:   "bg-purple-500/15 text-purple-400 border-purple-500/30",
  orange:   "bg-orange-500/15 text-orange-400 border-orange-500/30",
  cyan:     "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
};

const dotColors = {
  default:  "bg-slate-400",
  outline:  "bg-slate-400",
  success:  "bg-emerald-400",
  warning:  "bg-yellow-400",
  danger:   "bg-red-400",
  info:     "bg-indigo-400",
  purple:   "bg-purple-400",
  orange:   "bg-orange-400",
  cyan:     "bg-cyan-400",
};

const sizes = {
  sm: "px-1.5 py-0.5 text-[9px] rounded-md",
  md: "px-2 py-0.5 text-xs rounded-md",
  lg: "px-2.5 py-1 text-xs rounded-lg",
};

export function Badge({
  children,
  variant = "default",
  size = "md",
  dot = false,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-medium border",
        variants[variant],
        sizes[size],
        className
      )}
    >
      {dot && (
        <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", dotColors[variant])} />
      )}
      {children}
    </span>
  );
}
