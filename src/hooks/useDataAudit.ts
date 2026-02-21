/**
 * Hook for running and caching data audit results.
 * Auto-runs on mount (admin only) and every 30 minutes.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { runFullAudit, saveAuditRun, type AuditRunResult } from '@/lib/audit/dataAuditEngine';

const AUDIT_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

// Singleton so multiple components share state
let cachedResult: AuditRunResult | null = null;
let lastRunAt: number = 0;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach(fn => fn());
}

export function useDataAudit(autoRun = false) {
  const [result, setResult] = useState<AuditRunResult | null>(cachedResult);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  // Subscribe to singleton updates
  useEffect(() => {
    const handler = () => setResult(cachedResult);
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, []);

  const runAudit = useCallback(async () => {
    if (running) return;
    setRunning(true);
    try {
      const auditResult = await runFullAudit();
      cachedResult = auditResult;
      lastRunAt = Date.now();
      setResult(auditResult);
      notifyListeners();
      // Save to history in background
      saveAuditRun(auditResult).catch(() => {});
    } catch (err) {
      console.error('Audit run failed:', err);
    } finally {
      setRunning(false);
    }
  }, [running]);

  // Auto-run on mount and every 30 min
  useEffect(() => {
    if (!autoRun) return;

    // Run if stale (>30 min since last run)
    if (Date.now() - lastRunAt > AUDIT_INTERVAL_MS) {
      runAudit();
    }

    intervalRef.current = setInterval(() => {
      runAudit();
    }, AUDIT_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRun]); // eslint-disable-line react-hooks/exhaustive-deps

  const failCount = result?.failCount ?? 0;

  return { result, running, runAudit, failCount };
}

/**
 * Trigger an audit after a key event (outcome logged, booking created, etc.)
 * Debounced — only runs if last run was >60s ago.
 */
export function triggerAuditRefresh() {
  if (Date.now() - lastRunAt < 60_000) return; // debounce
  runFullAudit().then(auditResult => {
    cachedResult = auditResult;
    lastRunAt = Date.now();
    notifyListeners();
    saveAuditRun(auditResult).catch(() => {});
  }).catch(() => {});
}
