/**
 * Baseline mode — accept every issue that exists today, fail only on new ones.
 *
 * Adopting a linter on an existing codebase is mostly a social problem: how
 * do you turn it on in CI without asking the team to fix 200 findings at
 * once? The same shape ESLint and rubocop settled on: run once with
 * `--baseline-write` to snapshot every current issue to
 * `.mcpcheck.baseline.json`, then CI runs with `--baseline` and only new
 * issues trip `--fail-on`.
 *
 * Keying: we match on `ruleId + jsonPath`. Message text is excluded so that
 * rewording a diagnostic doesn't invalidate the baseline. A renamed server
 * or moved field *does* invalidate its entry — that's correct; the finding
 * is genuinely different.
 */

import { readFile, writeFile } from "node:fs/promises";
import type { Issue, FileReport } from "./types.js";

export interface BaselineEntry {
  file: string;
  ruleId: string;
  jsonPath: string;
}

export interface BaselineFile {
  /** Opaque version tag for future-proofing. Parser tolerates any value. */
  version: 1;
  /** ISO-8601 timestamp of when the baseline was written. */
  generatedAt: string;
  entries: BaselineEntry[];
}

export function entryKey(file: string, ruleId: string, jsonPath: string): string {
  return `${file}\u0000${ruleId}\u0000${jsonPath}`;
}

export function issueKey(file: string, issue: Issue): string {
  return entryKey(file, issue.ruleId, issue.jsonPath);
}

export function buildBaseline(reports: FileReport[]): BaselineFile {
  const entries: BaselineEntry[] = [];
  for (const r of reports) {
    for (const i of r.issues) {
      entries.push({ file: r.file, ruleId: i.ruleId, jsonPath: i.jsonPath });
    }
  }
  // Stable order so the baseline diffs cleanly in PRs.
  entries.sort((a, b) => {
    if (a.file !== b.file) return a.file < b.file ? -1 : 1;
    if (a.ruleId !== b.ruleId) return a.ruleId < b.ruleId ? -1 : 1;
    return a.jsonPath < b.jsonPath ? -1 : a.jsonPath > b.jsonPath ? 1 : 0;
  });
  return { version: 1, generatedAt: new Date().toISOString(), entries };
}

export async function writeBaseline(
  path: string,
  reports: FileReport[]
): Promise<number> {
  const baseline = buildBaseline(reports);
  await writeFile(path, JSON.stringify(baseline, null, 2) + "\n", "utf8");
  return baseline.entries.length;
}

export async function loadBaseline(path: string): Promise<Set<string> | undefined> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    return undefined;
  }
  let parsed: BaselineFile;
  try {
    parsed = JSON.parse(raw) as BaselineFile;
  } catch {
    return undefined;
  }
  const keys = new Set<string>();
  for (const e of parsed.entries ?? []) {
    keys.add(entryKey(e.file, e.ruleId, e.jsonPath));
  }
  return keys;
}

/**
 * Split every file's issues into (new, suppressed) buckets using the given
 * baseline. `new` is what CI should fail on; `suppressed` is purely
 * informational (lets the report say "42 issues were already there"). The
 * original `FileReport` list is returned with only `new` issues retained.
 */
export function applyBaseline(
  reports: FileReport[],
  baseline: Set<string>
): { files: FileReport[]; suppressed: number } {
  let suppressed = 0;
  const out: FileReport[] = reports.map((r) => {
    const keep: Issue[] = [];
    for (const i of r.issues) {
      if (baseline.has(issueKey(r.file, i))) suppressed += 1;
      else keep.push(i);
    }
    return { ...r, issues: keep };
  });
  return { files: out, suppressed };
}
