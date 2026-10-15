import { spawn } from 'node:child_process';

/** Keeps the last `maxBytes` of a stream — enough to diagnose a failure without unbounded memory. */
export class TailBuffer {
  private chunks: string[] = [];
  private size = 0;

  constructor(private readonly maxBytes: number) {}

  push(chunk: string): void {
    this.chunks.push(chunk);
    this.size += chunk.length;
    while (this.size > this.maxBytes && this.chunks.length > 1) {
      this.size -= this.chunks.shift()!.length;
    }
  }

  toString(): string {
    const text = this.chunks.join('');
    return text.length > this.maxBytes ? text.slice(-this.maxBytes) : text;
  }
}

export interface ManagedProcessOptions {
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  timeoutMs: number;
  signal: AbortSignal;
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
}

export interface ManagedProcessResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  cancelled: boolean;
  spawnError: Error | null;
}

const KILL_GRACE_MS = 5_000;

/** Signals the whole process group: agents spawn shells, gateways and tools of their own. */
function killGroup(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-pid, signal);
  } catch {
    // ESRCH: the group already exited.
  }
}

/**
 * Spawns a process in its own process group with a hard timeout and
 * cancellation. On timeout/abort the group gets SIGTERM, then SIGKILL; after a
 * normal exit any leftover descendants are reaped the same way.
 */
export function runManagedProcess(options: ManagedProcessOptions): Promise<ManagedProcessResult> {
  return new Promise((resolve) => {
    let timedOut = false;
    let cancelled = false;
    let settled = false;

    const child = spawn(options.command, options.args, {
      cwd: options.cwd,
      env: options.env,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => options.onStdout?.(chunk));
    child.stderr.on('data', (chunk: string) => options.onStderr?.(chunk));

    const terminate = (): void => {
      if (child.pid === undefined) return;
      const pid = child.pid;
      killGroup(pid, 'SIGTERM');
      setTimeout(() => killGroup(pid, 'SIGKILL'), KILL_GRACE_MS).unref();
    };

    const timer = setTimeout(() => {
      timedOut = true;
      terminate();
    }, options.timeoutMs);
    timer.unref();

    const onAbort = (): void => {
      cancelled = true;
      terminate();
    };
    if (options.signal.aborted) onAbort();
    else options.signal.addEventListener('abort', onAbort, { once: true });

    const finish = (result: Omit<ManagedProcessResult, 'timedOut' | 'cancelled'>): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal.removeEventListener('abort', onAbort);
      if (child.pid !== undefined) killGroup(child.pid, 'SIGTERM');
      resolve({ ...result, timedOut, cancelled });
    };

    child.on('error', (error) => finish({ exitCode: null, signal: null, spawnError: error }));
    // 'close' fires after stdio is drained, so no output is lost.
    child.on('close', (exitCode, signal) => finish({ exitCode, signal, spawnError: null }));
  });
}
