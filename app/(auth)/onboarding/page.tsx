// /onboarding: sends the person to the step they are on (the first with answers missing), or, with
// everything answered but the flow not closed, to the last step to finish it. A signed-out person goes
// to sign in and comes back; someone whose flow is done goes to where they start.

import { redirect } from "next/navigation";
import { stepHref } from "@/lib/onboarding";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadOnboarding } from "./load";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const l = await loadOnboarding(await createSupabaseServerClient(), "/onboarding");
  if (l.kind === "redirect") redirect(l.to);
  redirect(stepHref(l.step ?? "source"));
}
