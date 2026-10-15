import { Module } from '@nestjs/common';
import { DefinitionsModule } from '../definitions/definitions.module';
import { WorkspaceModule } from '../execution/workspace.module';
import { ExperimentsController, RunsController } from './experiments.controller';
import { ExperimentsRepository } from './experiments.repository';
import { ExperimentsService } from './experiments.service';
import { RunsRepository } from './runs.repository';

@Module({
  imports: [DefinitionsModule, WorkspaceModule],
  controllers: [ExperimentsController, RunsController],
  providers: [ExperimentsRepository, RunsRepository, ExperimentsService],
  exports: [ExperimentsService, ExperimentsRepository, RunsRepository],
})
export class ExperimentsModule {}
