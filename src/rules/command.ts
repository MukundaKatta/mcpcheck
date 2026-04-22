import type { Rule } from "../types.js";
import { getServers, serversKey, makeIssue } from "./helpers.js";

export const commandRules: Rule = (ctx) => {
  const issues: ReturnType<Rule> = [];
  const servers = getServers(ctx.config);
  if (!servers) return issues;
  const root = serversKey(ctx.config);

  for (const [name, serverRaw] of Object.entries(servers)) {
    if (typeof serverRaw !== "object" || serverRaw === null) continue;
    const server = serverRaw as Record<string, unknown>;
    if (!("command" in server)) continue;
    const serverPath = `${root}.${name}`;

    const cmd = server.command;
    if (typeof cmd !== "string" || cmd.trim() === "") {
      const rule = ctx.rules.invalidCommand;
      if (rule.enabled && rule.severity !== "off") {
        issues.push(makeIssue({
          ruleId: "invalid-command",
          severity: rule.severity,
          message: `Server "${name}" has invalid "command" (must be a non-empty string).`,
          jsonPath: `${serverPath}.command`,
          source: ctx.source,
        }));
      }
    } else if (cmd.startsWith("./") || cmd.startsWith("../")) {
      const rule = ctx.rules.relativePath;
      if (rule.enabled && rule.severity !== "off") {
        issues.push(makeIssue({
          ruleId: "relative-path",
          severity: rule.severity,
          message: `Server "${name}" command "${cmd}" is a relative path. Clients resolve cwd inconsistently; use an absolute path or a binary on PATH.`,
          jsonPath: `${serverPath}.command`,
          source: ctx.source,
        }));
      }
    }

    if ("args" in server) {
      const a = server.args;
      if (!Array.isArray(a)) {
        const rule = ctx.rules.invalidArgs;
        if (rule.enabled && rule.severity !== "off") {
          issues.push(makeIssue({
            ruleId: "invalid-args",
            severity: rule.severity,
            message: `Server "${name}" has "args" that is not an array.`,
            jsonPath: `${serverPath}.args`,
            source: ctx.source,
          }));
        }
      } else {
        a.forEach((arg: unknown, i: number) => {
          if (typeof arg !== "string") {
            const rule = ctx.rules.invalidArgs;
            if (rule.enabled && rule.severity !== "off") {
              issues.push(makeIssue({
                ruleId: "invalid-args",
                severity: rule.severity,
                message: `Server "${name}" args[${i}] must be a string, got ${typeof arg}.`,
                jsonPath: `${serverPath}.args.${i}`,
                source: ctx.source,
              }));
            }
          }
        });
      }
    }
  }
  return issues;
};
