import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Capitalize first letter of each word in a name
 */
export function capitalizeName(name: string | null | undefined): string | null {
  if (!name) return null;
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Normalize a name for comparison (lowercase, trimmed, single spaces)
 */
export function normalizeNameForComparison(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Calculate similarity between two strings using Levenshtein distance
 * Returns a score from 0 to 1 (1 = identical)
 */
export function calculateNameSimilarity(name1: string, name2: string): number {
  const s1 = normalizeNameForComparison(name1);
  const s2 = normalizeNameForComparison(name2);
  
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;
  
  const len1 = s1.length;
  const len2 = s2.length;
  
  // Create distance matrix
  const matrix: number[][] = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));
  
  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  return 1 - (distance / maxLen);
}

/**
 * Check if names have partial match (first or last name matches)
 */
export function hasPartialNameMatch(inputName: string, existingName: string): boolean {
  const inputParts = normalizeNameForComparison(inputName).split(' ').filter(Boolean);
  const existingParts = normalizeNameForComparison(existingName).split(' ').filter(Boolean);
  
  if (inputParts.length === 0 || existingParts.length === 0) return false;
  
  // Check if any part of input matches any part of existing
  return inputParts.some(inputPart => 
    existingParts.some(existingPart => 
      inputPart === existingPart || calculateNameSimilarity(inputPart, existingPart) > 0.8
    )
  );
}

/**
 * Parse a YYYY-MM-DD date string as local midnight (not UTC)
 * Use this when displaying dates from the database to prevent timezone shift
 */
export function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date(NaN);
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length !== 3) return new Date(NaN);
  const [year, month, day] = parts.map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Get current local date as YYYY-MM-DD string (avoids UTC conversion issues).
 * Use this instead of new Date().toISOString().split('T')[0] which can shift
 * the date forward when the local time is behind UTC (e.g., Central Time after 6 PM).
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Clean a name part for use in a slug: lowercase, strip non-alphanumeric.
 */
function cleanSlugPart(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Generate a questionnaire slug in the format: firstname-lastname-mmmdd
 * e.g. "Bailie Smith" on 2026-02-18 → "bailie-smith-feb18"
 * If no classDate provided, falls back to firstname-lastname.
 */
export function generateSlug(
  firstName: string,
  lastName: string,
  classDate?: string | null,
): string {
  const first = cleanSlugPart(firstName);
  const last = cleanSlugPart(lastName);
  const namePart = last ? `${first}-${last}` : first;
  if (!classDate) return namePart;
  // Parse as local midnight to avoid TZ shift
  const [y, m, d] = classDate.split('T')[0].split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const month = dateObj.toLocaleString('en-US', { month: 'short' }).toLowerCase();
  const day = dateObj.getDate();
  return `${namePart}-${month}${day}`;
}

/**
 * Generate a slug and check the DB for collisions, appending a counter if needed.
 * Returns a Promise for backward compatibility with existing call sites.
 */
export async function generateUniqueSlug(
  firstName: string,
  lastName: string,
  supabaseClient?: any,
  _legacyId?: string,
  classDate?: string | null,
): Promise<string> {
  const base = generateSlug(firstName, lastName, classDate);
  if (!supabaseClient) return base;

  // Check for collisions
  const { data } = await supabaseClient
    .from('intro_questionnaires')
    .select('slug')
    .like('slug', `${base}%`);

  const existing = new Set<string>((data || []).map((r: any) => r.slug));
  if (!existing.has(base)) return base;

  // Find next available counter
  let counter = 2;
  while (existing.has(`${base}-${counter}`)) counter++;
  return `${base}-${counter}`;
}

/** @deprecated Use generateSlug() directly */
export function generateNameSlug(firstName: string, lastName: string): string {
  return generateSlug(firstName, lastName);
}
