import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

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
  /** Allow natural word wrapping; auto-size so the widest line fits the container. */
  multiline?: boolean;
}

/**
 * Auto-sizes its child text to fill the container width.
 * Single-line by default (nowrap). With `multiline`, wraps at word boundaries
 * and picks the largest size where no word/line overflows the container.
 */
export function FitText({ children, min, max, fixed, style, as = 'span', fillRatio = 1, multiline = false }: FitTextProps) {
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
      // keep measurement width in sync for multiline mode
      if (multiline) measure.style.width = `${containerWidth}px`;

      const fits = (px: number) => {
        measure.style.fontSize = `${px}px`;
        if (multiline) {
          // No horizontal overflow = every word/line fits the available width.
          return measure.scrollWidth <= Math.ceil(containerWidth);
        }
        return measure.scrollWidth <= containerWidth;
      };

      let lo = min;
      let hi = fixed ? Math.min(fixed, max) : max;
      if (fits(hi)) {
        setSize(hi);
        return;
      }
      while (lo < hi - 1) {
        const mid = Math.floor((lo + hi) / 2);
        if (fits(mid)) lo = mid;
        else hi = mid;
      }
      setSize(Math.max(min, lo));
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [children, min, max, fixed, fillRatio, multiline]);

  const Tag: any = as;
  const measureStyle: CSSProperties = multiline
    ? {
        position: 'absolute',
        visibility: 'hidden',
        pointerEvents: 'none',
        whiteSpace: 'normal',
        wordBreak: 'normal',
        fontFamily: 'inherit',
        fontWeight: 'inherit',
        letterSpacing: 'inherit',
        lineHeight: 'inherit',
      }
    : {
        position: 'absolute',
        visibility: 'hidden',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        fontFamily: 'inherit',
        fontWeight: 'inherit',
        letterSpacing: 'inherit',
        lineHeight: 'inherit',
      };
  const multilineDisplayStyle: CSSProperties = multiline
    ? {
        whiteSpace: 'normal',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        maxWidth: '100%',
        display: 'block',
      }
    : {
        whiteSpace: 'nowrap',
        display: 'block',
      };

  return (
    <Tag ref={wrapRef} style={{ ...style, fontSize: size, display: 'block', width: '100%' }}>
      <span ref={measureRef} aria-hidden style={measureStyle}>
        {children}
      </span>
      <span style={{ whiteSpace: multiline ? 'normal' : 'nowrap', display: 'block' }}>{children}</span>
    </Tag>
  );
}
