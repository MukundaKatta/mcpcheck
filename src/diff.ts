/**
 * `mcpcheck diff <a.json> <b.json>` — what issues changed between two
 * configs? Useful for PR review: "what did this commit add to the MCP
 * config's lint output?"
 *
 * Issues are identified by (ruleId, jsonPath, message). Two identical issues
 * in the same path on both sides produce no diff; anything else shows up as
 * either "added" (present only in B) or "removed" (present only in A).
 */

import { readFile } from "node:fs/promises";
import { checkSource } from "./core.js";
import type { Issue } from "./types.js";

export interface IssueDiff {
  added: Issue[];
  removed: Issue[];
  unchanged: number;
}

export function diffReports(before: Issue[], after: Issue[]): IssueDiff {
  const key = (i: Issue) => `${i.ruleId}\t${i.jsonPath}\t${i.message}`;
  const beforeKeys = new Map<string, Issue>();
  for (const i of before) beforeKeys.set(key(i), i);
  const afterKeys = new Map<string, Issue>();
  for (const i of after) afterKeys.set(key(i), i);

  const added: Issue[] = [];
  const removed: Issue[] = [];
  let unchanged = 0;
  for (const [k, i] of afterKeys) {
    if (beforeKeys.has(k)) unchanged += 1;
    else added.push(i);
  }
  for (const [k, i] of beforeKeys) {
    if (!afterKeys.has(k)) removed.push(i);
  }
  return { added, removed, unchanged };
}

export async function diffFiles(a: string, b: string): Promise<IssueDiff> {
  const [as, bs] = await Promise.all([
    readFile(a, "utf8"),
    readFile(b, "utf8"),
  ]);
  const ar = checkSource(as, a);
  const br = checkSource(bs, b);
  return diffReports(ar.issues, br.issues);
}
