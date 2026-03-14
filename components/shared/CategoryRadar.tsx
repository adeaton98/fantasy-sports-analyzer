'use client';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts';

interface RadarDataPoint {
  category: string;
  value: number;
  fullMark: number;
}

interface CategoryRadarProps {
  data: RadarDataPoint[];
  color?: string;
  title?: string;
}

export default function CategoryRadar({ data, color = 'var(--neon)', title }: CategoryRadarProps) {
  return (
    <div className="w-full">
      {title && (
        <div className="text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-2">{title}</div>
      )}
      <ResponsiveContainer width="100%" height={220}>
        <RadarChart data={data}>
          <PolarGrid stroke="rgba(255,255,255,0.06)" />
          <PolarAngleAxis
            dataKey="category"
            tick={{ fill: 'var(--text-dim)', fontSize: 10, fontFamily: 'JetBrains Mono' }}
          />
          <Radar
            dataKey="value"
            stroke={color}
            fill={color}
            fillOpacity={0.15}
            strokeWidth={2}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--card-2)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
              fontFamily: 'JetBrains Mono',
            }}
            labelStyle={{ color: 'var(--text)' }}
            itemStyle={{ color }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
