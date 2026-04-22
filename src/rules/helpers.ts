import type { Issue } from "../types.js";
import { locate } from "../locate.js";

export interface IssueArgs {
  ruleId: string;
  severity: Issue["severity"];
  message: string;
  jsonPath: string;
  source: string;
  fix?: Issue["fix"];
}

export function makeIssue({ ruleId, severity, message, jsonPath, source, fix }: IssueArgs): Issue {
  const loc = locate(source, jsonPath);
  return {
    ruleId,
    severity,
    message,
    jsonPath,
    ...(loc ? { line: loc.line } : {}),
    ...(fix ? { fix } : {}),
  };
}

export function getServers(config: unknown): Record<string, unknown> | undefined {
  if (typeof config !== "object" || config === null) return undefined;
  const c = config as Record<string, unknown>;
  const servers = c.mcpServers ?? c.servers;
  if (!servers || typeof servers !== "object" || Array.isArray(servers)) return undefined;
  return servers as Record<string, unknown>;
}

export function serversKey(config: unknown): "mcpServers" | "servers" {
  if (config && typeof config === "object" && "mcpServers" in (config as object)) {
    return "mcpServers";
  }
  return "servers";
}
