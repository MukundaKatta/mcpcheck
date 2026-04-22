/**
 * Tiny Levenshtein-based "did you mean" helper. Used by `unknown-field` to
 * suggest the closest known MCP config key when a user writes a typo.
 *
 * We cap the max edit distance at 2: far enough to catch `commnad` → `command`
 * and `autoApprve` → `autoApprove`, close enough that we don't propose a
 * rename of e.g. `notes` → `name`. Empirically the distance-2 cutoff is
 * where most typo detectors park for a reason.
 */

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;
  // Single-row DP.
  let prev = new Array<number>(bl + 1);
  for (let j = 0; j <= bl; j += 1) prev[j] = j;
  const curr = new Array<number>(bl + 1);
  for (let i = 1; i <= al; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= bl; j += 1) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1]! + 1,
        prev[j]! + 1,
        prev[j - 1]! + cost
      );
    }
    for (let j = 0; j <= bl; j += 1) prev[j] = curr[j]!;
  }
  return prev[bl]!;
}

/**
 * Return the closest candidate to `input` within edit distance `maxDistance`,
 * or undefined if nothing is close enough. Ties broken by first-in-list.
 */
export function closestMatch(
  input: string,
  candidates: Iterable<string>,
  maxDistance = 2
): string | undefined {
  let best: string | undefined;
  let bestDist = Infinity;
  for (const c of candidates) {
    const d = levenshtein(input.toLowerCase(), c.toLowerCase());
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return bestDist <= maxDistance ? best : undefined;
}
