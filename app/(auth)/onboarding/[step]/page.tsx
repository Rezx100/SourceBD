// One first-run step (Paper `20 Onboarding` 3 to 5): About you, Your company, What you source. The form
// is pre-filled with what the buyer has already answered, so a half-finished flow resumes where it
// stopped and Back never shows a blank. A read that failed is an error with a retry, never an empty
// form a save could overwrite their answers with.

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AuthSplit } from "@/components/auth/frame";
import { AuthLink, SignOutButton } from "@/components/auth/link";
import { AuthBar, Heading } from "@/components/auth/state";
import { DraftProvider } from "@/components/onboarding/draft";
import { AboutForm, CompanyForm, CompanyPanel, SourceForm, SourcePanel, StartPanel, type HsOption } from "@/components/onboarding/steps";
import { ErrorPanel } from "@/components/kit";
import { fetchHsCatalogue } from "@/lib/discover-v32-rpc";
import { stepLine, stepOf } from "@/lib/onboarding";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadOnboarding } from "../load";

export const metadata: Metadata = { title: "Set up your account · SourceBD" };
export const dynamic = "force-dynamic";

/** The headings offered before anything is typed: the five with most exporters among clothing (chapters 61 and 62). */
function suggest(all: readonly HsOption[]): string[] {
  return all
    .filter((o) => /^6[12]/.test(o.hs))
    .sort((a, b) => b.n - a.n)
    .slice(0, 5)
    .map((o) => o.hs);
}

export default async function OnboardingStep({ params }: { params: Promise<{ step: string }> }) {
  const step = stepOf((await params).step);
  if (!step) notFound();
  const supabase = await createSupabaseServerClient();
  const l = await loadOnboarding(supabase, `/onboarding/${step}`);
  if (l.kind === "redirect") redirect(l.to);

  const bar = <AuthBar lead={l.email ?? undefined} link={<SignOutButton />} />;
  const line = <p className="text-sm font-medium text-ink-3">{stepLine(step)}</p>;

  // The answers could not be read: say so rather than draw blanks a save would write over.
  if (!l.answers) {
    return (
      <AuthSplit bar={bar} panel={<p className="max-w-[440px] text-base text-ink-3">Nothing you entered is lost.</p>}>
        {line}
        <ErrorPanel title="We couldn't load your answers" retry={<AuthLink href={`/onboarding/${step}`}>Try again</AuthLink>}>
          Your account is safe. Try again in a moment.
        </ErrorPanel>
      </AuthSplit>
    );
  }
  const a = l.answers;
  const p = l.progress;

  if (step === "about") {
    return (
      <AuthSplit bar={bar} panel={<StartPanel />}>
        <div className="flex flex-col gap-2">
          {line}
          <Heading title="About you" />
        </div>
        <AboutForm name={p.name ?? ""} role={a.jobRole} />
      </AuthSplit>
    );
  }

  if (step === "company") {
    const initial = { company: p.company ?? "", type: p.companyType ?? "", country: a.country ?? "", people: p.people ?? "" };
    return (
      <DraftProvider initial={initial}>
        <AuthSplit bar={bar} panel={<CompanyPanel />}>
          <div className="flex flex-col gap-2">
            {line}
            <Heading title="Your company" />
          </div>
          <CompanyForm {...initial} />
        </AuthSplit>
      </DraftProvider>
    );
  }

  const cat = await fetchHsCatalogue(supabase).catch(() => ({ rows: [], error: true }));
  const options: HsOption[] = cat.rows.map((r) => ({ hs: r.hs, label: r.heading ?? `HS ${r.hs}`, n: r.exporter_count })).filter((o) => /^[0-9]{4}$/.test(o.hs));
  return (
    <DraftProvider initial={{ hs: a.hs, certs: a.certs, markets: a.markets, count: null }}>
      <AuthSplit bar={bar} panel={<SourcePanel />} wide>
        <div className="flex flex-col gap-2">
          {line}
          <Heading title="What you source" />
        </div>
        {cat.error || options.length === 0 ? (
          <ErrorPanel title="We couldn't load the products" retry={<AuthLink href="/onboarding/source">Try again</AuthLink>}>
            Your account is safe. Try again in a moment.
          </ErrorPanel>
        ) : (
          <SourceForm options={options} suggested={suggest(options)} hs={a.hs} certs={a.certs} markets={a.markets} />
        )}
      </AuthSplit>
    </DraftProvider>
  );
}
