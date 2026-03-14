'use client';
import { useMemo, useState } from 'react';
import { useBasketballStore } from '@/store/useBasketballStore';
import { computeRankings, computeTeamProjections } from '@/utils/rankings';
import { getNextBestAvailable } from '@/utils/draftEngine';
import { BASKETBALL_POSITIONS, BASKETBALL_CATEGORY_LABELS } from '@/utils/constants';
import StatTable from '@/components/shared/StatTable';
import GlowCard from '@/components/shared/GlowCard';
import ProgressBar from '@/components/shared/ProgressBar';
import CategoryRadar from '@/components/shared/CategoryRadar';
import NextBestAvailable from './NextBestAvailable';
import type { Player, RankedPlayer, BasketballCategory } from '@/types';

export default function BasketballDraftMode() {
  const {
    players, myTeam, draftPlayer, undoLastPick, resetDraft,
    currentPick, leagueSettings, selectedCategories, categoryWeights,
    allTeams, setTeamPick, removeTeamPick, teamNames, setTeamNames,
    positionFilter, setPositionFilter,
  } = useBasketballStore();

  const [tab, setTab] = useState<'my' | 'track'>('my');
  const [search, setSearch] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [playerSearch2, setPlayerSearch2] = useState('');
  const [selectedPlayer2, setSelectedPlayer2] = useState<Player | null>(null);

  const myTeamPlayers = myTeam.map((p) => p.player);
  const draftedIds = new Set(myTeamPlayers.map((p) => p.id));
  const allDraftedIds = new Set([
    ...myTeamPlayers.map((p) => p.id),
    ...Object.values(allTeams).flatMap((picks) => picks.map((p) => p.player.id)),
  ]);

  const availablePlayers = useMemo(
    () => players.filter((p) => !allDraftedIds.has(p.id)),
    [players, myTeam, allTeams]
  );

  const ranked = useMemo(() => {
    if (availablePlayers.length === 0) return [];
    return computeRankings(availablePlayers, selectedCategories, categoryWeights, 'basketball');
  }, [availablePlayers, selectedCategories, categoryWeights]);

  const filtered = useMemo(() => {
    let list = ranked;
    if (positionFilter !== 'ALL') list = list.filter((p) => p.positions.some((pos) => pos === positionFilter));
    if (search.trim()) list = list.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [ranked, positionFilter, search]);

  const recs = useMemo(() => {
    if (availablePlayers.length === 0 || players.length === 0) return [];
    return getNextBestAvailable(myTeamPlayers, availablePlayers, selectedCategories, categoryWeights, players);
  }, [myTeamPlayers, availablePlayers, selectedCategories, categoryWeights, players]);

  const teamProjections = useMemo(() => {
    if (myTeamPlayers.length === 0 || players.length === 0) return [];
    return computeTeamProjections(myTeamPlayers, players, selectedCategories, 'basketball');
  }, [myTeamPlayers, players, selectedCategories]);

  const currentWins = teamProjections.filter((p) => p.winning).length;

  const radarData = teamProjections.map((tp) => ({
    category: tp.category,
    value: tp.leagueAverage > 0 ? (tp.projection / tp.leagueAverage) * 100 : 0,
    fullMark: 150,
  }));

  const handleDraft = (player: RankedPlayer) => {
    draftPlayer(player, currentPick + 1);
  };

  const handleDraftById = (playerId: string) => {
    const player = players.find((p) => p.id === playerId);
    if (player) draftPlayer(player, currentPick + 1);
  };

  const columns = useMemo(() => [
    { key: 'name', label: 'Player', format: (_: unknown, p: RankedPlayer) =>
      <span className="font-medium text-[var(--text)]">{p.name}</span> },
    { key: 'positions', label: 'Pos', format: (_: unknown, p: RankedPlayer) =>
      <span className="text-xs accent-text font-mono">{p.positions.join(', ')}</span> },
    { key: 'team', label: 'Team', format: (_: unknown, p: RankedPlayer) =>
      <span className="text-xs text-[var(--text-dim)]">{p.team}</span> },
    ...selectedCategories.slice(0, 5).map((cat) => ({
      key: `stats.${cat}`,
      label: cat,
      format: (_: unknown, p: RankedPlayer) => {
        const v = p.stats[cat];
        if (v === undefined) return '—';
        return ['FG%', 'FT%'].includes(cat) ? `${(v * 100).toFixed(1)}%` : v.toFixed(1);
      },
    })),
  ], [selectedCategories]);

  if (players.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="text-5xl mb-4">🏀</div>
        <h2 className="text-xl font-semibold text-[var(--text)] mb-2">No Player Data</h2>
        <a href="/upload" className="mt-2 px-6 py-2.5 rounded-xl accent-bg text-[var(--navy)] font-semibold text-sm">Upload Data →</a>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-5xl tracking-widest text-[var(--text)]">DRAFT MODE</h1>
        <p className="text-[var(--text-dim)] text-sm mt-1">
          Snake draft · Punt adjustments auto-detected · Target 5/9 category wins
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-[var(--navy-2)] border border-[var(--border)] w-fit">
        {[{ key: 'my', label: 'My Draft', icon: '⚡' }, { key: 'track', label: 'Track Draft', icon: '📋' }].map(({ key, label, icon }) => (
          <button key={key} onClick={() => setTab(key as 'my' | 'track')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              tab === key ? 'accent-bg text-[var(--navy)] font-semibold' : 'text-[var(--text-dim)] hover:text-[var(--text)]'
            }`}>
            {icon} {label}
          </button>
        ))}
      </div>

      {tab === 'my' ? (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
          {/* Left: NBA recs + team info */}
          <div className="xl:col-span-1 space-y-4">
            {/* Win tracker */}
            <GlowCard padding={false} hover={false} className="p-4">
              <div className="text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">Projected Wins</div>
              <div className="text-3xl font-display tracking-wider accent-text">{currentWins}<span className="text-lg text-[var(--text-dim)]">/9</span></div>
              <div className="text-xs text-[var(--text-dim)] mt-1">Pick {currentPick + 1} · {myTeamPlayers.length} drafted</div>
            </GlowCard>

            {/* Category bars */}
            {teamProjections.length > 0 && (
              <GlowCard className="space-y-2.5">
                <div className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]">Category Coverage</div>
                {teamProjections.map((tp) => (
                  <ProgressBar
                    key={tp.category}
                    label={tp.category}
                    value={tp.leagueAverage > 0 ? (tp.projection / tp.leagueAverage) * 100 : 0}
                    max={150}
                    winning={tp.winning}
                    format={(v) => `${v.toFixed(0)}% of avg`}
                  />
                ))}
              </GlowCard>
            )}

            {/* Radar */}
            {radarData.length > 0 && (
              <GlowCard>
                <CategoryRadar data={radarData} color="var(--electric)" title="Team vs League Avg" />
              </GlowCard>
            )}

            {/* My picks */}
            <GlowCard className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]">My Roster</div>
                <div className="flex gap-2">
                  <button onClick={undoLastPick} className="text-xs text-[var(--text-dim)] hover:underline">Undo</button>
                  <button onClick={resetDraft} className="text-xs text-[var(--danger)] hover:underline">Reset</button>
                </div>
              </div>
              {myTeam.length === 0 ? (
                <p className="text-xs text-[var(--text-dim)] py-2 text-center">No picks yet.</p>
              ) : (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {myTeam.map(({ player, pickNumber }, i) => (
                    <div key={player.id} className="flex items-center justify-between py-1 border-b border-[var(--border)] last:border-0">
                      <div>
                        <span className="text-xs font-mono text-[var(--text-dim)] mr-1.5">#{pickNumber}</span>
                        <span className="text-xs text-[var(--text)]">{player.name}</span>
                      </div>
                      <span className="text-[10px] font-mono accent-text">{player.positions.join('/')}</span>
                    </div>
                  ))}
                </div>
              )}
            </GlowCard>
          </div>

          {/* Center: NBA recs */}
          <div className="xl:col-span-1">
            <GlowCard className="h-full">
              <NextBestAvailable recs={recs} currentWins={currentWins} onDraft={handleDraftById} />
            </GlowCard>
          </div>

          {/* Right: player table */}
          <div className="xl:col-span-2 space-y-3">
            <div className="flex items-center gap-3">
              <input type="text" placeholder="Search players..."
                value={search} onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-[var(--navy-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted)]" />
              <select value={positionFilter} onChange={(e) => setPositionFilter(e.target.value)}
                className="bg-[var(--navy-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none">
                <option value="ALL">All Pos</option>
                {BASKETBALL_POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <StatTable players={filtered} columns={columns} draftedIds={draftedIds} onDraft={handleDraft} showRank maxHeight="620px" />
          </div>
        </div>
      ) : (
        /* Track Draft Tab */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <GlowCard className="space-y-4">
            <div>
              <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)] mb-2">Teams</h3>
              <div className="flex gap-2 mb-3">
                <input type="text" placeholder="Team name..."
                  value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { const n = newTeamName.trim(); if (n && !teamNames.includes(n)) { setTeamNames([...teamNames, n]); setNewTeamName(''); }}}}
                  className="flex-1 bg-[var(--navy-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted)]" />
                <button onClick={() => { const n = newTeamName.trim(); if (n && !teamNames.includes(n)) { setTeamNames([...teamNames, n]); setNewTeamName(''); }}}
                  className="px-3 py-2 rounded-lg accent-bg text-[var(--navy)] text-sm font-semibold">Add</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {teamNames.map((name) => (
                  <button key={name} onClick={() => setSelectedTeam(name === selectedTeam ? null : name)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
                      selectedTeam === name ? 'accent-bg text-[var(--navy)] border-transparent' : 'border-[var(--border)] text-[var(--text-dim)]'
                    }`}>
                    {name} ({(allTeams[name] ?? []).length})
                  </button>
                ))}
              </div>
            </div>

            {selectedTeam && (
              <div>
                <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)] mb-2">Log Pick: <span className="accent-text">{selectedTeam}</span></h3>
                <div className="space-y-2">
                  <div className="relative">
                    <input type="text" placeholder="Search player..."
                      value={playerSearch2} onChange={(e) => { setPlayerSearch2(e.target.value); setSelectedPlayer2(null); }}
                      className="w-full bg-[var(--navy-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted)]" />
                    {playerSearch2 && !selectedPlayer2 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--card-2)] border border-[var(--border)] rounded-lg z-20 max-h-40 overflow-y-auto">
                        {players.filter((p) => !allDraftedIds.has(p.id) && p.name.toLowerCase().includes(playerSearch2.toLowerCase())).slice(0, 15).map((p) => (
                          <div key={p.id} onClick={() => { setSelectedPlayer2(p); setPlayerSearch2(p.name); }}
                            className="px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--navy-2)] cursor-pointer">
                            {p.name} <span className="text-xs text-[var(--text-dim)]">({p.positions.join('/')})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={() => { if (selectedTeam && selectedPlayer2) { setTeamPick(selectedTeam, { player: selectedPlayer2 }); setSelectedPlayer2(null); setPlayerSearch2(''); }}}
                    disabled={!selectedPlayer2}
                    className="w-full py-2 rounded-lg accent-bg text-[var(--navy)] text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed">
                    Log Pick
                  </button>
                </div>
              </div>
            )}
          </GlowCard>

          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            {teamNames.length === 0 ? (
              <div className="col-span-2 flex flex-col items-center justify-center py-16 text-[var(--text-dim)] text-sm">
                <div className="text-3xl mb-2">👥</div>
                <p>Add teams to start tracking.</p>
              </div>
            ) : teamNames.map((name) => {
              const picks = allTeams[name] ?? [];
              return (
                <GlowCard key={name} padding={false} hover={false} className="overflow-hidden">
                  <div className="px-4 py-3 border-b border-[var(--border)] flex justify-between">
                    <div className="text-sm font-semibold text-[var(--text)]">{name}</div>
                    <div className="text-xs text-[var(--text-dim)]">{picks.length} picks</div>
                  </div>
                  <div className="divide-y divide-[var(--border)] max-h-48 overflow-y-auto">
                    {picks.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-[var(--text-dim)]">No picks yet.</div>
                    ) : picks.map(({ player }) => (
                      <div key={player.id} className="flex items-center justify-between px-4 py-2 group">
                        <div>
                          <span className="text-sm text-[var(--text)]">{player.name}</span>
                          <span className="text-xs text-[var(--text-dim)] ml-1">({player.positions.join('/')})</span>
                        </div>
                        <button onClick={() => removeTeamPick(name, player.id)}
                          className="text-xs text-[var(--danger)] opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                      </div>
                    ))}
                  </div>
                </GlowCard>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
