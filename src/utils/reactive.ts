/**
 * Utilities to strip Vue Proxy wrappers before storing in IndexedDB.
 * IndexedDB cannot serialize Proxy objects — use these helpers.
 */

/** Deep-copy an array of plain objects (removes Vue reactivity) */
export function plainOptions(opts: { id: string; text: string; correct: boolean }[]) {
  return opts.map(o => ({ id: o.id, text: o.text, correct: !!o.correct }));
}

/** Copy a string array (plain, non-reactive) */
export function copyStrings(arr?: string[]): string[] | undefined {
  return arr ? [...arr] : undefined;
}
