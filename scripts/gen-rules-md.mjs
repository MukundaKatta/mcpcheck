#!/usr/bin/env node
// Regenerate docs/RULES.md from the single source of truth in src/rule-docs.ts.
// Run with `node scripts/gen-rules-md.mjs` after editing rule docs. CI checks
// that the file is in sync via `npm run docs:check`.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// Ensure the TS project is built before we import from dist.
const build = spawnSync("npx", ["tsc"], { cwd: root, stdio: "inherit" });
if (build.status !== 0) process.exit(build.status ?? 1);

const { RULE_DOCS } = await import(pathToFileURL(resolve(root, "dist/rule-docs.js")).href);

const lines = [
  "# mcpcheck rule reference",
  "",
  "Every rule has an id, a default severity, and (sometimes) an autofix. You can",
  "explain any rule from the CLI without opening this file:",
  "",
  "```bash",
  "mcpcheck --explain hardcoded-secret",
  "mcpcheck --list-rules",
  "```",
  "",
  "This page is generated from `src/rule-docs.ts`. Don't edit it by hand.",
  "",
  "## Index",
  "",
  "| ID | Default | Autofix | Summary |",
  "|---|---|---|---|",
];
for (const d of RULE_DOCS) {
  lines.push(
    `| [\`${d.id}\`](#${d.id}) | ${d.defaultSeverity} | ${d.autofix ? "yes" : "no"} | ${d.summary.replace(/\|/g, "\\|")} |`
  );
}
lines.push("");

for (const d of RULE_DOCS) {
  lines.push(`## ${d.id}`);
  lines.push("");
  lines.push(`**${d.title}**`);
  lines.push("");
  lines.push(`- Default severity: \`${d.defaultSeverity}\``);
  lines.push(`- Autofix: ${d.autofix ? "yes" : "no"}`);
  lines.push("");
  lines.push(d.summary);
  lines.push("");
  lines.push(d.details);
  lines.push("");
}

const out = resolve(root, "docs/RULES.md");
const content = lines.join("\n") + "\n";

const prev = tryRead(out);
writeFileSync(out, content);
if (prev !== content) {
  console.log(`Wrote ${out}`);
} else {
  console.log(`docs/RULES.md already up to date.`);
}

function tryRead(p) {
  try {
    return readFileSync(p, "utf8");
  } catch {
    return undefined;
  }
}
