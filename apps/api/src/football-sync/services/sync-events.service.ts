import { Injectable, Logger } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';

export interface SyncEvent {
  type:
    | 'sync_started'
    | 'sync_completed'
    | 'sync_failed'
    | 'match_updated'
    | 'plan_updated'
    | 'rate_limit_warning';
  data: Record<string, unknown>;
  timestamp: string;
}

@Injectable()
export class SyncEventsService {
  private readonly logger = new Logger(SyncEventsService.name);
  private readonly subject = new Subject<SyncEvent>();

  /** Emit an event to all SSE subscribers */
  emit(event: SyncEvent): void {
    this.subject.next(event);
  }

  emitSyncStarted(matchCount: number, triggeredBy = 'auto'): void {
    this.emit({
      type: 'sync_started',
      data: { matchCount, triggeredBy },
      timestamp: new Date().toISOString(),
    });
  }

  emitSyncCompleted(matchesUpdated: number, requestsUsed: number, duration?: number): void {
    this.emit({
      type: 'sync_completed',
      data: { matchesUpdated, requestsUsed, duration },
      timestamp: new Date().toISOString(),
    });
  }

  emitSyncFailed(error: string): void {
    this.emit({
      type: 'sync_failed',
      data: { error },
      timestamp: new Date().toISOString(),
    });
  }

  emitMatchUpdated(matchId: string, homeScore: number | null, awayScore: number | null, status: string): void {
    this.emit({
      type: 'match_updated',
      data: { matchId, homeScore, awayScore, status },
      timestamp: new Date().toISOString(),
    });
  }

  emitPlanUpdated(strategy: string, intervalMinutes: number, requestsUsed: number, requestsAvailable: number): void {
    this.emit({
      type: 'plan_updated',
      data: { strategy, intervalMinutes, requestsUsed, requestsAvailable },
      timestamp: new Date().toISOString(),
    });
  }

  emitRateLimitWarning(remaining: number, limit: number): void {
    this.emit({
      type: 'rate_limit_warning',
      data: { remaining, limit, percentage: Math.round(((limit - remaining) / limit) * 100) },
      timestamp: new Date().toISOString(),
    });
  }

  /** Returns an Observable that new SSE clients subscribe to */
  getObservable(): Observable<SyncEvent> {
    return this.subject.asObservable();
  }
}
