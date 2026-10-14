"use client";

// The hero's email field. The address reaches sign-up through this tab's sessionStorage, never the URL (audit P1,
// 14 Oct 2026): a query string lands in server logs, browser history and the next page's Referer. With no script
// the field has no name, so the form opens sign-up with the field empty.

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { SIGNUP_EMAIL_KEY } from "@/components/auth/words";

export function HeroEmailForm({ className, children }: { className?: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <form
      action="/signup"
      method="get"
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const field = e.currentTarget.elements.namedItem("home-email");
        const email = field instanceof HTMLInputElement ? field.value.trim() : "";
        try {
          if (email) sessionStorage.setItem(SIGNUP_EMAIL_KEY, email);
        } catch {
          // Storage refused (private window): sign-up opens with the field empty, as with no script.
        }
        router.push("/signup");
      }}
    >
      {children}
    </form>
  );
}
