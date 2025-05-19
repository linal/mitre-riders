import React, { createContext, useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import RaceChecker from './components/RaceChecker';
import CacheManager from './components/CacheManager';
import './index.css';

// Create Theme Context
export const ThemeContext = createContext();

const Navigation = ({ darkMode }) => {
  return (
    <nav className={`px-4 py-3 ${darkMode ? 'bg-gray-800 text-white' : 'bg-white border-b'}`}>
      <div className="container mx-auto flex items-center justify-between">
        <div className="font-bold text-lg">BC Points App</div>
        <div className="flex space-x-4">
          <Link to="/" className={`px-3 py-1 rounded text-sm ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}>
            Race Checker
          </Link>
          <Link to="/cache" className={`px-3 py-1 rounded text-sm ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}>
            Cache Manager
          </Link>
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
            <Route path="/" element={<RaceChecker />} />
            <Route path="/cache" element={<CacheManager />} />
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
