/**
 * `mcpcheck list-servers <file...>` — one-line-per-server inventory across
 * all input files. Complements `stats` (which rolls up counts) and
 * `graph` (which renders a diagram): `list-servers` is for "what's the
 * full list of servers someone running these configs has configured?".
 *
 * Output columns: file, name, transport, target (npx pkg / docker image /
 * url hostname), pinned-ness, disabled.
 */

import { readFile } from "node:fs/promises";
import { parseJsonc } from "./jsonc.js";

export interface ServerRow {
  file: string;
  name: string;
  transport: "stdio" | "url" | "unknown";
  target: string;
  pinned: boolean | null;
  disabled: boolean;
}

export async function listServersFromFile(path: string): Promise<ServerRow[]> {
  const source = await readFile(path, "utf8");
  return listServersFromSource(source, path);
}

export function listServersFromSource(source: string, file: string): ServerRow[] {
  let parsed: unknown;
  try {
    parsed = parseJsonc(source);
  } catch {
    return [];
  }
  const servers = getServers(parsed);
  if (!servers) return [];
  const rows: ServerRow[] = [];
  for (const [name, raw] of Object.entries(servers)) {
    if (typeof raw !== "object" || raw === null) continue;
    const s = raw as Record<string, unknown>;
    const cmd = typeof s.command === "string" ? s.command : "";
    const url = typeof s.url === "string" ? s.url : "";
    const args = Array.isArray(s.args)
      ? (s.args.filter((a) => typeof a === "string") as string[])
      : [];
    if (cmd) {
      rows.push({
        file,
        name,
        transport: "stdio",
        target: describeStdio(cmd, args),
        pinned: isPinned(cmd, args),
        disabled: s.disabled === true,
      });
    } else if (url) {
      rows.push({
        file,
        name,
        transport: "url",
        target: describeUrl(url),
        pinned: null,
        disabled: s.disabled === true,
      });
    } else {
      rows.push({
        file,
        name,
        transport: "unknown",
        target: "(no transport)",
        pinned: null,
        disabled: s.disabled === true,
      });
    }
  }
  return rows;
}

export function formatServerRowsText(rows: ServerRow[]): string {
  if (rows.length === 0) return "No servers found.\n";
  const cols = ["file", "name", "transport", "target", "pinned", "disabled"];
  const widths = cols.map((c) => c.length);
  const plain = rows.map((r) => [
    r.file,
    r.name,
    r.transport,
    r.target,
    r.pinned === null ? "—" : r.pinned ? "yes" : "no",
    r.disabled ? "yes" : "",
  ]);
  for (const row of plain) {
    for (let i = 0; i < cols.length; i += 1) {
      widths[i] = Math.max(widths[i]!, row[i]!.length);
    }
  }
  const lines: string[] = [];
  lines.push(cols.map((c, i) => c.toUpperCase().padEnd(widths[i]!)).join("  "));
  lines.push(widths.map((w) => "-".repeat(w)).join("  "));
  for (const row of plain) {
    lines.push(row.map((cell, i) => cell.padEnd(widths[i]!)).join("  "));
  }
  return lines.join("\n") + "\n";
}

function getServers(config: unknown): Record<string, unknown> | undefined {
  if (typeof config !== "object" || config === null) return undefined;
  const c = config as Record<string, unknown>;
  for (const k of ["mcpServers", "servers", "context_servers"] as const) {
    const v = c[k];
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  }
  return undefined;
}

function describeStdio(cmd: string, args: string[]): string {
  const base = cmd.split(/[/\\]/).pop()!;
  const first = args.find((a) => !a.startsWith("-"));
  return first ? `${base} ${first}` : base;
}

function describeUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.protocol + "//" + u.hostname + (u.pathname === "/" ? "" : u.pathname);
  } catch {
    return url;
  }
}

function isPinned(cmd: string, args: string[]): boolean | null {
  const base = cmd.split(/[/\\]/).pop()!;
  if (base === "npx") {
    const pkg = args.find((a) => !a.startsWith("-"));
    if (!pkg) return null;
    if (pkg.startsWith("@")) {
      const slash = pkg.indexOf("/");
      return slash > 0 && pkg.slice(slash).includes("@");
    }
    return pkg.includes("@");
  }
  if (base === "uvx") {
    const pkg = args.find((a) => !a.startsWith("-"));
    return pkg ? pkg.includes("==") || pkg.includes("@") : null;
  }
  if (base === "docker") {
    const image = args.find((a) => /^[a-z0-9][\w./-]*(:[a-z0-9][\w.-]*)?$/i.test(a));
    if (!image) return null;
    if (image.endsWith(":latest")) return false;
    return image.includes(":");
  }
  return null;
}
