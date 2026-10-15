import { mkdtemp, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TaskSchema } from '@agent-evals/shared';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { AppConfig } from '../config/app-config';
import { WorkspaceService } from './workspace.service';

async function service(): Promise<WorkspaceService> {
  const dataDir = await mkdtemp(join(tmpdir(), 'ws-'));
  return new WorkspaceService({
    dataDir,
    evalsDir: join(dataDir, 'evals'),
    keepRunHome: false,
  } as AppConfig);
}

const task = TaskSchema.parse({
  id: 't',
  name: 'T',
  prompt: 'p',
  files: { 'notes/a.txt': 'hello' },
  scoring: { scorers: [{ type: 'contains', values: ['x'] }] },
});

describe('WorkspaceService', () => {
  it('seeds inline files and reports created and modified files', async () => {
    const workspaces = await service();
    const { dirs, manifest } = await workspaces.prepare('run-1', task);
    await writeFile(join(dirs.workspace, 'notes/a.txt'), 'changed');
    await writeFile(join(dirs.workspace, 'out.json'), '{}');
    expect(await workspaces.snapshot(dirs, manifest)).toEqual([
      { path: 'notes/a.txt', size: 7, created: false, modified: true },
      { path: 'out.json', size: 2, created: true, modified: false },
    ]);
  });

  it('serves workspace files but never anything outside the workspace', async () => {
    const workspaces = await service();
    const { dirs } = await workspaces.prepare('run-2', task);
    expect((await workspaces.readFile('run-2', 'notes/a.txt')).content).toBe('hello');

    await expect(workspaces.readFile('run-2', '../../secret')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    const outside = join(dirs.root, '..', 'outside.txt');
    await writeFile(outside, 'secret');
    await symlink(outside, join(dirs.workspace, 'link.txt'));
    await expect(workspaces.readFile('run-2', 'link.txt')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(workspaces.readFile('run-2', 'missing.txt')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
