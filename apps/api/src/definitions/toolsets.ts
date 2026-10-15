import type { CatalogToolset } from '@agent-evals/shared';

/**
 * Hermes toolsets that make sense in an unattended eval run (see Hermes'
 * toolsets reference). Platform-, desktop- and messaging-only toolsets are
 * omitted; any other toolset id is still accepted in a config definition.
 */
export const EVAL_TOOLSETS: CatalogToolset[] = [
  { id: 'file', description: 'read_file, write_file, patch, search_files' },
  { id: 'terminal', description: 'Shell commands and background processes' },
  { id: 'code_execution', description: 'Python scripts that call Hermes tools programmatically' },
  { id: 'memory', description: 'Persistent cross-session memory (needs memory enabled)' },
  { id: 'skills', description: 'skills_list, skill_view, skill_manage' },
  { id: 'todo', description: 'In-session task list' },
  { id: 'session_search', description: 'Search past sessions' },
  { id: 'web', description: 'web_search and web_extract (needs a search backend + network)' },
  { id: 'search', description: 'web_search only' },
  { id: 'browser', description: 'Headless browser automation (heavy; needs network)' },
  { id: 'vision', description: 'Image analysis with a vision-capable model' },
  { id: 'delegation', description: 'Spawn subagents' },
];
