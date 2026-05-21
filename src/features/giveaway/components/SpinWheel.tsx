import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DrawEntry, topWeightedForWheel } from '../lib/weightedDraw';
import type { GiveawayPartner } from '../hooks/useGiveawayPartners';
import {
  getDrawRuleStatement,
  isPerPrize,
  removesWinners,
  type WinnerStructure,
} from '../lib/winnerStructure';
import { getParticipantStudioName } from '@/lib/studioNames';

interface Segment { entry: DrawEntry; startAngle: number; endAngle: number; }

interface Prize { id: string; label: string; sublabel?: string; }

export function SpinWheel({
  entries,
  partners,
  winnerStructure,
  studioSlug,
}: {
  entries: DrawEntry[];
  partners: GiveawayPartner[];
  winnerStructure: WinnerStructure;
  studioSlug: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<DrawEntry | null>(null);

  // Independent wheel-removal pool (separate from DrawWinner state).
  const [wheelRemoved, setWheelRemoved] = useState<Set<string>>(new Set());
  const [removalPrompt, setRemovalPrompt] = useState<DrawEntry | null>(null);

  const perPrize = isPerPrize(winnerStructure);
  const canRemove = removesWinners(winnerStructure);

  const prizes = useMemo<Prize[]>(() => {
    const list: Prize[] = [{ id: 'membership', label: `${getParticipantStudioName(studioSlug)} Membership` }];
    for (const p of partners) {
      const desc = (p.prize_description || '').trim();
      if (!desc) continue;
      list.push({ id: p.id, label: desc, sublabel: p.partner_name });
    }
    return list;
  }, [partners, studioSlug]);

  const [selectedPrizeId, setSelectedPrizeId] = useState<string>(prizes[0]?.id ?? 'membership');
  useEffect(() => {
    if (!prizes.find(p => p.id === selectedPrizeId)) setSelectedPrizeId(prizes[0]?.id ?? 'membership');
  }, [prizes, selectedPrizeId]);
  const selectedPrize = prizes.find(p => p.id === selectedPrizeId);

  const wheelEntries = useMemo(
    () => topWeightedForWheel(entries, 20, canRemove ? wheelRemoved : undefined),
    [entries, canRemove, wheelRemoved],
  );
  const totalWeight = wheelEntries.reduce((s, e) => s + e.total_entries, 0);

  const segments: Segment[] = useMemo(() => {
    if (!totalWeight) return [];
    let acc = 0;
    return wheelEntries.map(e => {
      const start = acc;
      const slice = (e.total_entries / totalWeight) * Math.PI * 2;
      acc += slice;
      return { entry: e, startAngle: start, endAngle: start + slice };
    });
  }, [wheelEntries, totalWeight]);

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const size = c.width;
    const cx = size / 2, cy = size / 2, r = size / 2 - 4;
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);
    segments.forEach((seg, i) => {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, seg.startAngle, seg.endAngle);
      ctx.closePath();
      ctx.fillStyle = i % 2 === 0 ? '#E8540A' : '#1C1C1E';
      ctx.fill();
      ctx.strokeStyle = '#F5F2EE';
      ctx.lineWidth = 1;
      ctx.stroke();
      const mid = (seg.startAngle + seg.endAngle) / 2;
      ctx.save();
      ctx.rotate(mid);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#F5F2EE';
      ctx.font = 'bold 13px system-ui, sans-serif';
      const name = seg.entry.name.length > 18 ? seg.entry.name.slice(0, 16) + '…' : seg.entry.name;
      ctx.fillText(name, r - 12, 4);
      ctx.restore();
    });
    ctx.restore();
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.fillStyle = '#F5F2EE';
    ctx.fill();
  }, [rotation, segments, totalWeight]);

  const spin = () => {
    if (spinning || !segments.length) return;
    setWinner(null);
    setRemovalPrompt(null);
    setSpinning(true);
    const duration = 4500 + Math.random() * 1500;
    const turns = 6 + Math.random() * 3;
    const finalRot = rotation + turns * Math.PI * 2 + Math.random() * Math.PI * 2;
    const start = performance.now();
    const startRot = rotation;
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 4);
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const r = startRot + (finalRot - startRot) * easeOut(t);
      setRotation(r);
      if (t < 1) requestAnimationFrame(step);
      else {
        const pointer = (-Math.PI / 2 - r) % (Math.PI * 2);
        const norm = (pointer + Math.PI * 4) % (Math.PI * 2);
        const seg = segments.find(s => norm >= s.startAngle && norm < s.endAngle) || segments[0];
        setWinner(seg.entry);
        setSpinning(false);
        if (canRemove && perPrize) setRemovalPrompt(seg.entry);
      }
    };
    requestAnimationFrame(step);
  };

  if (!segments.length) {
    return <div className="rounded-xl border border-[#3a3a3c] bg-[#1f1f21] p-6 text-[#F5F2EE]/60">Add entries to spin.</div>;
  }

  return (
    <div className="rounded-xl border border-[#3a3a3c] bg-[#1f1f21] p-6">
      <h2 className="text-2xl font-black mb-2">Spin Wheel</h2>
      <p className="text-sm text-[#F5F2EE]/60 mb-1">Showing top {segments.length} weighted entrants.</p>
      <p className="text-xs text-[#E8540A] mb-4 italic">{getDrawRuleStatement(winnerStructure)}</p>

      {perPrize && (
        <div className="mb-4">
          <label className="block">
            <span className="block text-xs uppercase tracking-wider text-[#F5F2EE]/60 mb-1 font-bold">Spinning for</span>
            <select
              value={selectedPrizeId}
              onChange={(e) => setSelectedPrizeId(e.target.value)}
              className="w-full min-h-[44px] rounded-lg bg-[#2a2a2c] border border-[#3a3a3c] focus:border-[#E8540A] focus:outline-none px-3 text-[#F5F2EE] font-bold cursor-pointer"
            >
              {prizes.map(p => (
                <option key={p.id} value={p.id}>
                  {p.label}{p.sublabel ? ` — ${p.sublabel}` : ''}
                </option>
              ))}
            </select>
          </label>
          {canRemove && wheelRemoved.size > 0 && (
            <p className="text-xs text-[#F5F2EE]/50 mt-2">
              {wheelRemoved.size} removed from wheel.{' '}
              <button onClick={() => setWheelRemoved(new Set())} className="text-[#E8540A] hover:underline cursor-pointer font-bold">Reset</button>
            </p>
          )}
        </div>
      )}

      <div className="relative mx-auto" style={{ width: 360, maxWidth: '100%' }}>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10 w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[24px] border-t-[#F5F2EE]" />
        <canvas ref={canvasRef} width={360} height={360} className="w-full h-auto" />
      </div>
      <button
        onClick={spin}
        disabled={spinning}
        className="mt-6 w-full min-h-[56px] rounded-xl bg-[#E8540A] hover:bg-[#ff6a1f] disabled:bg-[#3a3a3c] text-white font-black text-lg tracking-wider cursor-pointer"
      >
        {spinning ? 'SPINNING…' : perPrize ? `SPIN FOR ${selectedPrize?.label.toUpperCase() ?? 'PRIZE'}` : 'SPIN'}
      </button>

      <AnimatePresence>
        {winner && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => { if (!removalPrompt) setWinner(null); }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6"
          >
            <div className="text-center max-w-lg" onClick={(e) => e.stopPropagation()}>
              <p className="text-sm uppercase tracking-[0.3em] text-[#E8540A] font-bold mb-3">
                Winner {perPrize && selectedPrize ? `· ${selectedPrize.label}` : ''}
              </p>
              <h1 className="text-6xl sm:text-8xl font-black text-[#F5F2EE]">{winner.name.toUpperCase()}</h1>

              {!perPrize && (
                <div className="mt-6">
                  <p className="text-xs uppercase tracking-[0.25em] text-[#E8540A] font-bold mb-2">Wins all prizes</p>
                  <ul className="text-[#F5F2EE]/80 text-sm space-y-1">
                    {prizes.map(p => (
                      <li key={p.id}>• {p.label}{p.sublabel ? ` (${p.sublabel})` : ''}</li>
                    ))}
                  </ul>
                </div>
              )}

              {removalPrompt && (
                <div className="mt-6 rounded-lg border border-[#E8540A]/40 bg-[#1f1f21] p-4 text-left">
                  <p className="text-sm text-[#F5F2EE] mb-3">
                    Remove <span className="font-bold">{removalPrompt.name}</span> from wheel for next spin?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setWheelRemoved(prev => new Set(prev).add(removalPrompt.id));
                        setRemovalPrompt(null);
                        setWinner(null);
                      }}
                      className="min-h-[44px] px-5 rounded-lg bg-[#E8540A] hover:bg-[#ff6a1f] text-white font-bold cursor-pointer"
                    >
                      Yes, remove
                    </button>
                    <button
                      onClick={() => { setRemovalPrompt(null); setWinner(null); }}
                      className="min-h-[44px] px-5 rounded-lg border border-[#3a3a3c] text-[#F5F2EE] hover:bg-[#2a2a2c] font-bold cursor-pointer"
                    >
                      No, keep
                    </button>
                  </div>
                </div>
              )}

              {!removalPrompt && <p className="mt-6 text-[#F5F2EE]/60">Tap to close</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
