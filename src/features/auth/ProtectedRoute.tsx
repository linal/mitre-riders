import { Navigate } from 'react-router-dom';
import { useAuth } from '../../shared/hooks/useAuth';
import type { ReactNode } from 'react';

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-md dark:bg-gray-800 dark:text-white">
        <h2 className="text-xl font-bold mb-2">Admins only</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Your account does not have permission to access this page. If you
          believe this is a mistake, contact an administrator.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
