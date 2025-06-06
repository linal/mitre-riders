import React, { useState, useEffect, useContext } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import LoadingOverlay from "react-loading-overlay-ts";
import { ThemeContext } from "../main";

export default function ClubSummary() {
  const { darkMode } = useContext(ThemeContext);
  const { clubName } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [year, setYear] = useState(searchParams.get("year") || new Date().getFullYear().toString());
  const [data, setData] = useState({});
  const [prevYearData, setPrevYearData] = useState({});
  const [loading, setLoading] = useState(true);
  const [showComparison, setShowComparison] = useState(true);
  const [summary, setSummary] = useState({
    activeRiders: 0,
    totalRaces: 0,
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
  const [prevYearSummary, setPrevYearSummary] = useState({
    activeRiders: 0,
    totalRaces: 0,
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
      
      // Fetch current year data
      const url = `${apiBase}/api/all-race-data?year=${year}`;
      const response = await fetch(url);
      const allData = await response.json();
      
      setData(allData);
      calculateSummary(allData, setSummary);
      
      // Fetch previous year data for comparison
      const prevYear = (parseInt(year) - 1).toString();
      const prevYearUrl = `${apiBase}/api/all-race-data?year=${prevYear}`;
      const prevYearResponse = await fetch(prevYearUrl);
      const prevYearAllData = await prevYearResponse.json();
      
      setPrevYearData(prevYearAllData);
      calculateSummary(prevYearAllData, setPrevYearSummary);
    } catch (error) {
      console.error("Error fetching race data:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateSummary = (data, setSummaryFunc) => {
    const summary = {
      activeRiders: 0,
      totalRaces: 0,
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
      categories: {}
    };

    // Process each rider's data
    Object.values(data)
      // Apply club filter if clubName is provided
      .filter(rider => !clubName || rider.club === decodeURIComponent(clubName))
      .forEach(rider => {
      // Count active riders (those with at least one race)
      if (rider.raceCount > 0) {
        summary.activeRiders++;
      }

      // Total races and points
      summary.totalRaces += rider.raceCount || 0;

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
    });

    setSummaryFunc(summary);
  };

  // Calculate percentage change between current and previous year
  const calculateChange = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  // Format percentage change with + or - sign and color, including actual values
  const formatChange = (change, current, previous) => {
    const formattedValue = change > 0 ? `+${change.toFixed(1)}% (${previous} → ${current})` : `${change.toFixed(1)}% (${previous} → ${current})`;
    const colorClass = change > 0 ? 'text-green-500' : change < 0 ? 'text-red-500' : 'text-gray-500';
    return <span className={colorClass}>{formattedValue}</span>;
  };

  useEffect(() => {
    fetchRaceData();
  }, [year, clubName]);

  // Update URL when year changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (year !== new Date().getFullYear().toString()) {
      params.set("year", year);
    }
    setSearchParams(params);
  }, [year, setSearchParams]);

  const handleYearChange = (e) => {
    setYear(e.target.value);
  };
  
  const toggleComparison = () => {
    setShowComparison(!showComparison);
  };

  return (
    <LoadingOverlay
      active={loading}
      spinner
      text="Loading club summary data..."
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
              Club Summary {clubName && `- ${decodeURIComponent(clubName)}`}
            </h3>
            {clubName && (
              <Link 
                to={`/clubs/${clubName}/riders`}
                className={`px-3 py-1 rounded text-sm ${darkMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
              >
                View Riders
              </Link>
            )}
          </div>
          <p className={`text-sm leading-relaxed ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            View statistics by year with year-over-year comparisons. See total races, points, and breakdowns by discipline.
            <Link to="/about" className="ml-1 text-blue-500 hover:underline">Learn more</Link> about how this works.
          </p>
        </div>

        {/* Year selector */}
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
            <div className="flex-shrink-0 self-end flex space-x-2">
              <button
                onClick={toggleComparison}
                className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm ${
                  darkMode
                    ? 'bg-gray-600 hover:bg-gray-700 text-white'
                    : 'bg-gray-500 hover:bg-gray-600 text-white'
                } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500`}
              >
                {showComparison ? 'Hide Comparison' : 'Show Comparison'}
              </button>
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
          <div className="flex justify-between items-center mb-3">
            <h3 className={`text-lg font-medium ${darkMode ? 'text-white' : 'text-gray-800'}`}>Overall Summary</h3>
            {showComparison && (
              <div className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Comparing {year} with {parseInt(year) - 1}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
            <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-white'} shadow-sm`}>
              <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Active Riders</div>
              <div className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                {summary.activeRiders}
                {showComparison && (
                  <span className="ml-2 text-sm">
                    {formatChange(calculateChange(summary.activeRiders, prevYearSummary.activeRiders), summary.activeRiders, prevYearSummary.activeRiders)}
                  </span>
                )}
              </div>
            </div>
            <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-white'} shadow-sm`}>
              <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Races</div>
              <div className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                {summary.totalRaces}
                {showComparison && (
                  <span className="ml-2 text-sm">
                    {formatChange(calculateChange(summary.totalRaces, prevYearSummary.totalRaces), summary.totalRaces, prevYearSummary.totalRaces)}
                  </span>
                )}
              </div>
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
                <div className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                  {summary.roadAndTrack.riders}
                  {showComparison && (
                    <span className="ml-2 text-sm">
                      {formatChange(calculateChange(summary.roadAndTrack.riders, prevYearSummary.roadAndTrack.riders), summary.roadAndTrack.riders, prevYearSummary.roadAndTrack.riders)}
                    </span>
                  )}
                </div>
              </div>
              <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-white'} shadow-sm`}>
                <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Races</div>
                <div className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                  {summary.roadAndTrack.races}
                  {showComparison && (
                    <span className="ml-2 text-sm">
                      {formatChange(calculateChange(summary.roadAndTrack.races, prevYearSummary.roadAndTrack.races), summary.roadAndTrack.races, prevYearSummary.roadAndTrack.races)}
                    </span>
                  )}
                </div>
              </div>
              <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-white'} shadow-sm`}>
                <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Points</div>
                <div className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                  {summary.roadAndTrack.points}
                  {showComparison && (
                    <span className="ml-2 text-sm">
                      {formatChange(calculateChange(summary.roadAndTrack.points, prevYearSummary.roadAndTrack.points), summary.roadAndTrack.points, prevYearSummary.roadAndTrack.points)}
                    </span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-white'} shadow-sm`}>
                  <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Regional Points</div>
                  <div className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                    {summary.roadAndTrack.regionalPoints}
                    {showComparison && (
                      <span className="ml-2 text-sm">
                        {formatChange(calculateChange(summary.roadAndTrack.regionalPoints, prevYearSummary.roadAndTrack.regionalPoints), summary.roadAndTrack.regionalPoints, prevYearSummary.roadAndTrack.regionalPoints)}
                      </span>
                    )}
                  </div>
                </div>
                <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-white'} shadow-sm`}>
                  <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>National Points</div>
                  <div className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                    {summary.roadAndTrack.nationalPoints}
                    {showComparison && (
                      <span className="ml-2 text-sm">
                        {formatChange(calculateChange(summary.roadAndTrack.nationalPoints, prevYearSummary.roadAndTrack.nationalPoints), summary.roadAndTrack.nationalPoints, prevYearSummary.roadAndTrack.nationalPoints)}
                      </span>
                    )}
                  </div>
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
                <div className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                  {summary.cyclocross.riders}
                  {showComparison && (
                    <span className="ml-2 text-sm">
                      {formatChange(calculateChange(summary.cyclocross.riders, prevYearSummary.cyclocross.riders), summary.cyclocross.riders, prevYearSummary.cyclocross.riders)}
                    </span>
                  )}
                </div>
              </div>
              <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-white'} shadow-sm`}>
                <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Races</div>
                <div className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                  {summary.cyclocross.races}
                  {showComparison && (
                    <span className="ml-2 text-sm">
                      {formatChange(calculateChange(summary.cyclocross.races, prevYearSummary.cyclocross.races), summary.cyclocross.races, prevYearSummary.cyclocross.races)}
                    </span>
                  )}
                </div>
              </div>
              <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-white'} shadow-sm`}>
                <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Points</div>
                <div className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                  {summary.cyclocross.points}
                  {showComparison && (
                    <span className="ml-2 text-sm">
                      {formatChange(calculateChange(summary.cyclocross.points, prevYearSummary.cyclocross.points), summary.cyclocross.points, prevYearSummary.cyclocross.points)}
                    </span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-white'} shadow-sm`}>
                  <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Regional Points</div>
                  <div className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                    {summary.cyclocross.regionalPoints}
                    {showComparison && (
                      <span className="ml-2 text-sm">
                        {formatChange(calculateChange(summary.cyclocross.regionalPoints, prevYearSummary.cyclocross.regionalPoints), summary.cyclocross.regionalPoints, prevYearSummary.cyclocross.regionalPoints)}
                      </span>
                    )}
                  </div>
                </div>
                <div className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-white'} shadow-sm`}>
                  <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>National Points</div>
                  <div className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                    {summary.cyclocross.nationalPoints}
                    {showComparison && (
                      <span className="ml-2 text-sm">
                        {formatChange(calculateChange(summary.cyclocross.nationalPoints, prevYearSummary.cyclocross.nationalPoints), summary.cyclocross.nationalPoints, prevYearSummary.cyclocross.nationalPoints)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Year-over-year comparison summary */}
        {showComparison && (
          <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
            <h3 className={`text-lg font-medium mb-3 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
              Year-over-Year Comparison Summary
            </h3>
            <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-white'} shadow-sm`}>
              <p className={`mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Comparing {year} with {parseInt(year) - 1}:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  Active riders: {summary.activeRiders} vs {prevYearSummary.activeRiders} 
                  ({formatChange(calculateChange(summary.activeRiders, prevYearSummary.activeRiders), summary.activeRiders, prevYearSummary.activeRiders)})
                </li>
                <li>
                  Total races: {summary.totalRaces} vs {prevYearSummary.totalRaces} 
                  ({formatChange(calculateChange(summary.totalRaces, prevYearSummary.totalRaces), summary.totalRaces, prevYearSummary.totalRaces)})
                </li>
                <li>
                  Road & Track points: {summary.roadAndTrack.points} vs {prevYearSummary.roadAndTrack.points} 
                  ({formatChange(calculateChange(summary.roadAndTrack.points, prevYearSummary.roadAndTrack.points), summary.roadAndTrack.points, prevYearSummary.roadAndTrack.points)})
                </li>
                <li>
                  Cyclocross points: {summary.cyclocross.points} vs {prevYearSummary.cyclocross.points} 
                  ({formatChange(calculateChange(summary.cyclocross.points, prevYearSummary.cyclocross.points), summary.cyclocross.points, prevYearSummary.cyclocross.points)})
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </LoadingOverlay>
  );
}