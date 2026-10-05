"use server";

// Contact sales: the one write on the public site. It emails the founder; no table holds the lead (`lib/contact.ts`).
// The middleware rate-limits this path per address (`/contact` is in the auth class), and a filled honeypot is dropped.

import { submitContact, type ContactState } from "@/lib/contact";
import { sendEmail } from "@/lib/email/send";

export async function sendContact(_prev: ContactState, formData: FormData): Promise<ContactState> {
  return submitContact(formData, {
    send: async ({ to, replyTo, values }) => {
      const sent = await sendEmail({ to, replyTo, template: "contact_lead", data: values });
      // No mail key (a development server) means nothing was sent: say so rather than claim it was.
      return sent.dev !== true;
    },
  });
}
