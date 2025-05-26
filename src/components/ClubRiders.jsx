import React, { useState, useEffect, useContext } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import LoadingOverlay from "react-loading-overlay-ts";
import { ThemeContext } from "../main";
import RiderCard from "./RiderCard";
import FilterControls from "./FilterControls";

export default function ClubRiders() {
  const { clubName } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { darkMode, toggleDarkMode } = useContext(ThemeContext);
  const [year, setYear] = useState(searchParams.get("year") || "2025");
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState(searchParams.get("sort") || "name");
  const [filterText, setFilterText] = useState(searchParams.get("filter") || "");
  const [raceTypeFilter, setRaceTypeFilter] = useState(searchParams.get("raceType") || "all");
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get("category") || "");
  const [uniqueClubs, setUniqueClubs] = useState([]);

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
    } catch (error) {
      console.error("Error fetching race data:", error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleClearFilters = () => {
    setFilterText("");
    setCategoryFilter("");
    setRaceTypeFilter("all");
    setSortKey("name");
    
    // Update URL params
    const params = new URLSearchParams();
    if (year !== "2025") {
      params.set("year", year);
    }
    setSearchParams(params);
  };
  
  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (year !== "2025") params.set("year", year);
    if (sortKey !== "name") params.set("sort", sortKey);
    if (filterText) params.set("filter", filterText);
    if (raceTypeFilter !== "all") params.set("raceType", raceTypeFilter);
    if (categoryFilter) params.set("category", categoryFilter);
    setSearchParams(params);
  }, [year, sortKey, filterText, raceTypeFilter, categoryFilter, setSearchParams]);
  
  // Fetch data when year or clubName changes
  useEffect(() => {
    fetchRaceData();
  }, [year, clubName]);

  // Process and filter the data
  const racerEntries = Object.entries(data);
  const sortedFilteredRacers = racerEntries
    .filter(([_, racer]) => racer.name && racer.name.toLowerCase().includes(filterText.toLowerCase()))
    // Filter by club from URL parameter
    .filter(([_, racer]) => !clubName || racer.club === decodeURIComponent(clubName))
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
      // Filter out riders with zero races
      if (raceTypeFilter === "all") return racer.raceCount > 0;
      if (raceTypeFilter === "roadAndTrack") return racer.roadAndTrackRaceCount > 0;
      if (raceTypeFilter === "cyclocross") return racer.cyclocrossRaceCount > 0;
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
      } else if (sortKey === "roadAndTrackRaceCount") {
        return (bData.roadAndTrackRaceCount || 0) - (aData.roadAndTrackRaceCount || 0);
      } else if (sortKey === "cyclocrossRaceCount") {
        return (bData.cyclocrossRaceCount || 0) - (aData.cyclocrossRaceCount || 0);
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
          <h3 className={`text-lg font-medium ${darkMode ? 'text-white' : 'text-gray-800'}`}>
            {clubName ? `${decodeURIComponent(clubName)} - Riders` : 'Club Riders'}
          </h3>
          {clubName && (
            <Link 
              to={`/clubs/${clubName}/summary`}
              className={`px-3 py-1 rounded text-sm ${darkMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
            >
              View Summary
            </Link>
          )}
        </div>
        <p className={`text-sm leading-relaxed ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          View British Cycling race data for {clubName ? decodeURIComponent(clubName) : 'club'} members. Filter and sort by various criteria.
          <Link to="/about" className="ml-1 text-blue-500 hover:underline">Learn more</Link> about how this works.
        </p>
      </div>
      
      {/* Filter controls - Now using the FilterControls component but without club filter */}
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
        clubFilter={null} // Not used anymore
        setClubFilter={null} // Not used anymore
        raceTypeFilter={raceTypeFilter}
        setRaceTypeFilter={setRaceTypeFilter}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        uniqueClubs={[]} // Not used anymore
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