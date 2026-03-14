'use client';
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { parseFile, normalizeRows, mergeProjectionSources, detectColumnMap } from '@/utils/fileParser';
import { useBaseballStore } from '@/store/useBaseballStore';
import { useBasketballStore } from '@/store/useBasketballStore';
import { useSportStore } from '@/store/useSportStore';
import type { Player } from '@/types';
import ColumnMapper from './ColumnMapper';

interface ParsedSource {
  filename: string;
  headers: string[];
  rows: Record<string, unknown>[];
  detectedMap: Record<string, string>;
  confirmedMap: Record<string, string>;
}

type BucketType = 'past' | 'projections';

interface UploadBucketProps {
  bucketType: BucketType;
  label: string;
  description: string;
  playerCount: number;
  onCommit: (players: Player[]) => void;
  onClear: () => void;
}

function UploadBucket({ bucketType, label, description, playerCount, onCommit, onClear }: UploadBucketProps) {
  const { activeSport } = useSportStore();
  const [sources, setSources] = useState<ParsedSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [committed, setCommitted] = useState(false);
  const [mappingIdx, setMappingIdx] = useState<number | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setLoading(true);
    setError(null);
    setCommitted(false);
    try {
      const newSources: ParsedSource[] = [];
      for (const file of acceptedFiles) {
        const { headers, rows } = await parseFile(file);
        const detectedMap = detectColumnMap(headers, activeSport);
        newSources.push({ filename: file.name, headers, rows, detectedMap, confirmedMap: { ...detectedMap } });
      }
      setSources((prev) => [...prev, ...newSources]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [activeSport]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    multiple: true,
  });

  const updateColumnMap = (idx: number, rawCol: string, canonical: string) => {
    setSources((prev) =>
      prev.map((s, i) =>
        i === idx ? { ...s, confirmedMap: { ...s.confirmedMap, [rawCol]: canonical || '__remove__' } } : s
      )
    );
  };

  const handleCommit = () => {
    const allPlayers = sources.map((src) => normalizeRows(src.rows, src.confirmedMap, activeSport));
    const merged = mergeProjectionSources(allPlayers);
    onCommit(merged);
    setCommitted(true);
  };

  const handleRemoveSource = (idx: number) => {
    setSources((prev) => prev.filter((_, i) => i !== idx));
    setCommitted(false);
  };

  const handleClearAll = () => {
    setSources([]);
    onClear();
    setCommitted(false);
  };

  const accentColor = bucketType === 'past' ? 'var(--accent)' : '#a78bfa';
  const bucketIcon = bucketType === 'past' ? '📈' : '🔮';

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between"
        style={{ background: `color-mix(in srgb, ${accentColor} 6%, transparent)` }}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{bucketIcon}</span>
          <div>
            <h3 className="font-semibold text-[var(--text)]">{label}</h3>
            <p className="text-xs text-[var(--text-dim)]">{description}</p>
          </div>
        </div>
        {playerCount > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono px-2 py-1 rounded-lg"
              style={{ color: accentColor, background: `color-mix(in srgb, ${accentColor} 12%, transparent)` }}>
              {playerCount} players loaded
            </span>
            <button onClick={handleClearAll} className="text-xs text-[var(--danger)] hover:underline">
              Clear
            </button>
          </div>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* Drop zone */}
        <div
          {...getRootProps()}
          className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 ${
            isDragActive ? 'border-[var(--accent)] bg-[var(--accent-dim)]' : 'border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--accent-dim)]'
          }`}
        >
          <input {...getInputProps()} />
          <div className="space-y-2">
            <div className="text-3xl">{isDragActive ? '📂' : '📁'}</div>
            <div>
              <p className="text-[var(--text)] font-semibold text-sm">
                {isDragActive ? 'Drop to upload' : 'Drop files here or click to browse'}
              </p>
              <p className="text-xs text-[var(--text-dim)] mt-0.5">CSV or Excel — multiple files will be averaged</p>
            </div>
            {loading && (
              <div className="flex items-center justify-center gap-2 text-xs text-[var(--text-dim)]">
                <div className="w-3 h-3 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                Parsing…
              </div>
            )}
            {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
          </div>
        </div>

        {/* Uploaded files */}
        {sources.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]">
                {sources.length} file{sources.length > 1 ? 's' : ''} loaded
              </span>
              {sources.length > 1 && (
                <button onClick={handleClearAll} className="text-xs text-[var(--danger)] hover:underline">
                  Clear all
                </button>
              )}
            </div>

            {sources.map((src, idx) => (
              <div key={idx} className="rounded-lg border border-[var(--border)] overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--border)]">
                  <div>
                    <div className="text-xs font-medium text-[var(--text)]">{src.filename}</div>
                    <div className="text-xs text-[var(--text-dim)]">
                      {src.rows.length} rows · {Object.keys(src.confirmedMap).length} mapped cols
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setMappingIdx(mappingIdx === idx ? null : idx)}
                      className="text-xs px-2 py-1 rounded border border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
                    >
                      {mappingIdx === idx ? 'Hide' : 'Columns'}
                    </button>
                    <button onClick={() => handleRemoveSource(idx)} className="text-xs text-[var(--danger)] hover:underline">
                      ✕
                    </button>
                  </div>
                </div>
                {mappingIdx === idx && (
                  <div className="p-3">
                    <ColumnMapper
                      headers={src.headers}
                      columnMap={src.confirmedMap}
                      onChange={(raw, canonical) => updateColumnMap(idx, raw, canonical)}
                    />
                  </div>
                )}
              </div>
            ))}

            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-[var(--text-dim)]">
                {sources.length > 1 ? `${sources.length} files will be averaged per player.` : 'Stats loaded from this file.'}
              </p>
              <button
                onClick={handleCommit}
                className="px-4 py-2 rounded-lg font-semibold text-sm accent-bg text-[var(--navy)] hover:opacity-90 transition-opacity"
              >
                {committed ? '✓ Loaded' : 'Load Data'}
              </button>
            </div>

            {committed && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[var(--accent-dim)] border border-[var(--accent)] border-opacity-30">
                <span className="text-[var(--accent)] text-sm">✓</span>
                <p className="text-xs text-[var(--accent)]">{playerCount} players loaded from {label.toLowerCase()}.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function FileUploadZone() {
  const { activeSport } = useSportStore();
  const baseballStore = useBaseballStore();
  const basketballStore = useBasketballStore();
  const store = activeSport === 'baseball' ? baseballStore : basketballStore;

  const pastCount = store.pastPlayers.length;
  const projCount = store.projectionPlayers.length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <UploadBucket
          bucketType="past"
          label="Past Stats"
          description="Historical stats from last season or year-to-date"
          playerCount={pastCount}
          onCommit={(players) => store.setPastPlayers(players)}
          onClear={() => store.clearPastPlayers()}
        />
        <UploadBucket
          bucketType="projections"
          label="Future Projections"
          description="Projected stats for the upcoming season"
          playerCount={projCount}
          onCommit={(players) => store.setProjectionPlayers(players)}
          onClear={() => store.clearProjectionPlayers()}
        />
      </div>

      {/* Status summary */}
      {(pastCount > 0 || projCount > 0) && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--navy-2)] border border-[var(--border)]">
          <span className="text-[var(--accent)] text-lg">✓</span>
          <div className="flex-1">
            <p className="text-sm text-[var(--text)] font-medium">
              {store.players.length} players ready
            </p>
            <p className="text-xs text-[var(--text-dim)]">
              {pastCount > 0 && projCount > 0
                ? `Past stats (${pastCount}) + projections (${projCount}) merged — toggle data mode on analysis pages.`
                : pastCount > 0
                ? `${pastCount} players from past stats.`
                : `${projCount} players from projections.`}
            </p>
          </div>
          <a href={`/${activeSport}/analysis`}
            className="px-4 py-2 rounded-lg font-semibold text-sm accent-bg text-[var(--navy)] hover:opacity-90 shrink-0">
            Analyze →
          </a>
        </div>
      )}

      {/* Instructions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: '1', title: 'Upload Files', desc: 'Upload past stats and/or future projections. Use both for the best rankings.' },
          { icon: '2', title: 'Map Columns', desc: 'We auto-detect stat columns. Review and correct any mappings before confirming.' },
          { icon: '3', title: 'Toggle Mode', desc: 'On analysis pages, switch between Past, Projections, or Both data modes.' },
        ].map((step) => (
          <div key={step.icon} className="flex gap-3 p-4 rounded-xl bg-[var(--navy-2)] border border-[var(--border)]">
            <div className="w-7 h-7 rounded-full accent-bg flex items-center justify-center text-xs font-bold text-[var(--navy)] shrink-0">
              {step.icon}
            </div>
            <div>
              <div className="text-sm font-semibold text-[var(--text)] mb-0.5">{step.title}</div>
              <div className="text-xs text-[var(--text-dim)]">{step.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
