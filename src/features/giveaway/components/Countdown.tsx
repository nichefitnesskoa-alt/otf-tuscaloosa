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
    <div className="flex flex-col items-center px-3 sm:px-5 py-3 rounded-lg bg-[#2a2a2c] border border-[#3a3a3c] min-w-[72px]">
      <span className="text-3xl sm:text-5xl font-black tabular-nums text-[#E8540A] leading-none">{String(n).padStart(2,'0')}</span>
      <span className="text-[10px] uppercase tracking-widest text-[#F5F2EE]/60 mt-1">{l}</span>
    </div>
  );

  return (
    <div className="flex flex-col items-center gap-3">
      {label && <p className="text-sm uppercase tracking-widest text-[#F5F2EE]/70">{label}</p>}
      <div className="flex gap-2 sm:gap-3">
        {seg(t.days,'Days')}{seg(t.hours,'Hrs')}{seg(t.minutes,'Min')}{seg(t.seconds,'Sec')}
      </div>
    </div>
  );
}
