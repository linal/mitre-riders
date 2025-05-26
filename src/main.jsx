import React, { createContext, useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import ClubRiders from './components/ClubRiders';
import CacheManager from './components/CacheManager';
import AddRacer from './components/AddRacer';
import ClubSummary from './components/ClubSummary';
import ClubsList from './components/ClubsList';
import './index.css';

// Create Theme Context
export const ThemeContext = createContext();

const Navigation = ({ darkMode }) => {
  const [showSettings, setShowSettings] = useState(false);
  
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
        <div className="font-bold text-lg">BC Points App</div>
        <div className="flex space-x-4 items-center">
          <Link to="/" className={`px-3 py-1 rounded text-sm ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}>
            Clubs
          </Link>
          <Link to="/club-riders" className={`px-3 py-1 rounded text-sm ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}>
            Club Riders
          </Link>
          <Link to="/club-summary" className={`px-3 py-1 rounded text-sm ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}>
            Club Summary
          </Link>
          
          {/* Settings dropdown */}
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
                  to="/add-racer" 
                  className={`block px-4 py-2 text-sm ${darkMode ? 'text-gray-200 hover:bg-gray-600' : 'text-gray-700 hover:bg-gray-100'}`}
                  onClick={() => setShowSettings(false)}
                >
                  Add Racer
                </Link>
              </div>
            )}
          </div>
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
          <Navigation darkMode={darkMode} />
          <Routes>
            <Route path="/" element={<ClubsList />} />
            <Route path="/club-riders" element={<ClubRiders />} />
            <Route path="/cache" element={<CacheManager />} />
            <Route path="/add-racer" element={<AddRacer />} />
            <Route path="/club-summary" element={<ClubSummary />} />
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