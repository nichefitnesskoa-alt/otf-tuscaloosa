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
