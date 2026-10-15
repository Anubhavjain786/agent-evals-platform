import type { CatalogToolset } from '@agent-evals/shared';

/**
 * Hermes toolsets that make sense in an unattended eval run (see Hermes'
 * toolsets reference). Platform-, desktop- and messaging-only toolsets are
 * omitted; any other toolset id is still accepted in a config definition.
 */
export const EVAL_TOOLSETS: CatalogToolset[] = [
  { id: 'file', description: 'Read, write, edit and search files' },
  { id: 'terminal', description: 'Run shell commands' },
  { id: 'code_execution', description: 'Run Python scripts that use Hermes tools' },
  { id: 'memory', description: 'Remember facts across conversations (turn memory on too)' },
  { id: 'skills', description: 'Find and open skills' },
  { id: 'todo', description: 'Keep a to-do list during the task' },
  { id: 'session_search', description: 'Search past conversations' },
  { id: 'web', description: 'Search the web and read pages (needs network and a search service)' },
  { id: 'search', description: 'Search the web only' },
  { id: 'browser', description: 'Control a web browser (heavy; needs network)' },
  { id: 'vision', description: 'Look at images (needs a model that can see images)' },
  { id: 'delegation', description: 'Start helper agents' },
];
