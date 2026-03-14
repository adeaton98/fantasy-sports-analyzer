'use client';
import { STAT_COLUMN_ALIASES } from '@/utils/constants';

const ALL_CANONICAL = Object.keys(STAT_COLUMN_ALIASES);

interface ColumnMapperProps {
  headers: string[];
  columnMap: Record<string, string>;
  onChange: (rawCol: string, canonical: string) => void;
}

export default function ColumnMapper({ headers, columnMap, onChange }: ColumnMapperProps) {
  return (
    <div>
      <div className="text-xs text-[var(--text-dim)] mb-3">
        Auto-detected column mappings. Override any incorrect ones using the dropdowns.
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
        {headers.map((header) => {
          const mapped = columnMap[header];
          const isDetected = Boolean(mapped);
          return (
            <div key={header}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--navy-2)] border border-[var(--border)]">
              <div className="flex-1 min-w-0">
                <div className="text-xs text-[var(--text-dim)] truncate font-mono">{header}</div>
              </div>
              <span className="text-[var(--text-dim)] text-xs">→</span>
              <select
                value={mapped ?? ''}
                onChange={(e) => onChange(header, e.target.value)}
                className="text-xs bg-[var(--card)] border border-[var(--border)] rounded px-2 py-1 text-[var(--text)] outline-none"
                style={{ minWidth: 70 }}
              >
                <option value="">skip</option>
                {ALL_CANONICAL.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {isDetected && (
                <span className="text-[8px] font-mono px-1 rounded accent-bg text-[var(--navy)] shrink-0">AUTO</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
