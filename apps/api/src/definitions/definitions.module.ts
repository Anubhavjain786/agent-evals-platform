import { Module, type OnModuleInit } from '@nestjs/common';
import { AgentConfigsRepository } from './agent-configs.repository';
import { AgentConfigsService } from './agent-configs.service';
import {
  AgentConfigsController,
  CatalogController,
  SuitesController,
} from './definitions.controller';
import { HermesInfoService } from './hermes-info.service';
import { SkillsLibraryService } from './skills-library.service';
import { SuitesRepository } from './suites.repository';
import { SuitesService } from './suites.service';

@Module({
  controllers: [SuitesController, AgentConfigsController, CatalogController],
  providers: [
    SuitesRepository,
    SuitesService,
    AgentConfigsRepository,
    AgentConfigsService,
    SkillsLibraryService,
    HermesInfoService,
  ],
  exports: [SuitesService, AgentConfigsService, SkillsLibraryService, HermesInfoService],
})
export class DefinitionsModule implements OnModuleInit {
  constructor(
    private readonly suites: SuitesService,
    private readonly configs: AgentConfigsService,
  ) {}

  /** Definitions-as-code: `evals/` is synced into the database on every boot. */
  async onModuleInit(): Promise<void> {
    await this.configs.syncFromFiles();
    await this.suites.syncFromFiles();
  }
}
