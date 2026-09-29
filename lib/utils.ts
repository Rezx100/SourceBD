import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// tailwind-merge reads an unknown `text-*` as a colour, so a named size
// followed by an ink (`text-nav-label … text-ink-muted`) lost the size. The
// phone's named sizes are declared as sizes here.
const twMerge = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: ["page-title", "nav-label"] }] } },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
