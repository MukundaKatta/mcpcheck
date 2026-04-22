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

/**
 * Known top-level keys that MCP clients use to hold the server map. Ordered by
 * preference when more than one is present (rare, but we pick the first).
 *
 * - `mcpServers`:     Claude Desktop, Cursor, Cline, Claude Code
 * - `servers`:        VS Code MCP and some plain `.mcp.json` layouts
 * - `context_servers`: Zed (lives inside the main settings.json)
 */
export const SERVER_KEYS = ["mcpServers", "servers", "context_servers"] as const;
export type ServersKey = (typeof SERVER_KEYS)[number];

export function getServers(config: unknown): Record<string, unknown> | undefined {
  if (typeof config !== "object" || config === null) return undefined;
  const c = config as Record<string, unknown>;
  for (const key of SERVER_KEYS) {
    const servers = c[key];
    if (servers && typeof servers === "object" && !Array.isArray(servers)) {
      return servers as Record<string, unknown>;
    }
  }
  return undefined;
}

export function serversKey(config: unknown): ServersKey {
  if (config && typeof config === "object") {
    const c = config as Record<string, unknown>;
    for (const key of SERVER_KEYS) {
      if (key in c) return key;
    }
  }
  return "mcpServers";
}
