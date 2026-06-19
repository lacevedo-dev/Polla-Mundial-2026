import type { AutomationStep, NotificationType } from '@prisma/client';

import type { AutomationExcludedLeague } from '../audience/automation-league-eligibility.util';

export type AutomationUserContact = {
  phone: string | null;
  countryCode: string | null;
};

export type AutomationUserDeliveryParams = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
  /** Paso de automatización — fuente de verdad para catálogo y admin. */
  step: AutomationStep;
  trigger?: string;
  userContact?: AutomationUserContact | null;
  pushTag?: string;
  pushRequireInteraction?: boolean;
};

export type AutomationUserDeliveryResult = {
  pushSent: number;
  pushFailed: number;
  pushDevices: number;
  whatsappSent: boolean;
  inAppSent: number;
  skipped: boolean;
};

export type AutomationChannelFlags = {
  push: boolean;
  inApp: boolean;
  whatsapp: boolean;
};

export type MatchReminderRetrySummary = {
  usersNotified: number;
  inAppSent: number;
  pushSent: number;
  pushFailed: number;
  pushDevices: number;
  whatsappSent: number;
  waGroupSent: number;
  waGroupFailed: number;
  emailQueued: number;
  audienceCount: number;
  excludedLeagues?: AutomationExcludedLeague[];
};
