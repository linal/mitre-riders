import React, { useState, useEffect, useContext } from "react";
import { useSearchParams } from "react-router-dom";
import LoadingOverlay from "react-loading-overlay-ts";
import { ThemeContext } from "../main";

export default function RiderSummary() {
  const { darkMode } = useContext(ThemeContext);
  const [searchParams, setSearchParams] = useSearchParams();
  const [year, setYear] = useState(searchParams.get("year") || new Date().getFullYear().toString());
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [clubFilter, setClubFilter] = useState(searchParams.get("club") || "");
  const [summary, setSummary] = useState({
    totalRiders: 0,
    activeRiders: 0,
    totalRaces: 0,
    totalPoints: 0,
    roadAndTrack: {
      riders: 0,
      races: 0,
      points: 0,
      regionalPoints: 0,
      nationalPoints: 0
    },
    cyclocross: {
      riders: 0,
      races: 0,
      points: 0,
      regionalPoints: 0,
      nationalPoints: 0
    },
    categories: {},
    clubs: {}
  });

  const fetchRaceData = async () => {
    setLoading(true);
    try {
      // Use environment variable in production or default to current origin or localhost
      const apiBase = import.meta.env.VITE_API_BASE_URL || window.location.origin || 'http://localhost:3001';
      const url = `${apiBase}/api/all-race-data?year=${year}`;
      const response = await fetch(url);
      const allData = await response.json();
      
      setData(allData);
      calculateSummary(allData);
    } catch (error) {
      console.error("Error fetching race data:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateSummary = (data) => {
    const summary = {
      totalRiders: Object.keys(data).length,
      activeRiders: 0,
      totalRaces: 0,
      totalPoints: 0,
      roadAndTrack: {
        riders: 0,
        races: 0,
        points: 0,
        regionalPoints: 0,
        nationalPoints: 0
      },
      cyclocross: {
        riders: 0,
        races: 0,
        points: 0,
        regionalPoints: 0,
        nationalPoints: 0
      },
      categories: {},
      clubs: {}
    };

    // Process each rider's data
    Object.values(data)
      // Apply club filter if set
      .filter(rider => !clubFilter || rider.club === clubFilter)
      .forEach(rider => {
      // Count active riders (those with at least one race)
      if (rider.raceCount > 0) {
        summary.activeRiders++;
      }

      // Total races and points
      summary.totalRaces += rider.raceCount || 0;
      summary.totalPoints += rider.points || 0;

      // Road & Track stats
      if (rider.roadAndTrackRaceCount > 0) {
        summary.roadAndTrack.riders++;
        summary.roadAndTrack.races += rider.roadAndTrackRaceCount || 0;
        summary.roadAndTrack.points += rider.roadAndTrackPoints || 0;
        summary.roadAndTrack.regionalPoints += rider.roadRegionalPoints || 0;
        summary.roadAndTrack.nationalPoints += rider.roadNationalPoints || 0;
      }

      // Cyclocross stats
      if (rider.cyclocrossRaceCount > 0) {
        summary.cyclocross.riders++;
        summary.cyclocross.races += rider.cyclocrossRaceCount || 0;
        summary.cyclocross.points += rider.cyclocrossPoints || 0;
        summary.cyclocross.regionalPoints += rider.cxRegionalPoints || 0;
        summary.cyclocross.nationalPoints += rider.cxNationalPoints || 0;
      }

      // Categories
      const category = rider.category || 'Unlicensed';
      if (!summary.categories[category]) {
        summary.categories[category] = {
          count: 0,
          points: 0,
          races: 0
        };
      }
      summary.categories[category].count++;
      summary.categories[category].points += rider.points || 0;
      summary.categories[category].races += rider.raceCount || 0;

      // Clubs
      const club = rider.club || 'Unknown';
      if (!summary.clubs[club]) {
        summary.clubs[club] = {
          count: 0,
          points: 0,
          races: 0
        };
      }
      summary.clubs[club].count++;
      summary.clubs[club].points += rider.points || 0;
      summary.clubs[club].races += rider.raceCount || 0;
    });

    setSummary(summary);
  };

  useEffect(() => {
    fetchRaceData();
  }, [year]);

  // Recalculate summary when club filter changes
  useEffect(() => {
    if (Object.keys(data).length > 0) {
      calculateSummary(data);
    }
  }, [clubFilter]);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (year !== new Date().getFullYear().toString()) {
      params.set("year", year);
    }
    if (clubFilter) {
      params.set("club", clubFilter);
    }
    setSearchParams(params);
  }, [year, clubFilter, setSearchParams]);

  const handleYearChange = (e) => {
    setYear(e.target.value);
  };
  
  const handleClubFilterChange = (e) => {
    setClubFilter(e.target.value);
  };

  return (
    <LoadingOverlay
      active={loading}
      spinner
      text="Loading rider summary data..."
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
              Rider Summary {clubFilter && `- ${clubFilter}`}
            </h3>
          </div>
          <p className={`text-sm leading-relaxed ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            This page provides a summary of rider data across all club members. View statistics by year, including total races, points, and breakdowns by discipline. Use the club filter to focus on specific clubs.
          </p>
        </div>

        {/* Year and club selector */}
        <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
          <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4">
            <div className="flex-1">
              <label htmlFor="year" className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Year
              </label>
              <select
                id="year"
                value={year}
                onChange={handleYearChange}
                className={`mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md ${
                  darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-white'
                }`}
              >
                <option value="2025">2025</option>
                <option value="2024">2024</option>
                <option value="2023">2023</option>
                <option value="2022">2022</option>
                <option value="2021">2021</option>
              </select>
            </div>
            <div className="flex-1">
              <label htmlFor="club" className={`block text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Filter by Club
              </label>
              <select
                id="club"
                value={clubFilter}
                onChange={handleClubFilterChange}
                className={`mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md ${
                  darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-white'
                }`}
              >
                <option value="">All Clubs</option>
                {Object.keys(summary.clubs).sort().map(club => (
                  <option key={club} value={club}>{club}</option>
                ))}
              </select>
            </div>
            <div className="flex-shrink-0 self-end">
              <button
                onClick={fetchRaceData}
                disabled={loading}
                className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm ${
                  darkMode
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
              >
                {loading ? 'Loading...' : 'Refresh Data'}
              </button>
            </div>
          </div>
        </div>

        {/* Overall summary */}
        <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
          <h3 className={`text-lg font-medium mb-3 ${darkMode ? 'text-white' : 'text-gray-800'}`}>Overall Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-white'} shadow-sm`}>
              <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Riders</div>
              <div className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>{summary.totalRiders}</div>
            </div>
            <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-white'} shadow-sm`}>
              <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Active Riders</div>
              <div className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>{summary.activeRiders}</div>
            </div>
            <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-white'} shadow-sm`}>
              <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Races</div>
              <div className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>{summary.totalRaces}</div>
            </div>
            <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-white'} shadow-sm`}>
              <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Points</div>
              <div className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>{summary.totalPoints}</div>
            </div>
          </div>
        </div>

        {/* Discipline breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Road & Track */}
          <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
            <h3 className={`text-lg font-medium mb-3 ${darkMode ? 'text-white' : 'text-gray-800'}`}>Road & Track</h3>
            <div className="space-y-3">
              <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-white'} shadow-sm`}>
                <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Active Riders</div>
                <div className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>{summary.roadAndTrack.riders}</div>
              </div>
              <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-white'} shadow-sm`}>
                <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Races</div>
                <div className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>{summary.roadAndTrack.races}</div>
              </div>
              <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-white'} shadow-sm`}>
                <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Points</div>
                <div className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>{summary.roadAndTrack.points}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-white'} shadow-sm`}>
                  <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Regional Points</div>
                  <div className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>{summary.roadAndTrack.regionalPoints}</div>
                </div>
                <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-white'} shadow-sm`}>
                  <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>National Points</div>
                  <div className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>{summary.roadAndTrack.nationalPoints}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Cyclocross */}
          <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
            <h3 className={`text-lg font-medium mb-3 ${darkMode ? 'text-white' : 'text-gray-800'}`}>Cyclocross</h3>
            <div className="space-y-3">
              <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-white'} shadow-sm`}>
                <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Active Riders</div>
                <div className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>{summary.cyclocross.riders}</div>
              </div>
              <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-white'} shadow-sm`}>
                <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Races</div>
                <div className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>{summary.cyclocross.races}</div>
              </div>
              <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-white'} shadow-sm`}>
                <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Points</div>
                <div className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>{summary.cyclocross.points}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-white'} shadow-sm`}>
                  <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Regional Points</div>
                  <div className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>{summary.cyclocross.regionalPoints}</div>
                </div>
                <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-white'} shadow-sm`}>
                  <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>National Points</div>
                  <div className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>{summary.cyclocross.nationalPoints}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Categories breakdown */}
        <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
          <h3 className={`text-lg font-medium mb-3 ${darkMode ? 'text-white' : 'text-gray-800'}`}>Categories</h3>
          <div className="overflow-x-auto">
            <table className={`min-w-full divide-y divide-gray-200 ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>
              <thead className={darkMode ? 'bg-gray-700' : 'bg-gray-50'}>
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Category</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Riders</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Races</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Points</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Avg Points/Rider</th>
                </tr>
              </thead>
              <tbody className={`divide-y divide-gray-200 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                {Object.entries(summary.categories)
                  .sort((a, b) => {
                    // Sort categories with "1st" first, then "2nd", etc.
                    const categoryOrder = {
                      "1st": 1,
                      "2nd": 2,
                      "3rd": 3,
                      "4th": 4,
                      "Unlicensed": 5
                    };
                    
                    const aOrder = Object.keys(categoryOrder).find(key => a[0].includes(key)) 
                      ? categoryOrder[Object.keys(categoryOrder).find(key => a[0].includes(key))]
                      : 6;
                    
                    const bOrder = Object.keys(categoryOrder).find(key => b[0].includes(key))
                      ? categoryOrder[Object.keys(categoryOrder).find(key => b[0].includes(key))]
                      : 6;
                    
                    return aOrder - bOrder;
                  })
                  .map(([category, data]) => (
                    <tr key={category}>
                      <td className="px-6 py-4 whitespace-nowrap">{category}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{data.count}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{data.races}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{data.points}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {data.count > 0 ? (data.points / data.count).toFixed(1) : 0}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Clubs breakdown */}
        <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
          <h3 className={`text-lg font-medium mb-3 ${darkMode ? 'text-white' : 'text-gray-800'}`}>Clubs</h3>
          <div className="overflow-x-auto">
            <table className={`min-w-full divide-y divide-gray-200 ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>
              <thead className={darkMode ? 'bg-gray-700' : 'bg-gray-50'}>
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Club</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Riders</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Races</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Points</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Avg Points/Rider</th>
                </tr>
              </thead>
              <tbody className={`divide-y divide-gray-200 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                {Object.entries(summary.clubs)
                  .sort((a, b) => b[1].points - a[1].points)
                  .map(([club, data]) => (
                    <tr key={club}>
                      <td className="px-6 py-4 whitespace-nowrap">{club}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{data.count}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{data.races}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{data.points}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {data.count > 0 ? (data.points / data.count).toFixed(1) : 0}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </LoadingOverlay>
  );
}