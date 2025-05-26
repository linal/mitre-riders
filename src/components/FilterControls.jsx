import React from "react";

export default function FilterControls({
  darkMode,
  toggleDarkMode,
  year,
  setYear,
  loading,
  fetchRaceData,
  filterText,
  setFilterText,
  sortKey,
  setSortKey,
  raceTypeFilter,
  setRaceTypeFilter,
  categoryFilter,
  setCategoryFilter,
  handleClearFilters
}) {
  return (
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
            <option value="roadAndTrackRaceCount">Road & Track Race Count</option>
            <option value="cyclocrossRaceCount">Cyclocross Race Count</option>
            <option value="roadAndTrack">Road & Track Pts</option>
            <option value="roadRegional">Road Regional Pts</option>
            <option value="roadNational">Road National Pts</option>
            <option value="cyclocross">Cyclocross Pts</option>
            <option value="cxRegional">CX Regional Pts</option>
            <option value="cxNational">CX National Pts</option>
            <option value="category">Category</option>
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
  );
}