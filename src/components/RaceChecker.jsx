import React, { useState, useEffect } from "react";
import LoadingOverlay from "react-loading-overlay-ts";

// Parse URL query parameters
function getQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    year: params.get("year") || "2025",
    sort: params.get("sort") || "name",
    filter: params.get("filter") || "",
    club: params.get("club") || "",
    raceType: params.get("raceType") || "all"
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
  
  // Update URL without reloading page
  window.history.replaceState({}, "", url);
}

export default function RaceChecker() {
  const queryParams = getQueryParams();
  const [year, setYear] = useState(queryParams.year);
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState(queryParams.sort);
  const [filterText, setFilterText] = useState(queryParams.filter);
  const [clubFilter, setClubFilter] = useState(queryParams.club);
  const [raceTypeFilter, setRaceTypeFilter] = useState(queryParams.raceType);
  const [uniqueClubs, setUniqueClubs] = useState([]);

  const fetchRaceData = async () => {
    setLoading(true);
    try {
      // Use environment variable in production or default to current origin or localhost
      const apiBase = import.meta.env.VITE_API_BASE_URL || window.location.origin || 'http://localhost:3000';
      const url = `${apiBase}/api/all-race-data?year=${year}`;
      const response = await fetch(url);
      const allData = await response.json();
      
      console.log("Fetched race data:", allData);
      setData(allData);
      
      // Extract unique clubs from the data
      const clubs = new Set(Object.values(allData).map(racer => racer.club));
      setUniqueClubs([...clubs]);
    } catch (error) {
      console.error("Error fetching race data:", error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleClearFilters = () => {
    setFilterText("");
    setClubFilter("");
    setRaceTypeFilter("all");
    setSortKey("name");
  };
  
  // Update URL when filters change
  useEffect(() => {
    updateQueryParams({ year, sort: sortKey, filter: filterText, club: clubFilter, raceType: raceTypeFilter });
  }, [year, sortKey, filterText, clubFilter, raceTypeFilter]);
  
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
        return (bData.raceCount || 0) - (aData.raceCount || 0);
      } else if (sortKey === "roadAndTrack") {
        return (bData.roadAndTrackPoints || 0) - (aData.roadAndTrackPoints || 0);
      } else if (sortKey === "cyclocross") {
        return (bData.cyclocrossPoints || 0) - (aData.cyclocrossPoints || 0);
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
      <div className="p-4 space-y-4">
      
      <div className="bg-white border-l-4 border-blue-600 rounded shadow-md p-4 mb-6 mx-2">
        <h3 className="text-lg font-medium text-gray-800 mb-2">Race Checker</h3>
        <p className="text-sm text-gray-600 leading-relaxed">
          This tool displays British Cycling race data for club members. Data is fetched from the British Cycling Website 
          when you select a year or click "Go". Results include both Road & Track and Cyclocross points and race counts. 
          Data is cached for 24 hours to improve performance. The server filters out duplicate race entries by extracting 
          unique event IDs from the HTML response, ensuring each race is only counted once even if a rider participated in 
          multiple events within the same race.
        </p>
      </div>
      
      <div className="block md:flex md:flex-row md:items-center md:space-x-4 space-y-2 md:space-y-0 mb-4">
        <div className="flex items-center">
          <label className="text-sm mr-1 w-10">Year:</label>
          <div className="flex flex-1">
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="border rounded px-1 py-1 text-sm"
            >
              {[...Array(10)].map((_, i) => {
                const y = 2025 - i;
                return <option key={y} value={y}>{y}</option>;
              })}
            </select>
            <button
              onClick={fetchRaceData}
              disabled={loading}
              className="bg-blue-600 text-white px-1 py-1 rounded text-xs ml-1"
            >
              {loading ? "..." : "Go"}
            </button>
          </div>
        </div>
        
        <div className="flex items-center">
          <label className="text-sm mr-1 w-10">Sort:</label>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
            className="border rounded px-1 py-1 text-sm flex-1"
          >
            <option value="name">Name</option>
            <option value="races">Races</option>
            <option value="roadAndTrack">Road</option>
            <option value="cyclocross">CX</option>
          </select>
        </div>
        
        <div className="flex items-center">
          <label className="text-sm mr-1 w-10">Find:</label>
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Name..."
            className="border px-1 py-1 rounded text-sm flex-1"
          />
        </div>
        
        <div className="flex items-center">
          <label className="text-sm mr-1 w-10">Club:</label>
          <select
            value={clubFilter}
            onChange={(e) => setClubFilter(e.target.value)}
            className="border rounded px-1 py-1 text-sm flex-1"
          >
            <option value="">All</option>
            {uniqueClubs.map(club => (
              <option key={club} value={club}>{club}</option>
            ))}
          </select>
        </div>
        
        <div className="flex items-center">
          <label className="text-sm mr-1 w-10">Type:</label>
          <select
            value={raceTypeFilter}
            onChange={(e) => setRaceTypeFilter(e.target.value)}
            className="border rounded px-1 py-1 text-sm flex-1"
          >
            <option value="all">All</option>
            <option value="roadAndTrack">Road & Track</option>
            <option value="cyclocross">Cyclocross</option>
          </select>
        </div>
        
        <div className="flex items-center">
          <button
            onClick={handleClearFilters}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-1 rounded text-xs"
          >
            Clear Filters
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedFilteredRacers.map(([racerId, racer]) => (
          <div key={racerId} className="rounded-2xl shadow-md border p-4 space-y-2 bg-white">
            <div className="text-xl font-semibold">{racer.name}</div>
            <div className="text-sm text-gray-500">BC No: {racerId}</div>
            <div className="text-sm text-gray-500">Club: {racer.club}</div>
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
            <div className="flex gap-2">
              <button
                onClick={() => window.open(`https://www.britishcycling.org.uk/points?d=4&person_id=${racerId}&year=${year}`, "_blank")}
                className="bg-gray-200 px-3 py-1 rounded text-xs"
              >
                Road Results
              </button>
              <button
                onClick={() => window.open(`https://www.britishcycling.org.uk/points?d=6&person_id=${racerId}&year=${year}`, "_blank")}
                className="bg-gray-200 px-3 py-1 rounded text-xs"
              >
                CX Results
              </button>
            </div>
          </div>
        ))}
      </div>
      </div>
    </LoadingOverlay>
  );
}