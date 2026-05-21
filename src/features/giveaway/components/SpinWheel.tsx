import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DrawEntry, topWeightedForWheel } from '../lib/weightedDraw';

interface Segment { entry: DrawEntry; startAngle: number; endAngle: number; }

export function SpinWheel({ entries }: { entries: DrawEntry[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<DrawEntry | null>(null);

  const wheelEntries = topWeightedForWheel(entries, 20);
  const totalWeight = wheelEntries.reduce((s, e) => s + e.total_entries, 0);

  const segments: Segment[] = (() => {
    if (!totalWeight) return [];
    let acc = 0;
    return wheelEntries.map(e => {
      const start = acc;
      const slice = (e.total_entries / totalWeight) * Math.PI * 2;
      acc += slice;
      return { entry: e, startAngle: start, endAngle: start + slice };
    });
  })();

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
      // label
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
    // center hub
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.fillStyle = '#F5F2EE';
    ctx.fill();
  }, [rotation, segments.length, totalWeight]);

  const spin = () => {
    if (spinning || !segments.length) return;
    setWinner(null);
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
        // pointer is at top (angle = -PI/2). Determine which segment lands under pointer.
        const pointer = (-Math.PI / 2 - r) % (Math.PI * 2);
        const norm = (pointer + Math.PI * 4) % (Math.PI * 2);
        const seg = segments.find(s => norm >= s.startAngle && norm < s.endAngle) || segments[0];
        setWinner(seg.entry);
        setSpinning(false);
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
      <p className="text-sm text-[#F5F2EE]/60 mb-4">Showing top {segments.length} weighted entrants.</p>
      <div className="relative mx-auto" style={{ width: 360, maxWidth: '100%' }}>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10 w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[24px] border-t-[#F5F2EE]" />
        <canvas ref={canvasRef} width={360} height={360} className="w-full h-auto" />
      </div>
      <button
        onClick={spin}
        disabled={spinning}
        className="mt-6 w-full min-h-[56px] rounded-xl bg-[#E8540A] hover:bg-[#ff6a1f] disabled:bg-[#3a3a3c] text-white font-black text-lg tracking-wider"
      >
        {spinning ? 'SPINNING…' : 'SPIN'}
      </button>

      <AnimatePresence>
        {winner && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setWinner(null)}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6"
          >
            <div className="text-center">
              <p className="text-sm uppercase tracking-[0.3em] text-[#E8540A] font-bold mb-3">Winner</p>
              <h1 className="text-6xl sm:text-8xl font-black text-[#F5F2EE]">{winner.name.toUpperCase()}</h1>
              <p className="mt-6 text-[#F5F2EE]/60">Tap to close</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
