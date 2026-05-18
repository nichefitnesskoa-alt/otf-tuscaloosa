// Canonical role helpers.
// Admin gating is by IDENTITY (Koa), not by role string. This prevents future
// staff from accidentally inheriting Admin powers if their staff.role is ever
// set to 'Admin' or 'Both'. Only Koa is Admin.
import type { User } from '@/types';

export const isKoa = (u: User | null | undefined): boolean =>
  u?.name === 'Koa';

// Identity-based admin check. Use this everywhere instead of role === 'Admin'.
export const isAdmin = isKoa;

// "Both" role staff get the union of Coach + SA features.
export const isCoachLike = (u: User | null | undefined): boolean =>
  u?.role === 'Coach' || u?.role === 'Both';

export const isSALike = (u: User | null | undefined): boolean =>
  u?.role === 'SA' || u?.role === 'Both';

// =====================================================================
// Per-staff feature/tab permissions
// =====================================================================
// Permission KEYS — keep in sync with StaffManagement permissions editor.
export const PERMISSION_KEYS = [
  'nav.my_day',
  'nav.coach_view',
  'nav.studio',
  'nav.wig',
  'nav.own_it',
  'nav.vips',
  'nav.my_intros',
  'nav.pipeline',
  'nav.admin',
  'feature.coaching_scripts',
  'feature.scripts_tab',
] as const;

export type PermissionKey = typeof PERMISSION_KEYS[number];

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  'nav.my_day': 'My Day tab',
  'nav.coach_view': 'Coach View tab',
  'nav.studio': 'Studio tab',
  'nav.wig': 'WIG tab',
  'nav.own_it': 'Own It tab',
  'nav.vips': 'VIPs tab',
  'nav.my_intros': 'Text My Intros tab',
  'nav.pipeline': 'Pipeline tab',
  'nav.admin': 'Admin tab',
  'feature.coaching_scripts': 'Coaching Scripts (Workout Templates)',
  'feature.scripts_tab': 'Scripts tab (My Day)',
};

// Role-based defaults — what each role sees when no override is set.
function defaultForRole(u: User | null | undefined, key: PermissionKey): boolean {
  if (!u) return false;
  if (isAdmin(u)) return true; // Koa sees everything
  const role = u.role;
  const coach = role === 'Coach' || role === 'Both';
  const sa = role === 'SA' || role === 'Both';
  switch (key) {
    case 'nav.my_day': return sa;
    case 'nav.coach_view': return coach;
    case 'nav.studio': return sa || coach; // SA, Coach, Both all see Studio (Recaps)
    case 'nav.wig': return sa || coach;
    case 'nav.own_it': return sa || coach;
    case 'nav.vips': return sa || coach;
    case 'nav.my_intros': return coach;
    case 'nav.pipeline': return sa; // Pipeline shown to SA and Both
    case 'nav.admin': return false; // Admin tab is Koa-only (handled by isAdmin)
    case 'feature.coaching_scripts':
      // Restricted to Koa + Jackson by default (per Koa's request).
      return u.name === 'Jackson';
    case 'feature.scripts_tab': return sa;
    default: return false;
  }
}

/**
 * Returns true if the user can see the given feature/tab.
 * Koa (admin) always returns true. Otherwise checks per-staff override,
 * falling back to the role default.
 */
export function canSee(u: User | null | undefined, key: PermissionKey): boolean {
  if (!u) return false;
  if (isAdmin(u)) return true;
  const override = u.permissions?.[key];
  if (typeof override === 'boolean') return override;
  return defaultForRole(u, key);
}
