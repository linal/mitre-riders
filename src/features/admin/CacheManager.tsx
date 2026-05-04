import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useBuildCache,
  useCacheList,
  useDeleteCache,
  useRacers,
} from '../../shared/hooks/queries';
import {
  ErrorBanner,
  PageContainer,
  PageHeader,
  SuccessBanner,
} from '../../shared/ui/PageContainer';

export default function CacheManager() {
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [selectedRacer, setSelectedRacer] = useState('');
  const [selectedDiscipline] = useState('road-track');
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: racers = [] } = useRacers();
  const { data: cacheData, isFetching: cacheLoading, refetch, error: cacheError } =
    useCacheList(selectedYear);
  const buildCache = useBuildCache(selectedYear);
  const deleteCache = useDeleteCache(selectedYear);

  const years = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => String(new Date().getFullYear() - i)),
    [],
  );

  const filteredRacers = useMemo(
    () =>
      racers.filter((racer) => {
        const lower = searchTerm.toLowerCase();
        return (
          racer.bc.toLowerCase().includes(lower) ||
          (racer.name?.toLowerCase().includes(lower) ?? false)
        );
      }),
    [racers, searchTerm],
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDelete = async () => {
    if (!window.confirm(`Delete all cache files for ${selectedYear}?`)) return;
    try {
      const result = await deleteCache.mutateAsync();
      setMessage({
        type: 'success',
        text: `Successfully removed ${result.removedFiles} cache files for ${selectedYear}`,
      });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to delete cache',
      });
    }
  };

  const handleBuildAll = async () => {
    if (
      !window.confirm(
        `Build cache for all racers for ${selectedYear} (road & track)? This may take some time.`,
      )
    )
      return;
    try {
      const result = await buildCache.mutateAsync({ discipline: selectedDiscipline });
      setMessage({
        type: 'success',
        text: `Cached ${result.cached} racers (${result.failed} failed)`,
      });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to build cache',
      });
    }
  };

  const handleBuildRacer = async () => {
    if (!selectedRacer) {
      setMessage({ type: 'error', text: 'Please select a racer' });
      return;
    }
    try {
      await buildCache.mutateAsync({ racerId: selectedRacer, discipline: selectedDiscipline });
      setMessage({ type: 'success', text: `Cached data for racer ${selectedRacer}` });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to build cache',
      });
    }
  };

  const loading = cacheLoading || buildCache.isPending || deleteCache.isPending;

  return (
    <PageContainer>
      <PageHeader
        title="Cache Manager"
        description={
          <>
            Manage cached race data by year. View cache statistics and clear cache files when
            needed.{' '}
            <Link to="/about" className="ml-1 text-blue-500 hover:underline">
              Learn more
            </Link>{' '}
            about the caching system.
          </>
        }
      />

      <div className="p-4 rounded-lg mb-4 bg-gray-100 dark:bg-gray-800">
        <div className="flex flex-wrap items-center gap-4 mb-3">
          <div className="flex items-center">
            <label className="text-sm mr-2 text-gray-600 dark:text-gray-300">Year:</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="border rounded px-2 py-1.5 text-sm bg-white border-gray-300 dark:bg-gray-700 dark:text-white dark:border-gray-600"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => refetch()}
            disabled={loading}
            className="flex items-center px-3 py-1.5 rounded text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>

          <button
            onClick={handleBuildAll}
            disabled={loading}
            className="flex items-center px-3 py-1.5 rounded text-xs font-medium text-white bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 disabled:opacity-50"
          >
            Build All Cache
          </button>

          <button
            onClick={handleDelete}
            disabled={loading || !cacheData || cacheData.count === 0}
            className="flex items-center px-3 py-1.5 rounded text-xs font-medium text-white bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 disabled:opacity-50"
          >
            Delete Cache
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center relative" ref={dropdownRef}>
            <label className="text-sm mr-2 text-gray-600 dark:text-gray-300">Racer:</label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setIsDropdownOpen(true);
                }}
                onClick={() => setIsDropdownOpen(true)}
                placeholder="Search racer..."
                className="border rounded px-2 py-1.5 text-sm w-64 bg-white border-gray-300 dark:bg-gray-700 dark:text-white dark:border-gray-600"
              />
              {isDropdownOpen && (
                <div className="absolute z-10 mt-1 w-full max-h-60 overflow-auto rounded-md shadow-lg bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
                  {filteredRacers.length > 0 ? (
                    filteredRacers.map((racer) => (
                      <div
                        key={racer.bc}
                        onClick={() => {
                          setSelectedRacer(racer.bc);
                          setSearchTerm(racer.name ? `${racer.name} (${racer.bc})` : racer.bc);
                          setIsDropdownOpen(false);
                        }}
                        className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        {racer.name ? `${racer.name} (${racer.bc})` : racer.bc}
                      </div>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                      No racers found
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleBuildRacer}
            disabled={loading || !selectedRacer}
            className="flex items-center px-3 py-1.5 rounded text-xs font-medium text-white bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 disabled:opacity-50"
          >
            Build Racer Cache
          </button>
        </div>
      </div>

      {message &&
        (message.type === 'success' ? (
          <SuccessBanner message={message.text} />
        ) : (
          <ErrorBanner message={message.text} />
        ))}

      {cacheError && <ErrorBanner message={cacheError.message} />}

      {cacheData && (
        <div className="p-4 rounded-lg bg-gray-100 dark:bg-gray-800">
          <h4 className="text-sm font-medium mb-2 text-gray-700 dark:text-white">
            Cache Summary for {selectedYear}
          </h4>

          <div className="p-3 rounded-lg mb-4 bg-white dark:bg-gray-700 shadow-sm">
            <div className="text-xs text-gray-500 dark:text-gray-400">Total Cache Files</div>
            <div className="text-xl font-bold text-gray-800 dark:text-white">{cacheData.count}</div>
          </div>

          {cacheData.count > 0 ? (
            <div className="overflow-auto max-h-96 rounded-lg bg-white dark:bg-gray-700">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                      Racer ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                      Filename
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                      Last Built
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                  {cacheData.files.map((file, index) => (
                    <tr
                      key={file.filename}
                      className={
                        index % 2 === 0
                          ? 'bg-white dark:bg-gray-700'
                          : 'bg-gray-50 dark:bg-gray-800'
                      }
                    >
                      <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-300">
                        {file.racerId}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-300">
                        {file.filename}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-300">
                        {file.lastBuilt ? new Date(file.lastBuilt).toLocaleString() : 'Unknown'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              No cache files found for {selectedYear}
            </div>
          )}
        </div>
      )}
    </PageContainer>
  );
}
