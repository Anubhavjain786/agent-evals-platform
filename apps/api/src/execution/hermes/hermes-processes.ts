import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { Injectable } from '@nestjs/common';

const REAP_GRACE_MS = 2_000;
/** Longest one run may hold the startup gate if it never produces a first event. */
const STARTUP_GATE_MAX_HOLD_MS = 45_000;

function signalGroup(pid: number, signal: NodeJS.Signals): void {
  for (const target of [-pid, pid]) {
    try {
      process.kill(target, signal);
    } catch {
      // ESRCH / EPERM: already gone or not a group leader.
    }
  }
}

/** PIDs whose environment carries `HERMES_HOME=<home>` (Linux /proc scan). */
async function pidsForHome(home: string): Promise<number[] | null> {
  let entries: string[];
  try {
    entries = await readdir('/proc');
  } catch {
    return null; // Not Linux.
  }
  const needle = `HERMES_HOME=${home}\0`;
  const matches: number[] = [];
  await Promise.all(
    entries
      .filter((name) => /^\d+$/.test(name) && Number(name) !== process.pid)
      .map(async (name) => {
        try {
          const environ = await readFile(`/proc/${name}/environ`, 'latin1');
          if (environ.includes(needle)) matches.push(Number(name));
        } catch {
          // Exited meanwhile, or not ours.
        }
      }),
  );
  return matches;
}

/** Fallback: the gateway records its PID (plain number or JSON record) in its home. */
async function pidFromPidFile(home: string): Promise<number[]> {
  try {
    const text = (await readFile(join(home, 'gateway.pid'), 'utf8')).trim();
    const pid = text.startsWith('{')
      ? Number((JSON.parse(text) as { pid?: unknown }).pid)
      : Number(text);
    return Number.isInteger(pid) && pid > 1 ? [pid] : [];
  } catch {
    return [];
  }
}

/**
 * `hermes chat` starts a detached gateway daemon (its own session and process
 * group) that outlives the CLI. Every process still carrying this run's
 * HERMES_HOME after the run is a leftover: terminate it so runs neither leak
 * memory nor collide with the next attempt in the same directory.
 */
export async function reapHermesProcesses(home: string): Promise<number> {
  const pids = (await pidsForHome(home)) ?? (await pidFromPidFile(home));
  if (pids.length === 0) return 0;
  for (const pid of pids) signalGroup(pid, 'SIGTERM');
  await sleep(REAP_GRACE_MS);
  for (const pid of pids) signalGroup(pid, 'SIGKILL');
  return pids.length;
}

/**
 * Serialises Hermes cold starts. Starting several gateways at once makes them
 * contend for CPU and shared tool-store locks until they miss their start
 * deadline; letting one start at a time (released at the run's first agent
 * event) keeps runs parallel while avoiding the thundering herd.
 */
@Injectable()
export class HermesStartupGate {
  private tail: Promise<void> = Promise.resolve();

  async acquire(): Promise<() => void> {
    let open!: () => void;
    const turn = new Promise<void>((resolve) => (open = resolve));
    const previous = this.tail;
    this.tail = previous.then(() => turn);
    await previous;

    let released = false;
    const release = (): void => {
      if (released) return;
      released = true;
      clearTimeout(timer);
      open();
    };
    const timer = setTimeout(release, STARTUP_GATE_MAX_HOLD_MS);
    timer.unref();
    return release;
  }
}
