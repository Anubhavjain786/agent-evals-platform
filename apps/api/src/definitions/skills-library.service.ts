import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CatalogSkill } from '@agent-evals/shared';
import { Inject, Injectable } from '@nestjs/common';
import { parse as parseYaml } from 'yaml';
import { APP_CONFIG, type AppConfig } from '../config/app-config';

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/;

/**
 * Skills available to agent configs, stored as Hermes-compatible skill
 * directories (`evals/skills/<id>/SKILL.md`). A config opts in per skill, so
 * "with skill X" vs "without" is an explicit, comparable variable.
 */
@Injectable()
export class SkillsLibraryService {
  private readonly root: string;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.root = join(config.evalsDir, 'skills');
  }

  skillDir(id: string): string {
    return join(this.root, id);
  }

  exists(id: string): boolean {
    return existsSync(join(this.root, id, 'SKILL.md'));
  }

  async list(): Promise<CatalogSkill[]> {
    if (!existsSync(this.root)) return [];
    const entries = await readdir(this.root, { withFileTypes: true });
    const skills: CatalogSkill[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || !this.exists(entry.name)) continue;
      const text = await readFile(join(this.root, entry.name, 'SKILL.md'), 'utf8');
      const meta = this.frontmatter(text);
      skills.push({
        id: entry.name,
        name: typeof meta.name === 'string' ? meta.name : entry.name,
        description: typeof meta.description === 'string' ? meta.description : '',
      });
    }
    return skills.sort((a, b) => a.id.localeCompare(b.id));
  }

  private frontmatter(text: string): Record<string, unknown> {
    const match = FRONTMATTER.exec(text);
    if (!match?.[1]) return {};
    try {
      const parsed: unknown = parseYaml(match[1]);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
}
