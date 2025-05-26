import React, { useState, useEffect, useContext } from "react";
import { Link } from "react-router-dom";
import LoadingOverlay from "react-loading-overlay-ts";
import { ThemeContext } from "../main";

export default function ClubsList() {
  const { darkMode } = useContext(ThemeContext);
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClubs = async () => {
      setLoading(true);
      try {
        const apiBase = import.meta.env.VITE_API_BASE_URL || window.location.origin || 'http://localhost:3001';
        const response = await fetch(`${apiBase}/api/clubs`);
        const clubsData = await response.json();
        setClubs(clubsData);
      } catch (error) {
        console.error("Error fetching clubs:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchClubs();
  }, []);

  return (
    <LoadingOverlay
      active={loading}
      spinner
      text="Loading clubs..."
      styles={{
        overlay: (base) => ({
          ...base,
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(4px)',
          position: 'fixed',
          zIndex: 9999
        }),
        content: (base) => ({
          ...base,
          color: '#fff',
          fontSize: '1.25rem',
          fontWeight: 500
        })
      }}
    >
      <div className={`p-4 space-y-4 ${darkMode ? 'dark bg-gray-900 text-white' : 'bg-white'}`}>
        <div className={`border-l-4 border-blue-600 rounded shadow-md p-4 mb-6 mx-2 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
          <div className="flex justify-between items-center mb-2">
            <h3 className={`text-lg font-medium ${darkMode ? 'text-white' : 'text-gray-800'}`}>Clubs</h3>
          </div>
          <p className={`text-sm leading-relaxed ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>        
          Browse British cycling clubs and view their members' race points. Select a club to see detailed rider information.
          </p>
          
          <p className={`text-sm leading-relaxed ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          <Link to="/about" className="text-blue-500 hover:underline">Learn more</Link> about how this application works.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clubs.map((club) => (
            <Link 
              key={club} 
              to={`/clubs/${encodeURIComponent(club)}/riders`}
              className={`block p-4 rounded-lg shadow-md transition-transform transform hover:scale-105 ${
                darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-50'
              }`}
            >
              <h3 className={`text-lg font-medium ${darkMode ? 'text-white' : 'text-gray-800'}`}>{club}</h3>
            </Link>
          ))}
        </div>

        {clubs.length === 0 && !loading && (
          <div className={`p-4 text-center rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
            <p>No clubs found. Add racers to see their clubs.</p>
          </div>
        )}
      </div>
    </LoadingOverlay>
  );
}