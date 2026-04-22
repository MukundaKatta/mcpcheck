import type { Rule } from "../types.js";
import { getServers, serversKey, makeIssue } from "./helpers.js";

/**
 * `empty-args` — `args: []` on a command that almost certainly needs args.
 * `npx` / `uvx` without a package name will print help and exit; `docker`
 * without a subcommand does the same. Nine times in ten, `args: []` is
 * leftover from a paste-and-edit session — the user intended to list a
 * package or `run <image>` and didn't.
 *
 * We fire only on package-runner / container-runner commands. Other
 * commands legitimately run with no args (a self-contained binary).
 *
 * Default severity: warning. Not every `args: []` is broken (someone might
 * have a `docker` alias that takes no args), but most are.
 */

const NEEDS_ARGS = new Set(["npx", "uvx", "docker", "bash", "sh", "zsh", "pwsh", "powershell"]);

export const emptyArgsRule: Rule = (ctx) => {
  const issues: ReturnType<Rule> = [];
  const servers = getServers(ctx.config);
  if (!servers) return issues;
  const root = serversKey(ctx.config);

  const rule = ctx.rules.emptyArgs;
  if (!rule.enabled || rule.severity === "off") return issues;

  for (const [name, serverRaw] of Object.entries(servers)) {
    if (typeof serverRaw !== "object" || serverRaw === null) continue;
    const server = serverRaw as Record<string, unknown>;
    const cmd = server.command;
    if (typeof cmd !== "string") continue;
    if (!NEEDS_ARGS.has(basename(cmd))) continue;
    if (!("args" in server)) continue; // Absent is fine; only flag explicit [].
    const args = server.args;
    if (!Array.isArray(args) || args.length !== 0) continue;
    issues.push(makeIssue({
      ruleId: "empty-args",
      severity: rule.severity,
      message: `Server "${name}" runs "${basename(cmd)}" with empty args. This command almost always needs at least one argument (package / subcommand).`,
      jsonPath: `${root}.${name}.args`,
      source: ctx.source,
    }));
  }
  return issues;
};

function basename(p: string): string {
  const i = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return i >= 0 ? p.slice(i + 1) : p;
}
