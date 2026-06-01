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

export type TemplateMap = {
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
