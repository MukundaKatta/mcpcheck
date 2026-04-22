/**
 * Color-control boot shim.
 *
 * Imported FIRST from `cli.ts` so that picocolors (and anything else that
 * reads `NO_COLOR` / `FORCE_COLOR` at module load) sees the right flag.
 * picocolors caches its color-enabled state on first import, so this file
 * must run before `import pc from "picocolors"` anywhere in the tree.
 *
 * Precedence:
 *   1. `--color=never` / `--no-color`  → disable color
 *   2. `--color=always`                → force color on
 *   3. `NO_COLOR` env var              → respected by default
 *   4. TTY detection                   → default auto behaviour
 */

const argv = process.argv;
if (argv.includes("--color=never") || argv.includes("--no-color")) {
  process.env.NO_COLOR = "1";
  delete process.env.FORCE_COLOR;
} else if (argv.includes("--color=always") || argv.includes("--color")) {
  process.env.FORCE_COLOR = "1";
  delete process.env.NO_COLOR;
}
// `--color=auto` is the default; nothing to do.
