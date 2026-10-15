import type { DefinitionSource, SuiteDefinition } from '@agent-evals/shared';
import { Inject, Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { contentVersion } from '../common/hash';
import { nowIso } from '../common/time';
import { DB, type Db } from '../database/database.module';
import { suites, type SuiteRow } from '../database/schema';

@Injectable()
export class SuitesRepository {
  constructor(@Inject(DB) private readonly db: Db) {}

  findAll(): SuiteRow[] {
    return this.db.select().from(suites).orderBy(asc(suites.name)).all();
  }

  findById(id: string): SuiteRow | undefined {
    return this.db.select().from(suites).where(eq(suites.id, id)).get();
  }

  /** Inserts or replaces a definition; returns the stored row and whether it changed. */
  upsert(
    definition: SuiteDefinition,
    source: DefinitionSource,
  ): { row: SuiteRow; changed: boolean } {
    const version = contentVersion(definition);
    const existing = this.findById(definition.id);
    if (existing && existing.version === version && existing.source === source) {
      return { row: existing, changed: false };
    }
    const now = nowIso();
    const values = {
      id: definition.id,
      name: definition.name,
      description: definition.description ?? null,
      source,
      version,
      definition,
      updatedAt: now,
    };
    const row = this.db
      .insert(suites)
      .values({ ...values, createdAt: now })
      .onConflictDoUpdate({ target: suites.id, set: values })
      .returning()
      .get();
    return { row, changed: true };
  }

  delete(id: string): void {
    this.db.delete(suites).where(eq(suites.id, id)).run();
  }
}
