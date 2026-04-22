import type { Rule } from "../types.js";
import { serversKey, makeIssue } from "./helpers.js";

/**
 * Top-level structural checks: "mcpServers" exists, it is an object, has
 * entries, and duplicate names (case-insensitive) are flagged.
 */
export const structureRules: Rule = (ctx) => {
  const issues: ReturnType<Rule> = [];
  if (typeof ctx.config !== "object" || ctx.config === null) return issues;

  const c = ctx.config as Record<string, unknown>;
  const raw = c.mcpServers ?? c.servers;
  const key = serversKey(ctx.config);

  if (raw === undefined) {
    const rule = ctx.rules.emptyServers;
    if (rule.enabled && rule.severity !== "off") {
      issues.push(makeIssue({
        ruleId: "empty-servers",
        severity: rule.severity,
        message: `Config has no "mcpServers" or "servers" key. Did you mean to add an MCP server?`,
        jsonPath: "",
        source: ctx.source,
      }));
    }
    return issues;
  }

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    const rule = ctx.rules.emptyServers;
    if (rule.enabled && rule.severity !== "off") {
      issues.push(makeIssue({
        ruleId: "empty-servers",
        severity: "error",
        message: `"${key}" must be an object keyed by server name.`,
        jsonPath: key,
        source: ctx.source,
      }));
    }
    return issues;
  }

  const servers = raw as Record<string, unknown>;
  if (Object.keys(servers).length === 0) {
    const rule = ctx.rules.emptyServers;
    if (rule.enabled && rule.severity !== "off") {
      issues.push(makeIssue({
        ruleId: "empty-servers",
        severity: rule.severity,
        message: `"${key}" is empty. Remove the key or add at least one server.`,
        jsonPath: key,
        source: ctx.source,
      }));
    }
  }

  // Case-insensitive duplicate names
  const seen = new Map<string, string>();
  for (const name of Object.keys(servers)) {
    const lower = name.toLowerCase();
    const prev = seen.get(lower);
    if (prev && prev !== name) {
      const rule = ctx.rules.duplicateServerName;
      if (rule.enabled && rule.severity !== "off") {
        issues.push(makeIssue({
          ruleId: "duplicate-server-name",
          severity: rule.severity,
          message: `Server name "${name}" collides with "${prev}" (case-insensitive). Clients may resolve inconsistently.`,
          jsonPath: `${key}.${name}`,
          source: ctx.source,
        }));
      }
    }
    seen.set(lower, name);
  }

  return issues;
};
