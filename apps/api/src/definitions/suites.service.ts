import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  type SuiteDefinition,
  type SuiteDetail,
  SuiteSchema,
  type SuiteSummary,
} from '@agent-evals/shared';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import type { SuiteRow } from '../database/schema';
import { loadDefinitionDir } from './definition-files';
import { SuitesRepository } from './suites.repository';

@Injectable()
export class SuitesService {
  private readonly logger = new Logger(SuitesService.name);

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly repository: SuitesRepository,
  ) {}

  fixturesRoot(): string {
    return join(this.config.evalsDir, 'fixtures');
  }

  list(): SuiteSummary[] {
    return this.repository.findAll().map((row) => this.toSummary(row));
  }

  get(id: string): SuiteDetail {
    const row = this.repository.findById(id);
    if (!row) throw new NotFoundException(`Suite "${id}" not found`);
    return { ...this.toSummary(row), definition: row.definition };
  }

  create(definition: SuiteDefinition): SuiteDetail {
    if (this.repository.findById(definition.id)) {
      throw new ConflictException(`Suite "${definition.id}" already exists`);
    }
    this.assertReferencesExist(definition);
    this.repository.upsert(definition, 'user');
    return this.get(definition.id);
  }

  update(id: string, definition: SuiteDefinition): SuiteDetail {
    if (definition.id !== id) throw new BadRequestException('Suite id cannot be changed');
    this.assertUserManaged(id);
    this.assertReferencesExist(definition);
    this.repository.upsert(definition, 'user');
    return this.get(id);
  }

  delete(id: string): void {
    this.assertUserManaged(id);
    this.repository.delete(id);
  }

  /** Upserts every suite under `evals/suites`. Files are the source of truth for file-managed suites. */
  async syncFromFiles(): Promise<void> {
    const { definitions, errors } = await loadDefinitionDir(
      join(this.config.evalsDir, 'suites'),
      SuiteSchema,
    );
    for (const error of errors) this.logger.error(`Skipping ${error.file}:\n${error.message}`);
    for (const { file, definition } of definitions) {
      const missing = this.missingReferences(definition);
      if (missing.length > 0) {
        this.logger.error(`Skipping ${file}: missing fixtures ${missing.join(', ')}`);
        continue;
      }
      const { changed } = this.repository.upsert(definition, 'file');
      if (changed) this.logger.log(`Synced suite "${definition.id}" from ${file}`);
    }
  }

  private assertUserManaged(id: string): void {
    const row = this.repository.findById(id);
    if (!row) throw new NotFoundException(`Suite "${id}" not found`);
    if (row.source === 'file') {
      throw new ConflictException(
        `Suite "${id}" is managed by a file in evals/suites; edit the file instead`,
      );
    }
  }

  private assertReferencesExist(definition: SuiteDefinition): void {
    const missing = this.missingReferences(definition);
    if (missing.length > 0) {
      throw new BadRequestException(`Fixture directories not found: ${missing.join(', ')}`);
    }
  }

  private missingReferences(definition: SuiteDefinition): string[] {
    const referenced = definition.tasks.flatMap((task) => [
      ...(task.fixtures ? [task.fixtures] : []),
      ...task.scoring.scorers.flatMap((scorer) =>
        scorer.type === 'command' && scorer.hiddenFixtures ? [scorer.hiddenFixtures] : [],
      ),
    ]);
    return [...new Set(referenced)].filter((dir) => !existsSync(join(this.fixturesRoot(), dir)));
  }

  private toSummary(row: SuiteRow): SuiteSummary {
    const tags = new Set(row.definition.tasks.flatMap((task) => task.tags));
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      source: row.source,
      version: row.version,
      taskCount: row.definition.tasks.length,
      tags: [...tags].sort(),
      updatedAt: row.updatedAt,
    };
  }
}
