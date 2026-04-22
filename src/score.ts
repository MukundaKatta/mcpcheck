/**
 * `mcpcheck score <file...>` — reduce a config (or set of configs) to a
 * single health score and letter grade. Deliberately simple so the output
 * fits in one sentence:
 *
 *   80 (B) — mcp.json   3 warnings, 0 errors
 *   60 (D) — .cursor/mcp.json   1 error, 4 warnings
 *
 * Scoring: start at 100. Each error subtracts `errorPenalty` (default
 * 10), each warning subtracts `warningPenalty` (3), each info subtracts
 * `infoPenalty` (1). Floor at 0. Letter grade follows the standard US
 * scale with the A-/B+ cutoffs that most people intuitively expect.
 *
 * Not a substitute for reading the report — it's a "has this config
 * gotten better or worse over time" quick signal, suitable for CI
 * badges and Slack summaries.
 */

import type { RunReport } from "./types.js";

export interface Score {
  file: string;
  score: number;
  grade: string;
  errors: number;
  warnings: number;
  infos: number;
}

export function scoreReport(
  report: RunReport,
  opts: { errorPenalty?: number; warningPenalty?: number; infoPenalty?: number } = {}
): Score[] {
  const ep = opts.errorPenalty ?? 10;
  const wp = opts.warningPenalty ?? 3;
  const ip = opts.infoPenalty ?? 1;
  return report.files.map((f) => {
    const errors = f.issues.filter((i) => i.severity === "error").length;
    const warnings = f.issues.filter((i) => i.severity === "warning").length;
    const infos = f.issues.filter((i) => i.severity === "info").length;
    const raw = 100 - errors * ep - warnings * wp - infos * ip;
    const score = Math.max(0, raw);
    return { file: f.file, score, grade: letterGrade(score), errors, warnings, infos };
  });
}

function letterGrade(score: number): string {
  if (score >= 97) return "A+";
  if (score >= 93) return "A";
  if (score >= 90) return "A-";
  if (score >= 87) return "B+";
  if (score >= 83) return "B";
  if (score >= 80) return "B-";
  if (score >= 77) return "C+";
  if (score >= 73) return "C";
  if (score >= 70) return "C-";
  if (score >= 60) return "D";
  return "F";
}

export function formatScoreText(scores: Score[]): string {
  if (scores.length === 0) return "No files scored.\n";
  const nameWidth = Math.max(4, ...scores.map((s) => s.file.length));
  const lines: string[] = [];
  for (const s of scores) {
    const summary =
      s.errors === 0 && s.warnings === 0 && s.infos === 0
        ? "clean"
        : `${s.errors}E ${s.warnings}W ${s.infos}I`;
    lines.push(
      `${String(s.score).padStart(3)} (${s.grade.padEnd(2)})  ${s.file.padEnd(nameWidth)}  ${summary}`
    );
  }
  if (scores.length > 1) {
    const avg = Math.round(
      scores.reduce((n, s) => n + s.score, 0) / scores.length
    );
    lines.push("");
    lines.push(
      `average score: ${avg} (${letterGrade(avg)}) across ${scores.length} file(s)`
    );
  }
  return lines.join("\n") + "\n";
}

export function averageScore(scores: Score[]): number {
  if (scores.length === 0) return 100;
  return Math.round(scores.reduce((n, s) => n + s.score, 0) / scores.length);
}
