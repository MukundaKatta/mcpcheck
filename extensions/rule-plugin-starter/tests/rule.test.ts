import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { noBetaServers } from "../src/index.js";
import type { RuleContext } from "mcpcheck";

function runRule(config: unknown) {
  const ctx: RuleContext = {
    config,
    source: JSON.stringify(config),
    file: "x.json",
    rules: {} as RuleContext["rules"],
  };
  return noBetaServers(ctx);
}

describe("my-org/no-beta-servers", () => {
  it("flags beta-prefixed servers", () => {
    const issues = runRule({
      mcpServers: { "beta-foo": { command: "x" }, "stable": { command: "y" } },
    });
    assert.equal(issues.length, 1);
    assert.equal(issues[0]!.ruleId, "my-org/no-beta-servers");
    assert.equal(issues[0]!.jsonPath, "mcpServers.beta-foo");
  });

  it("is silent on configs with no beta entries", () => {
    const issues = runRule({ mcpServers: { stable: { command: "x" } } });
    assert.equal(issues.length, 0);
  });

  it("ignores non-object configs", () => {
    assert.equal(runRule(null).length, 0);
    assert.equal(runRule([]).length, 0);
  });
});
