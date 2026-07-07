/**
 * 1920x1080 slide canvas. Scales via CSS transform to fit any viewport,
 * absolutely centered inside a `position: relative; overflow: hidden` parent.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';

export function ScaledSlide({ children }: { children: ReactNode }) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!parentRef.current) return;
    const el = parentRef.current;
    const compute = () => {
      const { width, height } = el.getBoundingClientRect();
      const s = Math.min(width / 1920, height / 1080);
      setScale(s || 1);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={parentRef}
      className="relative w-full h-full overflow-hidden"
      style={{ background: '#0A0A0A' }}
    >
      <div
        style={{
          position: 'absolute',
          width: 1920,
          height: 1080,
          left: '50%',
          top: '50%',
          marginLeft: -960,
          marginTop: -540,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          background: '#0A0A0A',
          color: '#FDF7EA',
          fontFamily: "'PP Right Grotesk', 'Arial Black', 'Helvetica Neue', Arial, sans-serif",
          letterSpacing: '-0.02em',
        }}
      >
        {children}
      </div>
    </div>
  );
}
