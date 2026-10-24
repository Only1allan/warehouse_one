/** Variance is confirmed minus expected: negative means stock is missing. */
export function computeVariance(expected: number, confirmed: number): number {
  return confirmed - expected;
}

export function describeVariance(name: string, expected: number, confirmed: number): string {
  const variance = computeVariance(expected, confirmed);
  if (variance === 0) return `${name}: counted ${confirmed}, matches the expected ${expected}`;
  const sign = variance > 0 ? `+${variance}` : String(variance);
  return `${name}: expected ${expected}, counted ${confirmed} (variance ${sign})`;
}
