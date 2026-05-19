/**
 * Shared "now" ticker. ONE setInterval studio-wide.
 *
 * Every consumer re-renders once per minute (at most), instead of every
 * countdown/card running its own setInterval. This fixes the My Day
 * "constant refresh" cascade.
 *
 * Usage:
 *   const now = useNowMinute();           // Date, updates ~once/min
 *   const today = useChicagoToday();      // 'yyyy-MM-dd' Chicago, rolls over
 */
import { useEffect, useState } from 'react';
import { getChicagoTodayYMD } from '@/lib/dateUtils';

type Listener = () => void;
const listeners = new Set<Listener>();
let currentNow = new Date();
let currentToday = safeChicagoToday();
let interval: ReturnType<typeof setInterval> | null = null;

function safeChicagoToday(): string {
  try { return getChicagoTodayYMD(); } catch { return new Date().toISOString().slice(0, 10); }
}

function tick() {
  currentNow = new Date();
  const t = safeChicagoToday();
  if (t !== currentToday) currentToday = t;
  listeners.forEach((fn) => fn());
}

function ensureInterval() {
  if (interval) return;
  // Align roughly to the next minute boundary so consumers update together.
  const msToNextMinute = 60_000 - (Date.now() % 60_000);
  setTimeout(() => {
    tick();
    interval = setInterval(tick, 60_000);
  }, msToNextMinute);
}

function subscribe(fn: Listener) {
  ensureInterval();
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function useNowMinute(): Date {
  const [, setN] = useState(0);
  useEffect(() => subscribe(() => setN((n) => n + 1)), []);
  return currentNow;
}

export function useChicagoToday(): string {
  const [t, setT] = useState(currentToday);
  useEffect(() => subscribe(() => {
    if (currentToday !== t) setT(currentToday);
  }), [t]);
  return t;
}
