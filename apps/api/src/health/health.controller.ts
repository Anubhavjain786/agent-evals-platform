import { Controller, Get } from '@nestjs/common';
import { HermesInfoService } from '../definitions/hermes-info.service';
import { RunScheduler } from '../execution/run-scheduler.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly hermes: HermesInfoService,
    private readonly scheduler: RunScheduler,
  ) {}

  @Get()
  async check(): Promise<{
    status: 'ok';
    hermesVersion: string | null;
    activeRuns: number;
    uptimeSec: number;
  }> {
    return {
      status: 'ok',
      hermesVersion: await this.hermes.version(),
      activeRuns: this.scheduler.activeCount,
      uptimeSec: Math.round(process.uptime()),
    };
  }
}
