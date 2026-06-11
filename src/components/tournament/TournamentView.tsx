import { useState, useEffect, useRef } from 'react';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { getFirebase, retry } from '../../lib/firebase';
import type { Tournament, Player, GameResult } from '../../lib/types';
import { generateFirstRound, generateNextRound } from '../../lib/swiss-pairing';
import { getPlayerStandings } from '../../lib/tiebreakers';
import { calculateElo } from '../../lib/elo';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import Standings from './Standings';

export default function TournamentView() {
  const [user, setUser] = useState<User | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'players' | 'rounds' | 'standings'>('players');
  const [playerName, setPlayerName] = useState('');
  const [playerRating, setPlayerRating] = useState('0');
  const [expandedRound, setExpandedRound] = useState<number | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const fbRef = useRef<{ auth: Auth; db: Firestore } | null>(null);

  const [showActions, setShowActions] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editPlayerName, setEditPlayerName] = useState('');
  const [editPlayerRating, setEditPlayerRating] = useState('');
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showExportActions, setShowExportActions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const importPanelRef = useRef<HTMLDivElement>(null);
  const [scoringPairing, setScoringPairing] = useState<{ roundIndex: number; pairingIndex: number } | null>(null);

  const tournamentId = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('id')
    : null;

  useEffect(() => {
    getFirebase()
      .then((fb) => {
        fbRef.current = fb;
        return onAuthStateChanged(fb.auth, (u) => setUser(u));
      })
      .catch(console.error);
  }, []);

  const fetchTournament = async () => {
    if (!tournamentId) return;
    setError('');
    try {
      const fb = await getFirebase();
      const snap = await retry(() => getDoc(doc(fb.db, 'tournaments', tournamentId)));
      if (snap.exists()) {
        setTournament({ id: snap.id, ...snap.data() } as Tournament);
      } else {
        setError('This tournament does not exist or has been deleted.');
      }
    } catch (err) {
      console.error('Failed to load tournament:', err);
      setError('Could not load tournament. Check Firestore is enabled and the database exists.');
    }
  };

  useEffect(() => {
    fetchTournament().finally(() => setInitialLoading(false));
  }, [tournamentId]);

  useEffect(() => {
    if (tab === 'players' && tournament?.status !== 'completed') {
      nameInputRef.current?.focus();
    }
  }, [tab, tournament?.players.length, tournament?.status]);

  useEffect(() => {
    if (!showActions) return;
    const handler = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setShowActions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showActions]);

  useEffect(() => {
    if (!showExportMenu) return;
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showExportMenu]);

  useEffect(() => {
    if (!showImport) return;
    const handler = (e: MouseEvent) => {
      if (importPanelRef.current && !importPanelRef.current.contains(e.target as Node)) {
        setShowImport(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showImport]);

  const isOwner = user && tournament?.ownerId === user.uid;

  if (!tournamentId) {
    return (
      <div className="py-16 text-center">
        <p className="text-body">No tournament selected</p>
        <a href="/dashboard" className="mt-4 inline-block text-sm text-link hover:text-link-deep transition-colors">
          Back to dashboard
        </a>
      </div>
    );
  }

  const addPlayer = async () => {
    if (!tournament || !playerName.trim() || tournament.status === 'completed') return;
    const newPlayer: Player = {
      id: crypto.randomUUID(),
      name: playerName.trim(),
      rating: parseInt(playerRating) || 0,
      initialRating: parseInt(playerRating) || 0,
      seed: tournament.players.length + 1,
      colorHistory: [],
    };
    const { db } = await getFirebase();
    await updateDoc(doc(db, 'tournaments', tournamentId), {
      players: [...tournament.players, newPlayer],
    });
    setPlayerName('');
    setPlayerRating('0');
    await fetchTournament();
  };

  const importPlayers = async (jsonText?: string) => {
    if (!tournament) return;
    const text = jsonText ?? importText;
    if (!text.trim()) return;
    try {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) { setError('Invalid format: expected an array'); return; }
      const existing = new Set(tournament.players.map((p) => p.name.toLowerCase()));
      const newPlayers: Player[] = [];
      for (const item of parsed) {
        if (!item.name) continue;
        if (existing.has(item.name.toLowerCase())) continue;
        existing.add(item.name.toLowerCase());
        newPlayers.push({
          id: crypto.randomUUID(),
          name: item.name,
          rating: parseInt(item.rating) || 0,
          initialRating: parseInt(item.rating) || 0,
          seed: tournament.players.length + newPlayers.length + 1,
          colorHistory: [],
        });
      }
      if (newPlayers.length === 0) { setError('No new players to import'); return; }
      const { db } = await getFirebase();
      await updateDoc(doc(db, 'tournaments', tournamentId), {
        players: [...tournament.players, ...newPlayers],
      });
      setImportText('');
      setShowImport(false);
      await fetchTournament();
    } catch {
      setError('Invalid JSON format');
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      importPlayers(text);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const removePlayer = async (playerId: string) => {
    if (!tournament) return;
    const { db } = await getFirebase();
    await updateDoc(doc(db, 'tournaments', tournamentId), {
      players: tournament.players.filter((p) => p.id !== playerId),
    });
    await fetchTournament();
  };

  const startTournament = async () => {
    if (!tournament || tournament.players.length < 2) return;
    try {
      const round1 = generateFirstRound(tournament.players);
      const { db } = await getFirebase();
      await updateDoc(doc(db, 'tournaments', tournamentId), {
        status: 'active',
        currentRound: 1,
        rounds: [round1],
      });
      await fetchTournament();
      setTab('rounds');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Failed to start tournament:', msg);
      setError('Failed to start tournament: ' + msg);
    }
  };

  const nextRound = async () => {
    if (!tournament || tournament.currentRound >= tournament.numberOfRounds) return;
    const round = generateNextRound(tournament.players, tournament.rounds);
    const { db } = await getFirebase();
    await updateDoc(doc(db, 'tournaments', tournamentId), {
      currentRound: tournament.currentRound + 1,
      rounds: [...tournament.rounds, round],
    });
    await fetchTournament();
  };

  const setResult = async (roundIndex: number, pairingIndex: number, result: GameResult) => {
    if (!tournament) return;
    const updatedRounds = [...tournament.rounds];
    const round = { ...updatedRounds[roundIndex] };
    const pairings = [...round.pairings];
    const prevResult = pairings[pairingIndex].result;
    pairings[pairingIndex] = { ...pairings[pairingIndex], result };
    round.pairings = pairings;
    updatedRounds[roundIndex] = round;

    let updatedPlayers = tournament.players;
    if (result && prevResult !== result) {
      const pairing = tournament.rounds[roundIndex].pairings[pairingIndex];
      const whitePlayer = tournament.players.find((p) => p.id === pairing.white);
      const blackPlayer = tournament.players.find((p) => p.id === pairing.black);
      if (whitePlayer && blackPlayer) {
        let scoreA: number;
        if (result === '1-0') scoreA = 1;
        else if (result === '0-1') scoreA = 0;
        else scoreA = 0.5;
        const elo = calculateElo(whitePlayer.rating, blackPlayer.rating, scoreA);
        const whiteChange = elo.newRatingA - whitePlayer.rating;
        const blackChange = elo.newRatingB - blackPlayer.rating;
        pairings[pairingIndex].whiteEloChange = whiteChange;
        pairings[pairingIndex].blackEloChange = blackChange;
        updatedPlayers = tournament.players.map((p) => {
          if (p.id === whitePlayer.id) return { ...p, rating: elo.newRatingA };
          if (p.id === blackPlayer.id) return { ...p, rating: elo.newRatingB };
          return p;
        });
      }
    }

    const { db } = await getFirebase();
    await updateDoc(doc(db, 'tournaments', tournamentId), {
      rounds: updatedRounds,
      players: updatedPlayers,
    });
    await fetchTournament();
  };

  const getResultClass = (result: GameResult, isWhite: boolean): string => {
    if (!result) return '';
    const won = (isWhite && result === '1-0') || (!isWhite && result === '0-1');
    if (won) return 'bg-win-soft text-win border-win/30';
    if (result === '0.5-0.5') return 'bg-draw-soft text-draw border-draw/30';
    return 'bg-loss-soft text-loss border-loss/30';
  };

  const finishTournament = async () => {
    if (!tournament) return;
    const { db } = await getFirebase();
    await updateDoc(doc(db, 'tournaments', tournamentId), { status: 'completed' });
    await fetchTournament();
  };

  const updateName = async () => {
    if (!tournament || !editNameValue.trim()) return;
    const { db } = await getFirebase();
    await updateDoc(doc(db, 'tournaments', tournamentId), { name: editNameValue.trim() });
    setEditingName(false);
    await fetchTournament();
  };

  const deleteTournament = async () => {
    if (!tournament) return;
    setDeleting(true);
    try {
      const { db } = await getFirebase();
      await deleteDoc(doc(db, 'tournaments', tournamentId));
      window.location.href = '/dashboard';
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError('Failed to delete: ' + msg);
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const updatePlayer = async (playerId: string) => {
    if (!tournament || !editPlayerName.trim()) return;
    const { db } = await getFirebase();
    await updateDoc(doc(db, 'tournaments', tournamentId), {
      players: tournament.players.map((p) =>
        p.id === playerId
          ? { ...p, name: editPlayerName.trim(), rating: parseInt(editPlayerRating) || 0 }
          : p,
      ),
    });
    setEditingPlayerId(null);
    await fetchTournament();
  };

  const refreshRound = async () => {
    if (!tournament || tournament.status !== 'active') return;
    try {
      const currentRoundIndex = tournament.currentRound - 1;
      const rounds = [...tournament.rounds];
      const round = generateNextRound(tournament.players, rounds.slice(0, currentRoundIndex));
      rounds[currentRoundIndex] = round;
      const { db } = await getFirebase();
      await updateDoc(doc(db, 'tournaments', tournamentId), { rounds });
      await fetchTournament();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError('Failed to refresh round: ' + msg);
    }
  };

  const downloadPlayers = () => {
    if (!tournament) return;
    const data = tournament.players.map((p) => ({ name: p.name, rating: p.rating }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tournament.name.replace(/[^a-z0-9]/gi, '_')}_players.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyPlayers = () => {
    if (!tournament) return;
    const data = tournament.players.map((p) => ({ name: p.name, rating: p.rating }));
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
  };

  if (initialLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-hairline border-t-ink" />
      </div>
    );
  }

  if (error && !tournament) {
    return (
      <div className="py-16 text-center">
        <p className="text-body">{error || 'Tournament not found'}</p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={fetchTournament}
            className="cursor-pointer rounded-pill bg-ink px-6 py-2 text-sm font-medium text-on-ink transition-all duration-150 hover:opacity-90"
          >
            Retry
          </button>
          <a
            href="/dashboard"
            className="inline-flex cursor-pointer items-center rounded-pill border border-hairline bg-canvas px-6 py-2 text-sm font-medium text-ink no-underline transition-all duration-150 hover:bg-canvas-soft"
          >
            Back to dashboard
          </a>
        </div>
      </div>
    );
  }

  if (!tournament) return null;

  const currentRoundData = tournament.rounds[tournament.currentRound - 1];
  const standings = getPlayerStandings(tournament.players, tournament.rounds);
  const allResultsIn = currentRoundData
    ? currentRoundData.pairings.every((p) => p.result !== null)
    : false;

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-lg border border-error/30 bg-error-soft px-4 py-3 text-sm text-error">
          {error}
          <button onClick={() => setError('')} className="ml-3 cursor-pointer font-medium underline">Dismiss</button>
        </div>
      )}

      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                value={editNameValue}
                onChange={(e) => setEditNameValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && updateName()}
                className="h-9 rounded-sm border border-hairline bg-canvas px-3 text-xl font-semibold tracking-tight text-ink focus:border-ink focus:outline-none"
              />
              <button onClick={updateName} className="cursor-pointer rounded-pill bg-ink px-3 py-1.5 text-xs font-medium text-on-ink transition-all duration-150 hover:opacity-90">
                Save
              </button>
              <button onClick={() => setEditingName(false)} className="cursor-pointer text-xs text-mute hover:text-ink transition-colors">
                Cancel
              </button>
            </div>
          ) : (
            <h1 className="truncate text-2xl font-semibold tracking-tight">{tournament.name}</h1>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-body">
            <span>{tournament.players.length} players</span>
            <span>·</span>
            <span>Round {tournament.currentRound || 0}/{tournament.numberOfRounds}</span>
            {tournament.status === 'setup' && (
              <span className="rounded-full bg-draw-soft px-2.5 py-0.5 text-xs font-medium text-draw">Setup</span>
            )}
            {tournament.status === 'active' && (
              <span className="rounded-full bg-link-bg-soft px-2.5 py-0.5 text-xs font-medium text-link">In Progress</span>
            )}
            {tournament.status === 'completed' && (
              <span className="rounded-full bg-win-soft px-2.5 py-0.5 text-xs font-medium text-win">Completed</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isOwner && (
            <div ref={actionsRef} className="relative">
              <button
                onClick={() => setShowActions(!showActions)}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-hairline bg-canvas text-mute transition-all duration-150 hover:text-ink"
              >
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>

              {showActions && (
                <div className="absolute right-0 top-10 z-50 w-52 rounded-lg border border-hairline bg-canvas py-1 shadow-[0px_1px_1px_#00000005,0px_8px_16px_-4px_#0000000a,0px_24px_32px_-8px_#0000000f]">
                  <button
                    onClick={() => { setEditingName(true); setEditNameValue(tournament.name); setShowActions(false); }}
                    className="flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-left text-sm text-ink hover:bg-canvas-soft"
                  >
                    <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit name
                  </button>

                  <button
                    onClick={() => setShowExportActions(!showExportActions)}
                    className="flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-left text-sm text-ink hover:bg-canvas-soft"
                  >
                    <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Export players
                  </button>
                  {showExportActions && (
                    <div className="flex gap-1 px-3 pb-2">
                      <button
                        onClick={() => { downloadPlayers(); setShowActions(false); setShowExportActions(false); }}
                        className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-hairline bg-canvas-soft px-3 py-1.5 text-xs text-ink transition-all duration-150 hover:bg-ink hover:text-on-ink"
                      >
                        <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download
                      </button>
                      <button
                        onClick={() => { copyPlayers(); setShowActions(false); setShowExportActions(false); }}
                        className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-hairline bg-canvas-soft px-3 py-1.5 text-xs text-ink transition-all duration-150 hover:bg-ink hover:text-on-ink"
                      >
                        <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy
                      </button>
                    </div>
                  )}

                  {tournament.status === 'active' && (
                    <button
                      onClick={() => { refreshRound(); setShowActions(false); }}
                      className="flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-left text-sm text-ink hover:bg-canvas-soft"
                    >
                      <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Refresh round
                    </button>
                  )}

                  <div className="my-1 border-t border-hairline" />

                  <button
                    onClick={() => { setShowDeleteConfirm(true); setShowActions(false); }}
                    className="flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-left text-sm text-error hover:bg-error-soft"
                  >
                    <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete tournament
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg min-w-[min(20rem,100%)] rounded-xl border border-hairline bg-canvas p-6 shadow-[0px_1px_1px_#00000005,0px_8px_16px_-4px_#0000000a,0px_24px_32px_-8px_#0000000f]">
            <h3 className="text-lg font-semibold text-ink">Delete tournament?</h3>
            <p className="mt-2 text-sm text-body leading-relaxed">This action cannot be undone. All tournament data will be permanently deleted.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="cursor-pointer rounded-pill border border-hairline bg-canvas px-5 py-2 text-sm text-ink transition-all duration-150 hover:bg-canvas-soft"
              >
                Cancel
              </button>
              <button
                onClick={deleteTournament}
                disabled={deleting}
                className="cursor-pointer rounded-pill bg-error px-5 py-2 text-sm font-medium text-white transition-all duration-150 hover:opacity-90 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-hairline">
        {(['players', 'rounds', 'standings'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            class={`cursor-pointer whitespace-nowrap border-b-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-colors ${
              tab === t
                ? 'border-ink text-ink'
                : 'border-transparent text-mute hover:text-ink'
            }`}
          >
            {t === 'rounds' ? 'Rounds' : t === 'standings' ? 'Standings' : 'Players'}
          </button>
        ))}
      </div>

      {tab === 'players' && (
        <div className="space-y-4">
          {isOwner && tournament.status !== 'completed' && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <input
                  ref={nameInputRef}
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Player name"
                  className="h-10 flex-1 rounded-sm border border-hairline bg-canvas px-3 text-sm text-ink placeholder:text-mute focus:border-ink focus:outline-none"
                  onKeyDown={(e) => e.key === 'Enter' && addPlayer()}
                />
                <div className="flex gap-2 sm:gap-3">
                  <input
                    type="number"
                    value={playerRating}
                    onChange={(e) => setPlayerRating(e.target.value)}
                    placeholder="Rating"
                    className="h-10 w-full sm:w-20 rounded-sm border border-hairline bg-canvas px-3 text-sm text-ink focus:border-ink focus:outline-none"
                    onKeyDown={(e) => e.key === 'Enter' && addPlayer()}
                  />
                  <button
                    onClick={addPlayer}
                    disabled={!playerName.trim()}
                    className="cursor-pointer rounded-pill bg-ink px-5 sm:px-4 text-sm font-medium text-on-ink transition-all duration-150 hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </div>
              <div ref={importPanelRef}>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowImport(!showImport)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-pill border border-hairline bg-canvas-soft-2 px-3 py-1.5 text-xs text-ink transition-all duration-150 hover:bg-canvas-soft"
                  >
                    <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19.5v-15m0 0l-6 6m6-6l6 6" /></svg>
                    Import
                  </button>
                  <div ref={exportMenuRef} className="relative">
                    <button
                      onClick={() => setShowExportMenu(!showExportMenu)}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-pill border border-hairline bg-canvas-soft-2 px-3 py-1.5 text-xs text-ink transition-all duration-150 hover:bg-canvas-soft"
                    >
                      <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.5v15m0 0l6-6m-6 6l-6-6" /></svg>
                      Export
                    </button>
                    {showExportMenu && (
                      <div className="absolute left-0 top-8 z-50 flex gap-1 rounded-lg border border-hairline bg-canvas p-2 shadow-[0px_1px_1px_#00000005,0px_8px_16px_-4px_#0000000a,0px_24px_32px_-8px_#0000000f]">
                        <button
                          onClick={() => { downloadPlayers(); setShowExportMenu(false); }}
                          className="flex cursor-pointer items-center gap-1.5 rounded-md border border-hairline bg-canvas-soft px-3 py-1.5 text-xs text-ink transition-all duration-150 hover:bg-ink hover:text-on-ink"
                        >
                          <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Download
                        </button>
                        <button
                          onClick={() => { copyPlayers(); setShowExportMenu(false); }}
                          className="flex cursor-pointer items-center gap-1.5 rounded-md border border-hairline bg-canvas-soft px-3 py-1.5 text-xs text-ink transition-all duration-150 hover:bg-ink hover:text-on-ink"
                        >
                          <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Copy
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {showImport && (
                  <div className="mt-2 rounded-lg border border-hairline bg-canvas p-4 shadow-[0_1px_1px_#00000005,0_2px_2px_#0000000a]">
                  <p className="mb-2 text-xs text-body">Paste JSON or upload an exported file:</p>
                  <textarea
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    rows={4}
                    className="w-full rounded-sm border border-hairline bg-canvas-soft px-3 py-2 text-xs text-ink focus:border-ink focus:outline-none"
                    placeholder='[{"name":"Alice","rating":1500},{"name":"Bob","rating":0}]'
                  />
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => importPlayers()} disabled={!importText.trim()} className="cursor-pointer rounded-pill bg-ink px-3 py-1.5 text-xs font-medium text-on-ink transition-all duration-150 hover:opacity-90 disabled:opacity-50">
                      Import
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="cursor-pointer rounded-pill border border-hairline bg-canvas-soft-2 px-3 py-1.5 text-xs text-ink transition-all duration-150 hover:bg-canvas-soft"
                    >
                      Upload file
                    </button>
                    <button onClick={() => { setShowImport(false); setImportText(''); }} className="cursor-pointer text-xs text-mute hover:text-ink transition-colors">
                      Cancel
                    </button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileImport}
                    className="hidden"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {tournament.players.length === 0 ? (
            <p className="py-8 text-center text-sm text-mute">No players added yet</p>
          ) : (
            <div className="space-y-2">
              {tournament.players.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border border-hairline bg-canvas px-4 py-3 shadow-[0_1px_1px_#00000005,0_2px_2px_#0000000a]"
                >
                  {editingPlayerId === p.id ? (
                    <div className="flex flex-1 items-center gap-2">
                      <input
                        value={editPlayerName}
                        onChange={(e) => setEditPlayerName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && updatePlayer(p.id)}
                        className="h-8 flex-1 rounded-sm border border-hairline bg-canvas-soft px-2 text-sm text-ink focus:border-ink focus:outline-none"
                      />
                      <input
                        type="number"
                        value={editPlayerRating}
                        onChange={(e) => setEditPlayerRating(e.target.value)}
                        className="h-8 w-20 rounded-sm border border-hairline bg-canvas-soft px-2 text-sm text-ink focus:border-ink focus:outline-none"
                        onKeyDown={(e) => e.key === 'Enter' && updatePlayer(p.id)}
                      />
                      <button
                        onClick={() => updatePlayer(p.id)}
                        className="cursor-pointer rounded-pill bg-ink px-3 py-1 text-xs font-medium text-on-ink transition-all duration-150 hover:opacity-90"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingPlayerId(null)}
                        className="cursor-pointer text-xs text-mute hover:text-ink transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-canvas-soft text-xs font-medium text-body">
                          {p.seed}
                        </span>
                        <span className="text-sm font-medium text-ink">{p.name}</span>
                        <span className="text-xs text-mute">{p.rating ? `(${p.rating})` : '(unrated)'}</span>
                      </div>
                      {isOwner && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => { setEditingPlayerId(p.id); setEditPlayerName(p.name); setEditPlayerRating(String(p.rating || '')); }}
                            className="cursor-pointer text-xs text-mute hover:text-ink transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => removePlayer(p.id)}
                            className="cursor-pointer text-xs text-mute hover:text-error transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {isOwner && tournament.status === 'setup' && tournament.players.length >= 2 && (
            <button
              onClick={startTournament}
              className="mt-4 w-full cursor-pointer rounded-pill bg-ink py-3 text-sm font-medium text-on-ink transition-all duration-150 hover:opacity-90 active:scale-[0.98]"
            >
              Start Tournament
            </button>
          )}
        </div>
      )}

      {tab === 'rounds' && (
        <div className="space-y-6">
          {tournament.status === 'setup' && (
            <div className="rounded-lg border border-hairline bg-canvas p-8 text-center shadow-[0_1px_1px_#00000005,0_2px_2px_#0000000a]">
              <p className="text-body">Add players and start the tournament to begin</p>
            </div>
          )}

          {tournament.status !== 'setup' && tournament.rounds.length === 0 && (
            <p className="py-8 text-center text-sm text-mute">No rounds yet</p>
          )}

          {tournament.rounds.map((round, ri) => {
            const isCurrentRound = ri === tournament.currentRound - 1;
            const isExpanded = expandedRound === ri || isCurrentRound;
            return (
              <div
                key={ri}
                class={`rounded-lg border bg-canvas shadow-[0_1px_1px_#00000005,0_2px_2px_#0000000a] ${
                  isCurrentRound ? 'border-ink' : 'border-hairline'
                }`}
              >
                <button
                  onClick={() => setExpandedRound(isExpanded ? null : ri)}
                  className="flex w-full cursor-pointer items-center justify-between px-4 py-3 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink">
                      Round {round.roundNumber}
                    </span>
                    {isCurrentRound && (
                      <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] text-on-ink">
                        Current
                      </span>
                    )}
                    {round.byePlayer && (
                      <span className="text-xs text-mute">
                        · Bye: {tournament.players.find((p) => p.id === round.byePlayer)?.name}
                      </span>
                    )}
                  </div>
                  <svg
                    class={`h-4 w-4 text-mute transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isExpanded && (
                  <div className="border-t border-hairline px-4 py-3">
                    <div className="mb-1.5 flex items-center gap-2 px-3 text-[10px] font-medium uppercase tracking-wider text-mute/60">
                      <span className="w-5 sm:w-7 text-center" />
                      <span className="flex-1 text-right">White</span>
                      <span className="shrink-0 px-0.5">vs</span>
                      <span className="flex-1">Black</span>
                      <span className="w-[52px] sm:w-[58px]" />
                    </div>
                    <div className="space-y-1">
                      {round.pairings.map((p, pi) => {
                        const white = tournament.players.find((pl) => pl.id === p.white);
                        const black = tournament.players.find((pl) => pl.id === p.black);
                        const needsScore = isCurrentRound && isOwner;
                        const isScoring = scoringPairing?.roundIndex === ri && scoringPairing?.pairingIndex === pi;
                        return (
                          <div
                            key={pi}
                            class={`rounded-md border transition-shadow ${isScoring ? 'border-ink shadow-sm' : p.result ? 'border-ink/15' : 'border-hairline'}`}
                          >
                            <div
                              onClick={() => {
                                if (!needsScore) return;
                                setScoringPairing(isScoring ? null : { roundIndex: ri, pairingIndex: pi });
                              }}
                              class={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 ${needsScore && !isScoring ? 'cursor-pointer transition-colors hover:bg-canvas-soft' : ''}`}
                            >
                              <span className="w-5 sm:w-7 text-[11px] sm:text-xs text-mute shrink-0 text-center">#{p.tableNumber}</span>
                              <span className="flex-1 text-right text-xs sm:text-sm font-medium text-ink leading-snug">
                                {white?.name || '?'}
                                {white && <span className="ml-1 text-[10px] sm:text-xs text-mute whitespace-nowrap">{white.rating ? `(${white.rating})` : '(u)'}</span>}
                                {p.result && typeof p.whiteEloChange === 'number' && (
                                  <span class={`ml-1 text-[10px] sm:text-xs font-medium whitespace-nowrap ${p.whiteEloChange > 0 ? 'text-win' : p.whiteEloChange < 0 ? 'text-loss' : 'text-mute'}`}>
                                    {p.whiteEloChange > 0 ? `+${p.whiteEloChange}` : p.whiteEloChange}
                                  </span>
                                )}
                              </span>
                              <span className="text-[11px] sm:text-xs text-mute shrink-0 px-0.5">vs</span>
                              <span className="flex-1 text-xs sm:text-sm font-medium text-ink leading-snug">
                                {black?.name || '?'}
                                {black && <span className="mr-1 text-[10px] sm:text-xs text-mute whitespace-nowrap">{black.rating ? `(${black.rating})` : '(u)'}</span>}
                                {p.result && typeof p.blackEloChange === 'number' && (
                                  <span class={`ml-1 text-[10px] sm:text-xs font-medium whitespace-nowrap ${p.blackEloChange > 0 ? 'text-win' : p.blackEloChange < 0 ? 'text-loss' : 'text-mute'}`}>
                                    {p.blackEloChange > 0 ? `+${p.blackEloChange}` : p.blackEloChange}
                                  </span>
                                )}
                              </span>
                              {p.result ? (
                                <span class={`shrink-0 rounded border px-2 sm:px-2.5 py-0.5 sm:py-1 text-[11px] sm:text-xs font-medium ${getResultClass(p.result, true)}`}>
                                  {p.result === '0.5-0.5' ? '½-½' : p.result}
                                </span>
                              ) : needsScore ? (
                                <span className="shrink-0 rounded border border-dashed border-hairline-strong px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-xs text-mute">
                                  {isScoring ? 'Cancel' : 'Score'}
                                </span>
                              ) : null}
                            </div>
                            {isScoring && (
                              <div className="border-t border-hairline px-2.5 sm:px-3 py-1.5 flex items-center justify-center gap-1.5">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setResult(ri, pi, '1-0'); setScoringPairing(null); }}
                                  className="cursor-pointer rounded border border-win/30 bg-win-soft px-2 py-1 text-[11px] font-medium text-win transition-colors hover:bg-win/10"
                                >
                                  1-0
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setResult(ri, pi, '0.5-0.5'); setScoringPairing(null); }}
                                  className="cursor-pointer rounded border border-draw/30 bg-draw-soft px-2 py-1 text-[11px] font-medium text-draw transition-colors hover:bg-draw/10"
                                >
                                  ½-½
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setResult(ri, pi, '0-1'); setScoringPairing(null); }}
                                  className="cursor-pointer rounded border border-loss/30 bg-loss-soft px-2 py-1 text-[11px] font-medium text-loss transition-colors hover:bg-loss/10"
                                >
                                  0-1
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {isOwner && tournament.status === 'active' && allResultsIn && (
            <div className="flex gap-3">
              {tournament.currentRound < tournament.numberOfRounds ? (
                <button
                  onClick={nextRound}
                  className="flex-1 cursor-pointer rounded-pill bg-ink py-3 text-sm font-medium text-on-ink transition-all duration-150 hover:opacity-90 active:scale-[0.98]"
                >
                  Generate Round {tournament.currentRound + 1}
                </button>
              ) : (
                <button
                  onClick={finishTournament}
                  className="flex-1 cursor-pointer rounded-pill bg-win py-3 text-sm font-medium text-white transition-all duration-150 hover:opacity-90 active:scale-[0.98]"
                >
                  Finish Tournament
                </button>
              )}
            </div>
          )}

          {isOwner && tournament.status === 'active' && !allResultsIn && currentRoundData && (
            <p className="text-center text-xs text-mute">
              Enter all results to proceed to the next round
            </p>
          )}
        </div>
      )}

      {tab === 'standings' && (
        <Standings standings={standings} players={tournament.players} />
      )}
    </div>
  );
}
