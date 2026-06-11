import { useState, useEffect, useRef } from 'react';
import type { Auth } from 'firebase/auth';
import { signInWithPopup, signOut, onAuthStateChanged, type User } from 'firebase/auth';
import { getFirebase } from '../../lib/firebase';

export default function GoogleLogin() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const fbRef = useRef<{ auth: Auth } | null>(null);

  useEffect(() => {
    getFirebase()
      .then((fb) => {
        fbRef.current = fb;
        return onAuthStateChanged(fb.auth, (u) => {
          setUser(u);
          setLoading(false);
        });
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const handleLogin = async () => {
    try {
      const fb = await getFirebase();
      await signInWithPopup(fb.auth, fb.googleProvider);
      window.location.href = '/dashboard';
    } catch (err) {
      console.error('Login failed:', err);
    }
  };

  const handleLogout = async () => {
    if (!fbRef.current) return;
    await signOut(fbRef.current.auth);
  };

  if (loading) {
    return (
      <div className="flex h-12 w-full items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-hairline border-t-ink" />
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-3">
        {user.photoURL && (
          <img src={user.photoURL} alt="" className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" />
        )}
        <span className="text-sm text-body">{user.displayName || user.email}</span>
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
    <button
      onClick={handleLogin}
      style={{ whiteSpace: 'nowrap', width: '100%' }}
      className="inline-flex h-12 cursor-pointer items-center justify-center gap-3 rounded-pill bg-ink px-8 text-sm font-medium text-on-ink transition-all duration-150 hover:opacity-90 active:scale-[0.98]"
    >
      <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      <span>Sign in with Google</span>
    </button>
  );
}
