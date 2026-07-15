import { forwardRef, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FieldAccent } from "./Input";

const RING_CLASSES: Record<FieldAccent, string> = {
  green: "focus:border-emerald-600 focus:ring-emerald-600/30",
  gold: "focus:border-[#C9A96E] focus:ring-[#C9A96E]/30",
};

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  accent?: FieldAccent;
  error?: boolean;
}

/**
 * Native <select>, styled to match Input. Uses appearance-none + a Lucide
 * chevron rather than relying on the browser's own arrow, which renders
 * inconsistently in light chrome on a dark field. `bg-[#0A0C10]` keeps this
 * covered by the dark option/calendar-chrome fix already in globals.css.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, accent = "green", error = false, children, ...props },
  ref
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        aria-invalid={error || undefined}
        className={cn(
          "w-full appearance-none px-3 py-2.5 pr-9 rounded-lg border bg-[#0A0C10] text-sm text-white",
          "outline-none transition-colors focus:ring-1",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          error
            ? "border-red-600 focus:border-red-600 focus:ring-red-600/30"
            : cn("border-[#2A2D35]", RING_CLASSES[accent]),
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B7280]"
        aria-hidden="true"
      />
    </div>
  );
});
