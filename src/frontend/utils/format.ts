export function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Zeitpunkt nicht verfügbar"
    : date.toLocaleString("de-DE");
}
