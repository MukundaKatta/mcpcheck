import type { Rule } from "../types.js";
import { getServers, serversKey, makeIssue } from "./helpers.js";
import { SECRET_PATTERNS, ENV_INTERPOLATION } from "./constants.js";

/**
 * `secret-in-args` — a string in `args` matches a known secret pattern.
 *
 * This is the "I passed it on the command line" cousin of
 * `hardcoded-secret`. People copy example invocations like
 * `mcp-server-foo --token sk-abc123...` and drop them into `args` without
 * realising the token is now persistently committed in the config file.
 * The `hardcoded-secret` rule only looks inside `env`, so these get
 * missed.
 *
 * We skip strings that are env-var substitutions already (`${TOKEN}`).
 *
 * Default severity: error. Same risk profile as `hardcoded-secret`.
 */

export const secretInArgsRule: Rule = (ctx) => {
  const issues: ReturnType<Rule> = [];
  const servers = getServers(ctx.config);
  if (!servers) return issues;
  const root = serversKey(ctx.config);

  const rule = ctx.rules.secretInArgs;
  if (!rule.enabled || rule.severity === "off") return issues;

  for (const [name, serverRaw] of Object.entries(servers)) {
    if (typeof serverRaw !== "object" || serverRaw === null) continue;
    const server = serverRaw as Record<string, unknown>;
    const args = server.args;
    if (!Array.isArray(args)) continue;

    args.forEach((arg, idx) => {
      if (typeof arg !== "string") return;
      const trimmed = arg.trim();
      if (!trimmed) return;
      if (ENV_INTERPOLATION.test(trimmed)) return;

      for (const pattern of SECRET_PATTERNS) {
        if (!pattern.re.test(trimmed)) continue;
        // Skip keyHint-scoped patterns here since args don't have a "name"
        // context to match against; those patterns exist specifically to
        // avoid false-positives on raw hex, so we'd fire too broadly.
        if (pattern.keyHint) continue;
        issues.push(makeIssue({
          ruleId: "secret-in-args",
          severity: rule.severity,
          message: `Server "${name}" args[${idx}] looks like a hardcoded ${pattern.name}. Pass it via env + \${VAR} substitution instead.`,
          jsonPath: `${root}.${name}.args.${idx}`,
          source: ctx.source,
        }));
        return;
      }
    });
  }
  return issues;
};
