import type { LiveEvent } from '@agent-evals/shared';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { filter, type Observable, Subject } from 'rxjs';

/** Internal signals between modules (keeps the scheduler decoupled from the HTTP layer). */
export type DomainEvent =
  | { type: 'experiment.launched'; experimentId: string }
  | { type: 'experiment.cancelled'; experimentId: string }
  | { type: 'runs.requeued'; experimentId: string };

/**
 * In-process pub/sub. `live$` feeds Server-Sent Events to browsers; `domain$`
 * carries commands between modules. A multi-instance deployment would back
 * this with Redis/NATS — the interface stays the same.
 */
@Injectable()
export class EventBus implements OnModuleDestroy {
  private readonly live = new Subject<LiveEvent>();
  private readonly domain = new Subject<DomainEvent>();

  publishLive(event: LiveEvent): void {
    this.live.next(event);
  }

  publishDomain(event: DomainEvent): void {
    this.domain.next(event);
  }

  liveForExperiment(experimentId: string): Observable<LiveEvent> {
    return this.live.pipe(filter((e) => e.experimentId === experimentId));
  }

  liveForRun(runId: string): Observable<LiveEvent> {
    return this.live.pipe(
      filter(
        (e) =>
          (e.type === 'run.event' && e.runId === runId) ||
          (e.type === 'run.updated' && e.run.id === runId),
      ),
    );
  }

  get domain$(): Observable<DomainEvent> {
    return this.domain.asObservable();
  }

  onModuleDestroy(): void {
    this.live.complete();
    this.domain.complete();
  }
}
