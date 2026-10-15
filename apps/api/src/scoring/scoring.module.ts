import { Module } from '@nestjs/common';
import { WorkspaceModule } from '../execution/workspace.module';
import { LlmJudgeClient } from './llm-judge.client';
import { SCORERS } from './scorer';
import { JsonFieldScorer } from './scorers/json-field.scorer';
import { LlmJudgeScorer } from './scorers/llm-judge.scorer';
import {
  ContainsScorer,
  ExactMatchScorer,
  NumericScorer,
  RegexScorer,
} from './scorers/text.scorers';
import { CommandScorer, FileExistsScorer, ToolUsageScorer } from './scorers/workspace.scorers';
import { ScoringService } from './scoring.service';

const SCORER_CLASSES = [
  ContainsScorer,
  ExactMatchScorer,
  RegexScorer,
  NumericScorer,
  JsonFieldScorer,
  FileExistsScorer,
  CommandScorer,
  ToolUsageScorer,
  LlmJudgeScorer,
];

@Module({
  imports: [WorkspaceModule],
  providers: [
    LlmJudgeClient,
    ...SCORER_CLASSES,
    {
      provide: SCORERS,
      inject: SCORER_CLASSES,
      useFactory: (...scorers: unknown[]) => scorers,
    },
    ScoringService,
  ],
  exports: [ScoringService],
})
export class ScoringModule {}
