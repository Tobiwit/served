export function volumeVerdict(score: number): string {
  if (score >= 85) return 'Very high volume';
  if (score >= 70) return 'Large and filling';
  if (score >= 55) return 'Substantial';
  if (score >= 40) return 'Moderate';
  return 'Compact';
}
