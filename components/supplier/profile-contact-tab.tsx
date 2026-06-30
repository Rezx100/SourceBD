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
  return (
    <dl className="contact-list">
      <dt>Phone</dt>
      <dd className="masked">+880-2-XXXXXXXX</dd>
      <dt>Email</dt>
      <dd className="masked">XXXXXX@XXXXX.com</dd>
      <dt>Website</dt>
      <dd className="masked">XXXXXX.com</dd>
      <dt>Contact</dt>
      <dd className="masked">Mr. XXXXXX XXXXXX</dd>
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
      <dl className="contact-list">
        {unlocked.phones.length > 0 ? (
          <>
            <dt>Phone</dt>
            <dd>
              <PhonesReveal phones={unlocked.phones} />
            </dd>
          </>
        ) : unlocked.phone ? (
          <>
            <dt>Phone</dt>
            <dd>
              <a href={`tel:${unlocked.phone}`}>{unlocked.phone}</a>
            </dd>
          </>
        ) : null}
        {unlocked.email ? (
          <>
            <dt>Email</dt>
            <dd>
              <a href={`mailto:${unlocked.email}`}>{unlocked.email}</a>
            </dd>
          </>
        ) : null}
        {unlocked.website ? (
          <>
            <dt>Website</dt>
            <dd>
              <a
                href={unlocked.website}
                target="_blank"
                rel="noopener noreferrer"
              >
                {unlocked.website}
              </a>
            </dd>
          </>
        ) : null}
        {unlocked.name ? (
          <>
            <dt>Contact</dt>
            <dd>
              {unlocked.name}
              {unlocked.role ? `, ${unlocked.role}` : ""}
            </dd>
          </>
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
          <div className="gated-cta">
            <p className="gated-cta-title">{gated.title}</p>
            <p className="gated-cta-body">{gated.body}</p>
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
            className="btn-proto primary"
            href={`/pricing?from=/app/suppliers/${slug}`}
          >
            See plans →
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
            className="btn-proto primary"
          >
            Sign up free →
          </Link>
        ),
      }}
    />
  );
}
