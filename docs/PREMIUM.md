# mcpcheck premium

The OSS core (`mcpcheck`) ships every rule documented in the README for free, under MIT. Some organizations need more than rule-based CI checks: policy-as-code across many repos, aggregate reporting across an org, and exotic rules (regulated-industry secret patterns, internal-network-only URL enforcement, runtime fingerprint rotation reminders).

**mcpcheck premium** is a small closed-source plugin package plus a hosted dashboard. It composes over the same `Rule` and `Plugin` interfaces the OSS core exposes, so there is no two-codebase split — you install a plugin, set a license key, and extra rules + reporters activate.

## What's in it

- **Policy-as-code** — define org-level policies (e.g. "all production MCP configs must use transport=streamable-http over https, commands must be pinned to a specific tag") as a YAML file, enforced in CI.
- **Dashboard** — historical trends, per-team rule compliance, exception tracking, SLA on time-to-fix.
- **Extra rule packs** — HIPAA / PCI / SOC2-aligned secret detection, private network URL enforcement, rotation-age warnings.
- **Slack / Linear / Jira reporters** — autorotate notifications to the team that owns a given MCP server.
- **SSO** and org billing.

## How the license gate works

1. You buy a seat on the site and get a license key like `mcpc_acme_xxxxxxxxxxxxxxxxxxxxxxxxxxxx`.
2. Set it as `MCPCHECK_LICENSE_KEY` in your CI environment (and locally if you like).
3. Install the premium plugin: `npm install --save-dev @mcpcheck/premium`.
4. Add to your `mcpcheck.config.json`:

```json
{
  "plugins": ["@mcpcheck/premium"]
}
```

The plugin's `premium(api)` hook runs only when `hasLicense()` returns true. Without the key, the plugin is a no-op — the core rules still run, but the premium reporters and rules stay dark.

All of this code is visible in this repo so you can audit what mcpcheck does with or without the license. The license check itself is a format test — the real enforcement happens when the hosted dashboard accepts (or rejects) dashboard payloads from the reporter.

## Status

Premium is currently in private beta. [Drop a line](https://github.com/MukundaKatta/mcpcheck/discussions) if you want early access.
