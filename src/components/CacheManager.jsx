import React, { useState, useEffect, useContext, useRef } from "react";
import { ThemeContext } from "../main";
import { Link } from "react-router-dom";
import { getAuth } from "firebase/auth";

export default function CacheManager() {
  const { darkMode } = useContext(ThemeContext);
  const [years, setYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [cacheData, setCacheData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [selectedRacer, setSelectedRacer] = useState("");
  const [racers, setRacers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Generate years for dropdown (current year and 9 previous years)
  useEffect(() => {
    const currentYear = new Date().getFullYear();
    const yearsList = Array.from({ length: 10 }, (_, i) => (currentYear - i).toString());
    setYears(yearsList);
    
    // Fetch racers list
    fetchRacers();
  }, []);
  
  // Fetch racers from API
  const fetchRacers = async () => {
    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL || window.location.origin || 'http://localhost:3001';
      const response = await fetch(`${apiBase}/api/racers`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch racers: ${response.status}`);
      }
      
      const data = await response.json();
      setRacers(data);
    } catch (error) {
      console.error("Error fetching racers:", error);
      setMessage({ type: "error", text: `Failed to load racers: ${error.message}` });
    }
  };

  // Fetch cache data for selected year
  const fetchCacheData = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL || window.location.origin || 'http://localhost:3001';
      const response = await fetch(`${apiBase}/api/cache/${selectedYear}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch cache data: ${response.status}`);
      }
      
      const data = await response.json();
      setCacheData(data);
    } catch (error) {
      console.error("Error fetching cache data:", error);
      setMessage({ type: "error", text: error.message });
    } finally {
      setLoading(false);
    }
  };

  // Delete cache for selected year
  const deleteCacheData = async () => {
    if (!confirm(`Are you sure you want to delete all cache files for ${selectedYear}?`)) {
      return;
    }
    
    setLoading(true);
    setMessage(null);
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) {
        throw new Error('You must be logged in to delete cache files');
      }
      
      const token = await user.getIdToken();
      const apiBase = import.meta.env.VITE_API_BASE_URL || window.location.origin || 'http://localhost:3001';
      const response = await fetch(`${apiBase}/api/cache/${selectedYear}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete cache: ${response.status}`);
      }
      
      const result = await response.json();
      setMessage({ 
        type: "success", 
        text: `Successfully removed ${result.removedFiles} cache files for ${selectedYear}` 
      });
      
      // Refresh cache data
      fetchCacheData();
    } catch (error) {
      console.error("Error deleting cache:", error);
      setMessage({ type: "error", text: error.message });
    } finally {
      setLoading(false);
    }
  };

  // Build cache for selected year
  const buildCache = async () => {
    if (!confirm(`Are you sure you want to build cache for all racers for ${selectedYear}? This may take some time.`)) {
      return;
    }
    
    setLoading(true);
    setMessage(null);
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) {
        throw new Error('You must be logged in to build cache');
      }
      
      const token = await user.getIdToken();
      const apiBase = import.meta.env.VITE_API_BASE_URL || window.location.origin || 'http://localhost:3001';
      const response = await fetch(`${apiBase}/api/build-cache`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ year: selectedYear })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to build cache: ${response.status}`);
      }
      
      const result = await response.json();
      setMessage({ 
        type: "success", 
        text: `Successfully cached data for ${result.cached} racers (${result.failed} failed)` 
      });
      
      // Refresh cache data
      fetchCacheData();
    } catch (error) {
      console.error("Error building cache:", error);
      setMessage({ type: "error", text: error.message });
    } finally {
      setLoading(false);
    }
  };
  
  // Build cache for specific racer
  const buildRacerCache = async () => {
    if (!selectedRacer) {
      setMessage({ type: "error", text: "Please select a racer" });
      return;
    }
    
    setLoading(true);
    setMessage(null);
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) {
        throw new Error('You must be logged in to build cache');
      }
      
      const token = await user.getIdToken();
      const apiBase = import.meta.env.VITE_API_BASE_URL || window.location.origin || 'http://localhost:3001';
      const response = await fetch(`${apiBase}/api/build-cache`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          year: selectedYear,
          racerId: selectedRacer
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to build cache: ${response.status}`);
      }
      
      const result = await response.json();
      setMessage({ 
        type: "success", 
        text: `Successfully cached data for racer ${selectedRacer}` 
      });
      
      // Refresh cache data
      fetchCacheData();
    } catch (error) {
      console.error("Error building racer cache:", error);
      setMessage({ type: "error", text: error.message });
    } finally {
      setLoading(false);
    }
  };

  // Load cache data when year changes
  useEffect(() => {
    fetchCacheData();
  }, [selectedYear]);
  
  // Handle clicks outside the dropdown to close it
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef]);
  
  // Filter racers based on search term
  const filteredRacers = racers.filter(racer => {
    const searchLower = searchTerm.toLowerCase();
    const bcMatch = racer.bc.toLowerCase().includes(searchLower);
    const nameMatch = racer.name && racer.name.toLowerCase().includes(searchLower);
    return bcMatch || nameMatch;
  });

  return (
    <div className={`p-4 space-y-4 ${darkMode ? 'dark bg-gray-900 text-white' : 'bg-white'}`}>
      <div className={`border-l-4 border-blue-600 rounded shadow-md p-4 mb-6 mx-2 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <h3 className={`text-lg font-medium ${darkMode ? 'text-white' : 'text-gray-800'}`}>Cache Manager</h3>
        <p className={`text-sm leading-relaxed ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          Manage cached race data by year. View cache statistics and clear cache files when needed.
          <Link to="/about" className="ml-1 text-blue-500 hover:underline">Learn more</Link> about the caching system.
        </p>
      </div>

      {/* Controls */}
      <div className={`p-4 rounded-lg mb-4 ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
        <div className="flex flex-wrap items-center gap-4 mb-3">
          <div className="flex items-center">
            <label className={`text-sm mr-2 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Year:</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className={`border rounded px-2 py-1.5 text-sm ${darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-white border-gray-300'}`}
            >
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          
          <button
            onClick={fetchCacheData}
            disabled={loading}
            className={`flex items-center px-3 py-1.5 rounded text-xs font-medium ${darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'} text-white transition-colors duration-200`}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          
          <button
            onClick={buildCache}
            disabled={loading}
            className={`flex items-center px-3 py-1.5 rounded text-xs font-medium ${darkMode ? 'bg-green-600 hover:bg-green-700' : 'bg-green-500 hover:bg-green-600'} text-white transition-colors duration-200`}
          >
            Build All Cache
          </button>
          
          <button
            onClick={deleteCacheData}
            disabled={loading || !cacheData || cacheData.count === 0}
            className={`flex items-center px-3 py-1.5 rounded text-xs font-medium ${darkMode ? 'bg-red-600 hover:bg-red-700' : 'bg-red-500 hover:bg-red-600'} text-white transition-colors duration-200`}
          >
            Delete Cache
          </button>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center relative" ref={dropdownRef}>
            <label className={`text-sm mr-2 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Racer:</label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setIsDropdownOpen(true);
                }}
                onClick={() => setIsDropdownOpen(true)}
                placeholder="Search racer..."
                className={`border rounded px-2 py-1.5 text-sm w-64 ${darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-white border-gray-300'}`}
              />
              
              {isDropdownOpen && (
                <div className={`absolute z-10 mt-1 w-full max-h-60 overflow-auto rounded-md shadow-lg ${darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
                  {filteredRacers.length > 0 ? (
                    filteredRacers.map(racer => (
                      <div
                        key={racer.bc}
                        onClick={() => {
                          setSelectedRacer(racer.bc);
                          setSearchTerm(racer.name ? `${racer.name} (${racer.bc})` : racer.bc);
                          setIsDropdownOpen(false);
                        }}
                        className={`px-3 py-2 text-sm cursor-pointer ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                      >
                        {racer.name ? `${racer.name} (${racer.bc})` : racer.bc}
                      </div>
                    ))
                  ) : (
                    <div className={`px-3 py-2 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      No racers found
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <button
            onClick={buildRacerCache}
            disabled={loading || !selectedRacer}
            className={`flex items-center px-3 py-1.5 rounded text-xs font-medium ${darkMode ? 'bg-green-600 hover:bg-green-700' : 'bg-green-500 hover:bg-green-600'} text-white transition-colors duration-200`}
          >
            Build Racer Cache
          </button>
        </div>
      </div>

      {/* Status message */}
      {message && (
        <div className={`p-3 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {/* Cache summary */}
      {cacheData && (
        <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
          <h4 className={`text-sm font-medium mb-2 ${darkMode ? 'text-white' : 'text-gray-700'}`}>
            Cache Summary for {selectedYear}
          </h4>
          
          <div className={`p-3 rounded-lg mb-4 ${darkMode ? 'bg-gray-700' : 'bg-white'} shadow-sm`}>
            <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Cache Files</div>
            <div className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
              {cacheData.count}
            </div>
          </div>

          {cacheData.count > 0 ? (
            <div className={`overflow-auto max-h-96 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-white'}`}>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className={darkMode ? 'bg-gray-800' : 'bg-gray-50'}>
                  <tr>
                    <th scope="col" className={`px-4 py-3 text-left text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                      Racer ID
                    </th>
                    <th scope="col" className={`px-4 py-3 text-left text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                      Filename
                    </th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${darkMode ? 'divide-gray-600' : 'divide-gray-200'}`}>
                  {cacheData.files.map((file, index) => (
                    <tr key={index} className={index % 2 === 0 ? (darkMode ? 'bg-gray-700' : 'bg-white') : (darkMode ? 'bg-gray-750' : 'bg-gray-50')}>
                      <td className={`px-4 py-2 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                        {file.racerId}
                      </td>
                      <td className={`px-4 py-2 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                        {file.filename}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={`p-4 text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              No cache files found for {selectedYear}
            </div>
          )}
        </div>
      )}
    </div>
  );
}