import type { Rule } from "../types.js";
import { getServers, serversKey, makeIssue } from "./helpers.js";

/**
 * `dangerous-command` — refuse configs that ask an MCP client to run the
 * equivalent of `curl | sh`, escalate privileges, or mount the host filesystem
 * root. These patterns are the difference between "a server I'm running" and
 * "a server I'm running *and* giving it my machine".
 *
 * We flag:
 *   1. Remote shell pipes: any `command`/`args` that contains both a fetcher
 *      (curl, wget, iwr, Invoke-WebRequest) AND a shell sink (`| sh`, `| bash`,
 *      `| zsh`, `| fish`, `iex`).
 *   2. Privilege escalation: `sudo`, `doas`, `runas`, `pkexec` as the command
 *      or wrapping the command.
 *   3. Root-filesystem docker mounts: `-v /:/anything` or `--volume /:/…` —
 *      this gives the container read/write over the host root.
 *   4. `--privileged` on docker — drops most kernel protections.
 *   5. Node `--unsafe-perm`, npm `--allow-root`, npx `--unsafe-perm`.
 *   6. Dangerous destructive operators in args: a literal `rm -rf /` sequence.
 *
 * The rule's severity defaults to `error` because none of these patterns are
 * safe-by-default in a long-lived MCP client config.
 */

export const dangerousCommandRule: Rule = (ctx) => {
  const issues: ReturnType<Rule> = [];
  const servers = getServers(ctx.config);
  if (!servers) return issues;
  const root = serversKey(ctx.config);
  const rule = ctx.rules.dangerousCommand;
  if (!rule.enabled || rule.severity === "off") return issues;

  for (const [name, serverRaw] of Object.entries(servers)) {
    if (typeof serverRaw !== "object" || serverRaw === null) continue;
    const server = serverRaw as Record<string, unknown>;
    const command = typeof server.command === "string" ? server.command : "";
    const args = Array.isArray(server.args)
      ? (server.args.filter((a) => typeof a === "string") as string[])
      : [];
    if (!command) continue;
    const serverPath = `${root}.${name}`;

    for (const finding of detectDangerous(command, args)) {
      issues.push(makeIssue({
        ruleId: "dangerous-command",
        severity: rule.severity,
        message: `Server "${name}" ${finding}. An MCP client executes this on every load; keep a config free of escalation and remote-shell pipes.`,
        jsonPath: `${serverPath}.command`,
        source: ctx.source,
      }));
    }
  }
  return issues;
};

function detectDangerous(command: string, args: string[]): string[] {
  const out: string[] = [];
  const joined = [command, ...args].join(" ");
  const baseCommand = basename(command);

  // Privilege escalation wrappers. Executing `sudo foo` on every client launch
  // is almost always a config smell even if the binary happens to be NOPASSWD.
  if (PRIV_ESCALATION.has(baseCommand)) {
    out.push(`uses the privilege-escalation command "${baseCommand}"`);
  }
  // Common flag equivalents.
  if (args.some((a) => a === "--unsafe-perm" || a === "--allow-root" || a === "--allow-run-as-root")) {
    out.push(`passes a "run as root" flag (${args.find((a) => a.startsWith("--")) ?? ""})`);
  }

  // Remote shell pipe: needs a fetcher + a shell sink anywhere in the argv or
  // in the command string itself (for `bash -c 'curl … | sh'` style wrappers).
  if (FETCHERS_RE.test(joined) && SHELL_PIPE_RE.test(joined)) {
    out.push(`pipes a remote fetch into a shell (remote code execution on every launch)`);
  }

  // Docker `--privileged` or `-v /:/...` (host root mounted into container).
  if (baseCommand === "docker" || args[0] === "docker") {
    if (args.includes("--privileged")) {
      out.push(`runs docker with --privileged (drops kernel protections)`);
    }
    for (let i = 0; i < args.length; i += 1) {
      const a = args[i]!;
      if (a === "-v" || a === "--volume" || a === "--mount") {
        const val = args[i + 1];
        if (typeof val === "string" && isRootMount(val, a)) {
          out.push(`mounts the host root filesystem into the container ("${a} ${val}")`);
        }
      } else if (a.startsWith("-v=") || a.startsWith("--volume=") || a.startsWith("--mount=")) {
        const val = a.slice(a.indexOf("=") + 1);
        if (isRootMount(val, a.split("=")[0]!)) {
          out.push(`mounts the host root filesystem into the container ("${a}")`);
        }
      }
    }
  }

  // `rm -rf /` literal sequence in args.
  if (hasSequence(args, ["rm", "-rf", "/"]) || hasSequence(args, ["rm", "-rf", "/*"])) {
    out.push(`contains an "rm -rf /" sequence`);
  }

  return out;
}

const PRIV_ESCALATION = new Set(["sudo", "doas", "pkexec", "runas", "gosu", "su"]);

const FETCHERS_RE = /(?:\bcurl\b|\bwget\b|\biwr\b|Invoke-WebRequest)/;
const SHELL_PIPE_RE = /(?:\|\s*(?:sh|bash|zsh|fish|ksh|dash|pwsh|powershell)\b|\|\s*iex\b)/;

function isRootMount(value: string, flag: string): boolean {
  // `-v` / `--volume` form is `host:container[:options]`. `--mount` is
  // `type=bind,source=/,target=/host,...`. We match both.
  if (flag === "--mount") {
    // source=/ or src=/
    return /(?:^|,)\s*(?:source|src)\s*=\s*\/(?:,|$)/.test(value);
  }
  // host path is everything before the first `:` (skip a Windows drive letter).
  const [host] = splitDockerVolume(value);
  return host === "/";
}

function splitDockerVolume(spec: string): [string, string | undefined] {
  // Allow `C:\path:/container` on Windows-style hosts.
  const drivePrefix = /^([A-Za-z]:)(.*)$/.exec(spec);
  const body = drivePrefix ? drivePrefix[2]! : spec;
  const drive = drivePrefix ? drivePrefix[1] : "";
  const idx = body.indexOf(":");
  if (idx === -1) return [drive + body, undefined];
  return [drive + body.slice(0, idx), body.slice(idx + 1)];
}

function hasSequence(args: string[], seq: string[]): boolean {
  if (seq.length === 0) return false;
  outer: for (let i = 0; i <= args.length - seq.length; i += 1) {
    for (let j = 0; j < seq.length; j += 1) {
      if (args[i + j] !== seq[j]) continue outer;
    }
    return true;
  }
  return false;
}

function basename(p: string): string {
  const i = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return i >= 0 ? p.slice(i + 1) : p;
}
