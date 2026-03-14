'use client';
import FileUploadZone from '@/components/upload/FileUploadZone';
import { useBaseballStore } from '@/store/useBaseballStore';

export default function UploadPage() {
  const { clearPlayers } = useBaseballStore();

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-5xl tracking-widest text-[var(--text)]">UPLOAD DATA</h1>
          <p className="text-[var(--text-dim)] text-sm mt-1">
            Upload past stats and future projections separately. Analysis pages let you toggle between them.
          </p>
        </div>
        <button
          onClick={() => { if (window.confirm('Clear all player data?')) clearPlayers(); }}
          className="shrink-0 text-xs border border-red-500/50 text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-900/20 transition-colors mt-2">
          Clear All Data
        </button>
      </div>
      <FileUploadZone />
    </div>
  );
}
