// Contact sales (B9e): the form that emails the founder. The send is `./actions.ts`; the checks are `lib/contact.ts`.

import type { Metadata } from "next";
import { Contact, CONTACT_META } from "@/components/site/contact";

export const dynamic = "force-static";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sourcebd.net";

export const metadata: Metadata = {
  title: CONTACT_META.title,
  description: CONTACT_META.description,
  alternates: { canonical: `${SITE_URL}${CONTACT_META.path}` },
  openGraph: { title: CONTACT_META.title, description: CONTACT_META.description, url: `${SITE_URL}${CONTACT_META.path}`, siteName: "SourceBD", locale: "en_GB", type: "website" },
};

export default function ContactPage() {
  return <Contact />;
}
