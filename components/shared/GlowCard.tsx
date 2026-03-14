import { ReactNode } from 'react';

interface GlowCardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
  padding?: boolean;
}

export default function GlowCard({ children, className = '', onClick, hover = true, padding = true }: GlowCardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        rounded-xl bg-[var(--card)] border border-[var(--border)]
        ${hover ? 'glow-card' : ''}
        ${onClick ? 'cursor-pointer' : ''}
        ${padding ? 'p-5' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
