/**
 * `mcpcheck doctor` — per-client health summary.
 *
 * For each known client (Claude Desktop, Claude Code, Cursor, Cline, Windsurf,
 * Zed), we resolve its configured paths, check which ones exist, run
 * `checkSource` on the ones that do, and render a one-line-per-client summary:
 *
 *   Claude Desktop  ~/Library/.../claude_desktop_config.json     ✓ 3 servers, 0 issues
 *   Claude Code     ~/.claude.json                                ✓ 1 server, 1 warning
 *   Cursor          ~/.cursor/mcp.json                            —  (not installed)
 *   Windsurf        ~/.codeium/windsurf/mcp_config.json          ✗ 1 error, 0 warnings
 *   Zed             ~/.config/zed/settings.json                   —  (not installed)
 *
 * Think `brew doctor` for your MCP setup — one command, one screen, one
 * definitive answer to "is everything ok?".
 */

import { readFile, access } from "node:fs/promises";
import { homedir } from "node:os";
import { checkSource } from "./core.js";
import { statsFromSource } from "./stats.js";
import type { Issue } from "./types.js";

type ClientName =
  | "Claude Desktop"
  | "Claude Code"
  | "Cursor"
  | "Cline"
  | "Windsurf"
  | "Zed";

/** Per-client candidate paths, in priority order. First hit wins. */
const CLIENT_PATHS: Array<{ name: ClientName; paths: string[] }> = [
  {
    name: "Claude Desktop",
    paths: [
      "~/Library/Application Support/Claude/claude_desktop_config.json",
      "~/.config/Claude/claude_desktop_config.json",
      "~/AppData/Roaming/Claude/claude_desktop_config.json",
    ],
  },
  {
    name: "Claude Code",
    paths: ["~/.claude.json"],
  },
  {
    name: "Cursor",
    paths: ["~/.cursor/mcp.json"],
  },
  {
    name: "Cline",
    paths: [
      "~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json",
      "~/.config/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json",
    ],
  },
  {
    name: "Windsurf",
    paths: ["~/.codeium/windsurf/mcp_config.json"],
  },
  {
    name: "Zed",
    paths: ["~/.config/zed/settings.json"],
  },
];

export interface ClientStatus {
  client: ClientName;
  path?: string;
  installed: boolean;
  servers?: number;
  errors?: number;
  warnings?: number;
  fatalError?: string;
  issues?: Issue[];
}

export async function runDoctor(): Promise<ClientStatus[]> {
  const out: ClientStatus[] = [];
  for (const entry of CLIENT_PATHS) {
    const hit = await firstExisting(entry.paths.map(expandTilde));
    if (!hit) {
      out.push({ client: entry.name, installed: false });
      continue;
    }
    try {
      const source = await readFile(hit, "utf8");
      const report = checkSource(source, hit);
      const stats = statsFromSource(source, hit);
      out.push({
        client: entry.name,
        path: hit,
        installed: true,
        servers: stats.totalServers,
        errors: report.issues.filter((i) => i.severity === "error").length,
        warnings: report.issues.filter((i) => i.severity === "warning").length,
        issues: report.issues,
      });
    } catch (err) {
      out.push({
        client: entry.name,
        path: hit,
        installed: true,
        fatalError: (err as Error).message,
      });
    }
  }
  return out;
}

async function firstExisting(paths: string[]): Promise<string | undefined> {
  for (const p of paths) {
    try {
      await access(p);
      return p;
    } catch {
      // next
    }
  }
  return undefined;
}

function expandTilde(p: string): string {
  if (p === "~") return homedir();
  if (p.startsWith("~/") || p.startsWith("~\\")) return homedir() + p.slice(1);
  return p;
}

export function formatDoctorText(statuses: ClientStatus[]): string {
  // Compute column widths so the output stays aligned no matter the paths.
  const widthName = Math.max(...statuses.map((s) => s.client.length));
  const widthPath = Math.max(
    ...statuses.map((s) => (s.path ?? "(not installed)").length),
    5
  );

  const lines: string[] = [];
  let okCount = 0;
  let problemCount = 0;
  for (const s of statuses) {
    const name = s.client.padEnd(widthName);
    const path = (s.path ?? "(not installed)").padEnd(widthPath);
    let marker: string;
    let detail: string;
    if (!s.installed) {
      marker = "—";
      detail = "(not installed)";
    } else if (s.fatalError) {
      marker = "✗";
      detail = `fatal: ${s.fatalError}`;
      problemCount += 1;
    } else if ((s.errors ?? 0) > 0) {
      marker = "✗";
      detail = `${s.servers} server(s), ${s.errors} error(s), ${s.warnings} warning(s)`;
      problemCount += 1;
    } else if ((s.warnings ?? 0) > 0) {
      marker = "!";
      detail = `${s.servers} server(s), ${s.warnings} warning(s)`;
      okCount += 1;
    } else {
      marker = "✓";
      detail = `${s.servers} server(s), 0 issues`;
      okCount += 1;
    }
    lines.push(`${marker}  ${name}  ${path}  ${detail}`);
  }
  lines.push("");
  lines.push(
    problemCount === 0
      ? `All installed clients look OK. (${okCount} checked)`
      : `${problemCount} client(s) have errors. Run \`mcpcheck\` or \`mcpcheck --client <name>\` for details.`
  );
  return lines.join("\n");
}

/** Exit code: 0 if nothing is error-level, 1 otherwise. */
export function doctorExitCode(statuses: ClientStatus[]): number {
  for (const s of statuses) {
    if (s.fatalError || (s.errors ?? 0) > 0) return 1;
  }
  return 0;
}
