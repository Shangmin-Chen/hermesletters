/**
 * Zip two parallel arrays by index, filter pairs on `a`, and return both
 * resulting arrays in lockstep.
 *
 * When `keep` is a type predicate (e.g. `(x): x is string => x !== null`),
 * the narrowed type propagates to the output `a` array.
 *
 * Example:
 *   zipFilter([fileA, fileB, fileC], [capA, capB, capC], (f) => f.size > 0)
 *   // → { a: [fileA, fileC], b: [capA, capC] }  (assuming fileB.size === 0)
 */
export function zipFilter<A, N extends A, B>(
  a: A[],
  b: B[],
  keep: (a: A) => a is N
): { a: N[]; b: B[] };
export function zipFilter<A, B>(
  a: A[],
  b: B[],
  keep: (a: A) => boolean
): { a: A[]; b: B[] };
export function zipFilter<A, B>(
  a: A[],
  b: B[],
  keep: (a: A) => boolean
): { a: A[]; b: B[] } {
  const outA: A[] = [];
  const outB: B[] = [];
  for (let i = 0; i < a.length; i++) {
    if (keep(a[i])) {
      outA.push(a[i]);
      outB.push(b[i]);
    }
  }
  return { a: outA, b: outB };
}
