/**
 * `mcpcheck stats` — one-screen summary of what's in an MCP config, without
 * lint findings. Answers the "what's in this file?" question: total servers,
 * stdio vs remote breakdown, how many are pinned, how many reference which
 * transport. Useful for auditing a shared config at a glance.
 */

import { readFile } from "node:fs/promises";
import { parseJsonc } from "./jsonc.js";

export interface ConfigStats {
  file: string;
  totalServers: number;
  byTransport: { stdio: number; url: number; unknown: number };
  byPackageRunner: { npx: number; uvx: number; docker: number; other: number };
  pinnedPackages: number;
  unpinnedPackages: number;
  serversWithEnv: number;
  disabledServers: number;
}

export async function statsFromFile(path: string): Promise<ConfigStats> {
  const source = await readFile(path, "utf8");
  return statsFromSource(source, path);
}

export function statsFromSource(source: string, file: string): ConfigStats {
  const stats: ConfigStats = {
    file,
    totalServers: 0,
    byTransport: { stdio: 0, url: 0, unknown: 0 },
    byPackageRunner: { npx: 0, uvx: 0, docker: 0, other: 0 },
    pinnedPackages: 0,
    unpinnedPackages: 0,
    serversWithEnv: 0,
    disabledServers: 0,
  };
  let parsed: unknown;
  try {
    parsed = parseJsonc(source);
  } catch {
    return stats;
  }
  const servers = getServers(parsed);
  if (!servers) return stats;

  for (const serverRaw of Object.values(servers)) {
    if (typeof serverRaw !== "object" || serverRaw === null) continue;
    const server = serverRaw as Record<string, unknown>;
    stats.totalServers += 1;

    if (server.disabled === true) stats.disabledServers += 1;

    const command = typeof server.command === "string" ? server.command : "";
    const url = typeof server.url === "string" ? server.url : "";
    if (command) stats.byTransport.stdio += 1;
    else if (url) stats.byTransport.url += 1;
    else stats.byTransport.unknown += 1;

    if (command) {
      const base = basename(command);
      if (base === "npx") stats.byPackageRunner.npx += 1;
      else if (base === "uvx") stats.byPackageRunner.uvx += 1;
      else if (base === "docker") stats.byPackageRunner.docker += 1;
      else stats.byPackageRunner.other += 1;

      const args = Array.isArray(server.args)
        ? (server.args.filter((a) => typeof a === "string") as string[])
        : [];
      const pinned = isPinned(base, args);
      if (pinned === true) stats.pinnedPackages += 1;
      else if (pinned === false) stats.unpinnedPackages += 1;
    }

    const env = server.env;
    if (env && typeof env === "object" && !Array.isArray(env)) {
      if (Object.keys(env).length > 0) stats.serversWithEnv += 1;
    }
  }
  return stats;
}

function getServers(config: unknown): Record<string, unknown> | undefined {
  if (typeof config !== "object" || config === null) return undefined;
  const c = config as Record<string, unknown>;
  for (const key of ["mcpServers", "servers", "context_servers"] as const) {
    const v = c[key];
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  }
  return undefined;
}

function basename(p: string): string {
  const i = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return i >= 0 ? p.slice(i + 1) : p;
}

/**
 * @returns true  — command runs a pinned package/image
 *          false — command runs an unpinned package/image
 *          null  — command is neither a package runner nor a docker invocation
 */
function isPinned(base: string, args: string[]): boolean | null {
  if (base === "npx") {
    const pkg = args.find((a) => !a.startsWith("-"));
    if (!pkg) return null;
    return /@[\d]/.test(pkg);
  }
  if (base === "uvx") {
    const pkg = args.find((a) => !a.startsWith("-"));
    if (!pkg) return null;
    return pkg.includes("==") || pkg.includes("@");
  }
  if (base === "docker") {
    const image = findDockerImage(args);
    if (!image) return null;
    if (image.endsWith(":latest")) return false;
    return image.includes(":");
  }
  return null;
}

const DOCKER_SUBCOMMANDS = new Set([
  "run", "exec", "pull", "start", "create", "compose",
]);
const DOCKER_VALUE_FLAGS = new Set([
  "-e", "--env", "-v", "--volume", "-p", "--publish",
  "-w", "--workdir", "-u", "--user", "--name", "--mount",
  "--network", "--platform", "--entrypoint", "--label",
  "--add-host", "--env-file",
]);

function findDockerImage(args: string[]): string | undefined {
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i]!;
    if (DOCKER_SUBCOMMANDS.has(a)) continue;
    if (a.startsWith("-")) {
      if (a.includes("=")) continue;
      if (DOCKER_VALUE_FLAGS.has(a)) i += 1;
      continue;
    }
    if (/^[a-z0-9][\w./-]*(:[a-z0-9][\w.-]*)?$/i.test(a)) return a;
    return undefined;
  }
  return undefined;
}

export function formatStatsText(stats: ConfigStats[]): string {
  const rollup: ConfigStats = {
    file: `(${stats.length} file(s))`,
    totalServers: 0,
    byTransport: { stdio: 0, url: 0, unknown: 0 },
    byPackageRunner: { npx: 0, uvx: 0, docker: 0, other: 0 },
    pinnedPackages: 0,
    unpinnedPackages: 0,
    serversWithEnv: 0,
    disabledServers: 0,
  };
  for (const s of stats) {
    rollup.totalServers += s.totalServers;
    rollup.byTransport.stdio += s.byTransport.stdio;
    rollup.byTransport.url += s.byTransport.url;
    rollup.byTransport.unknown += s.byTransport.unknown;
    rollup.byPackageRunner.npx += s.byPackageRunner.npx;
    rollup.byPackageRunner.uvx += s.byPackageRunner.uvx;
    rollup.byPackageRunner.docker += s.byPackageRunner.docker;
    rollup.byPackageRunner.other += s.byPackageRunner.other;
    rollup.pinnedPackages += s.pinnedPackages;
    rollup.unpinnedPackages += s.unpinnedPackages;
    rollup.serversWithEnv += s.serversWithEnv;
    rollup.disabledServers += s.disabledServers;
  }
  const lines: string[] = [];
  for (const s of stats) {
    lines.push(oneBlock(s));
  }
  if (stats.length > 1) lines.push(oneBlock(rollup, "TOTAL"));
  return lines.join("\n");
}

function oneBlock(s: ConfigStats, label?: string): string {
  const header = label ?? s.file;
  return [
    header,
    `  servers:       ${s.totalServers}`,
    `  transport:     stdio=${s.byTransport.stdio} url=${s.byTransport.url} unknown=${s.byTransport.unknown}`,
    `  runners:       npx=${s.byPackageRunner.npx} uvx=${s.byPackageRunner.uvx} docker=${s.byPackageRunner.docker} other=${s.byPackageRunner.other}`,
    `  pinning:       pinned=${s.pinnedPackages} unpinned=${s.unpinnedPackages}`,
    `  with env:      ${s.serversWithEnv}`,
    `  disabled:      ${s.disabledServers}`,
    "",
  ].join("\n");
}
