// The contact card once the details are unlocked (0145; founder, 12 Oct 2026: Growth, Enterprise and
// admins see a supplier's contact details as the registers filed them). One drawing for the full page's
// column, the pane and a phone: a row per kind, its glyph, and each value a link that does the obvious
// thing (write, dial, open the site). It is given only what `supplier_contact_details` returned; a reader
// the database did not entitle never reaches this file and keeps the locked card. Server-safe.

import { Envelope, Globe, Phone, User } from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { ring } from "@/components/kit";
import type { ContactDetails } from "@/lib/dashboard/models";
import { cn } from "@/lib/utils";

/** `mailto:` for an address as filed; anything but the '@' is escaped, so a filed "?bcc=" stays part of the address. */
export const mailHref = (email: string) => `mailto:${encodeURIComponent(email).replace("%40", "@")}`;

/**
 * A number as a phone dials it from abroad. The registers file Bangladesh numbers in local form
 * ("01754…", "02-…") as often as with the country code, and a buyer in London cannot dial those.
 */
export function telHref(phone: string): string {
  // The number itself: a label before it ("Tel: ") and words after it (", Ext 114") are not dialled.
  const filed = phone.replace(/^[^\d+]+/, "").split(/[A-Za-z]/)[0] ?? "";
  const d = filed.replace(/\D/g, "");
  // ponytail: every record is a Bangladesh company, so a leading 0 is read as its trunk prefix. A foreign
  // number filed without "+" or "00" dials wrong; a country column on the phone would fix that.
  const withCode = d.startsWith("00") ? d.slice(2) : d.startsWith("880") ? d : d.startsWith("0") ? `880${d.slice(1)}` : /^1[3-9]\d{8}$/.test(d) ? `880${d}` : null;
  return `tel:${withCode ? `+${withCode}` : filed.startsWith("+") ? `+${d}` : d}`;
}

/** The site as a link: `https://` when the register filed none. Only http(s) is ever kept as filed. */
export const siteHref = (website: string) => (/^https?:\/\//i.test(website) ? website : `https://${website}`);

const LINK = cn(
  "block rounded-sm py-2.5 text-md text-brand-ink underline decoration-1 [overflow-wrap:anywhere] [text-underline-position:from-font] hover:decoration-2 sm:py-1.5 sm:text-base",
  ring,
);

/** One kind: its glyph in a fixed slot, its name for a screen reader, and its values stacked. */
function Kind({ icon: G, name, children }: { icon: Icon; name: string; children: ReactNode }) {
  return (
    <li className="flex gap-3 border-t border-line px-4 first:border-t-0">
      {/* As tall as one row, so the glyph sits on the first value's line however many follow or wrap. */}
      <span className="flex h-11 shrink-0 items-center sm:h-8">
        <G size={20} weight="thin" className="text-ink-3" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="sr-only">{name}</span>
        {children}
      </div>
    </li>
  );
}

/**
 * The details, in the box the locked card holds. With a `level` it heads itself "Contact" (the page's
 * column and the pane); without one it is the rows alone, as wide as its caller, under a heading the
 * caller already drew (a phone's Contact section).
 */
export function ContactDetailsCard({ details, level: H, className }: { details: ContactDetails; level?: "h2" | "h3"; className?: string }) {
  const { emails, phones, website, person, role } = details;
  const empty = emails.length + phones.length === 0 && !website && !person;
  // Headed, it is the Contact region itself; under a caller's heading it is a box inside that caller's region.
  const Box = H ? "section" : "div";
  return (
    <Box aria-label={H ? "Contact" : undefined} data-contact-details="" className={cn("flex w-full flex-col rounded-lg border border-line", H && "max-w-details", className)}>
      {H ? <H className="px-4 pt-4 text-base font-semibold text-ink">Contact</H> : null}
      {empty ? (
        <p className="p-4 text-base font-medium text-ink-2">No email or phone on file</p>
      ) : (
        <ul className="flex flex-col py-1.5">
          {person ? (
            <Kind icon={User} name="Contact person">
              <p className="py-2.5 text-md text-ink [overflow-wrap:anywhere] sm:py-1.5 sm:text-base">
                {person}
                {role ? <span className="block text-sm text-ink-3">{role}</span> : null}
              </p>
            </Kind>
          ) : null}
          {emails.length ? (
            <Kind icon={Envelope} name={emails.length === 1 ? "Email" : "Emails"}>
              {emails.map((e, i) => (
                <a key={`${e}-${i}`} href={mailHref(e)} className={LINK}>
                  {e}
                </a>
              ))}
            </Kind>
          ) : null}
          {phones.length ? (
            <Kind icon={Phone} name={phones.length === 1 ? "Phone number" : "Phone numbers"}>
              {phones.map((p, i) => (
                <a key={`${p}-${i}`} href={telHref(p)} className={cn(LINK, "[font-variant-numeric:tabular-nums]")}>
                  {p}
                </a>
              ))}
            </Kind>
          ) : null}
          {website ? (
            <Kind icon={Globe} name="Website">
              <a href={siteHref(website)} target="_blank" rel="noopener noreferrer nofollow" className={LINK}>
                {website.replace(/^https?:\/\//i, "").replace(/\/$/, "")}
              </a>
            </Kind>
          ) : null}
        </ul>
      )}
    </Box>
  );
}
