import { Module } from '@nestjs/common';
import { DefinitionsModule } from '../definitions/definitions.module';
import { ExperimentsModule } from '../experiments/experiments.module';
import { ScoringModule } from '../scoring/scoring.module';
import { AGENT_RUNNER } from './agent-runner';
import { HermesCliRunner } from './hermes/hermes-cli.runner';
import { HermesStartupGate } from './hermes/hermes-processes';
import { RunExecutor } from './run-executor.service';
import { RunScheduler } from './run-scheduler.service';
import { WorkspaceModule } from './workspace.module';

@Module({
  imports: [DefinitionsModule, ExperimentsModule, ScoringModule, WorkspaceModule],
  providers: [
    HermesStartupGate,
    { provide: AGENT_RUNNER, useClass: HermesCliRunner },
    RunExecutor,
    RunScheduler,
  ],
  exports: [RunScheduler],
})
export class ExecutionModule {}
