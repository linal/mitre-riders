import { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged, type User } from 'firebase/auth';

export interface AuthState {
  user: User | null;
  loading: boolean;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>(() => ({
    user: getAuth().currentUser,
    // If currentUser is already set, we're not loading. Otherwise we wait
    // for onAuthStateChanged to fire at least once before deciding.
    loading: getAuth().currentUser === null,
  }));

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getAuth(), (currentUser) => {
      setState({ user: currentUser, loading: false });
    });
    return unsubscribe;
  }, []);

  return state;
}
