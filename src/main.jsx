import React, { createContext, useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import ClubRiders from './components/ClubRiders';
import CacheManager from './components/CacheManager';
import ManageRiders from './components/ManageRiders';
import ClubSummary from './components/ClubSummary';
import ClubsList from './components/ClubsList';
import ClubsManager from './components/ClubsManager';
import About from './components/About';
import Login from './components/Login';
import RegisterUser from './components/RegisterUser';
import ProtectedRoute from './components/ProtectedRoute';
import AuthStatus from './components/AuthStatus';
import './index.css';
import './firebase'; // Import Firebase configuration
import CompareRiders from './components/CompareRiders';

// Create Theme Context
export const ThemeContext = createContext();

const Navigation = ({ darkMode, toggleDarkMode }) => {
  const [showSettings, setShowSettings] = useState(false);
  const auth = getAuth();
  const [user, setUser] = useState(auth.currentUser);
  const navigate = useNavigate();
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, [auth]);
  
  const toggleSettings = () => {
    setShowSettings(!showSettings);
  };
  
  // Close settings dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showSettings && !event.target.closest('.settings-container')) {
        setShowSettings(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSettings]);

  return (
    <nav className={`px-4 py-3 ${darkMode ? 'bg-gray-800 text-white' : 'bg-white border-b'}`}>
      <div className="container mx-auto flex items-center justify-between">
        <div className="font-bold text-lg">British Cycling Club Viewer</div>
        <div className="flex space-x-4 items-center">
          <Link to="/" className={`px-3 py-1 rounded text-sm ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}>
            Clubs
          </Link>
          <Link to="/about" className={`px-3 py-1 rounded text-sm ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}>
            About
          </Link>
          <Link to="/compare" className={`px-3 py-1 rounded text-sm ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}>
            Compare
          </Link>
          
          {/* Dark mode toggle */}
          <button
            onClick={toggleDarkMode}
            className={`p-2 rounded-full ${darkMode ? 'bg-gray-700 text-yellow-300' : 'bg-gray-200 text-gray-800'}`}
            aria-label="Toggle dark mode"
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
          
          {/* Auth status */}
          <AuthStatus />
          
          {/* Settings dropdown - only show if user is logged in */}
          {user && (
            <div className="relative settings-container">
              <button 
                onClick={toggleSettings}
                className={`p-2 rounded-full ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                aria-label="Settings"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
              </button>
              
              {showSettings && (
                <div 
                  className={`absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 z-10 ${darkMode ? 'bg-gray-700' : 'bg-white'} ring-1 ring-black ring-opacity-5 settings-container`}
                  role="menu"
                >
                  <Link 
                    to="/cache" 
                    className={`block px-4 py-2 text-sm ${darkMode ? 'text-gray-200 hover:bg-gray-600' : 'text-gray-700 hover:bg-gray-100'}`}
                    onClick={() => setShowSettings(false)}
                  >
                    Cache Manager
                  </Link>
                  <Link 
                    to="/manage-riders" 
                    className={`block px-4 py-2 text-sm ${darkMode ? 'text-gray-200 hover:bg-gray-600' : 'text-gray-700 hover:bg-gray-100'}`}
                    onClick={() => setShowSettings(false)}
                  >
                    Manage Riders
                  </Link>
                  <Link 
                    to="/manage-clubs" 
                    className={`block px-4 py-2 text-sm ${darkMode ? 'text-gray-200 hover:bg-gray-600' : 'text-gray-700 hover:bg-gray-100'}`}
                    onClick={() => setShowSettings(false)}
                  >
                    Manage Clubs
                  </Link>
                  <button 
                    onClick={() => {
                      setShowSettings(false);
                      signOut(auth).then(() => {
                        navigate('/login');
                      }).catch((error) => {
                        console.error('Error signing out:', error);
                      });
                    }}
                    className={`block w-full text-left px-4 py-2 text-sm ${darkMode ? 'text-gray-200 hover:bg-gray-600' : 'text-gray-700 hover:bg-gray-100'}`}
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
};

const App = () => {
  const [darkMode, setDarkMode] = useState(() => {
    // Default to system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    // Update class on document when theme changes
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    // Listen for system preference changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      setDarkMode(e.matches);
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode(prevMode => !prevMode);
  };
  


  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode }}>
      <BrowserRouter>
        <div className={darkMode ? 'bg-gray-900 min-h-screen' : 'bg-gray-50 min-h-screen'}>
          <Navigation darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
          <Routes>
            <Route path="/" element={<ClubsList />} />
            <Route path="/clubs/:clubName/riders" element={<ClubRiders />} />
            <Route path="/clubs/:clubName/summary" element={<ClubSummary />} />
            <Route path="/compare" element={<CompareRiders />} />
            <Route path="/cache" element={
              <ProtectedRoute>
                <CacheManager />
              </ProtectedRoute>
            } />
            <Route path="/manage-riders" element={
              <ProtectedRoute>
                <ManageRiders />
              </ProtectedRoute>
            } />
            <Route path="/manage-clubs" element={
              <ProtectedRoute>
                <ClubsManager />
              </ProtectedRoute>
            } />
            <Route path="/about" element={<About />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<RegisterUser />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </BrowserRouter>
    </ThemeContext.Provider>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);