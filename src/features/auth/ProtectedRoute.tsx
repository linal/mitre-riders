import { Navigate } from 'react-router-dom';
import { useAuth } from '../../shared/hooks/useAuth';
import type { ReactNode } from 'react';

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
