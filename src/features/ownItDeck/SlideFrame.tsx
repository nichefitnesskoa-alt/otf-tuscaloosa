/**
 * Common slide chrome: header (deck title + slide N/total) and footer.
 */
import type { ReactNode } from 'react';

export function SlideFrame({
  kicker,
  title,
  slideNum,
  total,
  children,
  footer,
}: {
  kicker?: string;
  title: string;
  slideNum: number;
  total: number;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div style={{
      position: 'absolute', inset: 0, padding: '60px 96px',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        borderBottom: '2px solid #FF6F0D', paddingBottom: 22, marginBottom: 40,
      }}>
        <div>
          {kicker && (
            <div style={{
              fontSize: 22, letterSpacing: '0.14em', textTransform: 'uppercase',
              color: '#FF6F0D', fontWeight: 700, marginBottom: 12,
            }}>{kicker}</div>
          )}
          <h1 style={{
            fontSize: 88, lineHeight: 1.02, letterSpacing: '-0.04em',
            fontWeight: 900, margin: 0, color: '#FDF7EA',
          }}>{title}</h1>
        </div>
        <div style={{ fontSize: 24, color: '#D7D7D7', opacity: 0.7, fontWeight: 700, whiteSpace: 'nowrap' }}>
          {slideNum} / {total}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {children}
      </div>

      {/* Footer */}
      <div style={{
        marginTop: 24, paddingTop: 20, borderTop: '1px solid #D7D7D720',
        display: 'flex', justifyContent: 'space-between',
        fontSize: 20, color: '#D7D7D7', opacity: 0.55,
      }}>
        <span>Own It — OTF Tuscaloosa</span>
        <span>{footer}</span>
      </div>
    </div>
  );
}

export const SlideStyles = {
  bigStat: {
    fontSize: 220, lineHeight: 1, fontWeight: 900, letterSpacing: '-0.05em',
    color: '#FDF7EA',
  } as const,
  statLabel: {
    fontSize: 28, letterSpacing: '0.1em', textTransform: 'uppercase',
    color: '#D7D7D7', opacity: 0.7, fontWeight: 700, marginBottom: 12,
  } as const,
  body: { fontSize: 32, lineHeight: 1.28, color: '#FDF7EA' } as const,
  bodySm: { fontSize: 24, lineHeight: 1.28, color: '#FDF7EA' } as const,
  orange: '#FF6F0D',
  success: '#34D399',
  danger: '#EF4444',
  warning: '#FBBF24',
};
