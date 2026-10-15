import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

export interface LoadedDefinition<T> {
  file: string;
  definition: T;
}

export interface DefinitionLoadError {
  file: string;
  message: string;
}

export interface DefinitionLoadResult<T> {
  definitions: LoadedDefinition<T>[];
  errors: DefinitionLoadError[];
}

const YAML_EXTENSIONS = new Set(['.yaml', '.yml', '.json']);

/** Parses YAML (a superset of JSON) and validates it, returning a readable error on failure. */
export function parseDefinition<TSchema extends z.ZodType>(
  schema: TSchema,
  text: string,
): { ok: true; value: z.output<TSchema> } | { ok: false; message: string } {
  let raw: unknown;
  try {
    raw = parseYaml(text);
  } catch (error) {
    return { ok: false, message: `invalid YAML: ${(error as Error).message}` };
  }
  const result = schema.safeParse(raw);
  if (!result.success) return { ok: false, message: z.prettifyError(result.error) };
  return { ok: true, value: result.data };
}

/**
 * Loads every definition file in a directory. Invalid files are reported, not
 * thrown, so one broken definition cannot take the whole platform down.
 */
export async function loadDefinitionDir<TSchema extends z.ZodType>(
  dir: string,
  schema: TSchema,
): Promise<DefinitionLoadResult<z.output<TSchema>>> {
  let entries: string[];
  try {
    entries = (await readdir(dir)).filter((name) => YAML_EXTENSIONS.has(extname(name))).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { definitions: [], errors: [] };
    throw error;
  }

  const result: DefinitionLoadResult<z.output<TSchema>> = { definitions: [], errors: [] };
  for (const name of entries) {
    const file = join(dir, name);
    const parsed = parseDefinition(schema, await readFile(file, 'utf8'));
    if (parsed.ok) result.definitions.push({ file, definition: parsed.value });
    else result.errors.push({ file, message: parsed.message });
  }
  return result;
}
