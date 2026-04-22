/**
 * Apply autofixes for rules that provide byte-offset replacements.
 *
 * Fixes are applied from the end of the source to the start so earlier
 * offsets remain valid. Overlapping fixes are resolved first-wins.
 */

import type { Issue } from "./types.js";

export interface ApplyResult {
  output: string;
  applied: Issue[];
  skipped: Issue[];
}

export function applyFixes(source: string, issues: Issue[]): ApplyResult {
  const fixable = issues.filter(hasFix).sort((a, b) => b.fix.start - a.fix.start);
  const taken: Array<[number, number]> = [];
  const applied: Issue[] = [];
  const skipped: Issue[] = [];
  let output = source;

  for (const issue of fixable) {
    const { start, end, replacement } = issue.fix;
    if (overlaps(taken, start, end)) {
      skipped.push(issue);
      continue;
    }
    output = output.slice(0, start) + replacement + output.slice(end);
    taken.push([start, end]);
    applied.push(issue);
  }
  return { output, applied, skipped };
}

function hasFix(issue: Issue): issue is Issue & { fix: NonNullable<Issue["fix"]> } {
  return !!issue.fix;
}

function overlaps(taken: Array<[number, number]>, start: number, end: number): boolean {
  for (const [s, e] of taken) {
    if (start < e && end > s) return true;
  }
  return false;
}
