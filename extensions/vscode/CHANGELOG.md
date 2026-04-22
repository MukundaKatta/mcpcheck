# Changelog

All notable changes to the mcpcheck VS Code extension.

## [0.1.0] — Unreleased

### Added

- Initial release.
- Inline linting for MCP config files (`mcp.json`, `.mcp.json`,
  `claude_desktop_config.json`, `cline_mcp_settings.json`,
  `.cursor/mcp.json`, `.codeium/windsurf/mcp_config.json`, `.claude.json`,
  `.claude/mcp.json`). File patterns configurable via `mcpcheck.filePatterns`.
- Quick Fix for hardcoded secrets (replaces the value with `${VAR}`).
- `mcpcheck: Fix all autofixable issues in active file` command plus a
  per-file Source Fix All code action when more than one fix applies.
- `mcpcheck: Explain rule...` command — pick any rule by id and open its
  documentation in a Markdown preview.
- `mcpcheck.runOn` setting (`onType` / `onSave`).
- Every diagnostic is linked to its rule documentation via a clickable
  rule-id code link.
