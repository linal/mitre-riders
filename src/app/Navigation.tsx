import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getAuth, signOut } from 'firebase/auth';
import AuthStatus from '../features/auth/AuthStatus';
import { useAuth } from '../shared/hooks/useAuth';
import { useTheme } from '../shared/theme/ThemeProvider';
import { logger } from '../shared/logger';
import Logo from './Logo';

const log = logger.child({ component: 'navigation' });

const COLLAPSED_KEY = 'nav.collapsed';

const iconClass = 'h-5 w-5 shrink-0';

const ClubsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} viewBox="0 0 20 20" fill="currentColor">
    <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
  </svg>
);

const AboutIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} viewBox="0 0 20 20" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
      clipRule="evenodd"
    />
  </svg>
);

const CompareIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} viewBox="0 0 20 20" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M7.707 3.293a1 1 0 010 1.414L5.414 7H17a1 1 0 110 2H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0zm4.586 5a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 14H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z"
      clipRule="evenodd"
    />
  </svg>
);

const CacheIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} viewBox="0 0 20 20" fill="currentColor">
    <path d="M3 4a2 2 0 012-2h10a2 2 0 012 2v1a2 2 0 01-2 2H5a2 2 0 01-2-2V4zM3 10a2 2 0 012-2h10a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6zm2 2a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" />
  </svg>
);

const RidersIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} viewBox="0 0 20 20" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
      clipRule="evenodd"
    />
  </svg>
);

const ClubsAdminIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} viewBox="0 0 20 20" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M4 4a2 2 0 012-2h8a2 2 0 012 2v14a1 1 0 01-1 1h-3v-4a1 1 0 00-1-1H9a1 1 0 00-1 1v4H5a1 1 0 01-1-1V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z"
      clipRule="evenodd"
    />
  </svg>
);

const LogoutIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} viewBox="0 0 20 20" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M3 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zm7.707 3.293a1 1 0 010 1.414L9.414 9H17a1 1 0 110 2H9.414l1.293 1.293a1 1 0 01-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0z"
      clipRule="evenodd"
    />
  </svg>
);

const ChevronLeftIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
      clipRule="evenodd"
    />
  </svg>
);

const ChevronRightIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
      clipRule="evenodd"
    />
  </svg>
);

const HamburgerIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm1 4a1 1 0 100 2h12a1 1 0 100-2H4z"
      clipRule="evenodd"
    />
  </svg>
);

export default function Navigation() {
  const { darkMode, toggleDarkMode } = useTheme();
  const { user, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(COLLAPSED_KEY) === '1';
  });
  const navigate = useNavigate();

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0');
    } catch {
      // ignore storage errors (private mode, etc.)
    }
  }, [collapsed]);

  const close = () => setOpen(false);

  const handleLogout = async () => {
    close();
    try {
      await signOut(getAuth());
      navigate('/login');
    } catch (error) {
      log.error('signout_failed', { err: error });
    }
  };

  // When the mobile drawer is open, always show full labels regardless of
  // the desktop collapsed preference.
  const showLabels = open || !collapsed;

  const NavRow = ({
    to,
    icon,
    label,
  }: {
    to: string;
    icon: ReactNode;
    label: string;
  }) => (
    <Link
      to={to}
      onClick={close}
      title={showLabels ? undefined : label}
      aria-label={label}
      className={[
        'flex items-center gap-3 rounded text-sm hover:bg-gray-100 dark:hover:bg-gray-700',
        showLabels ? 'px-3 py-2' : 'px-2 py-2 justify-center',
      ].join(' ')}
    >
      {icon}
      {showLabels && <span className="truncate">{label}</span>}
    </Link>
  );

  return (
    <>
      <button
        type="button"
        className="md:hidden fixed top-3 left-3 z-50 p-2 rounded bg-white dark:bg-gray-800 dark:text-white border dark:border-gray-700"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
      >
        <HamburgerIcon />
      </button>

      {open && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/40"
          onClick={close}
          aria-hidden="true"
        />
      )}

      <nav
        className={[
          'fixed md:static inset-y-0 left-0 z-40 shrink-0',
          showLabels ? 'w-64' : 'w-16',
          'bg-white dark:bg-gray-800 dark:text-white border-r dark:border-transparent',
          'flex flex-col transform transition-all md:transform-none',
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        ].join(' ')}
      >
        <div
          className={[
            'flex items-center border-b dark:border-gray-700',
            showLabels ? 'px-4 py-4 justify-between' : 'px-2 py-4 justify-center',
          ].join(' ')}
        >
          <Link
            to="/"
            onClick={close}
            aria-label="PeloPoints - Home"
            className={[
              'flex items-center gap-2 min-w-0 rounded hover:opacity-90',
              showLabels ? '' : 'justify-center',
            ].join(' ')}
          >
            <Logo size={showLabels ? 32 : 36} className="shrink-0" />
            {showLabels && (
              <span className="font-bold text-lg leading-tight truncate">
                PeloPoints
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="hidden md:inline-flex p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
          <NavRow to="/" icon={<ClubsIcon />} label="Clubs" />
          <NavRow to="/about" icon={<AboutIcon />} label="About" />
          <NavRow to="/compare" icon={<CompareIcon />} label="Compare" />

          {isAdmin && (
            <div className="pt-4">
              {showLabels ? (
                <div className="px-3 pb-1 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Admin
                </div>
              ) : (
                <div className="mx-2 mb-1 border-t dark:border-gray-700" />
              )}
              <NavRow to="/cache" icon={<CacheIcon />} label="Cache Manager" />
              <NavRow to="/manage-riders" icon={<RidersIcon />} label="Manage Riders" />
              <NavRow to="/manage-clubs" icon={<ClubsAdminIcon />} label="Manage Clubs" />
            </div>
          )}

          {user && (
            <div className="pt-4">
              {!isAdmin && !showLabels && (
                <div className="mx-2 mb-1 border-t dark:border-gray-700" />
              )}
              <button
                type="button"
                onClick={handleLogout}
                title={showLabels ? undefined : 'Logout'}
                aria-label="Logout"
                className={[
                  'w-full flex items-center gap-3 rounded text-sm hover:bg-gray-100 dark:hover:bg-gray-700',
                  showLabels ? 'px-3 py-2 text-left' : 'px-2 py-2 justify-center',
                ].join(' ')}
              >
                <LogoutIcon />
                {showLabels && <span className="truncate">Logout</span>}
              </button>
            </div>
          )}
        </div>

        <div
          className={[
            'border-t dark:border-gray-700',
            showLabels
              ? 'px-3 py-3 flex items-center justify-between'
              : 'px-2 py-3 flex flex-col items-center gap-2',
          ].join(' ')}
        >
          {showLabels && <AuthStatus />}
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-full bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-yellow-300"
            aria-label="Toggle dark mode"
            title="Toggle dark mode"
          >
            {darkMode ? '\u2600\ufe0f' : '\u{1F319}'}
          </button>
        </div>
      </nav>
    </>
  );
}
