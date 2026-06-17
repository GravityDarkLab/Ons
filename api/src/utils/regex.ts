/** Escapes regex metacharacters so user input can be used safely in a MongoDB $regex filter. */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
