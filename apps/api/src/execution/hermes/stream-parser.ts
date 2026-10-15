import type { RunnerEvent } from '../agent-runner';

/** The terminal `result` record of `hermes chat --format stream-json`. */
export interface HermesResultRecord {
  sessionId: string;
  exitCode: number;
  text: string;
  durationMs: number | null;
  error: string | null;
  tokens: { input: number; output: number; total: number; cacheRead: number };
}

type Json = Record<string, unknown>;

const str = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;
const num = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/**
 * Incremental parser for Hermes' JSONL event stream. Streamed text deltas are
 * coalesced into one `assistant_text` event per message so the stored
 * trajectory stays compact and readable.
 */
export class HermesStreamParser {
  private buffer = '';
  private pendingText: { text: string; ts: number } | null = null;
  private resultRecord: HermesResultRecord | null = null;
  private malformedLines = 0;

  constructor(private readonly emit: (event: RunnerEvent) => void) {}

  get result(): HermesResultRecord | null {
    return this.resultRecord;
  }

  get malformed(): number {
    return this.malformedLines;
  }

  push(chunk: string): void {
    this.buffer += chunk;
    let newline = this.buffer.indexOf('\n');
    while (newline !== -1) {
      this.handleLine(this.buffer.slice(0, newline));
      this.buffer = this.buffer.slice(newline + 1);
      newline = this.buffer.indexOf('\n');
    }
  }

  /** Flushes any partial line and buffered text at end of stream. */
  end(): void {
    if (this.buffer.trim()) this.handleLine(this.buffer);
    this.buffer = '';
    this.flushText();
  }

  private handleLine(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) return;
    let record: Json;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (!parsed || typeof parsed !== 'object') throw new Error('not an object');
      record = parsed as Json;
    } catch {
      this.malformedLines += 1;
      return;
    }
    const ts = num(record.timestamp) ?? Date.now();

    switch (record.type) {
      case 'text': {
        const text = str(record.text);
        if (this.pendingText) this.pendingText.text += text;
        else this.pendingText = { text, ts };
        return;
      }
      case 'system':
        this.flushText();
        this.emit({
          type: 'init',
          ts,
          model: str(record.model),
          sessionId: str(record.session_id),
        });
        return;
      case 'tool_use':
        this.flushText();
        this.emit({
          type: 'tool_call',
          ts,
          toolCallId: str(record.tool_call_id),
          name: str(record.name, 'unknown'),
          input: record.input ?? null,
        });
        return;
      case 'tool_result':
        this.flushText();
        this.emit({
          type: 'tool_result',
          ts,
          toolCallId: str(record.tool_call_id),
          name: str(record.name, 'unknown'),
          output: str(record.output),
          durationMs: num(record.duration_ms),
          isError: record.is_error === true,
        });
        return;
      case 'result': {
        this.flushText();
        const tokens = (record.tokens ?? {}) as Json;
        this.resultRecord = {
          sessionId: str(record.session_id),
          exitCode: num(record.exit_code) ?? 1,
          text: str(record.text),
          durationMs: num(record.duration_ms),
          error: typeof record.error === 'string' && record.error ? record.error : null,
          tokens: {
            input: num(tokens.input) ?? 0,
            output: num(tokens.output) ?? 0,
            total: num(tokens.total) ?? 0,
            cacheRead: num(tokens.cache_read) ?? 0,
          },
        };
        this.emit({
          type: 'result',
          ts,
          exitCode: this.resultRecord.exitCode,
          text: this.resultRecord.text,
          durationMs: this.resultRecord.durationMs,
          error: this.resultRecord.error,
        });
        return;
      }
      default:
        // Unknown event types are ignored: newer Hermes versions may add events.
        return;
    }
  }

  private flushText(): void {
    if (!this.pendingText) return;
    const { text, ts } = this.pendingText;
    this.pendingText = null;
    if (text.trim()) this.emit({ type: 'assistant_text', ts, text });
  }
}
