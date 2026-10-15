import type { AgentConfigDefinition, DefinitionSource } from '@agent-evals/shared';
import { Inject, Injectable } from '@nestjs/common';
import { asc, eq, inArray } from 'drizzle-orm';
import { contentVersion } from '../common/hash';
import { nowIso } from '../common/time';
import { DB, type Db } from '../database/database.module';
import { agentConfigs, type AgentConfigRow } from '../database/schema';

@Injectable()
export class AgentConfigsRepository {
  constructor(@Inject(DB) private readonly db: Db) {}

  findAll(): AgentConfigRow[] {
    return this.db.select().from(agentConfigs).orderBy(asc(agentConfigs.name)).all();
  }

  findById(id: string): AgentConfigRow | undefined {
    return this.db.select().from(agentConfigs).where(eq(agentConfigs.id, id)).get();
  }

  findByIds(ids: string[]): AgentConfigRow[] {
    if (ids.length === 0) return [];
    return this.db.select().from(agentConfigs).where(inArray(agentConfigs.id, ids)).all();
  }

  upsert(
    definition: AgentConfigDefinition,
    source: DefinitionSource,
  ): { row: AgentConfigRow; changed: boolean } {
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
      .insert(agentConfigs)
      .values({ ...values, createdAt: now })
      .onConflictDoUpdate({ target: agentConfigs.id, set: values })
      .returning()
      .get();
    return { row, changed: true };
  }

  delete(id: string): void {
    this.db.delete(agentConfigs).where(eq(agentConfigs.id, id)).run();
  }
}
