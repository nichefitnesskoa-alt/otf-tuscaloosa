import { cn } from '@/lib/utils';

export function BulletControl({ value, onChange, label }: { value: 0 | 1 | 2 | undefined; onChange: (v: 0 | 1 | 2) => void; label: string }) {
  const opts: { v: 0 | 1 | 2; lbl: string; cls: string }[] = [
    { v: 0, lbl: 'Missed',   cls: 'bg-destructive text-white border-destructive' },
    { v: 1, lbl: 'Partial',  cls: 'bg-warning text-white border-warning' },
    { v: 2, lbl: 'Hit',      cls: 'bg-success text-white border-success' },
  ];
  return (
    <div className="space-y-1.5">
      <p className="text-xs leading-tight">{label}</p>
      <div className="flex gap-1.5">
        {opts.map(o => (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            className={cn(
              'flex-1 rounded-md border text-xs font-semibold transition-colors cursor-pointer',
              value === o.v
                ? o.cls
                : 'bg-background text-muted-foreground border-input hover:bg-muted'
            )}
            style={{ minHeight: '36px' }}
          >
            {o.lbl}
          </button>
        ))}
      </div>
    </div>
  );
}
