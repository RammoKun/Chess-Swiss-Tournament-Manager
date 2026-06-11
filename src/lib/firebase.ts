let initialized = false;

export async function getFirebase() {
  const apiKey = import.meta.env.PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Firebase not configured. Add PUBLIC_FIREBASE_API_KEY etc. to your .env file.',
    );
  }

  if (!initialized) {
    initialized = true;
    const { initializeApp } = await import('firebase/app');
    const { getAuth, GoogleAuthProvider } = await import('firebase/auth');
    const { getFirestore, enableNetwork, disableNetwork } = await import('firebase/firestore');

    const app = initializeApp({
      apiKey,
      authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.PUBLIC_FIREBASE_APP_ID,
    });

    const auth = getAuth(app);
    const db = getFirestore(app);

    return {
      auth,
      db,
      googleProvider: new GoogleAuthProvider(),
    };
  }

  const { getAuth, GoogleAuthProvider } = await import('firebase/auth');
  const { getFirestore } = await import('firebase/firestore');
  return {
    auth: getAuth(),
    db: getFirestore(),
    googleProvider: new GoogleAuthProvider(),
  };
}

export function withTimeout<T>(promise: Promise<T>, ms = 15000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${ms / 1000}s`)), ms),
    ),
  ]);
}

async function retry<T>(fn: () => Promise<T>, retries = 3, delay = 500): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, delay * (i + 1)));
    }
  }
  throw new Error('Retry failed');
}

export { retry };
