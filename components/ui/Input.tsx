import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** green = farmer-facing modules (coffee/dairy/poultry/small ruminants). gold = cooperative/B2B surfaces. */
export type FieldAccent = "green" | "gold";

const RING_CLASSES: Record<FieldAccent, string> = {
  green: "focus:border-emerald-600 focus:ring-emerald-600/30",
  gold: "focus:border-[#C9A96E] focus:ring-[#C9A96E]/30",
};

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  accent?: FieldAccent;
  /** Marks the field as invalid — overrides the accent ring with a red one. */
  error?: boolean;
}

/**
 * Note on <input type="date"|"time"|"datetime-local"> and dark chrome:
 * app/globals.css already forces `color-scheme: dark` and re-themes the
 * native calendar icon for elements matching `bg-[#0A0C10]` (this
 * component's default background) — no extra work needed here.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, accent = "green", error = false, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      aria-invalid={error || undefined}
      className={cn(
        "w-full px-3 py-2.5 rounded-lg border bg-[#0A0C10] text-sm text-white",
        "placeholder:text-[#6B7280] outline-none transition-colors focus:ring-1",
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
