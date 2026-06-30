import type { ReactNode } from "react";

import { NumberTicker } from "@/components/ui/number-ticker";
import { cn } from "@/lib/utils";

/** Vertical stack for tab panel content — stable rhythm across tabs. */
export function ProfileTabStack({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("profile-tab-stack", className)}>{children}</div>
  );
}

export function ProfileCard({
  children,
  className,
  id,
  hoverable,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  hoverable?: boolean;
}) {
  return (
    <section
      id={id}
      className={cn("proto-card", hoverable && "hoverable", className)}
    >
      {children}
    </section>
  );
}

export function ProfileCardHeader({
  title,
  meta,
}: {
  title: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <header className="proto-card-head">
      <h2 className="proto-card-title">{title}</h2>
      {meta != null && meta !== "" ? (
        <span className="proto-card-meta">{meta}</span>
      ) : null}
    </header>
  );
}

export function ProfileEmptyState({ children }: { children: ReactNode }) {
  return <p className="profile-empty">{children}</p>;
}

export function ProfileFootnote({ children }: { children: ReactNode }) {
  return <p className="profile-footnote">{children}</p>;
}

export type ProfileKpiItem = {
  key: string;
  label: string;
  value: string;
  numValue?: number;
  sub?: string;
};

export function ProfileKpiGrid({ items }: { items: ProfileKpiItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="profile-kpi-grid">
      {items.map(({ key, ...item }) => (
        <ProfileKpiTile key={key} {...item} />
      ))}
    </div>
  );
}

export function ProfileKpiTile({
  label,
  value,
  numValue,
  sub,
}: ProfileKpiItem) {
  return (
    <div className="profile-kpi-tile">
      <p className="profile-kpi-label">{label}</p>
      <div className="profile-kpi-value">
        {numValue != null ? (
          <NumberTicker value={numValue} className="text-ink-primary" />
        ) : (
          value
        )}
      </div>
      {sub ? <p className="profile-kpi-sub">{sub}</p> : null}
    </div>
  );
}

/** Overview sidebar fact grid — readable labels, not micro-uppercase. */
export function ProfileFactGrid({
  facts,
}: {
  facts: { label: string; value: ReactNode }[];
}) {
  if (facts.length === 0) return null;
  return (
    <dl className="profile-fact-grid">
      {facts.map((f) => (
        <div key={f.label} className="profile-fact-cell">
          <dt className="profile-fact-label">{f.label}</dt>
          <dd className="profile-fact-value">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ProfileStatusBadge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "valid" | "expiring" | "expired" | "evergreen" | "inherited" | "neutral" | "danger";
  className?: string;
}) {
  return (
    <span className={cn("profile-status-badge", tone, className)}>
      {children}
    </span>
  );
}
