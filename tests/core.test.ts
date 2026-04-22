import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { checkSource } from "../src/core.js";
import { applyFixes } from "../src/fix.js";
import { stripJsonc } from "../src/jsonc.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fx = (name: string) => readFileSync(resolve(__dirname, "fixtures", name), "utf8");

describe("checkSource - valid configs", () => {
  it("valid-stdio.json has no issues", () => {
    const report = checkSource(fx("valid-stdio.json"), "valid-stdio.json");
    assert.deepEqual(report.issues, []);
  });

  it("valid-http.json has no issues", () => {
    const report = checkSource(fx("valid-http.json"), "valid-http.json");
    assert.deepEqual(report.issues, []);
  });
});

describe("checkSource - rule triggers", () => {
  const report = checkSource(fx("broken.json"), "broken.json");
  const ids = new Set(report.issues.map((i) => i.ruleId));

  it("flags missing-transport", () => assert.ok(ids.has("missing-transport")));
  it("flags conflicting-transport (command + url)", () =>
    assert.ok(ids.has("conflicting-transport")));
  it("flags hardcoded-secret", () => assert.ok(ids.has("hardcoded-secret")));
  it("flags invalid-url (plain http)", () => assert.ok(ids.has("invalid-url")));
  it("flags invalid-transport", () => assert.ok(ids.has("invalid-transport")));
  it("flags relative-path", () => assert.ok(ids.has("relative-path")));
  it("flags unstable-reference (unpinned npx)", () =>
    assert.ok(ids.has("unstable-reference")));
  it("flags unknown-field", () => assert.ok(ids.has("unknown-field")));

  it("assigns line numbers", () => {
    const withLine = report.issues.filter((i) => typeof i.line === "number");
    assert.ok(withLine.length > 0, "expected at least one issue to have a line number");
  });
});

describe("checkSource - invalid JSON", () => {
  it("reports invalid-json fatally", () => {
    const report = checkSource("{ not: json", "invalid.json");
    assert.equal(report.fatal, true);
    assert.equal(report.issues.length, 1);
    assert.equal(report.issues[0]?.ruleId, "invalid-json");
  });
});

describe("checkSource - corner cases", () => {
  it("accepts env var substitution", () => {
    const src = `{
      "mcpServers": {
        "s": {
          "command": "node",
          "env": { "OPENAI_API_KEY": "\${OPENAI_API_KEY}" }
        }
      }
    }`;
    const report = checkSource(src, "x.json");
    assert.equal(
      report.issues.filter((i) => i.ruleId === "hardcoded-secret").length,
      0
    );
  });

  it("allows localhost http", () => {
    const src = `{"servers":{"dev":{"url":"http://localhost:8080"}}}`;
    const report = checkSource(src, "x.json");
    const urlIssues = report.issues.filter((i) => i.ruleId === "invalid-url");
    assert.equal(urlIssues.length, 0);
  });

  it("flags pinned npx as clean", () => {
    const src = `{"mcpServers":{"x":{"command":"npx","args":["-y","@org/pkg@1.2.3"]}}}`;
    const report = checkSource(src, "x.json");
    assert.equal(
      report.issues.filter((i) => i.ruleId === "unstable-reference").length,
      0
    );
  });

  it("flags unpinned docker", () => {
    const src = `{"mcpServers":{"x":{"command":"docker","args":["run","myimg:latest"]}}}`;
    const report = checkSource(src, "x.json");
    assert.ok(
      report.issues.some((i) => i.ruleId === "unstable-reference"),
      "expected unstable-reference for docker :latest"
    );
  });

  it("ignores docker subcommand and flag-values when finding the image", () => {
    const src = `{"mcpServers":{"x":{"command":"docker","args":["run","-i","--rm","-e","API_KEY","ghcr.io/foo/bar:1.0.0"]}}}`;
    const report = checkSource(src, "x.json");
    assert.equal(
      report.issues.filter((i) => i.ruleId === "unstable-reference").length,
      0,
      "a properly pinned docker image with flags should not be flagged"
    );
  });

  it("flags docker image with no tag", () => {
    const src = `{"mcpServers":{"x":{"command":"docker","args":["run","ghcr.io/foo/bar"]}}}`;
    const report = checkSource(src, "x.json");
    assert.ok(
      report.issues.some((i) => i.ruleId === "unstable-reference"),
      "expected unstable-reference for implicit :latest (no tag)"
    );
  });

  it("flags case-insensitive duplicate server names", () => {
    const src = `{"mcpServers":{"Foo":{"command":"a"},"foo":{"command":"b"}}}`;
    const report = checkSource(src, "x.json");
    assert.ok(
      report.issues.some((i) => i.ruleId === "duplicate-server-name"),
      "expected duplicate-server-name"
    );
  });
});

describe("checkSource - Zed context_servers", () => {
  it("zed-settings.json validates context_servers as a server map", () => {
    const report = checkSource(fx("zed-settings.json"), "zed-settings.json");
    // If the parser still ignored context_servers we'd get "empty-servers"
    // and no per-server issues at all.
    assert.equal(
      report.issues.filter((i) => i.ruleId === "empty-servers").length,
      0,
      "Zed context_servers should count as a valid server map"
    );
    // And we should at least pick up the existence of the two servers for
    // per-server rules — no structural error expected on this valid config.
    assert.deepEqual(report.issues, []);
  });
});

describe("checkSource - JSONC tolerance", () => {
  it("strips line and block comments and trailing commas", () => {
    const out = stripJsonc(`{
      // line
      "a": 1, /* block */
      "b": [1, 2, 3,],
    }`);
    const parsed = JSON.parse(out) as Record<string, unknown>;
    assert.deepEqual(parsed, { a: 1, b: [1, 2, 3] });
  });

  it("keeps // and /* untouched when they appear inside JSON strings", () => {
    const out = stripJsonc('{"url":"https://a//b","glob":"/*ignore*/"}');
    const parsed = JSON.parse(out) as Record<string, unknown>;
    assert.deepEqual(parsed, { url: "https://a//b", glob: "/*ignore*/" });
  });

  it("preserves line numbers so locate still points at the right line", () => {
    const report = checkSource(fx("claude-desktop-jsonc.json"), "x.json");
    // File is JSONC (comments + trailing commas). Before JSONC support, this
    // was a fatal invalid-json. Now it parses and we should get zero issues
    // on this valid config.
    assert.equal(report.fatal, false);
    assert.deepEqual(report.issues, []);
  });
});

describe("checkSource - Azure secret heuristic", () => {
  it("32-hex value is flagged only when the env var name hints Azure/OpenAI", () => {
    const report = checkSource(fx("azure-hint.json"), "azure-hint.json");
    const hits = report.issues
      .filter((i) => i.ruleId === "hardcoded-secret")
      .map((i) => i.jsonPath);
    assert.deepEqual(
      hits,
      ["mcpServers.oai.env.AZURE_OPENAI_API_KEY"],
      "Only AZURE_OPENAI_API_KEY should trip the 32-hex heuristic; SOMETHING_ELSE_HASH is noise"
    );
  });
});

describe("applyFixes", () => {
  it("replaces hardcoded secret with env substitution", () => {
    const src = `{
      "mcpServers": {
        "s": {
          "command": "node",
          "env": { "OPENAI_API_KEY": "sk-proj-hardcoded12345678901234567890abc" }
        }
      }
    }`;
    const report = checkSource(src, "x.json");
    const { output, applied } = applyFixes(src, report.issues);
    assert.equal(applied.length, 1);
    assert.ok(output.includes(`"\${OPENAI_API_KEY}"`));
  });
});
