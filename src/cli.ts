#!/usr/bin/env node
/**
 * mcpcheck CLI.
 *
 * Examples:
 *   mcpcheck                                    # scan default paths
 *   mcpcheck ~/.cursor/mcp.json                 # single file
 *   mcpcheck '**\/mcp.json' --format sarif      # emit SARIF
 *   mcpcheck config.json --fix                  # apply autofixes in place
 */

import { readFile, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { Command } from "commander";
import { globby } from "globby";
import pc from "picocolors";

import { checkFiles } from "./core-fs.js";
import { applyFixes } from "./fix.js";
import { mergeConfig } from "./config.js";
import { loadConfigFile } from "./config-fs.js";
import { loadPlugins, hasLicense } from "./plugins.js";
import { formatText } from "./formatters/text.js";
import { formatJson } from "./formatters/json.js";
import { formatSarif } from "./formatters/sarif.js";
import { formatGithub } from "./formatters/github.js";
import { formatMarkdown } from "./formatters/markdown.js";
import { formatJunit } from "./formatters/junit.js";
import { explainRule, listRuleIds } from "./rule-docs.js";
import { runInit } from "./init.js";
import { diffFiles } from "./diff.js";
import { statsFromFile, formatStatsText } from "./stats.js";
import { runDoctor, formatDoctorText, doctorExitCode } from "./doctor.js";
import {
  applyBaseline,
  loadBaseline,
  writeBaseline,
} from "./baseline.js";
import type { Mcpcheckconfig, Rule, RunReport, FileReport } from "./types.js";

type Format = "text" | "json" | "sarif" | "github" | "markdown" | "junit";

interface CliOptions {
  config?: string;
  format: Format;
  fix: boolean;
  failOn: "error" | "warning" | "info" | "never";
  output?: string;
  explain?: string;
  listRules?: boolean;
  quiet: boolean;
  client?: string;
  baseline?: string;
  baselineWrite?: boolean;
}

const DEFAULT_BASELINE_PATH = ".mcpcheck.baseline.json";

/**
 * Default inputs when no argument is given. We scan two places:
 *
 *   1. In-repo configs:    **\/mcp.json, **\/.mcp.json, **\/.cursor/mcp.json, etc.
 *   2. Known per-user paths: Claude Desktop, Cursor, Cline, Windsurf, Zed,
 *      Claude Code — one entry per client. These are absolute paths under the
 *      user's home dir and are tilde-expanded in `expandInputs`.
 */
const DEFAULT_GLOBS = [
  // repo-local configs
  "mcp.json",
  ".mcp.json",
  "**/mcp.json",
  "**/.mcp.json",
  "**/claude_desktop_config.json",
  "**/.cursor/mcp.json",
  "**/.cline/mcp.json",
  "**/.claude/mcp.json",
  "**/.codeium/windsurf/mcp_config.json",
  // per-user configs (tilde-expanded on the fly)
  "~/.claude.json",
  "~/.cursor/mcp.json",
  "~/.codeium/windsurf/mcp_config.json",
  "~/.config/zed/settings.json",
  "~/Library/Application Support/Claude/claude_desktop_config.json",
  "~/.config/Claude/claude_desktop_config.json",
  "~/AppData/Roaming/Claude/claude_desktop_config.json",
];

/**
 * Pre-baked path sets for the `--client=<name>` convenience flag. Picks only
 * the paths that client actually reads, so a user debugging Cursor doesn't
 * have their Claude Desktop and Claude Code configs linted alongside.
 */
const CLIENT_PATHS: Record<string, string[]> = {
  cursor: ["~/.cursor/mcp.json", "**/.cursor/mcp.json"],
  "claude-desktop": [
    "~/Library/Application Support/Claude/claude_desktop_config.json",
    "~/.config/Claude/claude_desktop_config.json",
    "~/AppData/Roaming/Claude/claude_desktop_config.json",
    "**/claude_desktop_config.json",
  ],
  "claude-code": [
    "~/.claude.json",
    "**/.claude/mcp.json",
    "**/.mcp.json",
    "**/mcp.json",
  ],
  windsurf: [
    "~/.codeium/windsurf/mcp_config.json",
    "**/.codeium/windsurf/mcp_config.json",
  ],
  zed: ["~/.config/zed/settings.json"],
  cline: ["**/.cline/mcp.json", "**/cline_mcp_settings.json"],
};

export function pathsForClient(name: string): string[] | undefined {
  return CLIENT_PATHS[name];
}

export function knownClients(): string[] {
  return Object.keys(CLIENT_PATHS);
}

function expandTilde(p: string): string {
  if (p === "~") return homedir();
  if (p.startsWith("~/") || p.startsWith("~\\")) return homedir() + p.slice(1);
  return p;
}

async function main(): Promise<void> {
  // `mcpcheck init` is handled before commander parses, because commander
  // doesn't combine well with a positional-arg default command. We only
  // peek the first raw arg; everything else still goes through the main
  // command parser below.
  if (process.argv[2] === "init") {
    await handleInit(process.argv.slice(3));
    return;
  }
  if (process.argv[2] === "diff") {
    await handleDiff(process.argv.slice(3));
    return;
  }
  if (process.argv[2] === "stats") {
    await handleStats(process.argv.slice(3));
    return;
  }
  if (process.argv[2] === "doctor") {
    const statuses = await runDoctor();
    process.stdout.write(formatDoctorText(statuses) + "\n");
    process.exit(doctorExitCode(statuses));
  }

  const program = new Command()
    .name("mcpcheck")
    .description(
      "Validate MCP (Model Context Protocol) config files for Claude, Claude Code, Cursor, Cline, Windsurf, and Zed."
    )
    .argument("[inputs...]", "file paths or globs (defaults to common MCP config locations)")
    .option("-c, --config <path>", "mcpcheck config file")
    .option("-f, --format <type>", "text | json | sarif | github | markdown | junit", "text")
    .option("--fix", "apply autofixes in place", false)
    .option("--fail-on <level>", "exit nonzero threshold: error | warning | info | never", "error")
    .option("-o, --output <path>", "write formatted output to a file")
    .option("-q, --quiet", "only print files that have issues", false)
    .option(
      "--client <name>",
      `scan only one client's paths: ${knownClients().join(", ")}`
    )
    .option("--explain <rule-id>", "print docs for a rule and exit")
    .option("--list-rules", "list all rule ids and exit", false)
    .option(
      "--baseline [path]",
      `suppress every issue already present in the baseline file (default: ${DEFAULT_BASELINE_PATH})`
    )
    .option(
      "--baseline-write [path]",
      `write the current issues as a baseline and exit 0 (default: ${DEFAULT_BASELINE_PATH})`
    )
    .version(readVersion(), "-v, --version")
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  mcpcheck                                     scan common MCP paths (auto-discovery)",
        "  mcpcheck ~/.cursor/mcp.json                  check a single file",
        "  mcpcheck '**/mcp.json' --format sarif        emit SARIF for Code Scanning",
        "  mcpcheck config.json --fix                   apply autofixes in place",
        "  mcpcheck --fail-on warning                   strict CI mode",
        "  mcpcheck --explain hardcoded-secret          print rule documentation",
        "  mcpcheck init                                scaffold mcpcheck.config.json + CI",
        "  mcpcheck diff a.json b.json                  show which issues changed between two configs",
        "  mcpcheck doctor                              per-client health summary across installed MCP clients",
        "  mcpcheck stats path.json                     inventory summary of an MCP config",
        "  mcpcheck --baseline-write                    snapshot today's issues as .mcpcheck.baseline.json",
        "  mcpcheck --baseline                          fail only on new issues (respects --baseline-write output)",
      ].join("\n")
    )
    .parse(process.argv);

  const opts = program.opts<CliOptions>();

  let defaultInputs: string[] = DEFAULT_GLOBS;
  if (opts.client) {
    const paths = pathsForClient(opts.client);
    if (!paths) {
      process.stderr.write(
        pc.red(
          `Unknown --client "${opts.client}". Known: ${knownClients().join(", ")}\n`
        )
      );
      process.exit(2);
    }
    defaultInputs = paths;
  }

  const rawInputs = program.args.length > 0 ? program.args : defaultInputs;

  if (opts.listRules) {
    process.stdout.write(listRuleIds().join("\n") + "\n");
    process.exit(0);
  }
  if (opts.explain) {
    const text = explainRule(opts.explain);
    if (!text) {
      process.stderr.write(
        pc.red(`Unknown rule "${opts.explain}". Try \`mcpcheck --list-rules\`.\n`)
      );
      process.exit(2);
    }
    process.stdout.write(text);
    process.exit(0);
  }

  const config: Mcpcheckconfig = opts.config ? loadConfigFileSafe(opts.config) : mergeConfig();
  const extraRules = await loadPluginRules(config);

  const files = await expandInputs(rawInputs);
  if (files.length === 0) {
    process.stderr.write(pc.yellow("No MCP config files matched. Nothing to do.\n"));
    process.exit(0);
  }

  const report = await checkFiles(files, { config, extraRules });

  if (opts.baselineWrite !== undefined) {
    const path =
      typeof opts.baselineWrite === "string" ? opts.baselineWrite : DEFAULT_BASELINE_PATH;
    const n = await writeBaseline(path, report.files);
    process.stderr.write(
      pc.green(`[baseline] wrote ${n} issue(s) to ${path}\n`)
    );
    process.exit(0);
  }

  let suppressedByBaseline = 0;
  if (opts.baseline !== undefined) {
    const path =
      typeof opts.baseline === "string" ? opts.baseline : DEFAULT_BASELINE_PATH;
    const baseline = await loadBaseline(path);
    if (!baseline) {
      process.stderr.write(
        pc.yellow(
          `[baseline] no baseline found at ${path}; running as if --baseline weren't set. Use --baseline-write to create one.\n`
        )
      );
    } else {
      const { files: filtered, suppressed } = applyBaseline(report.files, baseline);
      report.files = filtered;
      suppressedByBaseline = suppressed;
      // Counts need to reflect what we still report.
      report.errorCount = filtered.reduce(
        (n, f) => n + f.issues.filter((i) => i.severity === "error").length,
        0
      );
      report.warningCount = filtered.reduce(
        (n, f) => n + f.issues.filter((i) => i.severity === "warning").length,
        0
      );
      report.infoCount = filtered.reduce(
        (n, f) => n + f.issues.filter((i) => i.severity === "info").length,
        0
      );
      if (suppressed > 0) {
        process.stderr.write(
          pc.dim(`[baseline] suppressed ${suppressed} pre-existing issue(s)\n`)
        );
      }
    }
  }
  void suppressedByBaseline;

  if (opts.fix) {
    for (const file of report.files) {
      if (file.fatal) continue;
      const source = await readFile(file.file, "utf8");
      const { output, applied } = applyFixes(source, file.issues);
      if (applied.length > 0) {
        await writeFile(file.file, output, "utf8");
        process.stderr.write(
          pc.green(`[fixed] ${applied.length} issue(s) in ${file.file}\n`)
        );
      }
    }
  }

  const viewReport = opts.quiet && opts.format === "text" ? filterQuiet(report) : report;
  const out = renderReport(opts.format, viewReport);
  if (opts.output) {
    await writeFile(opts.output, out, "utf8");
  } else {
    process.stdout.write(out + (opts.format === "text" ? "\n" : "\n"));
  }
  process.exit(exitCode(report, opts.failOn));
}

/**
 * For --quiet text output, drop files with no issues from the printed report
 * while keeping aggregate counts. Non-text formats are machine-readable and
 * should not be filtered; --quiet is a text-UX affordance.
 */
function filterQuiet(report: RunReport): RunReport {
  const files: FileReport[] = report.files.filter((f) => f.issues.length > 0);
  return { ...report, files };
}

async function handleStats(argv: string[]): Promise<void> {
  if (argv.length === 0 || argv.includes("-h") || argv.includes("--help")) {
    process.stderr.write(
      "Usage: mcpcheck stats <file...>\n" +
        "Summarize MCP configs: server count, transport mix, pinning, env usage.\n"
    );
    process.exit(argv.length === 0 ? 2 : 0);
  }
  const stats = [];
  for (const file of argv) {
    try {
      stats.push(await statsFromFile(file));
    } catch (err) {
      process.stderr.write(
        pc.yellow(`[skip] ${file}: ${(err as Error).message}\n`)
      );
    }
  }
  if (stats.length === 0) process.exit(1);
  process.stdout.write(formatStatsText(stats));
  process.exit(0);
}

async function handleDiff(argv: string[]): Promise<void> {
  if (argv.length !== 2 || argv.includes("-h") || argv.includes("--help")) {
    process.stderr.write(
      "Usage: mcpcheck diff <before.json> <after.json>\n" +
        "Compare the issues two MCP configs produce and print what was added / removed.\n"
    );
    process.exit(argv.length === 2 ? 0 : 2);
  }
  const [a, b] = argv as [string, string];
  const diff = await diffFiles(a, b);
  const lines: string[] = [];
  if (diff.added.length === 0 && diff.removed.length === 0) {
    process.stdout.write(pc.green(`No issue changes. (${diff.unchanged} unchanged)\n`));
    process.exit(0);
  }
  for (const i of diff.removed) {
    lines.push(pc.green(`- ${pad(i.line)} ${i.severity.padEnd(8)} ${i.ruleId}  ${i.message}`));
  }
  for (const i of diff.added) {
    lines.push(pc.red(`+ ${pad(i.line)} ${i.severity.padEnd(8)} ${i.ruleId}  ${i.message}`));
  }
  lines.push(
    `\n${diff.added.length} added, ${diff.removed.length} removed, ${diff.unchanged} unchanged.`
  );
  process.stdout.write(lines.join("\n") + "\n");
  process.exit(diff.added.length > 0 ? 1 : 0);
}

function pad(line: number | undefined): string {
  return line ? `L${String(line).padStart(4, " ")}` : "     ";
}

async function handleInit(argv: string[]): Promise<void> {
  const initCmd = new Command("init")
    .description("Scaffold mcpcheck.config.json and .github/workflows/mcpcheck.yml")
    .option("--config-only", "only write mcpcheck.config.json", false)
    .option("--workflow-only", "only write the GitHub Actions workflow", false)
    .option("--force", "overwrite existing files", false)
    .parse(["node", "mcpcheck", ...argv]);
  const opts = initCmd.opts<{ configOnly: boolean; workflowOnly: boolean; force: boolean }>();
  const result = await runInit({
    cwd: process.cwd(),
    force: opts.force,
    configOnly: opts.configOnly,
    workflowOnly: opts.workflowOnly,
  });
  for (const path of result.written) {
    process.stdout.write(pc.green(`[+] ${path}\n`));
  }
  for (const path of result.skipped) {
    process.stderr.write(
      pc.yellow(`[=] ${path} (already exists; pass --force to overwrite)\n`)
    );
  }
  if (result.written.length === 0) {
    process.exit(1);
  }
  process.exit(0);
}

function loadConfigFileSafe(path: string): Mcpcheckconfig {
  try {
    return loadConfigFile(path);
  } catch (err) {
    const message = (err as Error)?.message ?? String(err);
    process.stderr.write(
      pc.red(`Failed to load --config file "${path}": ${message}\n`)
    );
    process.exit(2);
  }
}

async function loadPluginRules(config: Mcpcheckconfig): Promise<Rule[]> {
  if (!config.plugins || config.plugins.length === 0) return [];
  const plugins = await loadPlugins(config.plugins);
  const unlocked = hasLicense();
  const extra: Rule[] = [];
  for (const p of plugins) {
    if (p.rules) extra.push(...p.rules);
    if (p.premium && unlocked) p.premium({});
  }
  return extra;
}

async function expandInputs(inputs: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const rawInput of inputs) {
    const input = expandTilde(rawInput);
    // Absolute/~-expanded paths: read directly. This skips globby's
    // "path outside cwd" restriction and works for per-user configs.
    try {
      await readFile(input, "utf8");
      out.push(input);
      continue;
    } catch {
      // Fall through to glob matching. If it contains no glob characters and
      // isn't readable, it silently drops — that's fine, the default list
      // includes several paths that only exist on some OSes/clients.
    }
    try {
      const matches = await globby(input, {
        onlyFiles: true,
        gitignore: true,
        ignore: ["**/node_modules/**", "**/dist/**", "**/.next/**", "**/build/**"],
      });
      out.push(...matches);
    } catch {
      // Skip: neither a glob match nor a readable file.
    }
  }
  return [...new Set(out)].sort();
}

function renderReport(fmt: Format, report: ReturnType<typeof checkFiles> extends Promise<infer R> ? R : never): string {
  switch (fmt) {
    case "json":
      return formatJson(report);
    case "sarif":
      return formatSarif(report);
    case "github":
      return formatGithub(report);
    case "markdown":
      return formatMarkdown(report);
    case "junit":
      return formatJunit(report);
    default:
      return formatText(report);
  }
}

function exitCode(
  report: Awaited<ReturnType<typeof checkFiles>>,
  failOn: CliOptions["failOn"]
): number {
  if (failOn === "never") return 0;
  const order = { info: 0, warning: 1, error: 2 };
  const threshold = order[failOn];
  for (const file of report.files) {
    for (const issue of file.issues) {
      if (issue.severity === "off") continue;
      if (order[issue.severity] >= threshold) return 1;
    }
  }
  return 0;
}

function readVersion(): string {
  try {
    const url = new URL("../package.json", import.meta.url);
    const json = readFileSync(url, "utf8");
    return (JSON.parse(json) as { version: string }).version;
  } catch {
    return "0.0.0";
  }
}

main().catch((err: unknown) => {
  process.stderr.write(pc.red(String((err as Error)?.message ?? err)) + "\n");
  process.exit(2);
});
