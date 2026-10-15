import { Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { DB, type Db } from '../database/database.module';
import { type ExperimentRow, experiments, runs } from '../database/schema';
import type { NewRun } from './runs.repository';

@Injectable()
export class ExperimentsRepository {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Creates the experiment and its full run plan atomically. */
  create(experiment: ExperimentRow, plan: NewRun[]): void {
    this.db.transaction((tx) => {
      tx.insert(experiments).values(experiment).run();
      for (const run of plan) {
        tx.insert(runs)
          .values({ ...run, status: 'queued', createdAt: experiment.createdAt })
          .run();
      }
    });
  }

  findAll(): ExperimentRow[] {
    return this.db.select().from(experiments).orderBy(desc(experiments.createdAt)).all();
  }

  findById(id: string): ExperimentRow | undefined {
    return this.db.select().from(experiments).where(eq(experiments.id, id)).get();
  }

  update(
    id: string,
    fields: Partial<Pick<ExperimentRow, 'status' | 'startedAt' | 'finishedAt'>>,
  ): ExperimentRow | undefined {
    return this.db.update(experiments).set(fields).where(eq(experiments.id, id)).returning().get();
  }

  delete(id: string): void {
    this.db.delete(experiments).where(eq(experiments.id, id)).run();
  }
}
