import { useEffect, useState } from 'react';

function diff(target: number) {
  const ms = Math.max(0, target - Date.now());
  const s = Math.floor(ms / 1000);
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
    done: ms === 0,
  };
}

export function Countdown({ targetIso, label }: { targetIso: string; label?: string }) {
  const target = new Date(targetIso).getTime();
  const [t, setT] = useState(() => diff(target));
  useEffect(() => {
    const i = setInterval(() => setT(diff(target)), 1000);
    return () => clearInterval(i);
  }, [target]);

  const seg = (n: number, l: string) => (
    <div className="flex flex-col items-center px-3 py-3 rounded-lg bg-[#2a2a2c] border border-[#3a3a3c]" style={{ minWidth: 64 }}>
      <span className="font-display font-black tabular-nums text-[#E8540A] leading-none" style={{ fontSize: 'clamp(36px, 5vw, 48px)' }}>
        {String(n).padStart(2,'0')}
      </span>
      <span className="font-display text-[10px] md:text-[11px] uppercase tracking-widest text-[#F5F2EE]/60 mt-1">{l}</span>
    </div>
  );

  return (
    <div className="flex flex-col items-center gap-3">
      {label && <p className="font-display text-sm uppercase tracking-widest text-[#F5F2EE]/70">{label}</p>}
      <div className="flex gap-2 md:gap-3">
        {seg(t.days,'Days')}{seg(t.hours,'Hrs')}{seg(t.minutes,'Min')}{seg(t.seconds,'Sec')}
      </div>
    </div>
  );
}
