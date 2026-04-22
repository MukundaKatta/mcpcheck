# mcpcheck — MCP config linter for VS Code

Inline linting for **MCP (Model Context Protocol)** config files. Works on every client that reads `mcp.json` / `.mcp.json` / `claude_desktop_config.json` / `context_servers`: Claude Desktop, Claude Code, Cursor, Cline, Windsurf, Zed.

Under the hood it runs the open-source [mcpcheck](https://github.com/MukundaKatta/mcpcheck) library — the same rules that run in `mcpcheck`'s CLI and GitHub Action.

## What it catches

- **Hardcoded secrets** (OpenAI, Anthropic, GitHub, GitLab, Slack, AWS, Stripe, Twilio, SendGrid, Hugging Face, npm, Google AI, Google Cloud service JSON, Azure OpenAI) with a **Quick Fix** that swaps the value for a `${VAR}` substitution your MCP client expands from the shell.
- **Missing / conflicting transport** — servers with no `command`/`url`, or both at once, or a `transport` value that contradicts them.
- **Unpinned packages and images** — `npx foo`, `uvx foo`, `docker run foo` without a pinned version (detected through flag-arg combinations like `docker run -i --rm image:tag`).
- **Dangerous commands** — `sudo`, `curl | sh`, `docker --privileged`, host-root bind mounts (`-v /:/`), `--unsafe-perm`. A config is executed on every client launch; these patterns are the difference between "a server I'm running" and "a server I'm running *and* giving my machine to".
- **Structural issues** — invalid JSON/JSONC, bad types on `args`/`env`, relative `command` paths, unknown fields, case-colliding server names.
- **JSONC tolerance** — comments and trailing commas are accepted, matching what Claude Desktop, Cursor, and VS Code actually parse.

Every diagnostic links to its rule documentation (click the rule-id next to the squiggle).

## Commands

| Command | What it does |
|---|---|
| `mcpcheck: Lint active file` | Force a re-lint of the file in the active editor. |
| `mcpcheck: Fix all autofixable issues in active file` | Apply every available autofix in the current file (secret → `${VAR}`). |
| `mcpcheck: Explain rule...` | Pick a rule by id and open its documentation in a Markdown preview. |

## Settings

| Setting | Default | Purpose |
|---|---|---|
| `mcpcheck.enable` | `true` | Turn diagnostics on/off globally. |
| `mcpcheck.filePatterns` | Common MCP config paths | Glob patterns that opt a file into linting. |
| `mcpcheck.runOn` | `"onType"` | `"onType"` re-lints as you edit (debounced 300 ms); `"onSave"` only updates on save. |

## Install

1. Install the extension from the Marketplace (search "mcpcheck").
2. Open any MCP config — diagnostics appear immediately.

No external CLI required. The full mcpcheck engine ships bundled in the extension.

## Related

- **CLI and GitHub Action:** [github.com/MukundaKatta/mcpcheck](https://github.com/MukundaKatta/mcpcheck)
- **Full rule reference:** [docs/RULES.md](https://github.com/MukundaKatta/mcpcheck/blob/main/docs/RULES.md)

## License

MIT
