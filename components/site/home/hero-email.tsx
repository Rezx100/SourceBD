"use client";

// The hero's email field. The address reaches sign-up through this tab's sessionStorage, never the URL (audit P1,
// 14 Oct 2026): a query string lands in server logs, browser history and the next page's Referer. With no script
// the field has no name, so the form opens sign-up with the field empty.

import { useRouter } from "next/navigation";
import { useRef, type ReactNode } from "react";
import { SIGNUP_EMAIL_KEY } from "@/components/auth/words";

export function HeroEmailForm({ className, children }: { className?: string; children: ReactNode }) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={form}
      action="/signup"
      method="get"
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const email = (form.current?.querySelector<HTMLInputElement>("input[type=email]")?.value ?? "").trim();
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
