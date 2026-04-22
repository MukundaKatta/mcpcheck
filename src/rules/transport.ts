import type { Rule } from "../types.js";
import { VALID_TRANSPORTS } from "./constants.js";
import { getServers, serversKey, makeIssue } from "./helpers.js";

export const transportRules: Rule = (ctx) => {
  const issues: ReturnType<Rule> = [];
  const servers = getServers(ctx.config);
  if (!servers) return issues;
  const root = serversKey(ctx.config);

  for (const [name, serverRaw] of Object.entries(servers)) {
    if (typeof serverRaw !== "object" || serverRaw === null || Array.isArray(serverRaw)) continue;
    const server = serverRaw as Record<string, unknown>;
    const hasCommand = "command" in server;
    const hasUrl = "url" in server;
    const serverPath = `${root}.${name}`;

    if (!hasCommand && !hasUrl) {
      const rule = ctx.rules.missingTransport;
      if (rule.enabled && rule.severity !== "off") {
        issues.push(makeIssue({
          ruleId: "missing-transport",
          severity: rule.severity,
          message: `Server "${name}" has no transport. Set either "command" (stdio) or "url" (http/sse).`,
          jsonPath: serverPath,
          source: ctx.source,
        }));
      }
    }
    if (hasCommand && hasUrl) {
      const rule = ctx.rules.conflictingTransport;
      if (rule.enabled && rule.severity !== "off") {
        issues.push(makeIssue({
          ruleId: "conflicting-transport",
          severity: rule.severity,
          message: `Server "${name}" has both "command" and "url". Pick one transport.`,
          jsonPath: serverPath,
          source: ctx.source,
        }));
      }
    }

    if ("transport" in server) {
      const t = server.transport;
      if (typeof t !== "string" || !VALID_TRANSPORTS.includes(t as typeof VALID_TRANSPORTS[number])) {
        const rule = ctx.rules.invalidTransport;
        if (rule.enabled && rule.severity !== "off") {
          issues.push(makeIssue({
            ruleId: "invalid-transport",
            severity: rule.severity,
            message: `Server "${name}" has transport=${JSON.stringify(t)}. Must be one of ${VALID_TRANSPORTS.join(", ")}.`,
            jsonPath: `${serverPath}.transport`,
            source: ctx.source,
          }));
        }
      } else if (t !== "stdio" && hasCommand) {
        const rule = ctx.rules.conflictingTransport;
        if (rule.enabled && rule.severity !== "off") {
          issues.push(makeIssue({
            ruleId: "conflicting-transport",
            severity: rule.severity,
            message: `Server "${name}" declares transport=${JSON.stringify(t)} but also has a "command" (implies stdio).`,
            jsonPath: `${serverPath}.transport`,
            source: ctx.source,
          }));
        }
      }
    }
  }
  return issues;
};
