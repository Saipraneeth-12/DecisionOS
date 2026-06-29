"use client";
import { motion } from "framer-motion";
import { cn, getStageColor, getStageLabel, getStageIcon } from "@/lib/utils";

interface StageBadgeProps {
  stage: string;
  size?: "xs" | "sm" | "md" | "lg";
  animated?: boolean;
  className?: string;
}

const sizeMap = {
  xs: "px-1.5 py-0.5 text-[9px] rounded",
  sm: "px-2 py-0.5 text-[10px] rounded-md",
  md: "px-2.5 py-1 text-xs rounded-lg",
  lg: "px-3 py-1.5 text-sm rounded-xl",
};

const isAnimatedStage = (stage: string) => stage === "analyzing" || stage === "in_progress";

export function StageBadge({
  stage,
  size = "sm",
  animated = true,
  className,
}: StageBadgeProps) {
  const colorClass = getStageColor(stage);
  const label = getStageLabel(stage);
  const icon = getStageIcon(stage);
  const shouldAnimate = animated && isAnimatedStage(stage);

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "inline-flex items-center gap-1 font-medium border",
        colorClass,
        sizeMap[size],
        className
      )}
    >
      {shouldAnimate ? (
        <motion.span
          animate={{ opacity: [1, 0.4, 1] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          className="text-[0.85em]"
        >
          {icon}
        </motion.span>
      ) : (
        <span className="text-[0.85em]">{icon}</span>
      )}
      {label}
    </motion.span>
  );
}
