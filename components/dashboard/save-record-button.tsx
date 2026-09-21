"use client";

import { useState } from "react";
import { Button } from "@/components/dashboard/controls";
import { Icon } from "@/components/dashboard/icons";

export function SaveRecordButton({
  supplierId,
  saved,
  icon = false,
}: {
  supplierId: string;
  saved: boolean;
  icon?: boolean;
}) {
  const [on, setOn] = useState(saved);
  const [pending, setPending] = useState(false);
  const label = on ? "Saved" : "Save";

  return (
    <Button
      type="button"
      icon={icon}
      disabled={pending}
      aria-pressed={on}
      aria-label={label}
      className={icon ? "h-7 w-7" : undefined}
      onClick={async () => {
        setPending(true);
        const res = on
          ? await fetch(`/api/v1/saved?supplier_id=${encodeURIComponent(supplierId)}`, { method: "DELETE" })
          : await fetch("/api/v1/saved", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ supplier_id: supplierId }),
            });
        setPending(false);
        if (res.ok) setOn(!on);
      }}
    >
      <Icon name="bookmark" /> {icon ? null : label}
    </Button>
  );
}
