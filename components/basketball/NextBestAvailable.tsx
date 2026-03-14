'use client';
import type { NBARec } from '@/utils/draftEngine';

interface NextBestAvailableProps {
  recs: NBARec[];
  currentWins: number;
  onDraft: (playerId: string) => void;
}

export default function NextBestAvailable({ recs, currentWins, onDraft }: NextBestAvailableProps) {
  if (recs.length === 0) {
    return (
      <div className="text-center py-8 text-[var(--text-dim)] text-sm">
        Draft some players first to get recommendations.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]">Next Best Available</div>
        <div className="text-xs font-mono text-[var(--text-dim)]">
          Current: <span className="accent-text font-bold">{currentWins}/9</span> wins
        </div>
      </div>

      {recs.map((rec, i) => {
        const isTop = i === 0;
        const color = isTop ? 'var(--electric)' : 'var(--text-dim)';
        const improves = rec.categoryImpacts.filter((c) => c.impact === 'improves');
        const hurts = rec.categoryImpacts.filter((c) => c.impact === 'hurts');

        return (
          <div
            key={rec.player.id}
            className={`rounded-xl border p-4 transition-all duration-200 ${
              isTop
                ? 'border-[rgba(0,198,255,0.4)] bg-[var(--electric-dim)]'
                : 'border-[var(--border)] bg-[var(--card)] hover:border-[rgba(0,198,255,0.25)]'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                  style={{
                    background: isTop ? 'var(--electric)' : 'var(--border)',
                    color: isTop ? 'var(--navy)' : 'var(--text-dim)',
                  }}
                >
                  {i + 1}
                </div>
                <div>
                  <div className="font-semibold text-[var(--text)] text-sm">{rec.player.name}</div>
                  <div className="text-xs text-[var(--text-dim)] flex items-center gap-2">
                    <span className="font-mono accent-text">{rec.player.positions.join('/')}</span>
                    <span>·</span>
                    <span>{rec.player.team}</span>
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="font-mono font-bold text-lg" style={{ color }}>
                  {rec.projectedWins}/9
                </div>
                <div className="text-xs font-mono" style={{ color: rec.delta > 0 ? 'var(--neon)' : rec.delta < 0 ? 'var(--danger)' : 'var(--text-dim)' }}>
                  {rec.delta > 0 ? `+${rec.delta}` : rec.delta} win{Math.abs(rec.delta) !== 1 ? 's' : ''}
                </div>
              </div>
            </div>

            {/* Category impacts */}
            {(improves.length > 0 || hurts.length > 0 || rec.fgPctDelta !== undefined || rec.ftPctDelta !== undefined) && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {improves.map((c) => (
                  <span key={c.category} className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[rgba(0,255,136,0.1)] text-[var(--neon)] border border-[rgba(0,255,136,0.2)]">
                    ↑ {c.category}
                  </span>
                ))}
                {hurts.map((c) => (
                  <span key={c.category} className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[rgba(255,71,87,0.1)] text-[var(--danger)] border border-[rgba(255,71,87,0.2)]">
                    ↓ {c.category}
                  </span>
                ))}
                {rec.fgPctDelta !== undefined && Math.abs(rec.fgPctDelta) > 0.001 && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${
                    rec.fgPctDelta > 0
                      ? 'bg-[rgba(0,255,136,0.1)] text-[var(--neon)] border-[rgba(0,255,136,0.2)]'
                      : 'bg-[rgba(255,71,87,0.1)] text-[var(--danger)] border-[rgba(255,71,87,0.2)]'
                  }`}>
                    FG% {rec.fgPctDelta > 0 ? '+' : ''}{(rec.fgPctDelta * 100).toFixed(2)}%
                  </span>
                )}
                {rec.ftPctDelta !== undefined && Math.abs(rec.ftPctDelta) > 0.001 && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${
                    rec.ftPctDelta > 0
                      ? 'bg-[rgba(0,255,136,0.1)] text-[var(--neon)] border-[rgba(0,255,136,0.2)]'
                      : 'bg-[rgba(255,71,87,0.1)] text-[var(--danger)] border-[rgba(255,71,87,0.2)]'
                  }`}>
                    FT% {rec.ftPctDelta > 0 ? '+' : ''}{(rec.ftPctDelta * 100).toFixed(2)}%
                  </span>
                )}
              </div>
            )}

            <button
              onClick={() => onDraft(rec.player.id)}
              className={`mt-3 w-full py-1.5 rounded-lg text-xs font-semibold transition-all ${
                isTop
                  ? 'accent-bg text-[var(--navy)] hover:opacity-90'
                  : 'border border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--accent)] hover:text-[var(--text)]'
              }`}
            >
              Draft {rec.player.name}
            </button>
          </div>
        );
      })}
    </div>
  );
}
