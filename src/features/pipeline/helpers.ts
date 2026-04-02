/**
 * Small utility helpers used inside the pipeline feature module.
 */

export function capitalizeNameOrNull(name: string | null | undefined): string | null {
  if (!name) return null;
  return name.replace(/\b\w/g, c => c.toUpperCase());
}

export { getLocalDateString } from '@/lib/utils';
