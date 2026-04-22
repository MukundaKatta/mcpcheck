/**
 * SARIF 2.1.0 output so GitHub Code Scanning ingests mcpcheck results into
 * the Security tab with inline PR annotations.
 */

import type { FileReport, Issue, RunReport } from "../types.js";

const RULE_META: Record<string, { short: string; helpUri?: string }> = {
  "invalid-json": { short: "Invalid JSON in config file" },
  "missing-transport": {
    short: "MCP server missing command or url",
    helpUri: "https://modelcontextprotocol.io/docs/tools/overview",
  },
  "conflicting-transport": { short: "MCP server declares conflicting transport fields" },
  "invalid-command": { short: "MCP server command field is invalid" },
  "invalid-args": { short: "MCP server args is not a string array" },
  "invalid-env": { short: "MCP server env is malformed" },
  "hardcoded-secret": {
    short: "Hardcoded API key in MCP server env",
    helpUri: "https://modelcontextprotocol.io/docs/tools/environments",
  },
  "invalid-url": { short: "MCP server url is invalid or uses plain http" },
  "invalid-transport": { short: "MCP server transport is not a supported value" },
  "unknown-field": { short: "MCP server contains unrecognised field" },
  "relative-path": { short: "MCP server command is a relative path" },
  "empty-servers": { short: "MCP config has no servers" },
  "duplicate-server-name": { short: "Case-insensitive duplicate server names" },
  "unstable-reference": { short: "MCP server references an unpinned package/image" },
  "unreadable": { short: "File could not be read" },
};

export function formatSarif(report: RunReport): string {
  const ruleIds = new Set<string>();
  const results: unknown[] = [];

  for (const file of report.files) {
    for (const issue of file.issues) {
      ruleIds.add(issue.ruleId);
      results.push(toResult(file, issue));
    }
  }

  const rules = [...ruleIds].sort().map((id) => {
    const meta = RULE_META[id] ?? { short: id };
    return {
      id,
      shortDescription: { text: meta.short },
      ...(meta.helpUri ? { helpUri: meta.helpUri } : {}),
      defaultConfiguration: { level: "warning" },
    };
  });

  const sarif = {
    $schema:
      "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "mcpcheck",
            informationUri: "https://github.com/MukundaKatta/mcpcheck",
            rules,
          },
        },
        results,
      },
    ],
  };
  return JSON.stringify(sarif, null, 2);
}

function toResult(file: FileReport, issue: Issue) {
  return {
    ruleId: issue.ruleId,
    level: toSarifLevel(issue.severity),
    message: { text: issue.message },
    locations: [
      {
        physicalLocation: {
          artifactLocation: { uri: file.file },
          region: {
            startLine: issue.line ?? 1,
          },
        },
      },
    ],
  };
}

function toSarifLevel(
  sev: Issue["severity"]
): "error" | "warning" | "note" | "none" {
  if (sev === "error") return "error";
  if (sev === "warning") return "warning";
  if (sev === "info") return "note";
  return "none";
}
