import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

interface FitTextProps {
  children: ReactNode;
  min: number;
  max: number;
  /** If set: use this exact size and skip auto-fitting. */
  fixed?: number | null;
  style?: CSSProperties;
  as?: 'h1' | 'h2' | 'p' | 'span' | 'div';
  /** Width-cap multiplier (0..1). Default 1 = fill container width. */
  fillRatio?: number;
}

/**
 * Auto-sizes its child text to fill the container width on one line.
 * Uses ResizeObserver and binary-search; respects min/max bounds.
 * If `fixed` is provided, that exact px is used (clamped if it overflows on small widths).
 */
export function FitText({ children, min, max, fixed, style, as = 'span', fillRatio = 1 }: FitTextProps) {
  const wrapRef = useRef<HTMLElement | null>(null);
  const measureRef = useRef<HTMLSpanElement | null>(null);
  const [size, setSize] = useState<number>(fixed ?? max);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const measure = measureRef.current;
    if (!wrap || !measure) return;

    const fit = () => {
      const containerWidth = wrap.clientWidth * fillRatio;
      if (containerWidth <= 0) return;

      // Binary search for the largest size that fits on one line.
      let lo = min;
      let hi = fixed ? Math.min(fixed, max) : max;
      // First measure at hi
      measure.style.fontSize = `${hi}px`;
      if (measure.scrollWidth <= containerWidth) {
        setSize(hi);
        return;
      }
      // If a fixed value was set but doesn't fit, fall back to auto-fit.
      while (lo < hi - 1) {
        const mid = Math.floor((lo + hi) / 2);
        measure.style.fontSize = `${mid}px`;
        if (measure.scrollWidth <= containerWidth) lo = mid;
        else hi = mid;
      }
      setSize(Math.max(min, lo));
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [children, min, max, fixed, fillRatio]);

  const Tag: any = as;
  return (
    <Tag ref={wrapRef} style={{ ...style, fontSize: size, display: 'block', width: '100%' }}>
      {/* hidden measurement node mirrors the visible text */}
      <span
        ref={measureRef}
        aria-hidden
        style={{
          position: 'absolute',
          visibility: 'hidden',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          fontFamily: 'inherit',
          fontWeight: 'inherit',
          letterSpacing: 'inherit',
          lineHeight: 'inherit',
        }}
      >
        {children}
      </span>
      <span style={{ whiteSpace: 'nowrap', display: 'block' }}>{children}</span>
    </Tag>
  );
}
