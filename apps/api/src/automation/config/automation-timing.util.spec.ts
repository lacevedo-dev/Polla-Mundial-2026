import {
  getEscalationCheckpointsMinutes,
  getFinalEscalationMinutesBeforeKickoff,
  checkpointMinutesToId,
} from './automation-timing.util';

describe('automation-timing.util', () => {
  it('calcula última escalada como cierre + 5 min', () => {
    expect(getFinalEscalationMinutesBeforeKickoff(15)).toBe(20);
    expect(getFinalEscalationMinutesBeforeKickoff(10)).toBe(15);
  });

  it('genera checkpoints T-45, T-30 y T-(cierre+5) para cierre 15', () => {
    expect(getEscalationCheckpointsMinutes(15)).toEqual([45, 30, 20]);
  });

  it('genera checkpoints para cierre 10', () => {
    expect(getEscalationCheckpointsMinutes(10)).toEqual([45, 30, 15]);
  });

  it('mapea minutos a checkpoint id', () => {
    expect(checkpointMinutesToId(45, 15)).toBe('T45');
    expect(checkpointMinutesToId(30, 15)).toBe('T30');
    expect(checkpointMinutesToId(20, 15)).toBe('T_FINAL');
    expect(checkpointMinutesToId(25, 15)).toBeNull();
  });
});
