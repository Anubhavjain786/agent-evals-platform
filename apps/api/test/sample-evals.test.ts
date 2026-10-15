import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { AgentConfigSchema, SuiteSchema } from '@agent-evals/shared';
import { describe, expect, it } from 'vitest';
import { loadDefinitionDir } from '../src/definitions/definition-files';

/** Guards the committed sample evals: they must always load and reference existing fixtures and skills. */
const EVALS = resolve(__dirname, '../../../evals');

describe('sample evals', () => {
  it('every suite is valid and references existing fixtures', async () => {
    const { definitions, errors } = await loadDefinitionDir(join(EVALS, 'suites'), SuiteSchema);
    expect(errors).toEqual([]);
    expect(definitions.map((d) => d.definition.id).sort()).toEqual(['core', 'harness']);
    for (const { definition } of definitions) {
      for (const task of definition.tasks) {
        const dirs = [
          task.fixtures,
          ...task.scoring.scorers.map((s) => (s.type === 'command' ? s.hiddenFixtures : undefined)),
        ].filter((d): d is string => !!d);
        for (const dir of dirs)
          expect(existsSync(join(EVALS, 'fixtures', dir)), `${task.id}: ${dir}`).toBe(true);
      }
    }
  });

  it('every agent config is valid and references existing skills', async () => {
    const { definitions, errors } = await loadDefinitionDir(
      join(EVALS, 'configs'),
      AgentConfigSchema,
    );
    expect(errors).toEqual([]);
    expect(definitions.length).toBeGreaterThanOrEqual(3);
    for (const { definition } of definitions) {
      for (const skill of definition.skills.include) {
        expect(
          existsSync(join(EVALS, 'skills', skill, 'SKILL.md')),
          `${definition.id}: ${skill}`,
        ).toBe(true);
      }
    }
  });
});
