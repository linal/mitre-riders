import React, { useState } from "react";

const racers = [
  { name: "Marek Shafer", bc: "670931" },
  { name: "Alwyn Frank", bc: "482041" },
  { name: "Nathan Cozens", bc: "987321" },
  { name: "Cesare Masset", bc: "1148505" },
  { name: "John Tindell", bc: "529480" },
  { name: "Jack Smith", bc: "40747" },
  { name: "Daniel Magrizos", bc: "925710" },
  { name: "Seamus Mcalister", bc: "750617" },
  { name: "Ben Weaterton", bc: "1149921" },
  { name: "Thomas Houghton", bc: "57471" },
  { name: "Jash Hutheesing", bc: "1040818" },
  { name: "Karla Boddy", bc: "133044" },
  { name: "Ernesto Battinelli", bc: "746844" },
  { name: "Russell Bickle", bc: "442746" },
  { name: "Mark Day", bc: "651560" },
];

async function fetchRaceData(personId, year) {
  const apiBase = process.env.REACT_APP_API_URL || 'http://localhost:3000';
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

  const sortedFilteredRacers = [...racers]
    .filter(r => r.name.toLowerCase().includes(filterText.toLowerCase()))
    .sort((a, b) => {
      const aData = data[a.bc];
      const bData = data[b.bc];
      if (sortKey === "name") {
        return a.name.localeCompare(b.name);
      } else if (sortKey === "races") {
        return (bData?.raceCount || 0) - (aData?.raceCount || 0);
      } else if (sortKey === "points") {
        return (bData?.points || 0) - (aData?.points || 0);
      }
      return 0;
    });

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label>Year:</label>
<select
  value={year}
  onChange={(e) => setYear(e.target.value)}
  className="border rounded px-2 py-1"
>
  {[...Array(10)].map((_, i) => {
    const y = 2025 - i;
    return <option key={y} value={y}>{y}</option>;
  })}
</select>
          <button
            onClick={handleCheckAll}
            disabled={loading}
            className="bg-blue-600 text-white px-3 py-1 rounded"
          >
            {loading ? "Checking..." : "Check Race Data"}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <label>Sort by:</label>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
            className="border rounded px-2 py-1"
          >
            <option value="name">Name</option>
            <option value="races">Race Count</option>
            <option value="points">Points</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label>Filter:</label>
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Search names..."
            className="border px-2 py-1 rounded"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedFilteredRacers.map((racer, idx) => (
          <div key={idx} className="rounded-2xl shadow-md border p-4 space-y-2 bg-white">
            <div className="text-xl font-semibold">{racer.name}</div>
            <div className="text-sm text-gray-500">BC No: {racer.bc}</div>
            <div className="text-sm text-blue-700">
              {data[racer.bc] ? `Races: ${data[racer.bc].raceCount}` : "Not checked"}
            </div>
            <div className="text-sm text-green-700">
              {data[racer.bc] ? `Points: ${data[racer.bc].points}` : ""}
            </div>
            <button
              onClick={() => window.open(`https://www.britishcycling.org.uk/points?d=4&person_id=${racer.bc}&year=${year}`, "_blank")}
              className="bg-gray-200 px-3 py-1 rounded"
            >
              View Results
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
