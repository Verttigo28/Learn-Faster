let counter = 0;

export function uid(prefix = "id"): string {
  // Unique for offline usage: random part + time + per-session counter (safe within the same ms)
  counter = (counter + 1) % 0x10000;
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}${counter.toString(16)}`;
}
