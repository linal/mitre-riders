import React, { useState, useEffect, useContext } from "react";
import LoadingOverlay from "react-loading-overlay-ts";
import { ThemeContext } from "../main";
import RiderCard from "./RiderCard";
import FilterControls from "./FilterControls";

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
      } else if (sortKey === "roadRegional") {
        return (bData.roadRegionalPoints || 0) - (aData.roadRegionalPoints || 0);
      } else if (sortKey === "roadNational") {
        return (bData.roadNationalPoints || 0) - (aData.roadNationalPoints || 0);
      } else if (sortKey === "cyclocross") {
        return (bData.cyclocrossPoints || 0) - (aData.cyclocrossPoints || 0);
      } else if (sortKey === "cxRegional") {
        return (bData.cxRegionalPoints || 0) - (aData.cxRegionalPoints || 0);
      } else if (sortKey === "cxNational") {
        return (bData.cxNationalPoints || 0) - (aData.cxNationalPoints || 0);
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
          <br />
          <a href="https://github.com/linal/mitre-riders" target="_blank" className="text-blue-500 hover:underline inline-flex items-center">
            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            GitHub Repository
          </a>
        </p>
      </div>
      
      {/* Filter controls - Now using the FilterControls component */}
      <FilterControls 
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
        year={year}
        setYear={setYear}
        loading={loading}
        fetchRaceData={fetchRaceData}
        filterText={filterText}
        setFilterText={setFilterText}
        sortKey={sortKey}
        setSortKey={setSortKey}
        clubFilter={clubFilter}
        setClubFilter={setClubFilter}
        raceTypeFilter={raceTypeFilter}
        setRaceTypeFilter={setRaceTypeFilter}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        uniqueClubs={uniqueClubs}
        handleClearFilters={handleClearFilters}
      />

      {/* Summary section with totals */}
      <div className={`p-4 rounded-lg mb-4 ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
        <h3 className={`text-sm font-medium mb-2 ${darkMode ? 'text-white' : 'text-gray-700'}`}>Summary Totals</h3>
        <div className="grid gap-3 mb-3" style={{ 
          gridTemplateColumns: `repeat(${raceTypeFilter === "all" ? 3 : 2}, 1fr)`
        }}>
          <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-white'} shadow-sm`}>
            <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Active Riders</div>
            <div className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
              {sortedFilteredRacers.filter(([_, racer]) => 
                raceTypeFilter === "all" ? racer.raceCount > 0 
                : raceTypeFilter === "roadAndTrack" ? racer.roadAndTrackRaceCount > 0
                : racer.cyclocrossRaceCount > 0
              ).length}
            </div>
          </div>
          {(raceTypeFilter === "all" || raceTypeFilter === "roadAndTrack") && (
            <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-white'} shadow-sm`}>
              <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Road & Track Points</div>
              <div className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                {sortedFilteredRacers.reduce((sum, [_, racer]) => sum + (racer.roadAndTrackPoints || 0), 0)}
              </div>
            </div>
          )}
          {(raceTypeFilter === "all" || raceTypeFilter === "cyclocross") && (
            <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-white'} shadow-sm`}>
              <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Cyclocross Points</div>
              <div className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                {sortedFilteredRacers.reduce((sum, [_, racer]) => sum + (racer.cyclocrossPoints || 0), 0)}
              </div>
            </div>
          )}
        </div>
        <div className="grid gap-3" style={{ 
          gridTemplateColumns: `repeat(${raceTypeFilter === "all" ? 3 : 2}, 1fr)`
        }}>
          <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-white'} shadow-sm`}>
            <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Races</div>
            <div className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
              {raceTypeFilter === "all" 
                ? sortedFilteredRacers.reduce((sum, [_, racer]) => sum + (racer.raceCount || 0), 0)
                : raceTypeFilter === "roadAndTrack"
                  ? sortedFilteredRacers.reduce((sum, [_, racer]) => sum + (racer.roadAndTrackRaceCount || 0), 0)
                  : sortedFilteredRacers.reduce((sum, [_, racer]) => sum + (racer.cyclocrossRaceCount || 0), 0)
              }
            </div>
          </div>
          {(raceTypeFilter === "all" || raceTypeFilter === "roadAndTrack") && (
            <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-white'} shadow-sm`}>
              <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Road & Track Races</div>
              <div className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                {sortedFilteredRacers.reduce((sum, [_, racer]) => sum + (racer.roadAndTrackRaceCount || 0), 0)}
              </div>
            </div>
          )}
          {(raceTypeFilter === "all" || raceTypeFilter === "cyclocross") && (
            <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-white'} shadow-sm`}>
              <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Cyclocross Races</div>
              <div className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                {sortedFilteredRacers.reduce((sum, [_, racer]) => sum + (racer.cyclocrossRaceCount || 0), 0)}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedFilteredRacers.map(([racerId, racer]) => (
          <RiderCard 
            key={racerId} 
            racerId={racerId} 
            racer={racer} 
            year={year} 
            raceTypeFilter={raceTypeFilter} 
          />
        ))}
      </div>
      </div>
    </LoadingOverlay>
  );
}