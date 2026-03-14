'use client';
import { useState } from 'react';
import MyDraft from './MyDraft';
import TrackDraft from './TrackDraft';

export default function BaseballDraftMode() {
  const [tab, setTab] = useState<'my' | 'track'>('my');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-5xl tracking-widest text-[var(--text)]">DRAFT MODE</h1>
        <p className="text-[var(--text-dim)] text-sm mt-1">
          Values auto-adjust as your team builds — punt strategy detected automatically.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-[var(--navy-2)] border border-[var(--border)] w-fit">
        {[
          { key: 'my', label: 'My Draft', icon: '⚡' },
          { key: 'track', label: 'Track Draft', icon: '📋' },
        ].map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setTab(key as 'my' | 'track')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              tab === key
                ? 'accent-bg text-[var(--navy)] font-semibold'
                : 'text-[var(--text-dim)] hover:text-[var(--text)]'
            }`}
          >
            <span>{icon}</span>{label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="animate-fade-up">
        {tab === 'my' ? <MyDraft /> : <TrackDraft />}
      </div>
    </div>
  );
}
