import type { Rule } from "../types.js";
import { getServers, serversKey, makeIssue } from "./helpers.js";
import { KNOWN_SERVER_FIELDS } from "./constants.js";

export const unknownFieldRule: Rule = (ctx) => {
  const issues: ReturnType<Rule> = [];
  const servers = getServers(ctx.config);
  if (!servers) return issues;
  const root = serversKey(ctx.config);

  const rule = ctx.rules.unknownField;
  if (!rule.enabled || rule.severity === "off") return issues;

  for (const [name, serverRaw] of Object.entries(servers)) {
    if (typeof serverRaw !== "object" || serverRaw === null) continue;
    const server = serverRaw as Record<string, unknown>;
    for (const k of Object.keys(server)) {
      if (!KNOWN_SERVER_FIELDS.has(k)) {
        issues.push(makeIssue({
          ruleId: "unknown-field",
          severity: rule.severity,
          message: `Server "${name}" has unknown field "${k}". May be a client-specific extension or a typo.`,
          jsonPath: `${root}.${name}.${k}`,
          source: ctx.source,
        }));
      }
    }
  }
  return issues;
};
