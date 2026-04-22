import type { Rule } from "../types.js";
import { getServers, serversKey, makeIssue } from "./helpers.js";
import { ENV_INTERPOLATION } from "./constants.js";

/**
 * `password-flag-literal` — args contain `--password <literal>` or
 * `--token <literal>` or `--api-key <literal>` etc, where the value
 * isn't a `${VAR}` substitution.
 *
 * This catches the "I copied the CLI example and dropped it into args"
 * case without needing the value to match a known secret prefix. The
 * `secret-in-args` rule catches the subset that *also* matches a known
 * provider's format; this rule is the broader "if it's called
 * --password, we assume the thing after it is one" heuristic.
 *
 * Default severity: error. Too many real credentials leak this way.
 */

const CREDENTIAL_FLAGS = new Set([
  "--password",
  "--pass",
  "-p",
  "--token",
  "--auth-token",
  "--access-token",
  "--api-key",
  "--apikey",
  "--key",
  "--secret",
  "--client-secret",
]);

const COMMON_WORDS = new Set([
  "true",
  "false",
  "yes",
  "no",
  "on",
  "off",
  "stdin",
  "env",
]);

export const passwordFlagLiteralRule: Rule = (ctx) => {
  const issues: ReturnType<Rule> = [];
  const servers = getServers(ctx.config);
  if (!servers) return issues;
  const root = serversKey(ctx.config);

  const rule = ctx.rules.passwordFlagLiteral;
  if (!rule.enabled || rule.severity === "off") return issues;

  for (const [name, serverRaw] of Object.entries(servers)) {
    if (typeof serverRaw !== "object" || serverRaw === null) continue;
    const args = (serverRaw as Record<string, unknown>).args;
    if (!Array.isArray(args)) continue;
    for (let i = 0; i < args.length - 1; i += 1) {
      const flag = args[i];
      if (typeof flag !== "string") continue;
      if (!CREDENTIAL_FLAGS.has(flag)) continue;
      const value = args[i + 1];
      if (typeof value !== "string") continue;
      const trimmed = value.trim();
      if (!trimmed || trimmed.startsWith("-")) continue;
      if (ENV_INTERPOLATION.test(trimmed)) continue;
      if (COMMON_WORDS.has(trimmed.toLowerCase())) continue;

      issues.push(makeIssue({
        ruleId: "password-flag-literal",
        severity: rule.severity,
        message: `Server "${name}" passes "${flag} <literal>" in args. The literal is committed as plaintext. Replace with \${VAR} substitution and set the env var instead.`,
        jsonPath: `${root}.${name}.args.${i + 1}`,
        source: ctx.source,
      }));
    }
  }
  return issues;
};
