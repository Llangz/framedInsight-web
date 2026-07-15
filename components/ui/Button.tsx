"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * variant guide:
 *  - primary   green, farmer-facing modules (coffee/dairy/poultry/small ruminants)
 *  - gold      cooperative & B2B surfaces (intake, lots, passports, buyer data room)
 *  - secondary filled neutral — secondary action next to a primary/gold button
 *  - outline   bordered, transparent — tertiary action
 *  - danger    destructive actions (delete, suspend, revoke)
 *  - ghost     icon-only / nav-row actions, no border or fill at rest
 */
type Variant = "primary" | "gold" | "secondary" | "outline" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-emerald-700 hover:bg-emerald-600 text-white",
  gold: "bg-[#C9A96E] hover:bg-[#B8935C] text-black",
  secondary: "bg-[#17191F] hover:bg-[#1F2128] text-white border border-[#2A2D35]",
  outline: "bg-transparent hover:bg-white/5 text-white border border-[#2A2D35]",
  danger: "bg-red-700 hover:bg-red-600 text-white",
  ghost: "bg-transparent hover:bg-white/5 text-[#9CA3AF] hover:text-white",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2.5 text-sm",
  lg: "px-5 py-3 text-sm",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  /** Shows a spinner and disables the button. Pair with loadingText for forms mid-submit. */
  loading?: boolean;
  loadingText?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = "primary",
    size = "md",
    fullWidth,
    loading = false,
    loadingText,
    disabled,
    children,
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors",
        "disabled:opacity-50 disabled:pointer-events-none",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        fullWidth && "w-full",
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {loading ? loadingText ?? "Saving..." : children}
    </button>
  );
});
