import type { Rule, Fix } from "../types.js";
import { getServers, serversKey, makeIssue } from "./helpers.js";
import { SECRET_PATTERNS, ENV_INTERPOLATION } from "./constants.js";
import { locate } from "../locate.js";

export const envRules: Rule = (ctx) => {
  const issues: ReturnType<Rule> = [];
  const servers = getServers(ctx.config);
  if (!servers) return issues;
  const root = serversKey(ctx.config);

  for (const [name, serverRaw] of Object.entries(servers)) {
    if (typeof serverRaw !== "object" || serverRaw === null) continue;
    const server = serverRaw as Record<string, unknown>;
    if (!("env" in server)) continue;
    const serverPath = `${root}.${name}`;

    const env = server.env;
    if (typeof env !== "object" || env === null || Array.isArray(env)) {
      const rule = ctx.rules.invalidEnv;
      if (rule.enabled && rule.severity !== "off") {
        issues.push(makeIssue({
          ruleId: "invalid-env",
          severity: rule.severity,
          message: `Server "${name}" has "env" that is not an object.`,
          jsonPath: `${serverPath}.env`,
          source: ctx.source,
        }));
      }
      continue;
    }

    for (const [key, value] of Object.entries(env as Record<string, unknown>)) {
      const envPath = `${serverPath}.env.${key}`;

      if (typeof value !== "string") {
        const rule = ctx.rules.invalidEnv;
        if (rule.enabled && rule.severity !== "off") {
          issues.push(makeIssue({
            ruleId: "invalid-env",
            severity: rule.severity,
            message: `Server "${name}" env.${key} must be a string, got ${typeof value}.`,
            jsonPath: envPath,
            source: ctx.source,
          }));
        }
        continue;
      }

      // If it references an env var already, skip secret detection.
      if (ENV_INTERPOLATION.test(value)) continue;

      for (const { name: label, re, keyHint } of SECRET_PATTERNS) {
        if (!re.test(value.trim())) continue;
        if (keyHint && !keyHint.test(key)) continue;
        const rule = ctx.rules.hardcodedSecret;
        if (!rule.enabled || rule.severity === "off") break;

        const fix = buildSecretFix(ctx.source, envPath, key);
        issues.push(makeIssue({
          ruleId: "hardcoded-secret",
          severity: rule.severity,
          message: `Server "${name}" env.${key} looks like a hardcoded ${label}. Never commit secrets; use \${${key}} so the client substitutes from your shell.`,
          jsonPath: envPath,
          source: ctx.source,
          ...(fix ? { fix } : {}),
        }));
        break;
      }
    }
  }
  return issues;
};

/**
 * Build a fix that replaces the secret string with "${VAR_NAME}" (env-var
 * substitution that MCP clients expand from the shell).
 */
function buildSecretFix(source: string, jsonPath: string, key: string): Fix | undefined {
  const loc = locate(source, jsonPath);
  if (!loc) return undefined;
  return {
    start: loc.startOffset,
    end: loc.endOffset,
    replacement: `"\${${key}}"`,
    description: `Replace hardcoded secret with \${${key}} env-var substitution`,
  };
}
