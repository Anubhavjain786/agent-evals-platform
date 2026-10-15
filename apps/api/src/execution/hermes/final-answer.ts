/**
 * Hermes appends harness diagnostics to the final response (e.g. the
 * file-mutation verifier listing failed edits). They are useful in the
 * trajectory but are not part of the agent's answer, and would confuse
 * answer scorers (a numeric scorer would read "1 file edit(s)").
 */
const HARNESS_FOOTERS: RegExp[] = [/\n*⚠️ File-mutation verifier:[\s\S]*$/u];

export function cleanFinalAnswer(text: string): string {
  return HARNESS_FOOTERS.reduce((answer, footer) => answer.replace(footer, ''), text).trim();
}
