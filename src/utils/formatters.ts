/**
 * Helper utility functions for formatting numbers, sizes, and labels
 */

/**
 * Formats a raw number of tokens into a human-readable string (e.g. 1.2k, 45.3k, 1.5M)
 */
export function formatTokenCount(tokens: number): string {
  if (tokens < 0) {
    return '0';
  }
  if (tokens < 1000) {
    return tokens.toLocaleString();
  }
  if (tokens < 1000000) {
    const k = tokens / 1000;
    return k >= 100 ? `${Math.round(k)}k` : `${parseFloat(k.toFixed(1))}k`;
  }
  const m = tokens / 1000000;
  return `${parseFloat(m.toFixed(2))}M`;
}

/**
 * Formats a percentage with 1 decimal precision (e.g. 14.2%)
 */
export function formatPercentage(part: number, total: number): string {
  if (total <= 0) {
    return '0.0%';
  }
  const pct = (part / total) * 100;
  return `${pct.toFixed(1)}%`;
}

/**
 * Formats byte size to human readable (e.g. 4.2 KB, 1.5 MB)
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Returns a CSS hex color or color token based on token count
 */
export function getTokenSeverityColor(tokens: number): string {
  if (tokens < 1000) return '#10b981'; // green
  if (tokens < 8000) return '#eab308'; // yellow
  if (tokens < 30000) return '#f97316'; // orange
  return '#ef4444'; // red
}
