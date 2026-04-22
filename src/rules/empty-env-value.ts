import type { Rule } from "../types.js";
import { getServers, serversKey, makeIssue } from "./helpers.js";

/**
 * `empty-env-value` — `"API_KEY": ""`. An empty string is different from
 * an absent key: the variable ends up *present* in the subprocess's
 * environment with value `""`. Libraries that check `if (ENV_VAR)`
 * correctly treat it as unset; libraries that check
 * `if (typeof process.env.ENV_VAR === 'string')` or `if (ENV_VAR !==
 * undefined)` see it as set and proceed. The resulting "sometimes auth,
 * sometimes not" bugs are annoying to track down.
 *
 * Default severity: warning. Some configs intentionally use empty string
 * as a sentinel (rare); we don't want to error by default.
 */

export const emptyEnvValueRule: Rule = (ctx) => {
  const issues: ReturnType<Rule> = [];
  const servers = getServers(ctx.config);
  if (!servers) return issues;
  const root = serversKey(ctx.config);

  const rule = ctx.rules.emptyEnvValue;
  if (!rule.enabled || rule.severity === "off") return issues;

  for (const [name, serverRaw] of Object.entries(servers)) {
    if (typeof serverRaw !== "object" || serverRaw === null) continue;
    const env = (serverRaw as Record<string, unknown>).env;
    if (typeof env !== "object" || env === null || Array.isArray(env)) continue;
    for (const [key, value] of Object.entries(env as Record<string, unknown>)) {
      if (value !== "") continue;
      issues.push(makeIssue({
        ruleId: "empty-env-value",
        severity: rule.severity,
        message: `Server "${name}" env.${key} is an empty string. Set it or remove the key — an empty string is passed through to the subprocess and causes "sometimes auth, sometimes not" bugs.`,
        jsonPath: `${root}.${name}.env.${key}`,
        source: ctx.source,
      }));
    }
  }
  return issues;
};
