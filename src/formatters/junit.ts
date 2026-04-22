/**
 * JUnit XML formatter. Consumed by most CI "Test Report" UIs
 * (GitLab, Buildkite, Jenkins, CircleCI, GitHub Actions with the
 * publish-test-results action, etc.) — shipping a mcpcheck run as a test
 * suite means engineers see findings in the same place they see failing
 * tests without any extra tooling.
 *
 * Mapping:
 *   - One <testsuite> per file; name = file path.
 *   - One <testcase> per issue; name = `<ruleId> @ <jsonPath>`.
 *   - Severity: errors become <failure>, warnings become <system-err>,
 *     info is emitted as a passing testcase (so the count stays accurate).
 */

import type { Issue, RunReport } from "../types.js";

export function formatJunit(report: RunReport): string {
  const lines: string[] = [];
  const totals = summary(report.files.flatMap((f) => f.issues));
  const time = (report.durationMs / 1000).toFixed(3);

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(
    `<testsuites name="mcpcheck" tests="${totals.total}" failures="${totals.errors}" errors="0" time="${time}">`
  );
  for (const file of report.files) {
    const fileTotals = summary(file.issues);
    lines.push(
      `  <testsuite name="${attr(file.file)}" tests="${fileTotals.total}" failures="${fileTotals.errors}" errors="0" time="${time}">`
    );
    if (file.issues.length === 0) {
      // Emit a single passing placeholder so tooling doesn't treat an empty
      // suite as "suite missing / broken". This is the standard JUnit trick.
      lines.push(
        `    <testcase classname="${attr(file.file)}" name="no issues" />`
      );
    }
    for (const issue of file.issues) {
      const name = `${issue.ruleId} @ ${issue.jsonPath || "<root>"}`;
      lines.push(
        `    <testcase classname="${attr(file.file)}" name="${attr(name)}">`
      );
      if (issue.severity === "error") {
        lines.push(
          `      <failure message="${attr(issue.message)}" type="${attr(issue.ruleId)}">${text(detail(issue))}</failure>`
        );
      } else if (issue.severity === "warning") {
        lines.push(`      <system-err>${text(`[warning] ${detail(issue)}`)}</system-err>`);
      } else if (issue.severity === "info") {
        lines.push(`      <system-out>${text(`[info] ${detail(issue)}`)}</system-out>`);
      }
      lines.push("    </testcase>");
    }
    lines.push("  </testsuite>");
  }
  lines.push("</testsuites>");
  return lines.join("\n");
}

function summary(issues: Issue[]): { total: number; errors: number } {
  const errors = issues.filter((i) => i.severity === "error").length;
  return { total: Math.max(issues.length, 1), errors };
}

function detail(issue: Issue): string {
  const bits = [issue.message];
  if (issue.jsonPath) bits.push(`at ${issue.jsonPath}`);
  if (issue.line) bits.push(`line ${issue.line}`);
  if (issue.fix) bits.push(`fix: ${issue.fix.description}`);
  return bits.join(" ");
}

function attr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function text(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
