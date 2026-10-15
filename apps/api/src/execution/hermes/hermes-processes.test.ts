import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HermesStartupGate, reapHermesProcesses } from './hermes-processes';

const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

describe('HermesStartupGate', () => {
  it('lets one caller through at a time, in arrival order', async () => {
    const gate = new HermesStartupGate();
    const order: string[] = [];
    const first = await gate.acquire();
    const second = gate.acquire().then((release) => {
      order.push('second');
      return release;
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(order).toEqual([]);
    order.push('first-released');
    first();
    (await second)();
    expect(order).toEqual(['first-released', 'second']);
  });

  it('tolerates double release', async () => {
    const gate = new HermesStartupGate();
    const release = await gate.acquire();
    release();
    release();
    (await gate.acquire())();
  });
});

describe('reapHermesProcesses', () => {
  it('terminates a detached leftover process of the run', async () => {
    const home = await mkdtemp(join(tmpdir(), 'reap-'));
    const child = spawn('sleep', ['30'], {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, HERMES_HOME: home },
    });
    child.unref();
    const pid = child.pid!;
    // Covers non-Linux hosts, where the PID file is the only lead.
    await writeFile(join(home, 'gateway.pid'), JSON.stringify({ pid }));
    expect(alive(pid)).toBe(true);

    expect(await reapHermesProcesses(home)).toBe(1);
    await new Promise((r) => setTimeout(r, 100));
    expect(alive(pid)).toBe(false);
  });

  it('is a no-op when nothing is left behind', async () => {
    const home = await mkdtemp(join(tmpdir(), 'reap-'));
    expect(await reapHermesProcesses(home)).toBe(0);
  });
});
