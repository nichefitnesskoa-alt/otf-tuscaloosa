/**
 * Small utility helpers used inside the pipeline feature module.
 */

export function capitalizeNameOrNull(name: string | null | undefined): string | null {
  if (!name) return null;
  return name.replace(/\b\w/g, c => c.toUpperCase());
}

export function getLocalDateString(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
