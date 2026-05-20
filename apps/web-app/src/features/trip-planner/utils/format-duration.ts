export function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0m";
  if (seconds < 60) return "<1m";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours === 0) return `${String(minutes)}m`;
  return `${String(hours)}h ${String(minutes)}m`;
}
