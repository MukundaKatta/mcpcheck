/**
 * GitHub Actions workflow commands. When mcpcheck runs inside GitHub Actions
 * these lines become inline PR file annotations.
 */

import type { Issue, RunReport } from "../types.js";

export function formatGithub(report: RunReport): string {
  const lines: string[] = [];
  for (const file of report.files) {
    for (const issue of file.issues) {
      lines.push(toLine(file.file, issue));
    }
  }
  return lines.join("\n");
}

function toLine(file: string, issue: Issue): string {
  const type =
    issue.severity === "info" ? "notice" : issue.severity === "warning" ? "warning" : "error";
  const params = [
    `file=${escapeParam(file)}`,
    issue.line ? `line=${issue.line}` : "",
    `title=${escapeParam(`mcpcheck/${issue.ruleId}`)}`,
  ]
    .filter(Boolean)
    .join(",");
  return `::${type} ${params}::${escapeData(issue.message)}`;
}

function escapeData(s: string): string {
  return s.replace(/\r/g, "%0D").replace(/\n/g, "%0A").replace(/%/g, "%25");
}

function escapeParam(s: string): string {
  return s
    .replace(/\r/g, "%0D")
    .replace(/\n/g, "%0A")
    .replace(/:/g, "%3A")
    .replace(/,/g, "%2C")
    .replace(/%/g, "%25");
}
