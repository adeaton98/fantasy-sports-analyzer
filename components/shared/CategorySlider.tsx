'use client';

interface CategorySliderProps {
  category: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

export default function CategorySlider({
  category, label, value, onChange, min = 0, max = 3, step = 0.25,
}: CategorySliderProps) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="flex items-center gap-3">
      <div className="w-28 shrink-0">
        <div className="text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider">{category}</div>
        <div className="text-xs text-[var(--text)] truncate">{label}</div>
      </div>
      <div className="flex-1 relative">
        <div className="relative h-3 flex items-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full h-[3px] rounded-full bg-[var(--border)]" />
            <div
              className="absolute h-[3px] rounded-full transition-all duration-200"
              style={{ width: `${pct}%`, background: 'var(--accent)' }}
            />
          </div>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="w-full relative z-10 opacity-0 cursor-pointer h-3"
          />
        </div>
      </div>
      <div className="w-12 text-right">
        <span className="text-sm font-mono font-medium accent-text">{value.toFixed(2)}×</span>
      </div>
    </div>
  );
}
