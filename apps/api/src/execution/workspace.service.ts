import { createHash } from 'node:crypto';
import {
  cp,
  mkdir,
  open,
  readdir,
  readFile,
  realpath,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import type { TaskDefinition, WorkspaceFile, WorkspaceFileContent } from '@agent-evals/shared';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import type { RunDirectories } from './agent-runner';

/** path → `<sha1>:<size>` of each file, used to tell created/modified files apart. */
export type WorkspaceManifest = Map<string, string>;

const SKIPPED_DIRS = new Set(['.git', 'node_modules', '__pycache__', '.venv', '.hermes']);
const MAX_LISTED_FILES = 500;
const MAX_PREVIEW_BYTES = 256 * 1024;

@Injectable()
export class WorkspaceService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  dirsFor(runId: string): RunDirectories {
    const root = join(this.config.dataDir, 'runs', runId);
    return {
      root,
      home: join(root, 'home'),
      workspace: join(root, 'workspace'),
      runtime: join(root, 'rt'),
    };
  }

  fixturesDir(relativeDir: string): string {
    return join(this.config.evalsDir, 'fixtures', relativeDir);
  }

  /** Creates a fresh run directory and seeds the workspace with the task's fixtures. */
  async prepare(
    runId: string,
    task: TaskDefinition,
  ): Promise<{ dirs: RunDirectories; manifest: WorkspaceManifest }> {
    const dirs = this.dirsFor(runId);
    await rm(dirs.root, { recursive: true, force: true });
    // Hermes refuses control sockets in group/world-accessible directories.
    for (const dir of [dirs.root, dirs.home, dirs.workspace, dirs.runtime]) {
      await mkdir(dir, { recursive: true, mode: 0o700 });
    }
    if (task.fixtures) {
      await cp(this.fixturesDir(task.fixtures), dirs.workspace, { recursive: true });
    }
    for (const [path, content] of Object.entries(task.files)) {
      const target = this.resolveInside(dirs.workspace, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content);
    }
    return { dirs, manifest: await this.manifest(dirs.workspace) };
  }

  /** Copies grader-only fixtures in after the agent has finished. */
  async addHiddenFixtures(dirs: RunDirectories, relativeDir: string): Promise<void> {
    await cp(this.fixturesDir(relativeDir), dirs.workspace, { recursive: true, force: true });
  }

  /** Lists the workspace's final state relative to what was seeded. */
  async snapshot(dirs: RunDirectories, seeded: WorkspaceManifest): Promise<WorkspaceFile[]> {
    const current = await this.manifest(dirs.workspace);
    const files: WorkspaceFile[] = [];
    for (const [path, entry] of current) {
      const [hash, size] = entry.split(':') as [string, string];
      const seededHash = seeded.get(path)?.split(':')[0];
      files.push({
        path,
        size: Number(size),
        created: seededHash === undefined,
        modified: seededHash !== undefined && seededHash !== hash,
      });
    }
    return files.sort((a, b) => a.path.localeCompare(b.path));
  }

  async readFile(runId: string, path: string): Promise<WorkspaceFileContent> {
    const { workspace } = this.dirsFor(runId);
    const requested = this.resolveInside(workspace, path);
    let target: string;
    let size: number;
    try {
      // Follow symlinks, then re-check: the agent could have linked to files outside its workspace.
      target = this.resolveInside(await realpath(workspace), await realpath(requested));
      const info = await stat(target);
      if (!info.isFile()) throw new Error('not a file');
      size = info.size;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new NotFoundException(`File "${path}" not found in run workspace`);
    }
    const handle = await open(target, 'r');
    try {
      const length = Math.min(size, MAX_PREVIEW_BYTES);
      const buffer = Buffer.alloc(length);
      await handle.read(buffer, 0, length, 0);
      const binary = buffer.includes(0);
      return {
        path,
        size,
        content: binary ? '' : buffer.toString('utf8'),
        truncated: size > MAX_PREVIEW_BYTES,
        binary,
      };
    } finally {
      await handle.close();
    }
  }

  /** The Hermes home holds sessions, sockets and logs — large and not needed after scoring. */
  async cleanup(dirs: RunDirectories): Promise<void> {
    if (this.config.keepRunHome) return;
    await rm(dirs.home, { recursive: true, force: true });
    await rm(dirs.runtime, { recursive: true, force: true });
  }

  /** Resolves a workspace-relative path, rejecting anything that escapes the workspace. */
  resolveInside(root: string, path: string): string {
    const target = resolve(root, path);
    if (target !== root && !target.startsWith(root + sep)) {
      throw new BadRequestException(`Path "${path}" escapes the workspace`);
    }
    return target;
  }

  private async manifest(root: string): Promise<WorkspaceManifest> {
    const manifest: WorkspaceManifest = new Map();
    const walk = async (dir: string): Promise<void> => {
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (manifest.size >= MAX_LISTED_FILES) return;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!SKIPPED_DIRS.has(entry.name)) await walk(full);
        } else if (entry.isFile()) {
          const content = await readFile(full);
          const hash = createHash('sha1').update(content).digest('hex');
          manifest.set(relative(root, full), `${hash}:${content.length}`);
        }
      }
    };
    await walk(root);
    return manifest;
  }
}
