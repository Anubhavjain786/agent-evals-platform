import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import type { Subscription } from 'rxjs';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import type { RunRow } from '../database/schema';
import { EventBus } from '../events/event-bus.service';
import { ExperimentsService } from '../experiments/experiments.service';
import { RunsRepository } from '../experiments/runs.repository';
import { RunExecutor, SHUTDOWN } from './run-executor.service';

/** Safety-net poll in case a wake-up signal is ever missed. */
const POLL_INTERVAL_MS = 5_000;

interface ActiveRun {
  experimentId: string;
  controller: AbortController;
  done: Promise<void>;
}

/**
 * Durable work queue backed by the `runs` table. Keeps up to MAX_CONCURRENCY
 * runs in flight (and each experiment within its own limit), survives
 * restarts by re-queuing interrupted runs, and cancels in-flight runs on
 * request.
 */
@Injectable()
export class RunScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(RunScheduler.name);
  private readonly active = new Map<string, ActiveRun>();
  private subscription: Subscription | null = null;
  private poller: NodeJS.Timeout | null = null;
  private stopping = false;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly runs: RunsRepository,
    private readonly experiments: ExperimentsService,
    private readonly executor: RunExecutor,
    private readonly bus: EventBus,
  ) {}

  onApplicationBootstrap(): void {
    const requeued = this.runs.requeueInterrupted();
    if (requeued > 0)
      this.logger.warn(`Re-queued ${requeued} run(s) interrupted by the last shutdown`);

    this.subscription = this.bus.domain$.subscribe((event) => {
      if (event.type === 'experiment.cancelled') this.abortExperiment(event.experimentId);
      else this.fill();
    });
    this.poller = setInterval(() => this.fill(), POLL_INTERVAL_MS);
    this.poller.unref();
    this.fill();
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopping = true;
    this.subscription?.unsubscribe();
    if (this.poller) clearInterval(this.poller);
    for (const run of this.active.values()) run.controller.abort(SHUTDOWN);
    await Promise.allSettled([...this.active.values()].map((run) => run.done));
  }

  get activeCount(): number {
    return this.active.size;
  }

  /** Starts queued runs until the global concurrency limit is reached. */
  fill(): void {
    while (!this.stopping && this.active.size < this.config.maxConcurrency) {
      const run = this.runs.claimNext();
      if (!run) return;
      this.start(run);
    }
  }

  private start(run: RunRow): void {
    const controller = new AbortController();
    this.experiments.onRunStarted(run);
    const done = this.executor
      .execute(run, controller.signal)
      .catch((error: unknown) =>
        this.logger.error(`Run ${run.id} failed unexpectedly: ${String(error)}`),
      )
      .finally(() => {
        this.active.delete(run.id);
        if (!this.stopping) {
          this.experiments.onRunSettled(run.id);
          this.fill();
        }
      });
    this.active.set(run.id, { experimentId: run.experimentId, controller, done });
  }

  private abortExperiment(experimentId: string): void {
    for (const run of this.active.values()) {
      if (run.experimentId === experimentId) run.controller.abort('cancelled');
    }
  }
}
