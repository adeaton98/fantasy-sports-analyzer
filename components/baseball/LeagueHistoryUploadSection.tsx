'use client';
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  parseCategoryHistoryFile,
  parseDraftRecapFile,
  type SheetParseResult,
  type DraftSheetParseResult,
} from '@/utils/leagueHistoryParser';
import { useLeagueHistoryStore } from '@/store/useLeagueHistoryStore';

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: CURRENT_YEAR - 2019 }, (_, i) => CURRENT_YEAR - i);

// ── Per-sheet year picker row ─────────────────────────────────────────────────
function SheetYearRow({
  sheetName,
  detectedYear,
  year,
  onChange,
}: {
  sheetName: string;
  detectedYear: number | null;
  year: number;
  onChange: (y: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-xs text-[var(--text)] truncate flex-1">{sheetName}</span>
      <div className="flex items-center gap-2 shrink-0">
        {detectedYear && (
          <span className="text-[10px] text-[var(--text-dim)] font-mono">auto-detected</span>
        )}
        <select
          value={year}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="bg-[var(--navy-2)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text)] outline-none"
        >
          {YEAR_OPTIONS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ── Category History sub-bucket ────────────────────────────────────────────────
function CategoryHistoryBucket() {
  const { addCategoryHistory, removeCategoryYear, categoryHistory } = useLeagueHistoryStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState<{ result: SheetParseResult; year: number }[]>([]);

  const onDrop = useCallback(async (files: File[]) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const allPending: { result: SheetParseResult; year: number }[] = [];
      for (const file of files) {
        const results = await parseCategoryHistoryFile(file);
        for (const r of results) {
          allPending.push({ result: r, year: r.detectedYear ?? CURRENT_YEAR });
        }
      }
      setPending(allPending);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    multiple: false,
  });

  const handleConfirm = () => {
    for (const { result, year } of pending) {
      addCategoryHistory(year, result.rows);
    }
    setSuccess(`Loaded ${pending.length} sheet${pending.length > 1 ? 's' : ''}`);
    setPending([]);
  };

  const updatePendingYear = (idx: number, year: number) => {
    setPending((prev) => prev.map((p, i) => i === idx ? { ...p, year } : p));
  };

  return (
    <div className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--navy-2)] overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-2">
        <span className="text-lg">📊</span>
        <div>
          <div className="text-xs font-semibold text-[var(--text)]">Category History</div>
          <div className="text-[10px] text-[var(--text-dim)]">Teams × categories table</div>
        </div>
      </div>
      <div className="p-4 space-y-3">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all text-xs ${
            isDragActive
              ? 'border-[var(--accent)] bg-[var(--accent-dim)]'
              : 'border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--accent-dim)]'
          }`}
        >
          <input {...getInputProps()} />
          {loading
            ? <span className="text-[var(--text-dim)]">Parsing…</span>
            : <span className="text-[var(--text-dim)]">{isDragActive ? 'Drop here' : 'Drop CSV or Excel'}</span>
          }
        </div>

        {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
        {success && <p className="text-xs text-[var(--accent)]">✓ {success}</p>}

        {pending.length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] font-mono text-[var(--text-dim)] uppercase tracking-wider">Confirm year per sheet</div>
            {pending.map((p, i) => (
              <SheetYearRow
                key={i}
                sheetName={p.result.sheetName}
                detectedYear={p.result.detectedYear}
                year={p.year}
                onChange={(y) => updatePendingYear(i, y)}
              />
            ))}
            <button
              onClick={handleConfirm}
              className="w-full mt-2 py-1.5 rounded-lg text-xs font-semibold accent-bg text-[var(--navy)] hover:opacity-90"
            >
              Save
            </button>
          </div>
        )}

        {categoryHistory.length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] font-mono text-[var(--text-dim)] uppercase tracking-wider">Loaded</div>
            {categoryHistory.map((y) => (
              <div key={y.year} className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono accent-text">{y.year}</span>
                <span className="text-[10px] text-[var(--text-dim)]">{y.rows.length} teams</span>
                <button onClick={() => removeCategoryYear(y.year)} className="text-[10px] text-[var(--danger)] hover:underline">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Draft Recap sub-bucket ─────────────────────────────────────────────────────
function DraftRecapBucket() {
  const { addDraftRecap, removeDraftYear, draftRecaps } = useLeagueHistoryStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState<{ result: DraftSheetParseResult; year: number }[]>([]);

  const onDrop = useCallback(async (files: File[]) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const allPending: { result: DraftSheetParseResult; year: number }[] = [];
      for (const file of files) {
        const results = await parseDraftRecapFile(file);
        for (const r of results) {
          allPending.push({ result: r, year: r.detectedYear ?? CURRENT_YEAR });
        }
      }
      if (allPending.length === 0) throw new Error('No draft data found. Check that team names are in row 2.');
      setPending(allPending);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    multiple: false,
  });

  const handleConfirm = () => {
    for (const { result, year } of pending) {
      addDraftRecap(year, result.picks);
    }
    setSuccess(`Loaded ${pending.length} sheet${pending.length > 1 ? 's' : ''}`);
    setPending([]);
  };

  const updatePendingYear = (idx: number, year: number) => {
    setPending((prev) => prev.map((p, i) => i === idx ? { ...p, year } : p));
  };

  return (
    <div className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--navy-2)] overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-2">
        <span className="text-lg">💰</span>
        <div>
          <div className="text-xs font-semibold text-[var(--text)]">Draft Recap</div>
          <div className="text-[10px] text-[var(--text-dim)]">Excel with team headers in row 2</div>
        </div>
      </div>
      <div className="p-4 space-y-3">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all text-xs ${
            isDragActive
              ? 'border-[var(--accent)] bg-[var(--accent-dim)]'
              : 'border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--accent-dim)]'
          }`}
        >
          <input {...getInputProps()} />
          {loading
            ? <span className="text-[var(--text-dim)]">Parsing…</span>
            : <span className="text-[var(--text-dim)]">{isDragActive ? 'Drop here' : 'Drop Excel file'}</span>
          }
        </div>

        {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
        {success && <p className="text-xs text-[var(--accent)]">✓ {success}</p>}

        {pending.length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] font-mono text-[var(--text-dim)] uppercase tracking-wider">Confirm year per sheet</div>
            {pending.map((p, i) => (
              <SheetYearRow
                key={i}
                sheetName={p.result.sheetName}
                detectedYear={p.result.detectedYear}
                year={p.year}
                onChange={(y) => updatePendingYear(i, y)}
              />
            ))}
            <button
              onClick={handleConfirm}
              className="w-full mt-2 py-1.5 rounded-lg text-xs font-semibold accent-bg text-[var(--navy)] hover:opacity-90"
            >
              Save
            </button>
          </div>
        )}

        {draftRecaps.length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] font-mono text-[var(--text-dim)] uppercase tracking-wider">Loaded</div>
            {draftRecaps.map((y) => (
              <div key={y.year} className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono accent-text">{y.year}</span>
                <span className="text-[10px] text-[var(--text-dim)]">{y.picks.length} picks</span>
                <button onClick={() => removeDraftYear(y.year)} className="text-[10px] text-[var(--danger)] hover:underline">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────
export default function LeagueHistoryUploadSection() {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--border)]"
        style={{ background: 'color-mix(in srgb, var(--gold) 6%, transparent)' }}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">⌛</span>
          <div>
            <h3 className="font-semibold text-[var(--text)]">League History</h3>
            <p className="text-xs text-[var(--text-dim)]">Optional — improves category benchmarks and shows historical auction prices</p>
          </div>
        </div>
      </div>
      <div className="p-5">
        <div className="flex gap-4">
          <CategoryHistoryBucket />
          <DraftRecapBucket />
        </div>
      </div>
    </div>
  );
}
