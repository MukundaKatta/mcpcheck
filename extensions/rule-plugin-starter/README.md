# mcpcheck rule plugin starter

Fork this package to ship a custom rule pack on top of [mcpcheck](https://github.com/MukundaKatta/mcpcheck).

## What you get

- A minimal TypeScript setup (`tsc` → `dist/`).
- One example rule, `my-org/no-beta-servers`, that flags any server whose name starts with `beta-`.
- A unit test scaffold (`node --test` + tsx).
- A `Plugin` default export ready to be listed under `plugins: [...]` in `mcpcheck.config.json`.

## Develop

```bash
npm install
npm run build
npm test
```

## Use it from mcpcheck

```json
// mcpcheck.config.json
{
  "$schema": "https://raw.githubusercontent.com/MukundaKatta/mcpcheck/main/schema.json",
  "plugins": ["./path/to/dist/index.js"]
}
```

or after you `npm publish`:

```json
{ "plugins": ["@your-org/mcpcheck-rules"] }
```

## Writing your own rule

A rule is `(ctx: RuleContext) => Issue[]`. Minimum payload for an Issue:

```ts
{
  ruleId: "your-org/your-rule",
  severity: "error" | "warning" | "info",
  message: "Human-readable explanation",
  jsonPath: "dotted.path.into.the.config"
}
```

For editor-grade diagnostics (precise line numbers + Quick Fix edits in the VS Code extension), also set `line` and `fix`. See `src/locate.ts` + `src/fix.ts` in the mcpcheck repo for the helpers mcpcheck uses internally.

## License

Fork it. Change the name. Do whatever.
