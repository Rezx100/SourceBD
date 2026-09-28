// Settings · Members (/app/settings/members). One member today: the buyer who
// is signed in, as the owner. Team seats arrive with the Enterprise plan, so
// there is no invite form to fill in and nothing that pretends to send one.

import { Button } from "@/components/dashboard/controls";
import { Cell, DataTable, ErrorNote, HeadCell, Page, PageSection, rowClass } from "@/components/dashboard/page";
import { type SettingsDoc, SettingsFrame, SettingsHeader } from "@/components/dashboard/settings";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function MembersPageBody() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("settings_get");
  const settings = error ? null : ((data ?? null) as SettingsDoc | null);

  return (
    <>
      <SettingsHeader settings={settings} />
      <SettingsFrame current="members">
        {settings ? (
          <PageSection title="Members" caption="1 member">
            <DataTable label="Members" minWidth="28rem">
              <thead>
                <tr>
                  <HeadCell>Name</HeadCell>
                  <HeadCell>Email</HeadCell>
                  <HeadCell>Role</HeadCell>
                </tr>
              </thead>
              <tbody className="[&>tr:last-child>*]:border-b-0">
                <tr className={rowClass()}>
                  <Cell className="font-medium text-ink-strong [overflow-wrap:anywhere]">
                    {settings.display_name || <span className="font-normal text-ink-muted">No display name</span>}
                  </Cell>
                  <Cell className="[overflow-wrap:anywhere]">{settings.email || "—"}</Cell>
                  <Cell>Owner</Cell>
                </tr>
              </tbody>
            </DataTable>
          </PageSection>
        ) : (
          <ErrorNote>Could not load your account. Reload the page to try again.</ErrorNote>
        )}

        <PageSection title="Team seats">
          <div className="flex flex-col items-start gap-3 p-4">
            <p className="m-0 max-w-prose text-base text-ink">
              Seats for colleagues arrive with the Enterprise plan, with a role for each. To bring your team onto SourceBD
              before then, contact support.
            </p>
            <Button href="mailto:support@sourcebd.net?subject=SourceBD%20team%20seats">Contact support</Button>
          </div>
        </PageSection>
      </SettingsFrame>
    </>
  );
}

export default async function SettingsMembersPage() {
  return <Page>{await MembersPageBody()}</Page>;
}
