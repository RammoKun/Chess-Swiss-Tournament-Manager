import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { getFirebase } from '../../lib/firebase';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getFirebase()
      .then((fb) => {
        const unsub = onAuthStateChanged(fb.auth, (user) => {
          if (cancelled) return;
          if (user) {
            window.location.href = '/dashboard';
          } else {
            setChecking(false);
          }
        });
        return unsub;
      })
      .catch(() => {
        if (!cancelled) setChecking(false);
      });
    return () => { cancelled = true; };
  }, []);

  if (checking) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-hairline border-t-ink" />
      </div>
    );
  }

  return <>{children}</>;
}
