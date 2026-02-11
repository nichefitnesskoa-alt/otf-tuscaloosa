const MERGE_FIELDS = [
  { field: '{first-name}', desc: "Client's first name" },
  { field: '{last-name}', desc: "Client's last name" },
  { field: '{sa-name}', desc: 'Logged-in SA name' },
  { field: '{day}', desc: 'Class day (e.g. Tuesday)' },
  { field: '{time}', desc: 'Class time (e.g. 5:30 PM)' },
  { field: '{today/tomorrow}', desc: 'Smart: today/tomorrow/day name' },
  { field: '{questionnaire-link}', desc: 'Auto-generated questionnaire link' },
  { field: '{friend-questionnaire-link}', desc: '2nd questionnaire link' },
  { field: '{location-name}', desc: 'Studio location name' },
  { field: '{specific-thing}', desc: 'Manual: objection detail' },
  { field: '{x}', desc: "Manual: coach's recommended frequency" },
];

interface MergeFieldReferenceProps {
  onInsert?: (field: string) => void;
}

export function MergeFieldReference({ onInsert }: MergeFieldReferenceProps) {
  return (
    <div className="rounded-lg border bg-muted/50 p-3 space-y-1.5">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Merge Fields</p>
      <div className="space-y-1">
        {MERGE_FIELDS.map((mf) => (
          <button
            key={mf.field}
            type="button"
            onClick={() => onInsert?.(mf.field)}
            className="flex items-start gap-2 w-full text-left hover:bg-muted rounded px-1.5 py-0.5 transition-colors"
          >
            <code className="text-[11px] font-mono text-primary shrink-0">{mf.field}</code>
            <span className="text-[11px] text-muted-foreground">{mf.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
