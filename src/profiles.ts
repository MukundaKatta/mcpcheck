/**
 * Profile presets — opinionated rule-severity bundles that tune the default
 * behaviour for a specific deployment context without asking users to
 * spell every rule out in `mcpcheck.config.json`.
 *
 *   strict     — every rule is `error`; fail on anything.
 *   permissive — non-security hygiene rules drop to `info`.
 *   ci         — defaults + `unknown-field` escalates to `error` (typos
 *                break the build, matching what most projects want once
 *                their config has stabilised).
 *
 * Resolution order for a final severity:
 *   DEFAULT_CONFIG < profile preset < user mcpcheck.config.json rules
 *
 * That way a user can pick `--profile strict` and still relax one rule in
 * their config file without losing the rest of the preset.
 */

import { DEFAULT_CONFIG, mergeConfig } from "./config.js";
import type { Mcpcheckconfig, RulesConfig, Severity } from "./types.js";

export type ProfileName = "strict" | "permissive" | "ci";

const PROFILE_BUNDLES: Record<ProfileName, Partial<Record<keyof RulesConfig, Severity>>> = {
  strict: {
    unknownField: "error",
    relativePath: "error",
    emptyServers: "error",
    unstableReference: "error",
  },
  permissive: {
    unknownField: "info",
    relativePath: "info",
    emptyServers: "info",
    unstableReference: "info",
    // Keep security-critical rules at error even in permissive mode.
  },
  ci: {
    unknownField: "error",
  },
};

export function isKnownProfile(name: string): name is ProfileName {
  return name in PROFILE_BUNDLES;
}

export function listProfiles(): ProfileName[] {
  return Object.keys(PROFILE_BUNDLES) as ProfileName[];
}

/**
 * Build an mcpcheck config by layering: defaults, profile preset, user
 * overrides (in that order). Later layers win per rule key.
 */
export function applyProfile(
  profile: ProfileName,
  userOverrides?: Partial<Mcpcheckconfig>
): Mcpcheckconfig {
  const overrides: Partial<Record<keyof RulesConfig, { enabled: boolean; severity: Severity }>> = {};
  for (const [key, severity] of Object.entries(PROFILE_BUNDLES[profile])) {
    const k = key as keyof RulesConfig;
    overrides[k] = {
      enabled: DEFAULT_CONFIG.rules[k].enabled,
      severity: severity as Severity,
    };
  }
  const withProfile = mergeConfig({ rules: overrides as RulesConfig });
  if (!userOverrides) return withProfile;
  return mergeConfig({
    ...withProfile,
    ...userOverrides,
    rules: { ...withProfile.rules, ...(userOverrides.rules ?? {}) } as RulesConfig,
  });
}
