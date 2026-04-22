/**
 * Minimal YAML emitter — just enough to serialise a RunReport. Human-
 * readable alternative to JSON when you want to eyeball a scan result
 * or paste it into a doc, and the best alternative to SARIF/JUnit for
 * clients that prefer config-style tree output.
 *
 * We intentionally don't pull in a yaml dependency: the shape we emit is
 * narrow (strings, numbers, booleans, arrays of objects), strict JSON-like
 * formatting, always-quoted strings that need it. If users need round-trip
 * YAML parsing they should go through `--format json` instead.
 */

import type { RunReport } from "../types.js";

export function formatYaml(report: RunReport): string {
  const lines: string[] = [];
  lines.push(`errorCount: ${report.errorCount}`);
  lines.push(`warningCount: ${report.warningCount}`);
  lines.push(`infoCount: ${report.infoCount}`);
  lines.push(`durationMs: ${report.durationMs}`);
  lines.push("files:");
  for (const file of report.files) {
    lines.push(`  - file: ${q(file.file)}`);
    lines.push(`    fatal: ${file.fatal}`);
    if (file.issues.length === 0) {
      lines.push(`    issues: []`);
    } else {
      lines.push(`    issues:`);
      for (const i of file.issues) {
        lines.push(`      - ruleId: ${q(i.ruleId)}`);
        lines.push(`        severity: ${q(i.severity)}`);
        lines.push(`        message: ${q(i.message)}`);
        lines.push(`        jsonPath: ${q(i.jsonPath)}`);
        if (i.line !== undefined) lines.push(`        line: ${i.line}`);
        if (i.fix) {
          lines.push(`        fix:`);
          lines.push(`          description: ${q(i.fix.description)}`);
          lines.push(`          start: ${i.fix.start}`);
          lines.push(`          end: ${i.fix.end}`);
        }
      }
    }
  }
  return lines.join("\n") + "\n";
}

/**
 * Quote the value as a JSON-compatible double-quoted YAML scalar. Safe
 * for every codepoint; YAML's double-quoted form accepts JSON-escaped
 * sequences verbatim. Bit of an overapproximation (we always quote even
 * when we could leave a bare scalar) but the output stays predictable.
 */
function q(s: string): string {
  return JSON.stringify(s);
}
