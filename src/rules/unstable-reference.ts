import type { Rule } from "../types.js";
import { getServers, serversKey, makeIssue } from "./helpers.js";

/**
 * Heuristic: flag commands that reference unversioned packages (`npx foo@latest`,
 * `uvx bar`, `docker run image:latest`) which break reproducibility.
 *
 * Typical MCP servers are distributed via npx/uvx/docker, and pinning is the
 * difference between a config that keeps working next quarter and one that
 * quietly breaks when a dep bumps a major.
 */
export const unstableReferenceRule: Rule = (ctx) => {
  const issues: ReturnType<Rule> = [];
  const servers = getServers(ctx.config);
  if (!servers) return issues;
  const root = serversKey(ctx.config);

  const rule = ctx.rules.unstableReference;
  if (!rule.enabled || rule.severity === "off") return issues;

  for (const [name, serverRaw] of Object.entries(servers)) {
    if (typeof serverRaw !== "object" || serverRaw === null) continue;
    const server = serverRaw as Record<string, unknown>;
    const command = server.command;
    const args = Array.isArray(server.args) ? (server.args as string[]) : [];
    if (typeof command !== "string") continue;

    const concerning = detectUnstable(command, args);
    if (concerning) {
      issues.push(makeIssue({
        ruleId: "unstable-reference",
        severity: rule.severity,
        message: `Server "${name}" runs ${concerning} without a pinned version. Pin exact versions for reproducible clients.`,
        jsonPath: `${root}.${name}`,
        source: ctx.source,
      }));
    }
  }
  return issues;
};

function detectUnstable(command: string, args: string[]): string | undefined {
  const all = [command, ...args];
  if (command.endsWith("npx") || command === "npx") {
    const pkg = args.find((a) => !a.startsWith("-"));
    if (pkg && !/@[\d]/.test(pkg)) return `npx ${pkg}`;
  }
  if (command.endsWith("uvx") || command === "uvx") {
    const pkg = args.find((a) => !a.startsWith("-"));
    if (pkg && !pkg.includes("==") && !pkg.includes("@")) return `uvx ${pkg}`;
  }
  if (command.endsWith("docker") || command === "docker") {
    const image = args.find((a) => /^[a-z0-9][\w./-]*(:[a-z0-9][\w.-]*)?$/i.test(a) && !a.startsWith("-"));
    if (image && (image.endsWith(":latest") || !image.includes(":"))) {
      return `docker ${image}`;
    }
  }
  return undefined;
}
