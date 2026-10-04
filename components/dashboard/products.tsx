// The start choice at `/app/products/new` (27 Sep 2026): by hand, or from a description when
// `AI_ENABLED`. The list that used to live here is `components/products` (B7a); the next PR
// replaces this with the v4 start.

import Form from "next/form";
import type { ReactNode } from "react";
import { Button, V2Tag } from "./controls";
import { Icon, type IconName } from "./icons";
import { Caption } from "./type";

/**
 * The first step of `/app/products/new`: start by hand (chosen) or, when
 * `AI_ENABLED`, from a description. A GET form, so Next is a URL
 * (`?start=manual`) and Back returns here.
 */
export function StartChoice({ ai }: { ai: boolean }) {
  return (
    <Form action="/app/products/new" className="flex w-full max-w-[56rem] flex-col gap-4">
      <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
        <legend className="mb-3 text-title font-semibold text-ink-strong">How do you want to start?</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <StartCard value="manual" icon="pencil" title="Start manually" defaultChecked>
            Enter the name, price, size chart and BOM yourself. Only the name is required.
          </StartCard>
          {ai ? (
            <StartCard value="ai" icon="sparkle" title="Start with AI" tag={<V2Tag />}>
              Describe the product in your own words and check the fields drafted from it.
            </StartCard>
          ) : null}
        </div>
        {ai ? null : <Caption>Drafting a product from a description is not available yet.</Caption>}
      </fieldset>
      <div>
        <Button type="submit" variant="primary">
          Next <Icon name="arrow-r" />
        </Button>
      </div>
    </Form>
  );
}

function StartCard({
  value,
  icon,
  title,
  tag,
  defaultChecked = false,
  children,
}: {
  value: string;
  icon: IconName;
  title: string;
  tag?: ReactNode;
  defaultChecked?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md bg-surface p-4 shadow-edge transition-colors duration-fast hover:bg-surface-sunken has-[:checked]:bg-brand-tint has-[:checked]:shadow-[inset_0_0_0_1px_rgb(var(--ds-accent))]">
      <input type="radio" name="start" value={value} defaultChecked={defaultChecked} className="mt-1 size-4 shrink-0" />
      <span className="flex min-w-0 flex-col gap-1">
        <span className="inline-flex items-center gap-2 text-title font-medium text-ink-strong">
          <Icon name={icon} className="text-ink-muted" />
          {title}
          {tag}
        </span>
        <span className="text-sm text-ink-muted">{children}</span>
      </span>
    </label>
  );
}
