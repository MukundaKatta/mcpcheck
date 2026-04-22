import type { Rule } from "../types.js";
import { getServers, serversKey, makeIssue } from "./helpers.js";
import { closestMatch } from "./fuzzy.js";

/**
 * `typosquat-package` — user wrote an `npx` / `uvx` package name that's
 * within edit distance 2 of a well-known MCP server but doesn't match
 * exactly. Typosquatted npm packages are a real delivery vector for
 * supply-chain attacks: `@modelcontextprotoco/...` (missing `l`) would
 * sail through mcpcheck's other rules if it existed.
 *
 * We keep the curated list small and famous: the official
 * `@modelcontextprotocol/*` package suite. Adding an organisation's own
 * allowed packages belongs in `@mcpcheck/enterprise`, not here; this rule
 * only knows the public ecosystem's marquee names.
 *
 * Default severity: error. The false-positive rate on distance-2 matches of
 * a short list is very low, and the cost of silently installing a
 * typosquatted MCP server is high.
 */

const KNOWN_PACKAGES = new Set([
  "@modelcontextprotocol/server-filesystem",
  "@modelcontextprotocol/server-github",
  "@modelcontextprotocol/server-gitlab",
  "@modelcontextprotocol/server-memory",
  "@modelcontextprotocol/server-everything",
  "@modelcontextprotocol/server-postgres",
  "@modelcontextprotocol/server-sqlite",
  "@modelcontextprotocol/server-puppeteer",
  "@modelcontextprotocol/server-brave-search",
  "@modelcontextprotocol/server-slack",
  "@modelcontextprotocol/server-google-maps",
  "@modelcontextprotocol/server-sentry",
  "@modelcontextprotocol/server-sequential-thinking",
  "@modelcontextprotocol/server-fetch",
  "@modelcontextprotocol/server-aws-kb-retrieval-server",
  "@modelcontextprotocol/server-time",
]);

export const typosquatRule: Rule = (ctx) => {
  const issues: ReturnType<Rule> = [];
  const servers = getServers(ctx.config);
  if (!servers) return issues;
  const root = serversKey(ctx.config);

  const rule = ctx.rules.typosquatPackage;
  if (!rule.enabled || rule.severity === "off") return issues;

  for (const [name, serverRaw] of Object.entries(servers)) {
    if (typeof serverRaw !== "object" || serverRaw === null) continue;
    const server = serverRaw as Record<string, unknown>;
    const cmd = typeof server.command === "string" ? server.command : "";
    const base = basename(cmd);
    if (base !== "npx" && base !== "uvx") continue;
    const args = Array.isArray(server.args)
      ? (server.args.filter((a) => typeof a === "string") as string[])
      : [];
    const pkg = args.find((a) => !a.startsWith("-"));
    if (!pkg) continue;
    const bare = stripVersionSuffix(pkg);
    if (KNOWN_PACKAGES.has(bare)) continue;
    if (!bare.startsWith("@modelcontextprotocol/") && !looksLikeMcpTypo(bare)) continue;

    const nearest = closestMatch(bare, KNOWN_PACKAGES, 3);
    if (!nearest || nearest === bare) continue;

    issues.push(makeIssue({
      ruleId: "typosquat-package",
      severity: rule.severity,
      message: `Server "${name}" runs package "${bare}" — close to but not the official "${nearest}". Typosquatting is a real supply-chain vector; double-check the name.`,
      jsonPath: `${root}.${name}`,
      source: ctx.source,
    }));
  }
  return issues;
};

function looksLikeMcpTypo(pkg: string): boolean {
  // Any scoped package whose scope is close to @modelcontextprotocol or
  // whose name contains "mcp" / "server-" / "context" is a candidate.
  return (
    /^@mod[a-z0-9-]*\//i.test(pkg) ||
    /^@m(?:o|0)[a-z0-9-]*\//i.test(pkg) ||
    /mcp/i.test(pkg) ||
    /server-/i.test(pkg) ||
    /context/i.test(pkg)
  );
}

function stripVersionSuffix(pkg: string): string {
  if (pkg.startsWith("@")) {
    const slash = pkg.indexOf("/");
    if (slash < 0) return pkg;
    const tail = pkg.slice(slash);
    const at = tail.lastIndexOf("@");
    if (at <= 0) return pkg;
    return pkg.slice(0, slash) + tail.slice(0, at);
  }
  const at = pkg.lastIndexOf("@");
  if (at <= 0) return pkg;
  return pkg.slice(0, at);
}

function basename(p: string): string {
  const i = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return i >= 0 ? p.slice(i + 1) : p;
}
