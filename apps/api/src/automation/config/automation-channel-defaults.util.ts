import type { AutomationStepChannelId } from './automation-step-catalog';

/**
 * Canales opt-in (OFF hasta que Admin los active explícitamente).
 * Evita envíos masivos no deseados por WA personal.
 */
export const OPT_IN_AUTOMATION_CHANNELS: ReadonlySet<AutomationStepChannelId> =
  new Set(['whatsapp']);

export function getDefaultChannelEnabled(
  channel: AutomationStepChannelId,
): boolean {
  return !OPT_IN_AUTOMATION_CHANNELS.has(channel);
}

export function resolveChannelOverride(
  channel: AutomationStepChannelId,
  override: boolean | undefined,
): boolean {
  if (typeof override === 'boolean') {
    return override;
  }
  return getDefaultChannelEnabled(channel);
}
