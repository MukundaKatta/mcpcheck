import type { Rule } from "../types.js";
import { getServers, serversKey, makeIssue } from "./helpers.js";

/**
 * `cwd-not-absolute` — the `cwd` field is a relative path. Same failure
 * mode as `relative-path` for `command`: different MCP clients resolve
 * the starting directory differently. A relative `cwd` that works in one
 * client breaks in another.
 *
 * Default severity: warning. Legitimate in rare cases (running from a
 * consistent repo root), but almost always a cross-client footgun.
 */

export const cwdNotAbsoluteRule: Rule = (ctx) => {
  const issues: ReturnType<Rule> = [];
  const servers = getServers(ctx.config);
  if (!servers) return issues;
  const root = serversKey(ctx.config);

  const rule = ctx.rules.cwdNotAbsolute;
  if (!rule.enabled || rule.severity === "off") return issues;

  for (const [name, serverRaw] of Object.entries(servers)) {
    if (typeof serverRaw !== "object" || serverRaw === null) continue;
    const cwd = (serverRaw as Record<string, unknown>).cwd;
    if (typeof cwd !== "string" || cwd === "") continue;
    if (isAbsolute(cwd)) continue;
    // `~` home-expansion is handled by some clients; still not portable.
    issues.push(makeIssue({
      ruleId: "cwd-not-absolute",
      severity: rule.severity,
      message: `Server "${name}" cwd "${cwd}" is not an absolute path. Clients resolve relative cwd inconsistently; use an absolute path.`,
      jsonPath: `${root}.${name}.cwd`,
      source: ctx.source,
    }));
  }
  return issues;
};

function isAbsolute(p: string): boolean {
  if (p.startsWith("/")) return true;
  // Windows drive-letter absolute paths.
  if (/^[A-Za-z]:[/\\]/.test(p)) return true;
  // UNC paths.
  if (p.startsWith("\\\\")) return true;
  return false;
}
