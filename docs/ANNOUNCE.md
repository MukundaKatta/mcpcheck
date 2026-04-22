# Release announcement drafts

Pre-written copy you can lift once `mcpcheck` is live on npm + marketplace + ghcr. All drafts assume version `vYYYY.M.D`; replace the placeholders (`<version>`, `<repo-url>`, `<playground-url>`, `<marketplace-url>`) before posting.

---

## Hacker News — "Show HN"

**Title (80 char max):**

> Show HN: mcpcheck — a linter for MCP (Model Context Protocol) config files

**Body:**

> Hi HN. After the third time I audited someone's `claude_desktop_config.json` and found a raw `sk-proj-…` OpenAI key in it, I built a linter for MCP config files.
>
> mcpcheck catches the obvious stuff (hardcoded OpenAI/Anthropic/GitHub/AWS/Stripe/etc. keys, unpinned `npx` / `docker` references, `curl | sh` hidden inside `bash -c`, `docker --privileged`, host-root mounts) and the less obvious stuff (Zed's separate `context_servers` key, JSONC comments that the real Claude Desktop parser accepts but strict JSON rejects, case-colliding server names).
>
> Works on every client I could find — Claude Desktop, Claude Code, Cursor, Cline, Windsurf, Zed — and ships four ways:
>
> - CLI (`mcpcheck` on npm, Docker image on ghcr.io)
> - GitHub Action (inline PR annotations + SARIF)
> - VS Code extension with Quick Fixes, hover docs, and CodeLens
> - Web playground — paste a config, see diagnostics live: <playground-url>
>
> Sub-50 µs per config in the bench suite, so it fits anywhere. 15 built-in rules, 24 secret-provider patterns, one autofix (hardcoded secret → `${VAR}` substitution). Everything is open-source MIT.
>
> <repo-url>
>
> Happy to answer questions. Feedback especially welcome on the rule defaults — some of the severity decisions (where to draw `error` vs `warning`) were judgement calls.

---

## Reddit — r/ClaudeAI (or r/programming, minus the Claude-specific framing)

**Title:**

> I built a linter for MCP config files (Claude Desktop, Cursor, Cline, Windsurf, Zed)

**Body:**

> TL;DR: `mcpcheck` finds hardcoded API keys, unpinned `npx @foo` references, dangerous `curl | sh` wrappers, `docker --privileged`, and ~20 other issues in your MCP configs. CLI + VS Code extension + GitHub Action + browser playground.
>
> **Why:** MCP configs are tiny JSON files that your AI client executes on every launch. A typo, a leaked key, or a `npx some-package@latest` that gets silently republished can be a supply-chain vector. I wanted the same kind of lint-on-save experience I get for source code.
>
> **What it catches (selection):**
> - `OPENAI_API_KEY: "sk-proj-…"` hardcoded in `env` → one Quick Fix flips to `${OPENAI_API_KEY}`
> - `docker run image` without a pinned tag → `unstable-reference`
> - `bash -c "curl https://… | sh"` → `dangerous-command`
> - Typo'd field like `"commnad"` → "Did you mean `command`?"
> - Zed's `context_servers` (clients that only read `mcpServers` silently ignore it)
> - JSONC with comments/trailing commas (Claude Desktop tolerates these, so we do too)
>
> **Try without installing:** <playground-url> (pastes stay in-browser)
>
> Code / issues: <repo-url>
>
> MIT licensed. Happy to take rule-addition requests — new secret providers are especially easy PRs.

---

## Twitter / X / Mastodon / Bluesky

**Thread, ~5 tweets:**

1. Shipped `mcpcheck` today — a linter for MCP (Model Context Protocol) config files. Catches hardcoded API keys, unpinned `npx` references, `curl | sh` wrappers, `docker --privileged`, and ~20 other sharp edges in your Claude Desktop / Cursor / Cline / Windsurf / Zed config. 🧵
2. Runs in the CLI, as a GitHub Action, in VS Code (live diagnostics + Quick Fix), or in the browser. Sub-50 µs per config. Zero external services — your config never leaves the machine you run it on.
3. Example: paste a `claude_desktop_config.json` with `"OPENAI_API_KEY": "sk-proj-…"` in it. Get an error on the exact line. Hit "Fix all" and the value becomes `"${OPENAI_API_KEY}"`. Done.
4. Also: one command to audit every MCP client installed on your machine → `mcpcheck doctor`. Or `mcpcheck doctor --fix` if you're feeling brave.
5. Try it in-browser, no install: <playground-url>
   Source: <repo-url>
   MIT. Issues / rule requests very welcome.

---

## Dev.to / Substack long-form outline

- **Hook:** The config file your AI client runs on every launch. Why it's worth linting.
- **A tour of the rules:** hardcoded secrets, unpinned references, dangerous-command (with one real-world example per class). Show the wrong config, show the mcpcheck output, show the Quick Fix.
- **Install three ways:** CLI, VS Code, GitHub Action. 3 copy-paste blocks.
- **Under the hood:** 15 rules, 24 secret-provider patterns, JSONC tolerance, Zed's `context_servers` quirk, the locate() function for precise line numbers, sub-50 µs bench.
- **Adopting on an existing codebase:** `mcpcheck --baseline-write` → `mcpcheck --baseline`.
- **Extending:** `extensions/rule-plugin-starter/` + link.
- **What's next:** whatever's top of the issue tracker when you post.
- **Close:** MIT, link to repo, link to playground.

---

## Suggested posting order on launch day

1. Merge the `v<version>` tag.
2. Wait for CI to finish publishing the Docker image and building the VSIX.
3. `npm publish --access public` (see `CONTRIBUTING.md` for the 1Password / OTP flow).
4. `vsce publish --no-dependencies`.
5. Post the Twitter thread. Keep it warm for ~2 hours.
6. Post the Show HN between 7–9am PT on a weekday for best signal-to-noise.
7. When the HN post is alive, cross-link to it from the Twitter thread and add a comment in the `r/ClaudeAI` thread.
8. Post to the MCP Discord `#show-and-tell` channel with the Twitter link.
9. Submit PRs to `punkpeye/awesome-mcp-servers` and `modelcontextprotocol/servers` adding mcpcheck to their readme.

Don't post to every place at once — the conversations work best when they're sequential and cross-linked, not simultaneous.
