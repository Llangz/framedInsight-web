import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Surface color matches the de-facto standard already used ~150+ times
 * across dashboard pages (bg-[#0D0F14] / border-[#2A2D35]), not the
 * `.card` utility class in globals.css (bg-[#18181b] / border-[#27272a]),
 * which is legacy and only still used on a handful of marketing pages.
 */
export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function Card(
  { className, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn("rounded-xl border border-[#2A2D35] bg-[#0D0F14]", className)}
      {...props}
    />
  );
});
