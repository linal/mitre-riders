import { Navigate, Route, Routes } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import ProtectedRoute from '../features/auth/ProtectedRoute';

// Lazy-load admin and compare features so the public bundle stays small.
const ClubsList = lazy(() => import('../features/clubs/ClubsList'));
const ClubRiders = lazy(() => import('../features/clubs/ClubRiders'));
const ClubSummary = lazy(() => import('../features/clubs/ClubSummary'));
const CompareRiders = lazy(() => import('../features/compare/CompareRiders'));
const CacheManager = lazy(() => import('../features/admin/CacheManager'));
const ManageRiders = lazy(() => import('../features/admin/ManageRiders'));
const ClubsManager = lazy(() => import('../features/admin/ClubsManager'));
const About = lazy(() => import('../features/about/About'));
const Login = lazy(() => import('../features/auth/Login'));
const RegisterUser = lazy(() => import('../features/auth/RegisterUser'));

function Fallback() {
  return <div className="flex justify-center items-center h-64">Loading...</div>;
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<Fallback />}>
      <Routes>
        <Route path="/" element={<ClubsList />} />
        <Route path="/clubs/:clubName/riders" element={<ClubRiders />} />
        <Route path="/clubs/:clubName/summary" element={<ClubSummary />} />
        <Route path="/compare" element={<CompareRiders />} />
        <Route
          path="/cache"
          element={
            <ProtectedRoute>
              <CacheManager />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manage-riders"
          element={
            <ProtectedRoute>
              <ManageRiders />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manage-clubs"
          element={
            <ProtectedRoute>
              <ClubsManager />
            </ProtectedRoute>
          }
        />
        <Route path="/about" element={<About />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<RegisterUser />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Suspense>
  );
}
