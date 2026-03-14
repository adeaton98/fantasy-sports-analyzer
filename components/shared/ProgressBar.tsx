interface ProgressBarProps {
  label: string;
  value: number;
  max?: number;
  winning?: boolean;
  showValue?: boolean;
  format?: (v: number) => string;
}

export default function ProgressBar({ label, value, max = 100, winning, showValue = true, format }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, max > 0 ? (value / max) * 100 : 0));
  const displayVal = format ? format(value) : typeof value === 'number' ? value.toFixed(1) : value;

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider">{label}</span>
        {showValue && (
          <span className={`text-xs font-mono font-medium ${winning !== undefined ? (winning ? 'text-[var(--neon)]' : 'text-[var(--danger)]') : 'text-[var(--text)]'}`}>
            {displayVal}
          </span>
        )}
      </div>
      <div className="h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: winning === undefined
              ? 'var(--accent)'
              : winning
              ? 'var(--neon)'
              : 'var(--danger)',
          }}
        />
      </div>
    </div>
  );
}
