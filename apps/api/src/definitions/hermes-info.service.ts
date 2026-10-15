import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config/app-config';

const execFileAsync = promisify(execFile);

/** Detects the installed Hermes version once; `null` means Hermes is unavailable. */
@Injectable()
export class HermesInfoService {
  private readonly logger = new Logger(HermesInfoService.name);
  private versionPromise: Promise<string | null> | null = null;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  version(): Promise<string | null> {
    this.versionPromise ??= this.detect();
    return this.versionPromise;
  }

  private async detect(): Promise<string | null> {
    try {
      const { stdout } = await execFileAsync(this.config.hermesBin, ['--version'], {
        timeout: 30_000,
      });
      const line =
        stdout
          .split('\n')
          .find((l) => l.trim().length > 0)
          ?.trim() ?? null;
      this.logger.log(`Hermes detected: ${line}`);
      return line;
    } catch (error) {
      this.logger.warn(
        `Hermes not available via "${this.config.hermesBin}": ${(error as Error).message}`,
      );
      return null;
    }
  }
}
