/**
 * DrillOverlay — fullscreen (within scaled 1920x1080 canvas) drilldown panel.
 * Shown when a stat is clicked or the D key is pressed.
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

type DrillContextValue = {
  open: (node: ReactNode) => void;
  close: () => void;
  isOpen: boolean;
};

const DrillContext = createContext<DrillContextValue | null>(null);

export function useDrill() {
  const ctx = useContext(DrillContext);
  if (!ctx) throw new Error('useDrill must be used inside DrillProvider');
  return ctx;
}

export function DrillProvider({ children, defaultDrill }: {
  children: ReactNode;
  defaultDrill?: ReactNode;
}) {
  const [node, setNode] = useState<ReactNode | null>(null);
  const open = useCallback((n: ReactNode) => setNode(n), []);
  const close = useCallback(() => setNode(null), []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'd' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        if (node) close();
        else if (defaultDrill) open(defaultDrill);
      } else if (e.key === 'Escape' && node) {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [node, open, close, defaultDrill]);

  return (
    <DrillContext.Provider value={{ open, close, isOpen: !!node }}>
      {children}
      {node && (
        <div
          style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.92)',
            zIndex: 10, padding: '80px 96px', display: 'flex', flexDirection: 'column',
          }}
          onClick={close}
        >
          <div
            style={{ flex: 1, minHeight: 0, overflow: 'auto', color: '#FDF7EA' }}
            onClick={e => e.stopPropagation()}
          >
            {node}
          </div>
          <button
            onClick={close}
            style={{
              position: 'absolute', top: 24, right: 24,
              padding: 12, borderRadius: 12, border: '1px solid #D7D7D740',
              background: 'rgba(0,0,0,0.6)', color: '#FDF7EA', cursor: 'pointer',
            }}
            aria-label="Close drill (Esc)"
          >
            <X style={{ width: 24, height: 24 }} />
          </button>
        </div>
      )}
    </DrillContext.Provider>
  );
}

/** Wraps a stat so clicking it opens the given drill node. */
export function DrillStat({ drill, children, style }: {
  drill: ReactNode;
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  const { open } = useDrill();
  return (
    <button
      type="button"
      onClick={() => open(drill)}
      style={{
        background: 'transparent', border: 'none', padding: 0, margin: 0, cursor: 'pointer',
        textAlign: 'inherit', color: 'inherit', font: 'inherit', ...style,
      }}
      title="Click for details (or press D)"
    >
      {children}
    </button>
  );
}

/** Standard heading + scrollable rows for drill contents. */
export function DrillPanel({ title, subtitle, children }: {
  title: string; subtitle?: string; children: ReactNode;
}) {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{
          fontSize: 22, letterSpacing: '0.14em', textTransform: 'uppercase',
          color: '#FF6F0D', fontWeight: 700, marginBottom: 8,
        }}>Drilldown</div>
        <h2 style={{ fontSize: 60, lineHeight: 1.02, fontWeight: 900, margin: 0, color: '#FDF7EA' }}>{title}</h2>
        {subtitle && <div style={{ fontSize: 22, color: '#D7D7D7', opacity: 0.7, marginTop: 8 }}>{subtitle}</div>}
      </div>
      <div style={{ fontSize: 22, lineHeight: 1.35, color: '#FDF7EA' }}>{children}</div>
    </div>
  );
}
