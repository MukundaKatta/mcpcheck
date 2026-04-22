export const VALID_TRANSPORTS = ["stdio", "sse", "streamable-http"] as const;

export const KNOWN_SERVER_FIELDS = new Set([
  "command",
  "args",
  "env",
  "url",
  "transport",
  "cwd",
  "headers",
  "disabled",
  "autoApprove",
  "alwaysAllow",
  "type", // Cursor/Windsurf alternative to transport
  "description",
  "icon",
  "name",
]);

/**
 * Regex patterns for secrets that should never be hardcoded. We match on a
 * conservative set of well-known prefixes used by popular API providers.
 */
export const SECRET_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: "OpenAI API key", re: /^sk-(proj-|svcacct-|admin-|live-)?[A-Za-z0-9_-]{20,}$/ },
  { name: "Anthropic API key", re: /^sk-ant-[A-Za-z0-9_-]{20,}$/ },
  { name: "Google AI API key", re: /^AIza[0-9A-Za-z_-]{30,}$/ },
  { name: "GitHub personal token", re: /^(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}$/ },
  { name: "GitHub fine-grained PAT", re: /^github_pat_[A-Za-z0-9_]{30,}$/ },
  { name: "Slack bot token", re: /^xox[abp]-[0-9]+-[0-9]+-[A-Za-z0-9]+$/ },
  { name: "AWS access key", re: /^AKIA[0-9A-Z]{16}$/ },
  { name: "Stripe secret key", re: /^sk_(live|test)_[A-Za-z0-9]{20,}$/ },
  { name: "Azure OpenAI key", re: /^[a-f0-9]{32}$/i },
];

export const ENV_INTERPOLATION = /\$\{[A-Z_][A-Z0-9_]*\}|\$[A-Z_][A-Z0-9_]*/;
