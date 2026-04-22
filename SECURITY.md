# Security policy

## Supported versions

The most recent minor release is supported with security fixes. Older
minors may receive fixes at the maintainer's discretion. Beta tags are
not supported.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security reports.

Open a private security advisory:
<https://github.com/MukundaKatta/mcpcheck/security/advisories/new>

or email `mcpcheck-security@<owner-domain>` if you prefer (replace
`<owner-domain>` with the email on the maintainer's GitHub profile).

Include:

- a clear description of the issue
- the smallest reproduction possible (config snippet, CLI invocation)
- the affected version (`mcpcheck --version`)
- your disclosure preference (whether you want credit in the advisory)

We aim to:

- acknowledge every report within 5 business days
- publish a fix and advisory within 30 days for high-impact issues
- coordinate with reporters on disclosure timing

## Scope

In scope:

- mcpcheck CLI and library (`mcpcheck` on npm, the Docker image)
- VS Code extension (`mcpcheck-vscode`)
- Bundled plugins under `extensions/*`
- Generated JSON schemas, the playground, the GitHub Action

Out of scope:

- Bugs in the MCP configs mcpcheck lints (report those to the upstream
  client — Claude Desktop, Cursor, etc.)
- Vulnerabilities in third-party MCP servers that mcpcheck detects but
  does not ship (report those to the server author)
- Social-engineering against maintainers

## Non-secrets in the repo

Test fixtures contain synthetic values that match mcpcheck's secret
regexes (the point of a secret linter is that it catches these
patterns). These are not real credentials. See `tests/fixtures/*.json`
and the Discord / Azure / Google placeholders.
