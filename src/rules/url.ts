import type { Rule } from "../types.js";
import { getServers, serversKey, makeIssue } from "./helpers.js";

export const urlRules: Rule = (ctx) => {
  const issues: ReturnType<Rule> = [];
  const servers = getServers(ctx.config);
  if (!servers) return issues;
  const root = serversKey(ctx.config);

  for (const [name, serverRaw] of Object.entries(servers)) {
    if (typeof serverRaw !== "object" || serverRaw === null) continue;
    const server = serverRaw as Record<string, unknown>;
    if (!("url" in server)) continue;
    const serverPath = `${root}.${name}`;

    const url = server.url;
    const rule = ctx.rules.invalidUrl;
    if (!rule.enabled || rule.severity === "off") continue;

    if (typeof url !== "string") {
      issues.push(makeIssue({
        ruleId: "invalid-url",
        severity: rule.severity,
        message: `Server "${name}" has "url" that is not a string.`,
        jsonPath: `${serverPath}.url`,
        source: ctx.source,
      }));
      continue;
    }

    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        issues.push(makeIssue({
          ruleId: "invalid-url",
          severity: rule.severity,
          message: `Server "${name}" url protocol "${parsed.protocol}" is not supported. Use http or https.`,
          jsonPath: `${serverPath}.url`,
          source: ctx.source,
        }));
      }
      if (parsed.protocol === "http:" && !isLocalHost(parsed.hostname)) {
        issues.push(makeIssue({
          ruleId: "invalid-url",
          severity: rule.severity === "error" ? "warning" : rule.severity,
          message: `Server "${name}" uses plain http to "${parsed.hostname}". Remote MCP servers should use https in production.`,
          jsonPath: `${serverPath}.url`,
          source: ctx.source,
        }));
      }
    } catch {
      issues.push(makeIssue({
        ruleId: "invalid-url",
        severity: rule.severity,
        message: `Server "${name}" url "${url}" is not a valid URL.`,
        jsonPath: `${serverPath}.url`,
        source: ctx.source,
      }));
    }
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
