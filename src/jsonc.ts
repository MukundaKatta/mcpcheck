/**
 * Minimal JSONC parser: strict-JSON plus:
 *   - `// line` and `/* block *\/` comments
 *   - trailing commas in objects and arrays
 *
 * Claude Desktop, Cursor, and VS Code all accept these in their config files
 * even though MCP's spec is strict JSON. Rejecting a comment-ed config with
 * `invalid-json` before any rule runs would make mcpcheck useless against the
 * very configs it exists to check.
 *
 * Strategy: strip comments and trailing commas in a string-aware way so that
 * `//` / `/*` / `,` inside a JSON string stay untouched, then hand the
 * resulting pure JSON to `JSON.parse`. We preserve newlines (converting stripped
 * comment bytes to spaces) so line numbers in error messages still line up with
 * the original source.
 */
export function parseJsonc(source: string): unknown {
  return JSON.parse(stripJsonc(source));
}

/**
 * Return a strict-JSON version of `source` with comments and trailing commas
 * removed. Offsets and line counts are preserved (stripped characters become
 * spaces or keep their original newlines).
 */
export function stripJsonc(source: string): string {
  const out: string[] = [];
  const len = source.length;
  let i = 0;
  let inString = false;

  while (i < len) {
    const ch = source[i]!;

    // String literal — copy verbatim, tracking escapes.
    if (inString) {
      out.push(ch);
      if (ch === "\\" && i + 1 < len) {
        out.push(source[i + 1]!);
        i += 2;
        continue;
      }
      if (ch === '"') inString = false;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out.push(ch);
      i += 1;
      continue;
    }

    // Line comment: //... until newline (newline itself is preserved).
    if (ch === "/" && source[i + 1] === "/") {
      i += 2;
      while (i < len && source[i] !== "\n") {
        // Preserve width but blank it out.
        out.push(" ");
        i += 1;
      }
      continue;
    }

    // Block comment: /* ... */
    if (ch === "/" && source[i + 1] === "*") {
      i += 2;
      out.push("  ");
      while (i < len && !(source[i] === "*" && source[i + 1] === "/")) {
        out.push(source[i] === "\n" ? "\n" : " ");
        i += 1;
      }
      if (i < len) {
        out.push("  ");
        i += 2;
      }
      continue;
    }

    // Trailing comma: a `,` followed (possibly over whitespace/comments) by `}` or `]`.
    if (ch === ",") {
      const next = peekNonWhitespace(source, i + 1);
      if (next === "}" || next === "]") {
        out.push(" ");
        i += 1;
        continue;
      }
    }

    out.push(ch);
    i += 1;
  }
  return out.join("");
}

function peekNonWhitespace(source: string, from: number): string | undefined {
  let i = from;
  const len = source.length;
  while (i < len) {
    const ch = source[i]!;
    if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n") {
      i += 1;
      continue;
    }
    if (ch === "/" && source[i + 1] === "/") {
      while (i < len && source[i] !== "\n") i += 1;
      continue;
    }
    if (ch === "/" && source[i + 1] === "*") {
      i += 2;
      while (i < len && !(source[i] === "*" && source[i + 1] === "/")) i += 1;
      i += 2;
      continue;
    }
    return ch;
  }
  return undefined;
}
