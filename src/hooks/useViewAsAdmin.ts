/**
 * Admin View Toggle — lets Koa (real admin) preview non-admin surfaces
 * without logging out. Persists in localStorage, syncs across tabs and
 * across components in the same tab via a tiny event bus.
 *
 * Non-admins are unaffected: effectiveIsAdmin is always their real value.
 */
import { useSyncExternalStore, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { isAdmin as realIsAdmin } from '@/lib/auth/roles';

const KEY = 'otf.viewAsNonAdmin';
const EVT = 'otf:viewAsNonAdmin';

function read(): boolean {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}

function subscribe(cb: () => void) {
  const handler = () => cb();
  window.addEventListener(EVT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(EVT, handler);
    window.removeEventListener('storage', handler);
  };
}

export function useViewAsNonAdmin() {
  const value = useSyncExternalStore(subscribe, read, () => false);
  const set = useCallback((v: boolean) => {
    try {
      if (v) localStorage.setItem(KEY, '1');
      else localStorage.removeItem(KEY);
    } catch { /* ignore */ }
    window.dispatchEvent(new Event(EVT));
  }, []);
  return [value, set] as const;
}

/**
 * Effective admin flag. Returns false when the real admin has toggled
 * "View as non-admin". For everyone else, this equals their real admin state.
 */
export function useEffectiveAdmin(): boolean {
  const { user } = useAuth();
  const [viewAsNonAdmin] = useViewAsNonAdmin();
  const real = realIsAdmin(user);
  return real && !viewAsNonAdmin;
}

/** True only when the logged-in user is really Koa, regardless of toggle. */
export function useIsRealAdmin(): boolean {
  const { user } = useAuth();
  return realIsAdmin(user);
}
