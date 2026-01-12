/**
 * Mélange un tableau avec Fisher–Yates (non biaisé).
 *
 * Pourquoi:
 *  - `sort(() => Math.random() - 0.5)` est biaisé et peut donner une impression
 *    de "pas aléatoire" (mêmes débuts, patterns).
 */
export function shuffle<T>(input: T[]): T[] {
  const a = input.slice();

  // Random int [0, max)
  const rnd = (max: number) => {
    // crypto = meilleure distribution quand disponible
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      const buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      return buf[0] % max;
    }
    return Math.floor(Math.random() * max);
  };

  for (let i = a.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
