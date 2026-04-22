/**
 * GitHub-flavored Markdown formatter. Intended for pasting a report into a
 * PR comment (or producing one via a workflow: see
 * `examples/github-actions/mcpcheck-pr-comment.yml`).
 *
 * Layout:
 *   <summary block with counts>
 *   <details> per file </details>  — collapsed by default, one table each
 */

import type { Issue, RunReport } from "../types.js";

export function formatMarkdown(report: RunReport): string {
  const parts: string[] = ["# mcpcheck report", ""];
  const total = report.errorCount + report.warningCount + report.infoCount;
  if (total === 0) {
    parts.push(
      `All ${report.files.length} file(s) clean. Scanned in ${report.durationMs}ms.`
    );
    return parts.join("\n");
  }

  const summary: string[] = [];
  if (report.errorCount) summary.push(`**${report.errorCount}** error(s)`);
  if (report.warningCount) summary.push(`**${report.warningCount}** warning(s)`);
  if (report.infoCount) summary.push(`${report.infoCount} info`);
  parts.push(
    `${summary.join(", ")} across ${report.files.length} file(s) (scanned in ${report.durationMs}ms).`,
    ""
  );

  for (const file of report.files) {
    if (file.issues.length === 0) continue;
    parts.push(`<details><summary><code>${escapeMd(file.file)}</code> — ${file.issues.length} issue(s)</summary>`);
    parts.push("");
    parts.push("| line | severity | rule | message |");
    parts.push("|---:|---|---|---|");
    for (const issue of file.issues) {
      parts.push(
        `| ${issue.line ?? "—"} | ${severityBadge(issue.severity)} | \`${issue.ruleId}\` | ${formatMessage(issue)} |`
      );
    }
    parts.push("");
    parts.push("</details>");
    parts.push("");
  }
  return parts.join("\n");
}

function severityBadge(s: Issue["severity"]): string {
  if (s === "error") return "🔴 error";
  if (s === "warning") return "🟡 warning";
  if (s === "info") return "🔵 info";
  return s;
}

function formatMessage(issue: Issue): string {
  const msg = escapeMd(issue.message);
  const fix = issue.fix ? ` **Autofix:** ${escapeMd(issue.fix.description)}` : "";
  return msg + fix;
}

function escapeMd(s: string): string {
  // Minimal: escape pipes (table breakers) and backticks used in the wrapper.
  return s.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}
