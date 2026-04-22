import type { RunReport } from "../types.js";

export function formatJson(report: RunReport): string {
  return JSON.stringify(report, null, 2);
}
