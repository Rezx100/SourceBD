import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

import { fontSize } from "@/lib/design/tokens"

// tailwind-merge reads an unknown `text-*` as a colour, so a named size
// followed by an ink (`text-title … text-ink-strong`) lost the size. Every
// size in the token scale is declared a size here (the t-shirt names it
// already knew), so a new named size cannot fall into the same hole.
const twMerge = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: Object.keys(fontSize) }] } },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
