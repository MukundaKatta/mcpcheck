/**
 * Map a JSON dotted path back to a 1-based line number in the original source.
 *
 * We hand-roll a tiny scanner instead of pulling in `jsonc-parser` so that we
 * can keep the package zero-dep for JSON line tracking. Accuracy is "good
 * enough for linter messages": we walk object keys and array indexes,
 * tracking braces and newlines; we do not handle duplicate keys (first wins).
 */

export interface Location {
  line: number;
  column: number;
  /** Byte offset where the value (not the key) starts. */
  startOffset: number;
  /** Byte offset one past the end of the value. */
  endOffset: number;
}

/**
 * Given a JSON source and a dotted path like `mcpServers.github.env.API_KEY`,
 * return the Location of the value at that path, or undefined if not found.
 * Array segments use numeric indexes, e.g. `mcpServers.foo.args.0`.
 */
export function locate(source: string, jsonPath: string): Location | undefined {
  if (!jsonPath) return { line: 1, column: 1, startOffset: 0, endOffset: source.length };
  const segments = jsonPath.split(".");
  let offset = 0;

  for (const seg of segments) {
    offset = skipWs(source, offset);
    const char = source[offset];
    if (char === "{") {
      offset = findKey(source, offset, seg);
      if (offset < 0) return undefined;
    } else if (char === "[") {
      const idx = Number.parseInt(seg, 10);
      if (!Number.isFinite(idx)) return undefined;
      offset = findIndex(source, offset, idx);
      if (offset < 0) return undefined;
    } else {
      return undefined;
    }
  }
  offset = skipWs(source, offset);
  const end = scanValueEnd(source, offset);
  return toLocation(source, offset, end);
}

/**
 * Position the offset at the start of the value for key `name` inside the
 * object that begins at `start`. Returns -1 if not found or malformed.
 */
function findKey(source: string, start: number, name: string): number {
  if (source[start] !== "{") return -1;
  let i = start + 1;
  while (i < source.length) {
    i = skipWs(source, i);
    if (source[i] === "}") return -1;
    if (source[i] !== `"`) return -1;
    const keyEnd = findStringEnd(source, i);
    if (keyEnd < 0) return -1;
    const key = JSON.parse(source.slice(i, keyEnd + 1)) as string;
    i = skipWs(source, keyEnd + 1);
    if (source[i] !== ":") return -1;
    i = skipWs(source, i + 1);
    if (key === name) return i;
    i = scanValueEnd(source, i);
    i = skipWs(source, i);
    if (source[i] === ",") i += 1;
    else if (source[i] === "}") return -1;
    else return -1;
  }
  return -1;
}

function findIndex(source: string, start: number, index: number): number {
  if (source[start] !== "[") return -1;
  let i = start + 1;
  let n = 0;
  while (i < source.length) {
    i = skipWs(source, i);
    if (source[i] === "]") return -1;
    if (n === index) return i;
    i = scanValueEnd(source, i);
    i = skipWs(source, i);
    if (source[i] === ",") {
      i += 1;
      n += 1;
    } else if (source[i] === "]") return -1;
    else return -1;
  }
  return -1;
}

function scanValueEnd(source: string, i: number): number {
  i = skipWs(source, i);
  const ch = source[i];
  if (ch === `"`) {
    const end = findStringEnd(source, i);
    return end < 0 ? source.length : end + 1;
  }
  if (ch === "{" || ch === "[") return findMatchingBracket(source, i) + 1;
  if (ch === "t" && source.startsWith("true", i)) return i + 4;
  if (ch === "f" && source.startsWith("false", i)) return i + 5;
  if (ch === "n" && source.startsWith("null", i)) return i + 4;
  // number
  let j = i;
  while (j < source.length && /[-+0-9.eE]/.test(source[j]!)) j += 1;
  return j;
}

function findStringEnd(source: string, start: number): number {
  let i = start + 1;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "\\") {
      i += 2;
      continue;
    }
    if (ch === `"`) return i;
    i += 1;
  }
  return -1;
}

function findMatchingBracket(source: string, start: number): number {
  const open = source[start]!;
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let i = start;
  while (i < source.length) {
    const ch = source[i]!;
    if (ch === `"`) {
      i = findStringEnd(source, i) + 1;
      continue;
    }
    if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) return i;
    }
    i += 1;
  }
  return source.length - 1;
}

function skipWs(source: string, i: number): number {
  while (i < source.length) {
    const ch = source[i];
    if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n") {
      i += 1;
      continue;
    }
    // JSONC line comments — Claude Desktop / Cursor / VS Code tolerate these.
    if (ch === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") i += 1;
      continue;
    }
    // JSONC block comments.
    if (ch === "/" && source[i + 1] === "*") {
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) i += 1;
      if (i < source.length) i += 2;
      continue;
    }
    break;
  }
  return i;
}

function toLocation(source: string, start: number, end: number): Location {
  let line = 1;
  let col = 1;
  for (let i = 0; i < start; i += 1) {
    if (source[i] === "\n") {
      line += 1;
      col = 1;
    } else {
      col += 1;
    }
  }
  return { line, column: col, startOffset: start, endOffset: end };
}
