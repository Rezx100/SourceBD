"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/dashboard/controls";

export function SaveSearchForm({ search, defaultName }: { search: string; defaultName: string }) {
  const router = useRouter();
  const [name, setName] = useState(defaultName.slice(0, 120));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="flex max-w-lg flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError(null);
        const res = await fetch("/api/v1/saved-searches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, search }),
        });
        setPending(false);
        if (res.status === 401) {
          setError("Sign in to save a search.");
          return;
        }
        if (!res.ok) {
          setError("Could not save this search.");
          return;
        }
        router.push("/app/searches");
        router.refresh();
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink-strong">Name</span>
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          required
          className="h-control rounded-sm border border-line-strong bg-surface px-3 text-ink-strong"
        />
      </label>
      {error ? <p className="text-sm text-ink-strong">{error}</p> : null}
      <Button type="submit" variant="primary" disabled={pending || !name.trim()}>
        Save search
      </Button>
    </form>
  );
}
