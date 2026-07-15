import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import type { FieldAccent } from "./Input";

const RING_CLASSES: Record<FieldAccent, string> = {
  green: "focus:border-emerald-600 focus:ring-emerald-600/30",
  gold: "focus:border-[#C9A96E] focus:ring-[#C9A96E]/30",
};

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  accent?: FieldAccent;
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, accent = "green", error = false, rows = 3, ...props },
  ref
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={error || undefined}
      className={cn(
        "w-full px-3 py-2.5 rounded-lg border bg-[#0A0C10] text-sm text-white",
        "placeholder:text-[#6B7280] outline-none transition-colors focus:ring-1 resize-y",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        error
          ? "border-red-600 focus:border-red-600 focus:ring-red-600/30"
          : cn("border-[#2A2D35]", RING_CLASSES[accent]),
        className
      )}
      {...props}
    />
  );
});
