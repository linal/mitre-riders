import React, { useState, useEffect } from "react";
import LoadingOverlay from "react-loading-overlay-ts";

const racers = [
  { name: "Marek Shafer", bc: "670931", club: "Brighton Mitre CC" },
  { name: "Alwyn Frank", bc: "482041", club: "Brighton Mitre CC" },
  { name: "Nathan Cozens", bc: "987321", club: "Brighton Mitre CC" },
  { name: "Cesare Masset", bc: "1148505", club: "Brighton Mitre CC" },
  { name: "John Tindell", bc: "529480", club: "Brighton Mitre CC" },
  { name: "Jack Smith", bc: "40747", club: "Brighton Mitre CC" },
  { name: "Daniel Magrizos", bc: "925710", club: "Brighton Mitre CC" },
  { name: "Seamus Mcalister", bc: "750617", club: "Brighton Mitre CC" },
  { name: "Ben Weaterton", bc: "1149921", club: "Brighton Mitre CC" },
  { name: "Thomas Houghton", bc: "57471", club: "Brighton Mitre CC" },
  { name: "Jash Hutheesing", bc: "1040818", club: "Brighton Mitre CC" },
  { name: "Karla Boddy", bc: "133044", club: "Brighton Mitre CC" },
  { name: "Ernesto Battinelli", bc: "746844", club: "Brighton Mitre CC" },
  { name: "Russell Bickle", bc: "442746", club: "Brighton Mitre CC" },
  { name: "Mark Day", bc: "651560", club: "Brighton Mitre CC" },
  { name: "Richard Mount", bc: "335910", club: "Sussex Revolution Velo Club" }
];

async function fetchRaceData(personId, year) {
  // Use environment variable in production or default to current origin or localhost
  const apiBase = import.meta.env.VITE_API_BASE_URL || window.location.origin || 'http://localhost:3000';
  const url = `${apiBase}/api/race-data?person_id=${personId}&year=${year}`;
  const response = await fetch(url);
  return await response.json();
}

export default function RaceChecker() {
  const [year, setYear] = useState("2025");
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState("name");
  const [filterText, setFilterText] = useState("");
  const [clubFilter, setClubFilter] = useState("");

  const handleCheckAll = async () => {
    setLoading(true);
    const newData = {};
    for (const racer of racers) {
      newData[racer.bc] = await fetchRaceData(racer.bc, year);
      console.log(racer.bc, newData[racer.bc])
    }
    setData(newData);
    setLoading(false);
  };
  
  useEffect(() => {
    handleCheckAll();
  }, []);

  // Get unique clubs for the dropdown
  const uniqueClubs = [...new Set(racers.map(racer => racer.club))];

  const sortedFilteredRacers = [...racers]
    .filter(r => r.name.toLowerCase().includes(filterText.toLowerCase()))
    .filter(r => clubFilter === "" || r.club === clubFilter)
    .sort((a, b) => {
      const aData = data[a.bc];
      const bData = data[b.bc];
      if (sortKey === "name") {
        return a.name.localeCompare(b.name);
      } else if (sortKey === "races") {
        return (bData?.raceCount || 0) - (aData?.raceCount || 0);
      } else if (sortKey === "roadAndTrack") {
        return (bData?.roadAndTrackPoints || 0) - (aData?.roadAndTrackPoints || 0);
      } else if (sortKey === "cyclocross") {
        return (bData?.cyclocrossPoints || 0) - (aData?.cyclocrossPoints || 0);
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
              onClick={handleCheckAll}
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
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedFilteredRacers.map((racer, idx) => (
          <div key={idx} className="rounded-2xl shadow-md border p-4 space-y-2 bg-white">
            <div className="text-xl font-semibold">{racer.name}</div>
            <div className="text-sm text-gray-500">BC No: {racer.bc}</div>
            <div className="text-sm text-gray-500">Club: {racer.club}</div>
            <div className="space-y-2">
              <div className="flex gap-2 items-center flex-wrap">
                {data[racer.bc] && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Total Races: {data[racer.bc].raceCount}
                  </span>
                )}
                {data[racer.bc]?.roadAndTrackRaceCount > 0 && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    Road & Track: {data[racer.bc].roadAndTrackRaceCount} races
                  </span>
                )}
                {data[racer.bc]?.cyclocrossRaceCount > 0 && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    Cyclocross: {data[racer.bc].cyclocrossRaceCount} races
                  </span>
                )}
              </div>
              <div className="flex gap-2 items-center flex-wrap">
                {data[racer.bc]?.roadAndTrackPoints > 0 && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    Road & Track: {data[racer.bc].roadAndTrackPoints} pts
                  </span>
                )}
                {data[racer.bc]?.cyclocrossPoints > 0 && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    Cyclocross: {data[racer.bc].cyclocrossPoints} pts
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => window.open(`https://www.britishcycling.org.uk/points?d=4&person_id=${racer.bc}&year=${year}`, "_blank")}
                className="bg-gray-200 px-3 py-1 rounded text-xs"
              >
                Road Results
              </button>
              <button
                onClick={() => window.open(`https://www.britishcycling.org.uk/points?d=6&person_id=${racer.bc}&year=${year}`, "_blank")}
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