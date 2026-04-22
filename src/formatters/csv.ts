/**
 * Plain CSV output: one row per issue with a stable header. Intended for
 * piping into a spreadsheet / pandas for bulk review across many
 * repositories (e.g., an org-wide audit that produces 10k findings).
 *
 * Columns: file, line, severity, rule, message, json_path, autofix_available
 */

import type { RunReport } from "../types.js";

export function formatCsv(report: RunReport): string {
  const rows: string[] = ["file,line,severity,rule,message,json_path,autofix_available"];
  for (const file of report.files) {
    for (const i of file.issues) {
      rows.push(
        [
          esc(file.file),
          i.line ?? "",
          i.severity,
          i.ruleId,
          esc(i.message),
          esc(i.jsonPath),
          i.fix ? "yes" : "no",
        ].join(",")
      );
    }
  }
  return rows.join("\n") + "\n";
}

function esc(s: string | number): string {
  const str = String(s);
  // RFC 4180: quote when the field contains comma, double quote, or newline.
  if (/[,"\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
