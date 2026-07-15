import { forwardRef, type LabelHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(function Label(
  { className, required, children, ...props },
  ref
) {
  return (
    <label
      ref={ref}
      className={cn(
        "block text-xs font-bold uppercase tracking-wide text-[#9CA3AF] mb-1.5",
        className
      )}
      {...props}
    >
      {children}
      {required && <span className="text-emerald-500 ml-0.5">*</span>}
    </label>
  );
});
