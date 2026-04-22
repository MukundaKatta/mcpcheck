/**
 * `mcpcheck scan-env` — audit the current process's environment for values
 * that match mcpcheck's secret-detection patterns.
 *
 * Aimed at: "I think I `export`ed something I shouldn't have" — run it in
 * a shell, get a list of which env vars are carrying things that look
 * like credentials, decide what to do about it.
 *
 * The same SECRET_PATTERNS drive the `hardcoded-secret` rule; this is the
 * ambient-environment variant of that check.
 *
 * Outputs the matching env-var names only, never the values. That's
 * deliberate — the whole point is you can run this in a shared terminal
 * or paste the output into an issue without leaking what it found.
 */

import { SECRET_PATTERNS, ENV_INTERPOLATION } from "./rules/constants.js";

export interface EnvScanHit {
  name: string;
  provider: string;
}

export function scanEnv(env: NodeJS.ProcessEnv = process.env): EnvScanHit[] {
  const hits: EnvScanHit[] = [];
  for (const [name, raw] of Object.entries(env)) {
    if (typeof raw !== "string") continue;
    const value = raw.trim();
    if (!value) continue;
    if (ENV_INTERPOLATION.test(value)) continue;
    for (const { name: provider, re, keyHint } of SECRET_PATTERNS) {
      if (!re.test(value)) continue;
      if (keyHint && !keyHint.test(name)) continue;
      hits.push({ name, provider });
      break;
    }
  }
  hits.sort((a, b) => a.name.localeCompare(b.name));
  return hits;
}

export function formatEnvScanText(hits: EnvScanHit[]): string {
  if (hits.length === 0) {
    return "No known secret patterns found in the current environment.\n";
  }
  const widest = Math.max(...hits.map((h) => h.name.length), 4);
  const lines: string[] = [];
  lines.push(`${"NAME".padEnd(widest)}  PROVIDER`);
  lines.push(`${"-".repeat(widest)}  --------`);
  for (const h of hits) lines.push(`${h.name.padEnd(widest)}  ${h.provider}`);
  lines.push("");
  lines.push(`${hits.length} env var(s) look like secrets. (Values not printed.)`);
  return lines.join("\n") + "\n";
}
