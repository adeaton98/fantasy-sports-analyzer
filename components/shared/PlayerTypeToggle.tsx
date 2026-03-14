'use client';
type PlayerType = 'all' | 'batters' | 'pitchers';
interface Props {
  value: PlayerType;
  onChange: (v: PlayerType) => void;
}
export default function PlayerTypeToggle({ value, onChange }: Props) {
  const options: { value: PlayerType; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'batters', label: 'Batters' },
    { value: 'pitchers', label: 'Pitchers' },
  ];
  return (
    <div className="flex rounded-lg overflow-hidden border border-[var(--border)]">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 text-xs font-mono transition-colors ${
            value === opt.value
              ? 'accent-bg text-[var(--navy)] font-semibold'
              : 'bg-[var(--navy-2)] text-[var(--text-dim)] hover:text-[var(--text)]'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
