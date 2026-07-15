import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind class strings safely — later classes win over earlier
 * conflicting ones (e.g. `cn('px-2', condition && 'px-4')` resolves to
 * `px-4` instead of leaving both in the DOM).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
