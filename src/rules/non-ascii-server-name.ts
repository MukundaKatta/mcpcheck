import type { Rule } from "../types.js";
import { getServers, serversKey, makeIssue } from "./helpers.js";

/**
 * `non-ascii-server-name` — server map key contains non-ASCII codepoints.
 * MCP clients resolve server names in lots of places (logs, argv,
 * `--server <name>`, URLs). Non-ASCII names work in most paths but break
 * subtly in others (some shells mangle them, some tools URL-encode them
 * wrong). Usually an unintended paste of a smart quote or nbsp.
 *
 * Default severity: info. Not broken, just risky; we want to surface it
 * without failing CI.
 */

const ASCII_RE = /^[\x20-\x7E]+$/;

export const nonAsciiServerNameRule: Rule = (ctx) => {
  const issues: ReturnType<Rule> = [];
  const servers = getServers(ctx.config);
  if (!servers) return issues;
  const root = serversKey(ctx.config);

  const rule = ctx.rules.nonAsciiServerName;
  if (!rule.enabled || rule.severity === "off") return issues;

  for (const name of Object.keys(servers)) {
    if (ASCII_RE.test(name)) continue;
    issues.push(makeIssue({
      ruleId: "non-ascii-server-name",
      severity: rule.severity,
      message: `Server name "${name}" contains non-ASCII characters. Some MCP clients encode names into URLs / logs / argv inconsistently; prefer ASCII.`,
      jsonPath: `${root}.${name}`,
      source: ctx.source,
    }));
  }
  return issues;
};
