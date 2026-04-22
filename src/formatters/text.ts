import pc from "picocolors";
import type { Issue, RunReport } from "../types.js";

const SEV_COLOR = {
  error: pc.red,
  warning: pc.yellow,
  info: pc.cyan,
  off: pc.dim,
} as const;

export function formatText(report: RunReport): string {
  const lines: string[] = [];
  for (const file of report.files) {
    lines.push(pc.underline(file.file));
    if (file.issues.length === 0) {
      lines.push(pc.green("  No issues."));
      lines.push("");
      continue;
    }
    for (const issue of file.issues) {
      lines.push(formatIssue(issue));
    }
    lines.push("");
  }
  lines.push(summary(report));
  return lines.join("\n");
}

function formatIssue(issue: Issue): string {
  const color = SEV_COLOR[issue.severity];
  const loc = issue.line ? `line ${issue.line}` : "-";
  const head = `  ${loc.padEnd(9)}${color(issue.severity.padEnd(8))}${pc.dim(issue.ruleId)}`;
  const msg = `    ${issue.message}`;
  const path = pc.dim(`    at ${issue.jsonPath || "<root>"}`);
  const fix = issue.fix ? pc.green(`    fix: ${issue.fix.description}`) : "";
  return [head, msg, path, fix].filter(Boolean).join("\n");
}

function summary(report: RunReport): string {
  const total = report.errorCount + report.warningCount + report.infoCount;
  if (total === 0) {
    return pc.green(
      `Checked ${report.files.length} file(s) in ${report.durationMs}ms: no issues.`
    );
  }
  const parts: string[] = [];
  if (report.errorCount) parts.push(pc.red(`${report.errorCount} error(s)`));
  if (report.warningCount) parts.push(pc.yellow(`${report.warningCount} warning(s)`));
  if (report.infoCount) parts.push(pc.cyan(`${report.infoCount} info`));
  return pc.bold(
    `Checked ${report.files.length} file(s) in ${report.durationMs}ms: ${parts.join(", ")}.`
  );
}
