/**
 * Plugin loader.
 *
 * Rules beyond the OSS built-ins can ship as npm packages that default-export
 * an object { rules: Rule[] }. Paths listed under `plugins` in the config
 * file are imported in order.
 *
 * The license-key check below enables the optional policy-as-code and
 * org-dashboard reporter paths. Without a key, plugins still load — they
 * just can't opt in to those premium hooks. This keeps the OSS core free
 * while making paid extensions first-class citizens.
 */

import type { Rule } from "./types.js";

export interface Plugin {
  rules?: Rule[];
  /** Called once with an API object when premium features are unlocked. */
  premium?: (api: PremiumApi) => void;
}

export interface PremiumApi {
  /** A reporter can hook into this to send run results to a dashboard. */
  onRun?: (hook: (payload: unknown) => void | Promise<void>) => void;
}

export async function loadPlugins(specifiers: string[]): Promise<Plugin[]> {
  const plugins: Plugin[] = [];
  for (const spec of specifiers) {
    try {
      const mod = (await import(spec)) as { default?: Plugin } & Plugin;
      const plugin = mod.default ?? mod;
      plugins.push(plugin);
    } catch (err) {
      // Plugin load failure is visible but not fatal: the core still runs.
      // We surface it on stderr so CI logs catch config typos.
      process.stderr.write(
        `[mcpcheck] failed to load plugin "${spec}": ${(err as Error).message}\n`
      );
    }
  }
  return plugins;
}

/**
 * Returns true when a license key is present and syntactically valid.
 * The actual license validation happens at install time via the paid
 * distribution (npm scoped package or similar); this function is a cheap
 * runtime gate so plugins can conditionally enable premium codepaths.
 */
export function hasLicense(env: NodeJS.ProcessEnv = process.env): boolean {
  const key = env.MCPCHECK_LICENSE_KEY;
  if (!key) return false;
  // Format: "mcpc_<org>_<sig>", where <sig> is ≥ 20 chars.
  return /^mcpc_[a-zA-Z0-9-]{2,64}_[A-Za-z0-9_-]{20,}$/.test(key);
}
