import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DrawEntry, topWeightedForWheel, effectiveWeight } from '../lib/weightedDraw';
import { type GiveawayPartner, getPartnerPrizeLabel } from '../hooks/useGiveawayPartners';
import {
  getDrawRuleStatement,
  isPerPrize,
  removesWinners,
  type WinnerStructure,
} from '../lib/winnerStructure';
import { getParticipantStudioName } from '@/lib/studioNames';
import { RotateCcw, X } from 'lucide-react';

interface Segment { entry: DrawEntry; startAngle: number; endAngle: number; }

interface Prize { id: string; label: string; sublabel?: string; }

interface Award {
  id: string;                // unique per award row
  winner: DrawEntry;
  prizeId: string | null;    // null while awaiting prize choice (shouldn't persist)
  awardedAt: number;
}

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

  // === state ===
  const [awards, setAwards] = useState<Award[]>([]);
  const [disqualifiedIds, setDisqualifiedIds] = useState<Set<string>>(new Set());
  const [pendingWinner, setPendingWinner] = useState<DrawEntry | null>(null);
  // when disqualifying and re-spinning, hold the slot the next spin fills
  const [nextSpinLabel, setNextSpinLabel] = useState<string | null>(null);

  const perPrize = isPerPrize(winnerStructure);
  const noRepeats = removesWinners(winnerStructure);

  const prizes = useMemo<Prize[]>(() => {
    const list: Prize[] = [{ id: 'membership', label: 'One Month Free Unlimited Membership', sublabel: getParticipantStudioName(studioSlug) }];
    for (const p of partners) {
      const count = Math.max(1, Math.min(10, p.prize_count ?? 1));
      for (let i = 0; i < count; i++) {
        const label = getPartnerPrizeLabel(p, i);
        if (!label) continue;
        list.push({
          id: count > 1 ? `${p.id}__${i + 1}` : p.id,
          label,
          sublabel: count > 1 ? `${p.partner_name} (winner ${i + 1} of ${count})` : p.partner_name,
        });
      }
    }
    return list;
  }, [partners, studioSlug]);

  // === derived: what's left ===
  const activeAwards = awards; // all rows shown; disqualified ones are removed entirely
  const assignedPrizeIds = useMemo(
    () => new Set(activeAwards.map(a => a.prizeId).filter((x): x is string => !!x)),
    [activeAwards],
  );
  const remainingPrizes = useMemo(
    () => prizes.filter(p => !assignedPrizeIds.has(p.id)),
    [prizes, assignedPrizeIds],
  );

  // Winners who are locked in (not disqualified) — excluded from future spins in no-repeats mode.
  const wonWinnerIds = useMemo(
    () => new Set(activeAwards.map(a => a.winner.id)),
    [activeAwards],
  );

  const excludeFromPool = useMemo(() => {
    const s = new Set<string>(disqualifiedIds);
    if (noRepeats) wonWinnerIds.forEach(id => s.add(id));
    if (pendingWinner) s.add(pendingWinner.id);
    return s;
  }, [disqualifiedIds, wonWinnerIds, noRepeats, pendingWinner]);

  const wheelEntries = useMemo(
    () => topWeightedForWheel(entries, 20, excludeFromPool),
    [entries, excludeFromPool],
  );
  const totalWeight = wheelEntries.reduce((s, e) => s + effectiveWeight(e), 0);

  const segments: Segment[] = useMemo(() => {
    if (!totalWeight) return [];
    let acc = 0;
    return wheelEntries.map(e => {
      const start = acc;
      const slice = (effectiveWeight(e) / totalWeight) * Math.PI * 2;
      acc += slice;
      return { entry: e, startAngle: start, endAngle: start + slice };
    });
  }, [wheelEntries, totalWeight]);

  // === canvas ===
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
    if (spinning || !segments.length || pendingWinner) return;
    if (perPrize && remainingPrizes.length === 0) return;
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
        setPendingWinner(seg.entry);
        setSpinning(false);

        if (!perPrize) {
          // Single-mode: winner takes all prizes — auto-assign every unassigned prize.
          const now = Date.now();
          setAwards(prev => {
            const newRows: Award[] = remainingPrizes.map((p, i) => ({
              id: `${now}-${i}`,
              winner: seg.entry,
              prizeId: p.id,
              awardedAt: now + i,
            }));
            return [...prev, ...newRows];
          });
          setPendingWinner(null);
        }
      }
    };
    requestAnimationFrame(step);
  };

  const awardPrizeToPending = (prizeId: string) => {
    if (!pendingWinner) return;
    const now = Date.now();
    setAwards(prev => [
      ...prev,
      { id: `${now}`, winner: pendingWinner, prizeId, awardedAt: now },
    ]);
    setPendingWinner(null);
    setNextSpinLabel(null);
  };

  const cancelPending = () => {
    setPendingWinner(null);
    setNextSpinLabel(null);
  };

  const disqualify = (awardId: string) => {
    const target = awards.find(a => a.id === awardId);
    if (!target) return;
    setDisqualifiedIds(prev => {
      const n = new Set(prev);
      n.add(target.winner.id);
      return n;
    });
    setAwards(prev => prev.filter(a => a.id !== awardId));
    const prizeLabel = prizes.find(p => p.id === target.prizeId)?.label ?? 'that prize';
    setNextSpinLabel(prizeLabel);
  };

  const undoDisqualify = (winnerId: string) => {
    setDisqualifiedIds(prev => {
      const n = new Set(prev);
      n.delete(winnerId);
      return n;
    });
  };

  const resetAll = () => {
    setAwards([]);
    setDisqualifiedIds(new Set());
    setPendingWinner(null);
    setNextSpinLabel(null);
  };

  if (!prizes.length) {
    return <div className="rounded-xl border border-[#3a3a3c] bg-[#1f1f21] p-6 text-[#F5F2EE]/60">Add at least one prize.</div>;
  }
  if (!entries.length) {
    return <div className="rounded-xl border border-[#3a3a3c] bg-[#1f1f21] p-6 text-[#F5F2EE]/60">No submissions yet.</div>;
  }

  const allAwarded = perPrize ? remainingPrizes.length === 0 : awards.length > 0 && !pendingWinner;
  const canSpin = !spinning && !pendingWinner && segments.length > 0 && (!perPrize || remainingPrizes.length > 0);

  const spinButtonLabel = spinning
    ? 'SPINNING…'
    : pendingWinner
      ? 'PICK A PRIZE ABOVE'
      : perPrize
        ? (nextSpinLabel ? `SPIN AGAIN FOR ${nextSpinLabel.toUpperCase()}` : `SPIN — WINNER #${awards.length + 1} PICKS NEXT`)
        : (awards.length ? 'SPIN AGAIN' : 'SPIN');

  return (
    <div className="rounded-xl border border-[#3a3a3c] bg-[#1f1f21] p-6">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <h2 className="text-2xl font-black">Spin & Award</h2>
          <p className="text-sm text-[#F5F2EE]/60 mt-1">
            First person spun picks first. All submissions are eligible — verify follows in person.
          </p>
          <p className="text-xs text-[#E8540A] mt-1 italic">{getDrawRuleStatement(winnerStructure)}</p>
        </div>
        {(awards.length > 0 || disqualifiedIds.size > 0) && (
          <button
            onClick={resetAll}
            className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-lg border border-[#3a3a3c] text-[#F5F2EE]/70 hover:bg-[#2a2a2c] text-xs font-bold cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset draw
          </button>
        )}
      </div>

      <div className="mt-4 grid md:grid-cols-2 gap-6">
        {/* Wheel */}
        <div>
          <div className="relative mx-auto" style={{ width: 360, maxWidth: '100%' }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10 w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[24px] border-t-[#F5F2EE]" />
            <canvas ref={canvasRef} width={360} height={360} className="w-full h-auto" />
          </div>
          <button
            onClick={spin}
            disabled={!canSpin}
            className="mt-6 w-full min-h-[56px] rounded-xl bg-[#E8540A] hover:bg-[#ff6a1f] disabled:bg-[#3a3a3c] disabled:text-[#F5F2EE]/40 text-white font-black text-sm sm:text-lg tracking-wider cursor-pointer px-3"
          >
            {spinButtonLabel}
          </button>
          {perPrize && (
            <p className="text-xs text-[#F5F2EE]/50 text-center mt-2">
              {remainingPrizes.length} prize{remainingPrizes.length === 1 ? '' : 's'} left · {segments.length} entrant{segments.length === 1 ? '' : 's'} on wheel
            </p>
          )}
        </div>

        {/* Awards / prize picker */}
        <div className="space-y-4">
          {perPrize && (
            <div className="rounded-lg border border-[#3a3a3c] bg-[#181819] p-4">
              <p className="text-[10px] uppercase tracking-[0.25em] text-[#F5F2EE]/60 font-bold mb-2">Remaining prizes</p>
              {remainingPrizes.length === 0 ? (
                <p className="text-sm text-emerald-400 font-bold">All prizes awarded 🎉</p>
              ) : (
                <ul className="space-y-1.5">
                  {remainingPrizes.map(p => (
                    <li key={p.id} className="text-sm text-[#F5F2EE]">
                      • <span className="font-bold">{p.label}</span>
                      {p.sublabel && <span className="text-[#F5F2EE]/50"> — {p.sublabel}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {awards.length > 0 && (
            <div className="rounded-lg border border-[#3a3a3c] bg-[#181819] p-4">
              <p className="text-[10px] uppercase tracking-[0.25em] text-[#F5F2EE]/60 font-bold mb-2">Pick order</p>
              <ol className="space-y-2">
                {awards.map((a, idx) => {
                  const prize = prizes.find(p => p.id === a.prizeId);
                  return (
                    <li key={a.id} className="flex items-start justify-between gap-3 rounded-md bg-[#2a2a2c] border border-[#3a3a3c] p-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">
                          <span className="text-[#F5F2EE]/50 font-bold mr-1.5">#{idx + 1}</span>
                          <span className="font-bold text-[#F5F2EE]">{a.winner.name}</span>
                        </p>
                        <p className="text-xs text-emerald-400 mt-0.5">→ {prize?.label ?? 'All prizes'}{prize?.sublabel ? ` (${prize.sublabel})` : ''}</p>
                      </div>
                      <button
                        onClick={() => disqualify(a.id)}
                        className="inline-flex items-center gap-1 min-h-[32px] px-2.5 rounded-md border border-red-500/40 text-red-400 hover:bg-red-500/10 text-[11px] font-bold cursor-pointer"
                        title="Verified they don't qualify — remove and re-spin"
                      >
                        <X className="h-3 w-3" /> Disqualify
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {disqualifiedIds.size > 0 && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
              <p className="text-[10px] uppercase tracking-[0.25em] text-red-400 font-bold mb-2">Disqualified ({disqualifiedIds.size})</p>
              <ul className="space-y-1">
                {[...disqualifiedIds].map(id => {
                  const person = entries.find(e => e.id === id);
                  if (!person) return null;
                  return (
                    <li key={id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-[#F5F2EE]/80">{person.name}</span>
                      <button
                        onClick={() => undoDisqualify(id)}
                        className="text-[#E8540A] hover:underline font-bold cursor-pointer"
                      >
                        Undo
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {allAwarded && (
            <div className="rounded-lg border-2 border-emerald-500/40 bg-emerald-500/5 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-emerald-400 font-black">Draw complete</p>
            </div>
          )}
        </div>
      </div>

      {/* Pending winner modal — prize picker */}
      <AnimatePresence>
        {pendingWinner && perPrize && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6"
          >
            <div className="max-w-lg w-full text-center">
              <p className="text-sm uppercase tracking-[0.3em] text-[#E8540A] font-bold mb-3">
                Winner #{awards.length + 1} — picks first from what's left
              </p>
              <h1 className="text-5xl sm:text-7xl font-black text-[#F5F2EE] mb-6">{pendingWinner.name.toUpperCase()}</h1>

              <div className="rounded-xl border border-[#3a3a3c] bg-[#1f1f21] p-4 text-left">
                <p className="text-xs uppercase tracking-[0.25em] text-[#F5F2EE]/60 font-bold mb-3">Tap the prize they chose</p>
                <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                  {remainingPrizes.map(p => (
                    <button
                      key={p.id}
                      onClick={() => awardPrizeToPending(p.id)}
                      className="w-full text-left rounded-lg bg-[#2a2a2c] hover:bg-[#E8540A] hover:text-white border border-[#3a3a3c] p-3 cursor-pointer transition"
                    >
                      <p className="font-bold text-[#F5F2EE] group-hover:text-white">{p.label}</p>
                      {p.sublabel && <p className="text-xs text-[#F5F2EE]/60">{p.sublabel}</p>}
                    </button>
                  ))}
                </div>
                <button
                  onClick={cancelPending}
                  className="mt-4 w-full min-h-[40px] rounded-lg border border-[#3a3a3c] text-[#F5F2EE]/70 hover:bg-[#2a2a2c] text-xs font-bold cursor-pointer"
                >
                  Cancel this spin (put them back in the pool)
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
