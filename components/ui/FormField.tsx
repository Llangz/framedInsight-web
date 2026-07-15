import type { ReactNode } from "react";
import { Label } from "./Label";
import { cn } from "@/lib/utils";

export interface FormFieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  /** Shown in red below the field when set; suppresses `hint`. */
  error?: string;
  /** Muted helper text shown below the field when there's no error. */
  hint?: string;
  children: ReactNode;
  className?: string;
}

/** Wraps a single Input/Select/Textarea with a consistent label + hint/error row. */
export function FormField({
  label,
  htmlFor,
  required,
  error,
  hint,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <Label htmlFor={htmlFor} required={required}>
        {label}
      </Label>
      {children}
      {error ? (
        <p className="text-[11px] text-red-500">{error}</p>
      ) : hint ? (
        <p className="text-[11px] text-[#6B7280]">{hint}</p>
      ) : null}
    </div>
  );
}
