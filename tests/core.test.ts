import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { checkSource } from "../src/core.js";
import { applyFixes } from "../src/fix.js";

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

  it("flags case-insensitive duplicate server names", () => {
    const src = `{"mcpServers":{"Foo":{"command":"a"},"foo":{"command":"b"}}}`;
    const report = checkSource(src, "x.json");
    assert.ok(
      report.issues.some((i) => i.ruleId === "duplicate-server-name"),
      "expected duplicate-server-name"
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
