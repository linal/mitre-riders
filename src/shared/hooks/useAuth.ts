import { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged, type User } from 'firebase/auth';

export interface AuthState {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>(() => ({
    user: getAuth().currentUser,
    isAdmin: false,
    // If currentUser is already set, we're not loading. Otherwise we wait
    // for onAuthStateChanged to fire at least once before deciding.
    loading: getAuth().currentUser === null,
  }));

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = onAuthStateChanged(getAuth(), async (currentUser) => {
      if (!currentUser) {
        if (!cancelled) setState({ user: null, isAdmin: false, loading: false });
        return;
      }

      // Read custom claims from the ID token. Firebase caches the token, so
      // a freshly-granted admin claim only appears after a sign-out/in or a
      // forced refresh via getIdToken(true).
      let isAdmin = false;
      try {
        const tokenResult = await currentUser.getIdTokenResult();
        isAdmin = tokenResult.claims.admin === true;
      } catch {
        isAdmin = false;
      }
      if (!cancelled) setState({ user: currentUser, isAdmin, loading: false });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return state;
}
