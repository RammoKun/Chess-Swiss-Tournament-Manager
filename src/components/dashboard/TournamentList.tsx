import { useState, useEffect, useRef } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  Timestamp,
} from 'firebase/firestore';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { getFirebase, retry } from '../../lib/firebase';
import type { Tournament } from '../../lib/types';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

export default function TournamentList() {
  const [user, setUser] = useState<User | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRounds, setNewRounds] = useState('5');
  const [creating, setCreating] = useState(false);
  const fbRef = useRef<{ auth: Auth; db: Firestore } | null>(null);

  useEffect(() => {
    getFirebase()
      .then((fb) => {
        fbRef.current = fb;
        return onAuthStateChanged(fb.auth, (u) => {
          setUser(u);
          if (!u) setLoading(false);
        });
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
        setError('Failed to initialize');
      });
  }, []);

  const loadTournaments = async () => {
    if (!user || !fbRef.current) return;
    setError('');
    const { db } = fbRef.current;
    const q = query(
      collection(db, 'tournaments'),
      where('ownerId', '==', user.uid),
    );
    try {
      const snapshot = await retry(() => getDocs(q));
      const list: Tournament[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Tournament);
      });
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setTournaments(list);
    } catch (err) {
      console.error('Failed to load tournaments:', err);
      setError('Could not load tournaments. Check Firestore permissions.');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadTournaments();
  }, [user]);

  const handleCreate = async () => {
    if (!user || !newName.trim()) return;
    setCreating(true);
    setError('');
    try {
      const { db } = await getFirebase();
      const docRef = await addDoc(collection(db, 'tournaments'), {
        name: newName.trim(),
        ownerId: user.uid,
        status: 'setup',
        numberOfRounds: parseInt(newRounds) || 5,
        currentRound: 0,
        players: [],
        rounds: [],
        createdAt: Timestamp.now().toMillis(),
      });
      setNewName('');
      setShowCreate(false);
      loadTournaments();
    } catch (err) {
      console.error('Failed to create tournament:', err);
      setError('Failed to create tournament. Check Firestore is enabled.');
    }
    setCreating(false);
  };

  const handleLogout = async () => {
    if (!fbRef.current) return;
    await signOut(fbRef.current.auth);
  };

  if (!user) {
    return (
      <div className="py-16 text-center">
        <p className="text-body">Sign in to see your tournaments</p>
        <a
          href="/login"
          className="mt-4 inline-block cursor-pointer rounded-pill bg-ink px-6 py-3 text-sm font-medium text-on-ink no-underline transition-all duration-150 hover:opacity-90 active:scale-[0.98]"
        >
          Sign In
        </a>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-hairline border-t-ink" />
      </div>
    );
  }

  const statusLabel: Record<string, string> = {
    setup: 'Setup',
    active: 'In Progress',
    completed: 'Completed',
  };

  const statusVariant: Record<string, string> = {
    setup: 'bg-draw-soft text-draw',
    active: 'bg-link-bg-soft text-link',
    completed: 'bg-win-soft text-win',
  };

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">My Tournaments</h2>
          {user && (
            <button
              onClick={handleLogout}
              className="cursor-pointer text-xs text-mute transition-colors hover:text-ink"
            >
              Sign out
            </button>
          )}
        </div>
        {!showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="cursor-pointer w-full sm:w-auto rounded-pill bg-ink px-5 py-2 text-sm font-medium text-on-ink transition-all duration-150 hover:opacity-90 active:scale-[0.98]"
          >
            + New Tournament
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-error/30 bg-error-soft px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      {showCreate && (
        <div className="mb-6 rounded-lg border border-hairline bg-canvas p-6 shadow-[0_1px_1px_#00000005,0_2px_2px_#0000000a]">
          <h3 className="mb-4 text-sm font-semibold">Create Tournament</h3>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-body">Tournament Name</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Club Championship 2026"
                className="h-10 w-full rounded-sm border border-hairline bg-canvas px-3 text-sm text-ink placeholder:text-mute focus:border-ink focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-body">Number of Rounds</label>
              <input
                type="number"
                min={3}
                max={15}
                value={newRounds}
                onChange={(e) => setNewRounds(e.target.value)}
                className="h-10 w-24 rounded-sm border border-hairline bg-canvas px-3 text-sm text-ink focus:border-ink focus:outline-none"
              />
              <span className="ml-2 text-xs text-mute">(3–15)</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className="cursor-pointer w-full sm:w-auto rounded-pill bg-ink px-5 py-2 text-sm font-medium text-on-ink transition-all duration-150 hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="cursor-pointer w-full sm:w-auto rounded-pill border border-hairline bg-canvas px-5 py-2 text-sm font-medium text-ink transition-all duration-150 hover:bg-canvas-soft active:scale-[0.98]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {tournaments.length === 0 ? (
        <div className="rounded-lg border border-hairline bg-canvas p-12 text-center shadow-[0_1px_1px_#00000005,0_2px_2px_#0000000a]">
          <p className="text-lg text-mute">No tournaments yet</p>
          <p className="mt-1 text-sm text-mute">Create your first one to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tournaments.map((t) => (
            <a
              key={t.id}
              href={`/tournament?id=${t.id}`}
              className="block rounded-lg border border-hairline bg-canvas p-4 no-underline shadow-[0_1px_1px_#00000005,0_2px_2px_#0000000a] transition-all duration-150 hover:border-hairline-strong hover:shadow-[0_1px_1px_#00000005,0_2px_2px_#0000000a,0_4px_8px_#0000000a]"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-ink">{t.name}</h3>
                  <p className="mt-0.5 text-xs text-mute">
                    {t.players.length} players · {t.numberOfRounds} rounds
                    {t.currentRound > 0 && ` · Round ${t.currentRound}/${t.numberOfRounds}`}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusVariant[t.status] || ''}`}
                >
                  {statusLabel[t.status] || t.status}
                </span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
