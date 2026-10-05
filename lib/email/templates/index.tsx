// Spec H4 — template registry. Maps template name to its React component
// and subject-line builder. The sender (`lib/email/send.ts`) is the only
// importer.

import * as React from "react";

import { Welcome, welcomeSubject, type WelcomeData } from "./welcome";
import {
  RfqReceived,
  rfqReceivedSubject,
  type RfqReceivedData,
} from "./rfq-received";
import {
  CertExpiry,
  certExpirySubject,
  type CertExpiryData,
} from "./cert-expiry";
import {
  SanctionAlert,
  sanctionAlertSubject,
  type SanctionAlertData,
} from "./sanction-alert";
import {
  PasswordReset,
  passwordResetSubject,
  type PasswordResetData,
} from "./password-reset";

import { TeamInvite, teamInviteSubject, type TeamInviteData } from "./team-invite";
import { SavedSearchAlert, savedSearchAlertSubject, type SavedSearchAlertData } from "./saved-search-alert";

export type TemplateMap = {
  saved_search_alert: SavedSearchAlertData;
  team_invite: TeamInviteData;
  welcome: WelcomeData;
  rfq_received: RfqReceivedData;
  cert_expiry: CertExpiryData;
  sanction_alert: SanctionAlertData;
  password_reset: PasswordResetData;
};

export type TemplateName = keyof TemplateMap;

type Entry<K extends TemplateName> = {
  subject: (data: TemplateMap[K]) => string;
  render: (data: TemplateMap[K]) => React.ReactElement;
};

export const TEMPLATES: { [K in TemplateName]: Entry<K> } = {
  saved_search_alert: {
    subject: savedSearchAlertSubject,
    render: (data) => <SavedSearchAlert data={data} />,
  },
  team_invite: {
    subject: teamInviteSubject,
    render: (data) => <TeamInvite data={data} />,
  },
  welcome: {
    subject: welcomeSubject,
    render: (data) => <Welcome data={data} />,
  },
  rfq_received: {
    subject: rfqReceivedSubject,
    render: (data) => <RfqReceived data={data} />,
  },
  cert_expiry: {
    subject: certExpirySubject,
    render: (data) => <CertExpiry data={data} />,
  },
  sanction_alert: {
    subject: sanctionAlertSubject,
    render: (data) => <SanctionAlert data={data} />,
  },
  password_reset: {
    subject: passwordResetSubject,
    render: (data) => <PasswordReset data={data} />,
  },
};
