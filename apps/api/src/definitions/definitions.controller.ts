import {
  type AgentConfigDefinition,
  type AgentConfigDetail,
  AgentConfigSchema,
  type AgentConfigSummary,
  type Catalog,
  SCORER_TYPES,
  type SuiteDefinition,
  type SuiteDetail,
  SuiteSchema,
  type SuiteSummary,
} from '@agent-evals/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { AgentConfigsService } from './agent-configs.service';
import { DefinitionInputPipe } from './definition-input.pipe';
import { HermesInfoService } from './hermes-info.service';
import { SkillsLibraryService } from './skills-library.service';
import { SuitesService } from './suites.service';
import { EVAL_TOOLSETS } from './toolsets';

@Controller('suites')
export class SuitesController {
  constructor(private readonly suites: SuitesService) {}

  @Get()
  list(): SuiteSummary[] {
    return this.suites.list();
  }

  @Get(':id')
  get(@Param('id') id: string): SuiteDetail {
    return this.suites.get(id);
  }

  @Post()
  create(@Body(new DefinitionInputPipe(SuiteSchema)) definition: SuiteDefinition): SuiteDetail {
    return this.suites.create(definition);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body(new DefinitionInputPipe(SuiteSchema)) definition: SuiteDefinition,
  ): SuiteDetail {
    return this.suites.update(id, definition);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id') id: string): void {
    this.suites.delete(id);
  }
}

@Controller('configs')
export class AgentConfigsController {
  constructor(private readonly configs: AgentConfigsService) {}

  @Get()
  list(): AgentConfigSummary[] {
    return this.configs.list();
  }

  @Get(':id')
  get(@Param('id') id: string): AgentConfigDetail {
    return this.configs.get(id);
  }

  @Post()
  create(
    @Body(new DefinitionInputPipe(AgentConfigSchema)) definition: AgentConfigDefinition,
  ): AgentConfigDetail {
    return this.configs.create(definition);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body(new DefinitionInputPipe(AgentConfigSchema)) definition: AgentConfigDefinition,
  ): AgentConfigDetail {
    return this.configs.update(id, definition);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id') id: string): void {
    this.configs.delete(id);
  }
}

@Controller('catalog')
export class CatalogController {
  constructor(
    private readonly skills: SkillsLibraryService,
    private readonly hermes: HermesInfoService,
  ) {}

  @Get()
  async get(): Promise<Catalog> {
    const [skills, hermesVersion] = await Promise.all([this.skills.list(), this.hermes.version()]);
    return { toolsets: EVAL_TOOLSETS, skills, scorerTypes: SCORER_TYPES, hermesVersion };
  }
}
