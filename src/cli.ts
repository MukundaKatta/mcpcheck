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
import { Command } from "commander";
import { globby } from "globby";
import pc from "picocolors";

import { checkFiles } from "./core.js";
import { applyFixes } from "./fix.js";
import { mergeConfig, loadConfigFile } from "./config.js";
import { loadPlugins, hasLicense } from "./plugins.js";
import { formatText } from "./formatters/text.js";
import { formatJson } from "./formatters/json.js";
import { formatSarif } from "./formatters/sarif.js";
import { formatGithub } from "./formatters/github.js";
import type { Mcpcheckconfig, Rule } from "./types.js";

type Format = "text" | "json" | "sarif" | "github";

interface CliOptions {
  config?: string;
  format: Format;
  fix: boolean;
  failOn: "error" | "warning" | "info" | "never";
  output?: string;
}

const DEFAULT_GLOBS = [
  "mcp.json",
  ".mcp.json",
  "**/mcp.json",
  "**/.mcp.json",
  "**/claude_desktop_config.json",
  "**/.cursor/mcp.json",
  "**/.cline/mcp.json",
];

async function main(): Promise<void> {
  const program = new Command()
    .name("mcpcheck")
    .description(
      "Validate MCP (Model Context Protocol) config files for Claude, Cursor, Cline, Windsurf, and Zed."
    )
    .argument("[inputs...]", "file paths or globs (defaults to common MCP config locations)")
    .option("-c, --config <path>", "mcpcheck config file")
    .option("-f, --format <type>", "text | json | sarif | github", "text")
    .option("--fix", "apply autofixes in place", false)
    .option("--fail-on <level>", "exit nonzero threshold: error | warning | info | never", "error")
    .option("-o, --output <path>", "write formatted output to a file")
    .version(readVersion(), "-v, --version")
    .parse(process.argv);

  const rawInputs = program.args.length > 0 ? program.args : DEFAULT_GLOBS;
  const opts = program.opts<CliOptions>();

  const config: Mcpcheckconfig = opts.config ? loadConfigFile(opts.config) : mergeConfig();
  const extraRules = await loadPluginRules(config);

  const files = await expandInputs(rawInputs);
  if (files.length === 0) {
    process.stderr.write(pc.yellow("No MCP config files matched. Nothing to do.\n"));
    process.exit(0);
  }

  const report = await checkFiles(files, { config, extraRules });

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

  const out = renderReport(opts.format, report);
  if (opts.output) {
    await writeFile(opts.output, out, "utf8");
  } else {
    process.stdout.write(out + (opts.format === "text" ? "\n" : "\n"));
  }
  process.exit(exitCode(report, opts.failOn));
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
  for (const input of inputs) {
    // Try reading as an absolute/relative path first. This avoids globby's
    // "path outside cwd" restriction for explicit filenames users pass.
    try {
      await readFile(input, "utf8");
      out.push(input);
      continue;
    } catch {
      // Fall through to glob matching.
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
