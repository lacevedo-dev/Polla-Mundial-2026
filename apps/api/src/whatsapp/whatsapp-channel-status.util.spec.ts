import { AutomationStep, WhatsappJobStatus } from '@prisma/client';
import { buildWaGroupChannelBreakdown } from './whatsapp-channel-status.util';

describe('buildWaGroupChannelBreakdown', () => {
  const leagues = [
    { id: 'l1', name: 'Liga Oro', whatsappGroupId: 'g1@g.us' },
  ];

  it('marks missing job as failed with reason', () => {
    const result = buildWaGroupChannelBreakdown({
      step: AutomationStep.MATCH_REMINDER,
      stepStatus: 'SUCCESS',
      matchId: 'm1',
      relevantLeagues: leagues,
      jobsByDedupeKey: new Map(),
      waConnected: true,
      stepFinishedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    });

    expect(result?.waGroupFailed).toBe(1);
    expect(result?.waGroupReason).toMatch(/no se encoló/i);
  });

  it('counts sent jobs as success', () => {
    const result = buildWaGroupChannelBreakdown({
      step: AutomationStep.MATCH_REMINDER,
      stepStatus: 'SUCCESS',
      matchId: 'm1',
      relevantLeagues: leagues,
      jobsByDedupeKey: new Map([
        [
          'MATCH_REMINDER:m1:l1',
          {
            id: 'job1',
            status: WhatsappJobStatus.SENT,
            lastError: null,
            leagueId: 'l1',
            sentAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      ]),
      waConnected: true,
      stepFinishedAt: new Date().toISOString(),
    });

    expect(result?.waGroupSent).toBe(1);
    expect(result?.waGroupFailed).toBe(0);
  });

  it('flags disconnected session for pending jobs', () => {
    const result = buildWaGroupChannelBreakdown({
      step: AutomationStep.RESULT_NOTIFICATION,
      stepStatus: 'SUCCESS',
      matchId: 'm1',
      relevantLeagues: leagues,
      jobsByDedupeKey: new Map([
        [
          'RESULT_NOTIFICATION:m1:l1',
          {
            id: 'job2',
            status: WhatsappJobStatus.PENDING,
            lastError: null,
            leagueId: 'l1',
            sentAt: null,
            updatedAt: new Date(),
          },
        ],
      ]),
      waConnected: false,
      stepFinishedAt: new Date().toISOString(),
    });

    expect(result?.waGroupFailed).toBe(1);
    expect(result?.waGroupReason).toMatch(/desconectado/i);
  });
});
