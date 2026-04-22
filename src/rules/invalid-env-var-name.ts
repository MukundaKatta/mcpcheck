import type { Rule } from "../types.js";
import { getServers, serversKey, makeIssue } from "./helpers.js";

/**
 * `invalid-env-var-name` — env variable name that's not portable POSIX.
 * POSIX environment variable names must match `[A-Z_][A-Z0-9_]*`. Mixed
 * case, leading digit, or hyphens all produce variables some shells /
 * clients silently drop. This is a common source of "it works on my
 * machine" bugs.
 *
 * Default severity: warning. Many toolchains (Node, Python, Docker)
 * accept lowercase or hyphenated env vars; some shells and libc `env(3)`
 * don't. The rule surfaces the risk without failing every "GitHubToken".
 */

const PORTABLE_ENV_NAME = /^[A-Z_][A-Z0-9_]*$/;

export const invalidEnvVarNameRule: Rule = (ctx) => {
  const issues: ReturnType<Rule> = [];
  const servers = getServers(ctx.config);
  if (!servers) return issues;
  const root = serversKey(ctx.config);

  const rule = ctx.rules.invalidEnvVarName;
  if (!rule.enabled || rule.severity === "off") return issues;

  for (const [name, serverRaw] of Object.entries(servers)) {
    if (typeof serverRaw !== "object" || serverRaw === null) continue;
    const env = (serverRaw as Record<string, unknown>).env;
    if (typeof env !== "object" || env === null || Array.isArray(env)) continue;
    for (const key of Object.keys(env as Record<string, unknown>)) {
      if (PORTABLE_ENV_NAME.test(key)) continue;
      issues.push(makeIssue({
        ruleId: "invalid-env-var-name",
        severity: rule.severity,
        message: `Server "${name}" env var "${key}" isn't a POSIX-portable name (must match \`[A-Z_][A-Z0-9_]*\`). Some shells silently drop it.`,
        jsonPath: `${root}.${name}.env.${key}`,
        source: ctx.source,
      }));
    }
  }
  return issues;
};
