// A link written the way Paper draws one in an auth page: brand, underlined. Server-safe and client-safe,
// so the forms and the frame share it without the frame's reads reaching the browser.

import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const authLinkClass = "font-medium text-brand underline decoration-1 [text-underline-position:from-font]";

export function AuthLink({ href, children, className, ...rest }: ComponentProps<typeof Link>) {
  return (
    <Link href={href} prefetch={false} className={cn(authLinkClass, className)} {...rest}>
      {children}
    </Link>
  );
}
