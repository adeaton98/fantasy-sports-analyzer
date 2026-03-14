interface RankBadgeProps {
  rank: number;
  size?: 'sm' | 'md' | 'lg';
}

export default function RankBadge({ rank, size = 'md' }: RankBadgeProps) {
  const sizeMap = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-11 h-11 text-base',
  };

  const isTop = rank <= 3;
  const colors = ['', '#f5c542', '#94a3b8', '#cd7f32']; // gold, silver, bronze

  return (
    <div
      className={`
        ${sizeMap[size]} rounded-full flex items-center justify-center
        font-mono font-bold animate-rank-pop shrink-0
        ${isTop ? 'text-[var(--navy)]' : 'text-[var(--text-dim)] bg-[var(--navy-2)] border border-[var(--border)]'}
      `}
      style={isTop ? { background: colors[rank], boxShadow: `0 0 12px ${colors[rank]}66` } : {}}
    >
      {rank}
    </div>
  );
}
