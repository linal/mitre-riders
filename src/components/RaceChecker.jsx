import React, { useState, useEffect, useContext } from "react";
import LoadingOverlay from "react-loading-overlay-ts";
import { ThemeContext } from "../main";

// Parse URL query parameters
function getQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    year: params.get("year") || "2025",
    sort: params.get("sort") || "name",
    filter: params.get("filter") || "",
    club: params.get("club") || "",
    raceType: params.get("raceType") || "all",
    category: params.get("category") || ""
  };
}

// Update URL with current filter state
function updateQueryParams(params) {
  const url = new URL(window.location);
  
  // Clear existing params
  url.search = "";
  
  // Add non-default params
  if (params.year !== "2025") url.searchParams.set("year", params.year);
  if (params.sort !== "name") url.searchParams.set("sort", params.sort);
  if (params.filter) url.searchParams.set("filter", params.filter);
  if (params.club) url.searchParams.set("club", params.club);
  if (params.raceType !== "all") url.searchParams.set("raceType", params.raceType);
  if (params.category) url.searchParams.set("category", params.category);
  
  // Update URL without reloading page
  window.history.replaceState({}, "", url);
}

export default function RaceChecker() {
  const queryParams = getQueryParams();
  const { darkMode, toggleDarkMode } = useContext(ThemeContext);
  const [year, setYear] = useState(queryParams.year);
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState(queryParams.sort);
  const [filterText, setFilterText] = useState(queryParams.filter);
  const [clubFilter, setClubFilter] = useState(queryParams.club);
  const [raceTypeFilter, setRaceTypeFilter] = useState(queryParams.raceType);
  const [categoryFilter, setCategoryFilter] = useState(queryParams.category);
  const [uniqueClubs, setUniqueClubs] = useState([]);
  // Using hardcoded categories instead of dynamic ones

  const fetchRaceData = async () => {
    setLoading(true);
    try {
      // Use environment variable in production or default to current origin or localhost
      const apiBase = import.meta.env.VITE_API_BASE_URL || window.location.origin || 'http://localhost:3001';
      const url = `${apiBase}/api/all-race-data?year=${year}`;
      const response = await fetch(url);
      const allData = await response.json();
      
      console.log("Fetched race data:", allData);
      setData(allData);
      
      // Extract unique clubs from the data and sort alphabetically
      const clubs = new Set(Object.values(allData).map(racer => racer.club));
      setUniqueClubs([...clubs].sort());
      
      // We're using hardcoded categories, so no need to extract them from data
    } catch (error) {
      console.error("Error fetching race data:", error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleClearFilters = () => {
    setFilterText("");
    setClubFilter("");
    setCategoryFilter("");
    setRaceTypeFilter("all");
    setSortKey("name");
  };
  
  // Update URL when filters change
  useEffect(() => {
    updateQueryParams({ year, sort: sortKey, filter: filterText, club: clubFilter, raceType: raceTypeFilter, category: categoryFilter });
  }, [year, sortKey, filterText, clubFilter, raceTypeFilter, categoryFilter]);
  
  // Fetch data when year changes
  useEffect(() => {
    fetchRaceData();
  }, [year]);

  // Process and filter the data
  const racerEntries = Object.entries(data);
  const sortedFilteredRacers = racerEntries
    .filter(([_, racer]) => racer.name.toLowerCase().includes(filterText.toLowerCase()))
    .filter(([_, racer]) => clubFilter === "" || racer.club === clubFilter)
    .filter(([_, racer]) => {
      if (categoryFilter === "") return true;
      if (categoryFilter === "unlicensed") return !racer.category;
      if (categoryFilter === "1st") return racer.category && racer.category.includes("1st");
      if (categoryFilter === "2nd") return racer.category && racer.category.includes("2nd");
      if (categoryFilter === "3rd") return racer.category && racer.category.includes("3rd");
      if (categoryFilter === "4th") return racer.category && racer.category.includes("4th");
      return racer.category === categoryFilter;
    })
    .filter(([_, racer]) => {
      if (raceTypeFilter === "all") return true;
      if (raceTypeFilter === "roadAndTrack" && racer.roadAndTrackRaceCount > 0) return true;
      if (raceTypeFilter === "cyclocross" && racer.cyclocrossRaceCount > 0) return true;
      return false;
    })
    .sort((a, b) => {
      const [_, aData] = a;
      const [__, bData] = b;
      
      if (sortKey === "name") {
        return aData.name.localeCompare(bData.name);
      } else if (sortKey === "races") {
        // Consider race type filter when sorting by race count
        if (raceTypeFilter === "roadAndTrack") {
          return (bData.roadAndTrackRaceCount || 0) - (aData.roadAndTrackRaceCount || 0);
        } else if (raceTypeFilter === "cyclocross") {
          return (bData.cyclocrossRaceCount || 0) - (aData.cyclocrossRaceCount || 0);
        } else {
          return (bData.raceCount || 0) - (aData.raceCount || 0);
        }
      } else if (sortKey === "roadAndTrack") {
        return (bData.roadAndTrackPoints || 0) - (aData.roadAndTrackPoints || 0);
      } else if (sortKey === "cyclocross") {
        return (bData.cyclocrossPoints || 0) - (aData.cyclocrossPoints || 0);
      } else if (sortKey === "category") {
        // If one rider has a category and the other doesn't, the one with category comes first
        if (aData.category && !bData.category) return -1;
        if (!aData.category && bData.category) return 1;
        // If both have categories or both don't, sort alphabetically
        return (aData.category || "").localeCompare(bData.category || "");
      }
      return 0;
    });

  return (
    <LoadingOverlay
      active={loading}
      spinner
      text="Loading race data..."
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
          <h3 className={`text-lg font-medium ${darkMode ? 'text-white' : 'text-gray-800'}`}>Race Checker</h3>
        </div>
        <p className={`text-sm leading-relaxed ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          This tool displays British Cycling race data for club members. Data is fetched from the British Cycling Website 
          when you select a year or click "Go". Results include both Road & Track and Cyclocross points and race counts. 
          Data is cached for 24 hours to improve performance. The server filters out duplicate race entries by extracting 
          unique event IDs from the HTML response, ensuring each race is only counted once even if a rider participated in 
          multiple events within the same race.
          <br /><strong>Note: All data is pulled directly from the British Cycling website, so any inaccuracies there will be reflected here.</strong>
        </p>
      </div>
      
      {/* Filter controls - Improved organization and styling */}
      <div className={`p-4 rounded-lg mb-4 ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
        <div className="flex justify-between items-center mb-3">
          <h3 className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-700'}`}>Filter Options</h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleClearFilters}
              className={`px-3 py-1 rounded text-xs font-medium ${darkMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
            >
              Clear Filters
            </button>
            <button
              onClick={toggleDarkMode}
              className={`p-2 rounded-full ${darkMode ? 'bg-gray-700 text-yellow-300' : 'bg-gray-200 text-gray-800'}`}
              aria-label="Toggle dark mode"
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="flex items-center">
            <label className={`text-sm mr-2 w-12 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Year:</label>
            <div className="flex flex-1">
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className={`border rounded px-2 py-1.5 text-sm w-full ${darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-white border-gray-300'}`}
              >
                {[...Array(10)].map((_, i) => {
                  const y = 2025 - i;
                  return <option key={y} value={y}>{y}</option>;
                })}
              </select>
              <button
                onClick={fetchRaceData}
                disabled={loading}
                className={`flex items-center bg-blue-600 text-white px-3 py-1.5 rounded text-xs ml-1 ${darkMode ? 'hover:bg-blue-700' : 'hover:bg-blue-500'} transition-colors duration-200`}
              >
                {loading ? (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <>
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                    </svg>
                    Refresh
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center">
            <label className={`text-sm mr-2 w-12 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Find:</label>
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Search by name..."
              className={`border px-2 py-1.5 rounded text-sm w-full ${darkMode ? 'bg-gray-700 text-white border-gray-600 placeholder-gray-400' : 'bg-white border-gray-300'}`}
            />
          </div>
          
          <div className="flex items-center">
            <label className={`text-sm mr-2 w-12 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Sort:</label>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value)}
              className={`border rounded px-2 py-1.5 text-sm w-full ${darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-white border-gray-300'}`}
            >
              <option value="name">Name</option>
              <option value="races">Race Count</option>
              <option value="roadAndTrack">Road & Track Pts</option>
              <option value="cyclocross">Cyclocross Pts</option>
              <option value="category">Category</option>
            </select>
          </div>
          
          <div className="flex items-center">
            <label className={`text-sm mr-2 w-12 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Club:</label>
            <select
              value={clubFilter}
              onChange={(e) => setClubFilter(e.target.value)}
              className={`border rounded px-2 py-1.5 text-sm w-full ${darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-white border-gray-300'}`}
            >
              <option value="">All Clubs</option>
              {uniqueClubs.map(club => (
                <option key={club} value={club}>{club}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center">
            <label className={`text-sm mr-2 w-12 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Type:</label>
            <select
              value={raceTypeFilter}
              onChange={(e) => setRaceTypeFilter(e.target.value)}
              className={`border rounded px-2 py-1.5 text-sm w-full ${darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-white border-gray-300'}`}
            >
              <option value="all">All Types</option>
              <option value="roadAndTrack">Road & Track</option>
              <option value="cyclocross">Cyclocross</option>
            </select>
          </div>
          
          <div className="flex items-center">
            <label className={`text-sm mr-2 w-12 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Cat:</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className={`border rounded px-2 py-1.5 text-sm w-full ${darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-white border-gray-300'}`}
            >
              <option value="">All Categories</option>
              <option value="1st">1st</option>
              <option value="2nd">2nd</option>
              <option value="3rd">3rd</option>
              <option value="4th">4th</option>
              <option value="unlicensed">Unlicensed</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedFilteredRacers.map(([racerId, racer]) => (
          <div key={racerId} className={`rounded-2xl shadow-md border p-4 space-y-2 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white'}`}>
            <div className={`text-xl font-semibold ${darkMode ? 'text-white' : ''}`}>{racer.name}</div>
            <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>BC No: {racerId}</div>
            <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Club: {racer.club}</div>
            {racer.category && (
              <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Category: <span className="font-medium">{racer.category}</span>
              </div>
            )}
            <div className="space-y-2">
              <div className="flex gap-2 items-center flex-wrap">
                {(raceTypeFilter === "all") && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Total Races: {racer.raceCount}
                  </span>
                )}
                {racer.roadAndTrackRaceCount > 0 && (raceTypeFilter === "all" || raceTypeFilter === "roadAndTrack") && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    Road & Track: {racer.roadAndTrackRaceCount} races
                  </span>
                )}
                {racer.cyclocrossRaceCount > 0 && (raceTypeFilter === "all" || raceTypeFilter === "cyclocross") && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    Cyclocross: {racer.cyclocrossRaceCount} races
                  </span>
                )}
              </div>
              <div className="flex gap-2 items-center flex-wrap">
                {racer.roadAndTrackPoints > 0 && (raceTypeFilter === "all" || raceTypeFilter === "roadAndTrack") && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    Road & Track: {racer.roadAndTrackPoints} pts
                  </span>
                )}
                {racer.cyclocrossPoints > 0 && (raceTypeFilter === "all" || raceTypeFilter === "cyclocross") && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    Cyclocross: {racer.cyclocrossPoints} pts
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2 mt-2">
              {racer.roadAndTrackRaceCount > 0 && (
                <button
                  onClick={() => window.open(`https://www.britishcycling.org.uk/points?d=4&person_id=${racerId}&year=${year}`, "_blank")}
                  className={`flex items-center px-3 py-1.5 rounded text-xs font-medium transition-colors duration-200 ${
                    darkMode 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
                >
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                  </svg>
                  Road Results
                </button>
              )}
              {racer.cyclocrossRaceCount > 0 && (
                <button
                  onClick={() => window.open(`https://www.britishcycling.org.uk/points?d=6&person_id=${racerId}&year=${year}`, "_blank")}
                  className={`flex items-center px-3 py-1.5 rounded text-xs font-medium transition-colors duration-200 ${
                    darkMode 
                      ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                      : 'bg-purple-500 hover:bg-purple-600 text-white'
                  }`}
                >
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                  </svg>
                  CX Results
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      </div>
    </LoadingOverlay>
  );
}