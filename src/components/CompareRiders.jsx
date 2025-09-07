import React, { useContext, useEffect, useMemo, useState } from 'react';
import { ThemeContext } from '../main';
import { useSearchParams } from 'react-router-dom';

export default function CompareRiders() {
  const { darkMode } = useContext(ThemeContext);
  const [searchParams, setSearchParams] = useSearchParams();

  const initialYear = searchParams.get('year') || String(new Date().getFullYear());
  const initialRiderA = searchParams.get('riderA') || '';
  const initialRiderB = searchParams.get('riderB') || '';

  const [riders, setRiders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [riderA, setRiderA] = useState(initialRiderA);
  const [riderB, setRiderB] = useState(initialRiderB);
  const [year, setYear] = useState(initialYear);
  const [status, setStatus] = useState('');
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState('');
  const [riderAData, setRiderAData] = useState(null);
  const [riderBData, setRiderBData] = useState(null);
  const [lastComparedKey, setLastComparedKey] = useState('');

  useEffect(() => {
    let isMounted = true;
    async function loadRiders() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch('/api/racers');
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.message || response.statusText || 'Failed to fetch riders');
        }
        if (isMounted) {
          setRiders(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (isMounted) setError(err.message || 'Failed to fetch riders');
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadRiders();
    return () => {
      isMounted = false;
    };
  }, []);

  // Keep URL in sync with selections
  useEffect(() => {
    const params = new URLSearchParams();
    if (riderA) params.set('riderA', riderA);
    if (riderB) params.set('riderB', riderB);
    if (year) params.set('year', year);
    setSearchParams(params);
  }, [riderA, riderB, year, setSearchParams]);

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    const years = [];
    for (let y = current; y >= current - 6; y--) years.push(String(y));
    return years;
  }, []);

  const canCompare = riderA && riderB && riderA !== riderB && year && !loading && !error;

  const handleCompare = async (e) => {
    if (e) e.preventDefault();
    if (!canCompare) return;
    setCompareError('');
    setStatus('');
    setCompareLoading(true);
    setRiderAData(null);
    setRiderBData(null);
    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL || window.location.origin || 'http://localhost:3001';
      const url = `${apiBase}/api/all-race-data?year=${encodeURIComponent(year)}`;
      const response = await fetch(url);
      const allData = await response.json();
      if (!response.ok) {
        throw new Error(allData?.message || response.statusText || 'Failed to fetch race data');
      }
      const a = allData?.[riderA] || null;
      const b = allData?.[riderB] || null;
      if (!a || !b) {
        throw new Error('Comparison data not found for one or both riders.');
      }
      setRiderAData(a);
      setRiderBData(b);
      const aName = riders.find(r => r.bc === riderA)?.name || a.name || riderA;
      const bName = riders.find(r => r.bc === riderB)?.name || b.name || riderB;
      setStatus(`Comparing ${aName} vs ${bName} for ${year}.`);
      setLastComparedKey(`${riderA}|${riderB}|${year}`);
    } catch (err) {
      setCompareError(err.message || 'Failed to fetch comparison data');
    } finally {
      setCompareLoading(false);
    }
  };

  // Auto-compare when URL has riderA, riderB, and year
  useEffect(() => {
    const key = `${riderA}|${riderB}|${year}`;
    if (!loading && canCompare && key !== lastComparedKey && !compareLoading) {
      handleCompare();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, riderA, riderB, year]);

  const StatRow = ({ label, aValue, bValue, formatter }) => {
    const format = (v) => formatter ? formatter(v) : (v ?? 0);
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center py-2 border-t border-gray-200 dark:border-gray-700">
        <div className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{label}</div>
        <div className={`text-base font-medium ${darkMode ? 'text-white' : 'text-gray-800'}`}>{format(aValue)}</div>
        <div className={`text-base font-medium ${darkMode ? 'text-white' : 'text-gray-800'}`}>{format(bValue)}</div>
      </div>
    );
  };

  const RiderHeader = ({ title, rider, data }) => (
    <div>
      <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{title}</div>
      <div className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
        {rider?.name || data?.name || 'Unknown'}
      </div>
      <div className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
        {rider?.bc} • {data?.club || 'Unknown'} {data?.category ? `• ${data.category}` : ''}
      </div>
    </div>
  );

  return (
    <div className={`p-4 space-y-4 ${darkMode ? 'dark bg-gray-900 text-white' : 'bg-white'}`}>
      <div className={`border-l-4 border-blue-600 rounded shadow-md p-4 mb-6 mx-2 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <h3 className={`text-lg font-medium ${darkMode ? 'text-white' : 'text-gray-800'}`}>Compare Riders</h3>
        <p className={`text-sm leading-relaxed ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          Select two riders and a year, then press Compare. The URL updates so you can share it.
        </p>
      </div>

      <form onSubmit={handleCompare} className={`p-6 ${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md space-y-4`}>
        {loading && (
          <div className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Loading riders...</div>
        )}
        {error && (
          <div className={`${darkMode ? 'bg-red-900 text-red-200' : 'bg-red-100 text-red-800'} p-3 rounded`}>{error}</div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block mb-2 text-sm font-medium">Rider A</label>
            <select
              className={`w-full p-2 border rounded-md ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
              value={riderA}
              onChange={(e) => setRiderA(e.target.value)}
              disabled={loading || !!error}
            >
              <option value="">Select rider...</option>
              {riders.map((r) => (
                <option key={r.bc} value={r.bc}>
                  {(r.name ? r.name : 'Unknown') + ` (${r.bc})`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block mb-2 text-sm font-medium">Rider B</label>
            <select
              className={`w-full p-2 border rounded-md ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
              value={riderB}
              onChange={(e) => setRiderB(e.target.value)}
              disabled={loading || !!error}
            >
              <option value="">Select rider...</option>
              {riders.map((r) => (
                <option key={r.bc} value={r.bc}>
                  {(r.name ? r.name : 'Unknown') + ` (${r.bc})`}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="max-w-xs">
          <label className="block mb-2 text-sm font-medium">Year</label>
          <select
            className={`w-full p-2 border rounded-md ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
            value={year}
            onChange={(e) => setYear(e.target.value)}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={!canCompare || compareLoading}
          className={`px-4 py-2 rounded-md ${
            darkMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'
          } ${(!canCompare || compareLoading) ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {compareLoading ? 'Comparing...' : 'Compare'}
        </button>

        {compareError && (
          <div className={`${darkMode ? 'bg-red-900 text-red-200' : 'bg-red-100 text-red-800'} p-3 rounded`}>{compareError}</div>
        )}
        {status && !compareError && (
          <div className={`${darkMode ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-800'} p-3 rounded`}>{status}</div>
        )}
      </form>

      {(riderAData && riderBData) && (
        <div className={`p-6 ${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-md`}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 items-end">
            <RiderHeader title="Rider A" rider={riders.find(r => r.bc === riderA)} data={riderAData} />
            <div />
            <RiderHeader title="Rider B" rider={riders.find(r => r.bc === riderB)} data={riderBData} />
          </div>

          <div className="grid grid-cols-1">
            <StatRow label="Total Points" aValue={riderAData.points} bValue={riderBData.points} />
            <StatRow label="Total Races" aValue={riderAData.raceCount} bValue={riderBData.raceCount} />
            <StatRow label="Road & Track Points" aValue={riderAData.roadAndTrackPoints} bValue={riderBData.roadAndTrackPoints} />
            <StatRow label="Road & Track Races" aValue={riderAData.roadAndTrackRaceCount} bValue={riderBData.roadAndTrackRaceCount} />
            <StatRow label="Cyclocross Points" aValue={riderAData.cyclocrossPoints} bValue={riderBData.cyclocrossPoints} />
            <StatRow label="Cyclocross Races" aValue={riderAData.cyclocrossRaceCount} bValue={riderBData.cyclocrossRaceCount} />
            <StatRow label="Road Regional Points" aValue={riderAData.roadRegionalPoints} bValue={riderBData.roadRegionalPoints} />
            <StatRow label="Road National Points" aValue={riderAData.roadNationalPoints} bValue={riderBData.roadNationalPoints} />
            <StatRow label="CX Regional Points" aValue={riderAData.cxRegionalPoints} bValue={riderBData.cxRegionalPoints} />
            <StatRow label="CX National Points" aValue={riderAData.cxNationalPoints} bValue={riderBData.cxNationalPoints} />
          </div>
        </div>
      )}
    </div>
  );
}
