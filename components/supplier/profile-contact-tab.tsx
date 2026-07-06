import type { ReactNode } from "react";
import Link from "next/link";

import { PhonesReveal } from "@/components/supplier/phones-reveal";
import {
  ProfileCard,
  ProfileCardHeader,
  ProfileEmptyState,
  ProfileTabStack,
} from "@/components/supplier/profile-ui";

function MaskedContactFields() {
  // Masked values are short fixed strings, so phones ≥360px can afford the
  // two-column layout instead of stacking four rows of redacted text.
  return (
    <dl className="grid gap-x-5 gap-y-4 xs:grid-cols-2 sm:gap-x-7">
      {[
        ["Phone", "+880-2-XXXXXXXX"],
        ["Email", "XXXXXX@XXXXX.com"],
        ["Website", "XXXXXX.com"],
        ["Contact", "Mr. XXXXXX XXXXXX"],
      ].map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-[12.5px] font-semibold text-neutral-500">{label}</dt>
          <dd className="mt-1 select-none font-mono text-[14px] font-medium text-transparent [background-clip:text] [text-shadow:0_0_8px_rgba(15,15,20,0.35)]">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export type UnlockedContactFields = {
  email: string | null;
  phone: string | null;
  phones: string[];
  name: string | null;
  role: string | null;
  website: string | null;
};

type GatedCta = {
  title: string;
  body: string;
  action?: ReactNode;
};

/** Shared contact tab — same card shell on app and marketing routes. */
export function ProfileContactTab(props: {
  meta: string;
  gated?: GatedCta;
  unlocked?: UnlockedContactFields | null;
}) {
  const { meta, gated, unlocked } = props;

  let body: ReactNode;
  if (unlocked) {
    const hasAny =
      unlocked.phone ||
      unlocked.email ||
      unlocked.website ||
      unlocked.name ||
      unlocked.phones.length > 0;
    body = hasAny ? (
      <dl className="grid gap-x-7 gap-y-4 sm:grid-cols-2">
        {unlocked.phones.length > 0 ? (
          <ContactFact label="Phone">
              <PhonesReveal phones={unlocked.phones} />
          </ContactFact>
        ) : unlocked.phone ? (
          <ContactFact label="Phone">
            <a href={`tel:${unlocked.phone}`}>{unlocked.phone}</a>
          </ContactFact>
        ) : null}
        {unlocked.email ? (
          <ContactFact label="Email">
            <a href={`mailto:${unlocked.email}`}>{unlocked.email}</a>
          </ContactFact>
        ) : null}
        {unlocked.website ? (
          <ContactFact label="Website">
            <a href={unlocked.website} target="_blank" rel="noopener noreferrer">
              {unlocked.website}
            </a>
          </ContactFact>
        ) : null}
        {unlocked.name ? (
          <ContactFact label="Contact">
            {unlocked.name}
            {unlocked.role ? `, ${unlocked.role}` : ""}
          </ContactFact>
        ) : null}
      </dl>
    ) : (
      <ProfileEmptyState>
        No contact information on file for this supplier.
      </ProfileEmptyState>
    );
  } else {
    body = (
      <>
        <MaskedContactFields />
        {gated ? (
          <div className="mt-4 rounded-lg border border-dashed border-brand-forest/40 bg-brand-forest-soft/60 p-4 text-center">
            <p className="font-display text-[16px] font-bold text-neutral-950">
              {gated.title}
            </p>
            <p className="mx-auto mt-1 max-w-2xl text-[14px] leading-6 text-neutral-600">
              {gated.body}
            </p>
            {gated.action ?? null}
          </div>
        ) : null}
      </>
    );
  }

  return (
    <ProfileTabStack>
      <ProfileCard>
        <ProfileCardHeader title="Contact" meta={meta} />
        {body}
      </ProfileCard>
    </ProfileTabStack>
  );
}

function ContactFact({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[12.5px] font-semibold text-neutral-500">{label}</dt>
      <dd className="mt-1 break-words font-mono text-[14px] font-medium text-neutral-900 [&_a]:text-brand-forest [&_a]:underline [&_a]:decoration-brand-forest/30 [&_a]:underline-offset-2">
        {children}
      </dd>
    </div>
  );
}

/** App buyer — gated contact with pricing CTA. */
export function ProfileContactTabAppBuyer({ slug }: { slug: string }) {
  return (
    <ProfileContactTab
      meta="Free tier · contact gated"
      gated={{
        title: "Unlock verified contacts",
        body: "Direct-dial phone, decision-maker email, and principal contact name + title for every supplier in your saved list. Server-enforced; we never ship masked PII to the browser.",
        action: (
          <Link
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-forest px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-forest-mid"
            href={`/pricing?from=/app/suppliers/${slug}`}
          >
            See plans
          </Link>
        ),
      }}
    />
  );
}

/** Marketing — gated contact with signup CTA. */
export function ProfileContactTabMarketing({
  nextPath,
  disabled,
}: {
  nextPath: string;
  disabled: boolean;
}) {
  return (
    <ProfileContactTab
      meta={
        disabled
          ? "Contact disabled — sanctions flag active"
          : "Sign up free to unlock"
      }
      gated={{
        title: disabled
          ? "Contact disabled while a sanctions flag is active"
          : "Sign up free to view verified contacts",
        body: disabled
          ? "We render the profile so you can do diligence on the hit. Direct contact is held back until the listing clears."
          : "Direct-dial phone, decision-maker email, and principal contact name + title for every supplier. Server-enforced; we never ship masked PII to the browser.",
        action: disabled ? undefined : (
          <Link
            href={`/signup?next=${encodeURIComponent(nextPath)}`}
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-forest px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-forest-mid"
          >
            Sign up free
          </Link>
        ),
      }}
    />
  );
}
