import { BadRequestException, type PipeTransform } from '@nestjs/common';
import { stringify as toYaml } from 'yaml';
import { z } from 'zod';
import { parseDefinition } from './definition-files';

/**
 * Accepts a definition either as a JSON object or as `{ "yaml": "<document>" }`
 * (what the UI's YAML editor sends) and validates it against the shared schema.
 */
export class DefinitionInputPipe<TSchema extends z.ZodType> implements PipeTransform {
  constructor(private readonly schema: TSchema) {}

  transform(body: unknown): z.output<TSchema> {
    const text =
      body && typeof body === 'object' && typeof (body as { yaml?: unknown }).yaml === 'string'
        ? (body as { yaml: string }).yaml
        : toYaml(body ?? null);
    const parsed = parseDefinition(this.schema, text);
    if (!parsed.ok) {
      throw new BadRequestException({ message: 'Invalid definition', details: parsed.message });
    }
    return parsed.value;
  }
}
