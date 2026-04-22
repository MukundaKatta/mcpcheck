#!/usr/bin/env node
/**
 * Regenerate `schema.json` (repo root) from `src/config.ts`'s `DEFAULT_CONFIG`
 * and `src/rule-docs.ts`'s `RULE_DOCS`. Single source of truth: if you add a
 * new rule to `RulesConfig`, the schema picks it up automatically.
 *
 * Run with `node scripts/gen-schema.mjs`. CI enforces the file is in sync
 * via `npm run schema:check`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// We always build before reading from dist/ so the schema reflects the latest
// types — same pattern as gen-rules-md.mjs.
const build = spawnSync("npx", ["tsc"], { cwd: root, stdio: "inherit" });
if (build.status !== 0) process.exit(build.status ?? 1);

const { DEFAULT_CONFIG } = await import(pathToFileURL(resolve(root, "dist/config.js")).href);
const { RULE_DOCS } = await import(pathToFileURL(resolve(root, "dist/rule-docs.js")).href);

// Rule-docs are keyed by kebab-case rule id; config keys are camelCase. Build
// a lookup so we can attach a human-readable description (the doc summary)
// to each property in the generated schema.
const kebabToCamel = (k) => k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const docByCamel = Object.fromEntries(
  RULE_DOCS.map((d) => [kebabToCamel(d.id), d])
);

const ruleProperties = {};
for (const key of Object.keys(DEFAULT_CONFIG.rules)) {
  const doc = docByCamel[key];
  const defaultRule = DEFAULT_CONFIG.rules[key];
  ruleProperties[key] = {
    $ref: "#/$defs/RuleConfig",
    description: doc
      ? `${doc.title} — ${doc.summary}`
      : `Configuration for the \`${key}\` rule.`,
    default: defaultRule,
  };
}

const schema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id:
    "https://raw.githubusercontent.com/MukundaKatta/mcpcheck/main/schema.json",
  title: "mcpcheck configuration",
  description:
    "Configuration for the mcpcheck linter. See https://github.com/MukundaKatta/mcpcheck",
  type: "object",
  additionalProperties: false,
  properties: {
    $schema: { type: "string" },
    rules: {
      type: "object",
      description: "Per-rule enablement and severity. Omitted rules keep their defaults.",
      additionalProperties: false,
      properties: ruleProperties,
    },
    include: {
      type: "array",
      description: "Extra glob patterns to treat as MCP configs.",
      items: { type: "string" },
    },
    exclude: {
      type: "array",
      description: "Glob patterns to ignore.",
      items: { type: "string" },
    },
    plugins: {
      type: "array",
      description:
        "npm package names implementing the `Plugin` interface exported from `mcpcheck`.",
      items: { type: "string" },
    },
  },
  $defs: {
    RuleConfig: {
      type: "object",
      additionalProperties: false,
      properties: {
        enabled: {
          type: "boolean",
          default: true,
          description: "Turn the rule on or off entirely.",
        },
        severity: {
          enum: ["error", "warning", "info", "off"],
          description:
            "Severity to report at. `off` is equivalent to `enabled: false` but allows toggling without losing the severity.",
        },
      },
    },
  },
};

const out = resolve(root, "schema.json");
const content = JSON.stringify(schema, null, 2) + "\n";

const prev = tryRead(out);
writeFileSync(out, content);
if (prev !== content) {
  console.log(`Wrote ${out}`);
} else {
  console.log(`schema.json already up to date.`);
}

function tryRead(p) {
  try {
    return readFileSync(p, "utf8");
  } catch {
    return undefined;
  }
}
