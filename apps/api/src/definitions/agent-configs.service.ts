import { join } from 'node:path';
import {
  type AgentConfigDefinition,
  type AgentConfigDetail,
  AgentConfigSchema,
  type AgentConfigSummary,
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
import type { AgentConfigRow } from '../database/schema';
import { AgentConfigsRepository } from './agent-configs.repository';
import { loadDefinitionDir } from './definition-files';
import { SkillsLibraryService } from './skills-library.service';

@Injectable()
export class AgentConfigsService {
  private readonly logger = new Logger(AgentConfigsService.name);

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly repository: AgentConfigsRepository,
    private readonly skills: SkillsLibraryService,
  ) {}

  list(): AgentConfigSummary[] {
    return this.repository.findAll().map((row) => this.toSummary(row));
  }

  get(id: string): AgentConfigDetail {
    const row = this.repository.findById(id);
    if (!row) throw new NotFoundException(`Agent config "${id}" not found`);
    return { ...this.toSummary(row), definition: row.definition };
  }

  /** Rows for the given ids, in the given order; throws if any is missing. */
  getMany(ids: string[]): AgentConfigRow[] {
    const rows = new Map(this.repository.findByIds(ids).map((row) => [row.id, row]));
    return ids.map((id) => {
      const row = rows.get(id);
      if (!row) throw new NotFoundException(`Agent config "${id}" not found`);
      return row;
    });
  }

  create(definition: AgentConfigDefinition): AgentConfigDetail {
    if (this.repository.findById(definition.id)) {
      throw new ConflictException(`Agent config "${definition.id}" already exists`);
    }
    this.assertSkillsExist(definition);
    this.repository.upsert(definition, 'user');
    return this.get(definition.id);
  }

  update(id: string, definition: AgentConfigDefinition): AgentConfigDetail {
    if (definition.id !== id) throw new BadRequestException('Agent config id cannot be changed');
    this.assertUserManaged(id);
    this.assertSkillsExist(definition);
    this.repository.upsert(definition, 'user');
    return this.get(id);
  }

  delete(id: string): void {
    this.assertUserManaged(id);
    this.repository.delete(id);
  }

  async syncFromFiles(): Promise<void> {
    const { definitions, errors } = await loadDefinitionDir(
      join(this.config.evalsDir, 'configs'),
      AgentConfigSchema,
    );
    for (const error of errors) this.logger.error(`Skipping ${error.file}:\n${error.message}`);
    for (const { file, definition } of definitions) {
      const missing = this.missingSkills(definition);
      if (missing.length > 0) {
        this.logger.error(`Skipping ${file}: unknown skills ${missing.join(', ')}`);
        continue;
      }
      const { changed } = this.repository.upsert(definition, 'file');
      if (changed) this.logger.log(`Synced agent config "${definition.id}" from ${file}`);
    }
  }

  private assertUserManaged(id: string): void {
    const row = this.repository.findById(id);
    if (!row) throw new NotFoundException(`Agent config "${id}" not found`);
    if (row.source === 'file') {
      throw new ConflictException(
        `Agent config "${id}" is managed by a file in evals/configs; edit the file or duplicate it`,
      );
    }
  }

  private assertSkillsExist(definition: AgentConfigDefinition): void {
    const missing = this.missingSkills(definition);
    if (missing.length > 0) throw new BadRequestException(`Unknown skills: ${missing.join(', ')}`);
  }

  private missingSkills(definition: AgentConfigDefinition): string[] {
    return definition.skills.include.filter((id) => !this.skills.exists(id));
  }

  private toSummary(row: AgentConfigRow): AgentConfigSummary {
    const { definition } = row;
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      source: row.source,
      version: row.version,
      model: { provider: definition.model.provider, name: definition.model.name },
      toolsets: definition.toolsets,
      skills: definition.skills.include,
      memoryEnabled: definition.memory.enabled,
      updatedAt: row.updatedAt,
    };
  }
}
