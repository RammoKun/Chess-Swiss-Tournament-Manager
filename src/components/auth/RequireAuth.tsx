import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { getFirebase } from '../../lib/firebase';

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'checking' | 'authed' | 'redirecting'>('checking');

  useEffect(() => {
    let cancelled = false;
    getFirebase()
      .then((fb) => {
        const unsub = onAuthStateChanged(fb.auth, (user) => {
          if (cancelled) return;
          if (!user) {
            setState('redirecting');
            window.location.href = '/login';
          } else {
            setState('authed');
          }
        });
        return unsub;
      })
      .catch(() => {
        if (!cancelled) {
          setState('redirecting');
          window.location.href = '/login';
        }
      });
    return () => { cancelled = true; };
  }, []);

  if (state === 'authed') return <>{children}</>;

  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-hairline border-t-ink" />
        <p className="mt-4 text-sm text-mute">
          {state === 'redirecting' ? 'Redirecting...' : 'Checking...'}
        </p>
      </div>
    </div>
  );
}
