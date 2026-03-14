'use client';
import type { DataMode } from '@/types';

interface DataModeToggleProps {
  mode: DataMode;
  onChange: (mode: DataMode) => void;
  pastCount: number;
  projCount: number;
}

const OPTIONS: { value: DataMode; label: string; short: string }[] = [
  { value: 'past', label: 'Past Stats', short: 'Past' },
  { value: 'both', label: 'Both (default)', short: 'Both' },
  { value: 'projections', label: 'Projections', short: 'Proj' },
];

export default function DataModeToggle({ mode, onChange, pastCount, projCount }: DataModeToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[var(--text-dim)] font-mono shrink-0">Data:</span>
      <div className="flex gap-0.5 p-0.5 rounded-lg bg-[var(--navy-2)] border border-[var(--border)]">
        {OPTIONS.map(({ value, short }) => {
          const disabled = (value === 'past' && pastCount === 0) || (value === 'projections' && projCount === 0) || (value === 'both' && pastCount === 0 && projCount === 0);
          return (
            <button
              key={value}
              onClick={() => !disabled && onChange(value)}
              disabled={disabled}
              title={disabled ? 'No data uploaded for this mode' : undefined}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                mode === value
                  ? 'accent-bg text-[var(--navy)] font-semibold'
                  : disabled
                  ? 'text-[var(--muted)] cursor-not-allowed'
                  : 'text-[var(--text-dim)] hover:text-[var(--text)]'
              }`}
            >
              {short}
            </button>
          );
        })}
      </div>
    </div>
  );
}
