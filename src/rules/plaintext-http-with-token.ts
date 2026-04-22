import type { Rule } from "../types.js";
import { getServers, serversKey, makeIssue } from "./helpers.js";

/**
 * `plaintext-http-with-token` — the url is `http://<non-local>` AND the
 * server declares an `Authorization` (or similar credential-carrying)
 * header. That token rides over the wire in cleartext; any on-path
 * attacker captures it.
 *
 * `invalid-url` already warns about plain http to non-local hosts, and
 * `http-without-auth` complains about https + missing auth. This rule
 * closes the third quadrant: http + auth is always wrong.
 *
 * Default severity: error. The other rules warn; this one fires only on
 * the unambiguously-bad case.
 */

const CREDENTIAL_HEADERS = new Set([
  "authorization",
  "x-api-key",
  "x-auth-token",
  "cookie",
  "proxy-authorization",
]);

export const plaintextHttpWithTokenRule: Rule = (ctx) => {
  const issues: ReturnType<Rule> = [];
  const servers = getServers(ctx.config);
  if (!servers) return issues;
  const root = serversKey(ctx.config);

  const rule = ctx.rules.plaintextHttpWithToken;
  if (!rule.enabled || rule.severity === "off") return issues;

  for (const [name, serverRaw] of Object.entries(servers)) {
    if (typeof serverRaw !== "object" || serverRaw === null) continue;
    const server = serverRaw as Record<string, unknown>;
    const url = server.url;
    if (typeof url !== "string") continue;
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      continue;
    }
    if (parsed.protocol !== "http:") continue;
    if (isLocalHost(parsed.hostname)) continue;
    const headers = server.headers;
    if (typeof headers !== "object" || headers === null || Array.isArray(headers)) continue;
    const credentialHeader = Object.keys(headers as Record<string, unknown>).find((k) =>
      CREDENTIAL_HEADERS.has(k.toLowerCase())
    );
    if (!credentialHeader) continue;

    issues.push(makeIssue({
      ruleId: "plaintext-http-with-token",
      severity: rule.severity,
      message: `Server "${name}" sends a ${credentialHeader} header over plain http to ${parsed.hostname}. The token rides in cleartext; switch to https.`,
      jsonPath: `${root}.${name}.url`,
      source: ctx.source,
    }));
  }
  return issues;
};

function isLocalHost(host: string): boolean {
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local")
  );
}
