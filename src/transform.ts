/**
 * Config transforms used by `mcpcheck merge` and `mcpcheck convert`.
 *
 * These operate on parsed JSON objects (not source strings) — we accept the
 * whitespace / comment loss on output, since the point of these commands is
 * to produce a new canonical config from one or two inputs.
 */

import { readFile } from "node:fs/promises";
import { parseJsonc } from "./jsonc.js";

const SERVER_KEYS = ["mcpServers", "servers", "context_servers"] as const;
type ServerKey = (typeof SERVER_KEYS)[number];

/** Map a client name to the top-level key it reads. */
export const CLIENT_SERVER_KEY: Record<string, ServerKey> = {
  "claude-desktop": "mcpServers",
  "claude-code": "mcpServers",
  cursor: "mcpServers",
  cline: "mcpServers",
  windsurf: "mcpServers",
  zed: "context_servers",
  generic: "servers",
};

export function listConvertTargets(): string[] {
  return Object.keys(CLIENT_SERVER_KEY);
}

export function isKnownConvertTarget(name: string): boolean {
  return name in CLIENT_SERVER_KEY;
}

/**
 * Given a parsed config and a target client name, return a new object where
 * the server map lives under the target's top-level key. Other top-level
 * keys on the input are preserved (useful for Zed's `settings.json` which
 * has a lot of unrelated state).
 */
export function convertConfig(parsed: unknown, target: string): unknown {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return parsed;
  const c = { ...(parsed as Record<string, unknown>) };
  const srcKey = SERVER_KEYS.find((k) => k in c);
  if (!srcKey) return c; // nothing to convert
  const targetKey = CLIENT_SERVER_KEY[target];
  if (!targetKey) throw new Error(`Unknown convert target "${target}".`);
  if (srcKey === targetKey) return c;
  const servers = c[srcKey];
  delete c[srcKey];
  c[targetKey] = servers;
  return c;
}

/**
 * Shallow-merge two configs. Server maps are unioned; on a name collision,
 * the second config's entry wins in full (we don't try to merge individual
 * server objects, because `command` + `url` overlap gets dangerous).
 * Non-server top-level keys merge with later-wins precedence.
 */
export function mergeConfigs(a: unknown, b: unknown): unknown {
  const ao = asObject(a) ?? {};
  const bo = asObject(b) ?? {};
  const out: Record<string, unknown> = { ...ao };
  for (const [k, v] of Object.entries(bo)) {
    if ((SERVER_KEYS as readonly string[]).includes(k)) {
      const existing = asObject(out[k]) ?? {};
      const incoming = asObject(v) ?? {};
      out[k] = { ...existing, ...incoming };
    } else {
      out[k] = v;
    }
  }
  // If a used mcpServers and b used context_servers, merge them both into
  // mcpServers — the canonical key — rather than producing a config with
  // two competing server maps.
  const presentKeys = SERVER_KEYS.filter((k) => k in out);
  if (presentKeys.length > 1) {
    const canonical: Record<string, unknown> = {};
    for (const k of presentKeys) {
      Object.assign(canonical, asObject(out[k]) ?? {});
      delete out[k];
    }
    out.mcpServers = canonical;
  }
  return out;
}

export async function readJsoncFile(path: string): Promise<unknown> {
  const raw = await readFile(path, "utf8");
  return parseJsonc(raw);
}

function asObject(v: unknown): Record<string, unknown> | undefined {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  return undefined;
}
