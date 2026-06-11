import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { getFirebase } from '../../lib/firebase';

export default function AuthNav() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFirebase()
      .then((fb) => {
        return onAuthStateChanged(fb.auth, (u) => {
          setUser(u);
          setLoading(false);
        });
      })
      .catch(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    const fb = await getFirebase();
    await signOut(fb.auth);
    window.location.href = '/';
  };

  if (loading) return <div className="h-7 w-20 rounded-full bg-canvas-soft animate-pulse" />;

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <button data-theme-toggle className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-hairline bg-canvas text-mute transition-all duration-150 hover:text-ink" title="Toggle dark mode">
          <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        </button>
        <a
          href="/dashboard"
          className="inline-flex h-7 items-center rounded-pill-sm bg-ink px-3 text-xs font-medium text-on-ink no-underline transition-all duration-150 hover:opacity-90"
        >
          Dashboard
        </a>
        <button
          onClick={handleLogout}
          className="cursor-pointer text-xs text-mute transition-colors hover:text-ink"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <button data-theme-toggle className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-hairline bg-canvas text-mute transition-all duration-150 hover:text-ink" title="Toggle dark mode">
        <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      </button>
      <a
        href="/login"
        className="inline-flex h-7 items-center rounded-sm border border-hairline bg-canvas px-3 text-xs font-medium text-ink no-underline transition-all duration-150 hover:bg-canvas-soft"
      >
        Log In
      </a>
      <a
        href="/login"
        className="inline-flex h-7 items-center rounded-sm bg-ink px-3 text-xs font-medium text-on-ink no-underline transition-all duration-150 hover:opacity-90"
      >
        Sign Up
      </a>
    </div>
  );
}
