# mcpcheck

[![npm](https://img.shields.io/npm/v/mcpcheck.svg)](https://www.npmjs.com/package/mcpcheck)
[![CI](https://github.com/MukundaKatta/mcpcheck/actions/workflows/ci.yml/badge.svg)](https://github.com/MukundaKatta/mcpcheck/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

A linter for **MCP (Model Context Protocol)** config files. Works on every client that reads `mcp.json` / `.mcp.json` / `claude_desktop_config.json`: Claude Desktop, Cursor, Cline, Windsurf, Zed.

- **CLI** — `mcpcheck` scans common config paths (or anything you glob at it).
- **GitHub Action** — inline PR annotations + SARIF for Code Scanning.
- **Autofix** — replaces hardcoded secrets with `${VAR}` interpolation.
- **Programmatic API** — compose rules into your own pipeline.

```
$ mcpcheck
.cursor/mcp.json
  line 14   error   hardcoded-secret
    Server "github" env.GITHUB_TOKEN looks like a hardcoded GitHub personal token.
    at mcpServers.github.env.GITHUB_TOKEN
    fix: Replace hardcoded secret with ${GITHUB_TOKEN} env-var substitution
  line 22   warning relative-path
    Server "local" command "./scripts/run.sh" is a relative path.
    at mcpServers.local.command

Checked 1 file(s) in 3ms: 1 error, 1 warning.
```

## Install

```bash
npm install -g mcpcheck
```

Or one-off:

```bash
npx mcpcheck
```

## Usage

### CLI

```bash
mcpcheck                                     # scan common MCP config paths
mcpcheck ~/.cursor/mcp.json                  # single file
mcpcheck '**/mcp.json' --format sarif        # emit SARIF for Code Scanning
mcpcheck config.json --fix                   # apply autofixes in place
mcpcheck config.json --fail-on warning       # strict CI
```

| Flag | Purpose |
|---|---|
| `--format text\|json\|sarif\|github` | Output format (default `text`) |
| `--fix` | Apply autofixes in place (secret to `${VAR}` substitution) |
| `--config <path>` | JSON config file |
| `--fail-on error\|warning\|info\|never` | Exit-code threshold (default `error`) |
| `--output <path>` | Write formatted output to a file |
| `-v`, `--version` | Print version |

### GitHub Action

```yaml
# .github/workflows/mcpcheck.yml
name: mcpcheck
on: [pull_request]
permissions:
  contents: read
  pull-requests: write
  security-events: write
jobs:
  mcpcheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: MukundaKatta/mcpcheck@v1
        with:
          paths: '**/mcp.json **/claude_desktop_config.json'
          fail-on: error
      - uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: mcpcheck.sarif
```

What this does:

1. Emits inline PR annotations via `::error`/`::warning` on the exact line of each offending field.
2. Writes SARIF 2.1.0 so Code Scanning picks it up (Security tab + annotations that persist across PR updates).
3. Fails the job based on `fail-on`.

### Programmatic

```ts
import { checkSource, applyFixes } from "mcpcheck";

const report = checkSource(json, "mcp.json");
console.log(report.issues);

const { output, applied } = applyFixes(json, report.issues);
console.log(`Fixed ${applied.length} issue(s).`);
```

## Rules

| ID | Checks | Default severity | Autofix |
|---|---|---|---|
| `invalid-json` | File is not parseable JSON. | error | no |
| `missing-transport` | Server must have `command` or `url`. | error | no |
| `conflicting-transport` | Both `command` and `url` set, or `transport` disagrees. | error | no |
| `invalid-command` | `command` missing or not a string. | error | no |
| `invalid-args` | `args` is not an array of strings. | error | no |
| `invalid-env` | `env` is not an object of strings. | error | no |
| `hardcoded-secret` | Env value matches a known secret pattern (OpenAI, Anthropic, GitHub, Slack, AWS, Stripe, Azure, Google). | error | **yes** |
| `invalid-url` | `url` is not valid, not http/https, or plain http to a non-local host. | error | no |
| `invalid-transport` | `transport` is not `stdio`/`sse`/`streamable-http`. | error | no |
| `unknown-field` | Server has a field not in the MCP schema. | warning | no |
| `relative-path` | `command` starts with `./` or `../`. | warning | no |
| `empty-servers` | Config has no `mcpServers` or `servers`. | warning | no |
| `duplicate-server-name` | Two server names that differ only by case. | error | no |
| `unstable-reference` | `npx <pkg>` / `uvx <pkg>` / `docker <img:latest>` without a pinned version. | warning | no |

The `hardcoded-secret` rule recognises prefixes from every major provider (see [constants.ts](./src/rules/constants.ts)) and always proposes a fix: the value becomes `"${ENV_VAR}"`, which every MCP client expands from the caller's shell.

## Configuration

```json
// mcpcheck.config.json
{
  "rules": {
    "unknownField": { "severity": "off" },
    "relativePath": { "severity": "error" },
    "unstableReference": { "severity": "error" }
  },
  "plugins": ["@my-org/mcpcheck-custom-rules"]
}
```

Every rule accepts `{ "enabled": boolean, "severity": "error" | "warning" | "info" | "off" }`. Run with `--config mcpcheck.config.json`.

## Plugins

Plugins are npm packages that export `{ rules?: Rule[], premium?: (api) => void }`. See [src/plugins.ts](./src/plugins.ts). Example:

```ts
// @acme/mcpcheck-internal-rules
import type { Plugin } from "mcpcheck";
const plugin: Plugin = {
  rules: [
    // your Rule functions
  ],
};
export default plugin;
```

Then in `mcpcheck.config.json`: `{"plugins": ["@acme/mcpcheck-internal-rules"]}`.

## Premium

See [docs/PREMIUM.md](./docs/PREMIUM.md) for policy-as-code, hosted dashboard, and extra rule packs. The OSS core runs identically with or without a license; premium is an additive plugin layer.

## Supported clients

mcpcheck doesn't care which client reads the config, it only validates against the MCP protocol. Tested config layouts:

| Client | Typical path |
|---|---|
| Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Cursor | `~/.cursor/mcp.json` and `<repo>/.cursor/mcp.json` |
| Cline | `~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |
| Zed | `~/.config/zed/settings.json` under `context_servers` |
| Generic / in-repo | `mcp.json`, `.mcp.json` |

## Development

```bash
npm install
npm run build
npm test       # 18 passing
```

## License

MIT
