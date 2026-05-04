import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getAuth, signOut } from 'firebase/auth';
import AuthStatus from '../features/auth/AuthStatus';
import { useAuth } from '../shared/hooks/useAuth';
import { useTheme } from '../shared/theme/ThemeProvider';
import { logger } from '../shared/logger';

const log = logger.child({ component: 'navigation' });

export default function Navigation() {
  const { darkMode, toggleDarkMode } = useTheme();
  const { user } = useAuth();
  const [showSettings, setShowSettings] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showSettings && !target.closest('.settings-container')) {
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSettings]);

  const handleLogout = async () => {
    setShowSettings(false);
    try {
      await signOut(getAuth());
      navigate('/login');
    } catch (error) {
      log.error('signout_failed', { err: error });
    }
  };

  return (
    <nav className="px-4 py-3 bg-white border-b dark:bg-gray-800 dark:text-white dark:border-transparent">
      <div className="container mx-auto flex items-center justify-between">
        <div className="font-bold text-lg">British Cycling Club Viewer</div>
        <div className="flex space-x-4 items-center">
          <Link
            to="/"
            className="px-3 py-1 rounded text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Clubs
          </Link>
          <Link
            to="/about"
            className="px-3 py-1 rounded text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            About
          </Link>
          <Link
            to="/compare"
            className="px-3 py-1 rounded text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Compare
          </Link>

          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-full bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-yellow-300"
            aria-label="Toggle dark mode"
          >
            {darkMode ? '\u2600\ufe0f' : '\u{1F319}'}
          </button>

          <AuthStatus />

          {user && (
            <div className="relative settings-container">
              <button
                onClick={() => setShowSettings((s) => !s)}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="Settings"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>

              {showSettings && (
                <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 z-10 bg-white dark:bg-gray-700 ring-1 ring-black ring-opacity-5 settings-container">
                  <Link
                    to="/cache"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-600"
                    onClick={() => setShowSettings(false)}
                  >
                    Cache Manager
                  </Link>
                  <Link
                    to="/manage-riders"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-600"
                    onClick={() => setShowSettings(false)}
                  >
                    Manage Riders
                  </Link>
                  <Link
                    to="/manage-clubs"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-600"
                    onClick={() => setShowSettings(false)}
                  >
                    Manage Clubs
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-600"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
