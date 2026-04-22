import type { Rule } from "../types.js";
import { getServers, serversKey, makeIssue } from "./helpers.js";
import { ENV_INTERPOLATION } from "./constants.js";

/**
 * `url-embedded-credentials` — `url: "https://user:password@host/…"`.
 *
 * Embedded credentials in URLs (RFC 3986 userinfo) end up in browser
 * history, log lines, and proxy access logs basically everywhere they
 * go. When the password is a real secret this rule fires error-level;
 * when it's an `${VAR}` substitution we skip it (that's a
 * lesser-evil "I need auth in the URL" pattern).
 *
 * Default severity: error. The credential isn't just cleartext-on-
 * wire like `plaintext-http-with-token` — it's cleartext-in-log-files.
 */

export const urlEmbeddedCredsRule: Rule = (ctx) => {
  const issues: ReturnType<Rule> = [];
  const servers = getServers(ctx.config);
  if (!servers) return issues;
  const root = serversKey(ctx.config);

  const rule = ctx.rules.urlEmbeddedCredentials;
  if (!rule.enabled || rule.severity === "off") return issues;

  for (const [name, serverRaw] of Object.entries(servers)) {
    if (typeof serverRaw !== "object" || serverRaw === null) continue;
    const url = (serverRaw as Record<string, unknown>).url;
    if (typeof url !== "string") continue;
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      continue;
    }
    // userinfo present iff username is non-empty.
    if (!parsed.username) continue;
    // Env substitution is a weaker concern; skip it here.
    if (ENV_INTERPOLATION.test(parsed.password) || ENV_INTERPOLATION.test(parsed.username)) continue;

    issues.push(makeIssue({
      ruleId: "url-embedded-credentials",
      severity: rule.severity,
      message: `Server "${name}" URL embeds credentials (user:password@host). The credential will leak into browser history, proxy logs, and error traces. Use the Authorization header + env substitution instead.`,
      jsonPath: `${root}.${name}.url`,
      source: ctx.source,
    }));
  }
  return issues;
};
