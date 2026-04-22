# Contributing to mcpcheck

Thanks for considering a contribution. A few things to know before you
open a PR.

## What moves fast vs. what doesn't

Good first PRs, in rough order of likelihood-of-merge:

- **Bug fixes** — with a regression test.
- **New secret-provider patterns** — add a pattern to
  `src/rules/constants.ts` and a test in
  `tests/core.test.ts` under the "expanded secret providers" suite.
  Include a synthetic (obviously-fake) fixture value so GitHub's push
  protection doesn't reject the PR.
- **More fixtures** — real-world config layouts we don't cover yet.
- **Rule-doc improvements** — `src/rule-docs.ts` is the single source
  of truth; `docs/RULES.md` regenerates from it via
  `npm run docs:gen`.

Wants a design discussion first:

- New rules (severity default, autofix, scope — please open an issue)
- Changes to the public API (`src/index.ts`, `src/browser.ts`)
- Breaking CLI flag changes

## Dev setup

```bash
git clone https://github.com/MukundaKatta/mcpcheck
cd mcpcheck
npm install
npm run build
npm test                 # 62 passing
npm run lint             # tsc --noEmit
npm run docs:check       # docs/RULES.md must match src/rule-docs.ts
npm run schema:check     # schema.json must match RulesConfig
```

Sub-packages have their own lifecycle:

```bash
# VS Code extension
cd extensions/vscode && npm install && npm run build

# Playground
cd playground && npm install && npm run build

# Plugins
cd extensions/enterprise-plugin && npm install && npm test
cd extensions/rule-plugin-starter && npm install && npm test
```

## PR checklist

- [ ] `npm test` passes
- [ ] `npm run lint` passes
- [ ] `npm run docs:check` passes (if rule-doc changes)
- [ ] `npm run schema:check` passes (if `RulesConfig` changes)
- [ ] `npm run bench` results are roughly unchanged (if touching
      `src/core.ts`, `src/jsonc.ts`, or rule internals)
- [ ] CHANGELOG entry under `## [Unreleased]`
- [ ] If adding a secret pattern: fixture value is obviously synthetic
      (`FAKE…FAKE` / `aaa…` style) to avoid GitHub push-protection

## Commit style

One-line subject that starts with a verb, present tense. Body is
optional but welcome for context:

```
Add Mailgun / Replicate secret patterns

Mailgun uses `key-<32 hex>` which is narrow enough to unscope; Replicate
uses `r8_<…>` with a distinct prefix. Added 5 new secret patterns in the
same commit since they're all MCP-relevant AI providers.
```

## Tests

- Core tests live in `tests/` and run with `node --test` (via `tsx`).
- Plugin tests live in each plugin's `tests/`.
- For rule additions: always add a positive case AND a no-false-positive
  case (the Azure OpenAI / Datadog patterns are scoped for a reason —
  broad 32-hex regexes match UUIDs and MD5 hashes).

## Release

Releases are cut manually. See `CHANGELOG.md` — move entries from
`[Unreleased]` to a dated version, tag, and let CI (`.github/workflows/`)
publish the Docker image + VSIX artifact. `npm publish` and
`vsce publish` still require the maintainer's credentials.

## Code of Conduct

Be kind. Disagreements are fine; personal attacks aren't. Reports go
to the same email as SECURITY.md.
