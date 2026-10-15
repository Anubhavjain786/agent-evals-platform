import {
  type CreateExperimentCommand,
  CreateExperimentSchema,
  type ExperimentDetail,
  type ExperimentReport,
  type ExperimentSummary,
  type LiveEvent,
  type RunDetail,
  type RunListQuery,
  RunListQuerySchema,
  type RunSummary,
  type WorkspaceFileContent,
} from '@agent-evals/shared';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  type MessageEvent,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Sse,
} from '@nestjs/common';
import { interval, map, merge, type Observable } from 'rxjs';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { EventBus } from '../events/event-bus.service';
import { ExperimentsService } from './experiments.service';

/** Comment-free keep-alive so proxies do not close idle SSE connections. */
const HEARTBEAT_MS = 15_000;

function toSse(source: Observable<LiveEvent>): Observable<MessageEvent> {
  return merge(
    source.pipe(map((event): MessageEvent => ({ type: event.type, data: event }))),
    interval(HEARTBEAT_MS).pipe(map((): MessageEvent => ({ type: 'ping', data: {} }))),
  );
}

@Controller('experiments')
export class ExperimentsController {
  constructor(
    private readonly experiments: ExperimentsService,
    private readonly bus: EventBus,
  ) {}

  @Get()
  list(): ExperimentSummary[] {
    return this.experiments.list();
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(CreateExperimentSchema)) command: CreateExperimentCommand,
  ): ExperimentDetail {
    return this.experiments.create(command);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): ExperimentDetail {
    return this.experiments.get(id);
  }

  @Get(':id/report')
  report(@Param('id', ParseUUIDPipe) id: string): ExperimentReport {
    return this.experiments.report(id);
  }

  @Get(':id/runs')
  runs(
    @Param('id', ParseUUIDPipe) id: string,
    @Query(new ZodValidationPipe(RunListQuerySchema)) query: RunListQuery,
  ): RunSummary[] {
    return this.experiments.listRuns(id, query);
  }

  @Post(':id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string): ExperimentDetail {
    return this.experiments.cancel(id);
  }

  @Post(':id/retry')
  retry(@Param('id', ParseUUIDPipe) id: string): ExperimentDetail {
    return this.experiments.retryFailedRuns(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.experiments.delete(id);
  }

  @Sse(':id/stream')
  stream(@Param('id', ParseUUIDPipe) id: string): Observable<MessageEvent> {
    this.experiments.get(id);
    return toSse(this.bus.liveForExperiment(id));
  }
}

@Controller('runs')
export class RunsController {
  constructor(
    private readonly experiments: ExperimentsService,
    private readonly bus: EventBus,
  ) {}

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): RunDetail {
    return this.experiments.getRun(id);
  }

  @Get(':id/files')
  file(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('path') path: string | undefined,
  ): Promise<WorkspaceFileContent> {
    if (!path) throw new BadRequestException('Query parameter "path" is required');
    return this.experiments.readRunFile(id, path);
  }

  @Sse(':id/stream')
  stream(@Param('id', ParseUUIDPipe) id: string): Observable<MessageEvent> {
    this.experiments.getRun(id);
    return toSse(this.bus.liveForRun(id));
  }
}
