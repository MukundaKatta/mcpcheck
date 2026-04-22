/**
 * mcpcheck rule plugin starter.
 *
 * Fork this package, rename, rewrite rules. It is intentionally tiny so you
 * can read the whole thing in one sitting:
 *
 *   1. A `Plugin` default export exposes rules.
 *   2. A `Rule` is `(ctx: RuleContext) => Issue[]`.
 *   3. Issues need at minimum a ruleId, severity, message, and jsonPath.
 *      (Line numbers and fixes are optional — add them with `locate()` /
 *      `buildFix()` from mcpcheck if you want editor-grade diagnostics.)
 *
 * The example rule — `my-org/no-beta-servers` — flags any server whose name
 * starts with `beta-`. Trivial, but it shows the full shape.
 *
 * To use a local build:
 *
 *   // mcpcheck.config.json
 *   {
 *     "$schema": "https://raw.githubusercontent.com/MukundaKatta/mcpcheck/main/schema.json",
 *     "plugins": ["./path/to/dist/index.js"]
 *   }
 */

import type { Plugin, Rule } from "mcpcheck";

const noBetaServers: Rule = (ctx) => {
  if (typeof ctx.config !== "object" || ctx.config === null) return [];
  const c = ctx.config as Record<string, unknown>;
  // Match mcpcheck's own server-key discovery order.
  const servers =
    (c.mcpServers ?? c.servers ?? c.context_servers) as
      | Record<string, unknown>
      | undefined;
  if (!servers || typeof servers !== "object" || Array.isArray(servers)) return [];
  const key = "mcpServers" in c ? "mcpServers" : "servers" in c ? "servers" : "context_servers";

  return Object.keys(servers)
    .filter((name) => name.startsWith("beta-"))
    .map((name) => ({
      ruleId: "my-org/no-beta-servers",
      severity: "warning" as const,
      message: `Server "${name}" looks like a beta entry. My-org policy forbids beta-prefixed servers in shipped configs.`,
      jsonPath: `${key}.${name}`,
    }));
};

const plugin: Plugin = { rules: [noBetaServers] };
export default plugin;
export { noBetaServers };
