import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAllRaceData } from '../../shared/hooks/queries';
import { ErrorBanner, PageContainer } from '../../shared/ui/PageContainer';
import { PageOverlay } from '../../shared/ui/PageOverlay';
import RiderCard from './RiderCard';
import FilterControls from './FilterControls';
import type { RaceData } from '../../shared/api/types';

const DEFAULT_YEAR = String(new Date().getFullYear());

function matchesCategory(category: string | undefined, filter: string): boolean {
  if (!filter) return true;
  if (filter === 'unlicensed') return !category;
  if (['1st', '2nd', '3rd', '4th'].includes(filter)) return !!category && category.includes(filter);
  return category === filter;
}

function compareRacers(
  a: [string, RaceData],
  b: [string, RaceData],
  sortKey: string,
): number {
  const [, aData] = a;
  const [, bData] = b;
  switch (sortKey) {
    case 'name':
      return aData.name.localeCompare(bData.name);
    case 'races':
      return (bData.raceCount || 0) - (aData.raceCount || 0);
    case 'roadAndTrackRaceCount':
      return (bData.roadAndTrackRaceCount || 0) - (aData.roadAndTrackRaceCount || 0);
    case 'roadAndTrack':
      return (bData.roadAndTrackPoints || 0) - (aData.roadAndTrackPoints || 0);
    case 'roadRegional':
      return (bData.roadRegionalPoints || 0) - (aData.roadRegionalPoints || 0);
    case 'roadNational':
      return (bData.roadNationalPoints || 0) - (aData.roadNationalPoints || 0);
    case 'category':
      if (aData.category && !bData.category) return -1;
      if (!aData.category && bData.category) return 1;
      return (aData.category || '').localeCompare(bData.category || '');
    default:
      return 0;
  }
}

export default function ClubRiders() {
  const { clubName } = useParams<{ clubName: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [year, setYear] = useState(searchParams.get('year') || DEFAULT_YEAR);
  const [sortKey, setSortKey] = useState(searchParams.get('sort') || 'name');
  const [filterText, setFilterText] = useState(searchParams.get('filter') || '');
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') || '');

  const { data = {}, isFetching, refetch, error } = useAllRaceData(year);

  // Mirror filter state into the URL so the page is shareable.
  useEffect(() => {
    const params = new URLSearchParams();
    if (year !== DEFAULT_YEAR) params.set('year', year);
    if (sortKey !== 'name') params.set('sort', sortKey);
    if (filterText) params.set('filter', filterText);
    if (categoryFilter) params.set('category', categoryFilter);
    setSearchParams(params, { replace: true });
  }, [year, sortKey, filterText, categoryFilter, setSearchParams]);

  const handleClearFilters = () => {
    setFilterText('');
    setCategoryFilter('');
    setSortKey('name');
  };

  const sortedFilteredRacers = useMemo(() => {
    const decodedClub = clubName ? decodeURIComponent(clubName) : null;
    return Object.entries(data)
      .filter(([, racer]) => racer.name && racer.name.toLowerCase().includes(filterText.toLowerCase()))
      .filter(([, racer]) => !decodedClub || racer.club === decodedClub)
      .filter(([, racer]) => matchesCategory(racer.category, categoryFilter))
      .filter(([, racer]) => racer.raceCount > 0)
      .sort((a, b) => compareRacers(a, b, sortKey));
  }, [data, clubName, filterText, categoryFilter, sortKey]);

  const totals = useMemo(() => {
    return sortedFilteredRacers.reduce(
      (acc, [, racer]) => ({
        roadAndTrackPoints: acc.roadAndTrackPoints + (racer.roadAndTrackPoints || 0),
        raceCount: acc.raceCount + (racer.raceCount || 0),
        roadAndTrackRaceCount: acc.roadAndTrackRaceCount + (racer.roadAndTrackRaceCount || 0),
      }),
      { roadAndTrackPoints: 0, raceCount: 0, roadAndTrackRaceCount: 0 },
    );
  }, [sortedFilteredRacers]);

  return (
    <PageOverlay active={isFetching} text="Loading race data...">
      <PageContainer>
        <div className="border-l-4 border-blue-600 rounded shadow-md p-4 mb-6 mx-2 bg-white dark:bg-gray-800">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-medium text-gray-800 dark:text-white">
              {clubName ? `${decodeURIComponent(clubName)} - Riders` : 'Club Riders'}
            </h3>
            {clubName && (
              <Link
                to={`/clubs/${clubName}/summary`}
                className="px-3 py-1 rounded text-sm bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
              >
                View Summary
              </Link>
            )}
          </div>
          <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            View British Cycling race data for {clubName ? decodeURIComponent(clubName) : 'club'}{' '}
            members. Filter and sort by various criteria.
            <Link to="/about" className="ml-1 text-blue-500 hover:underline">
              Learn more
            </Link>{' '}
            about how this works.
          </p>
        </div>

        {error && <ErrorBanner message={error.message} />}

        <FilterControls
          year={year}
          setYear={setYear}
          loading={isFetching}
          fetchRaceData={() => refetch()}
          filterText={filterText}
          setFilterText={setFilterText}
          sortKey={sortKey}
          setSortKey={setSortKey}
          categoryFilter={categoryFilter}
          setCategoryFilter={setCategoryFilter}
          handleClearFilters={handleClearFilters}
        />

        <div className="p-4 rounded-lg mb-4 bg-gray-100 dark:bg-gray-800">
          <h3 className="text-sm font-medium mb-2 text-gray-700 dark:text-white">
            Summary Totals
          </h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <SummaryCell label="Total Active Riders" value={sortedFilteredRacers.length} />
            <SummaryCell label="Total Road & Track Points" value={totals.roadAndTrackPoints} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SummaryCell label="Total Races" value={totals.raceCount} />
            <SummaryCell label="Road & Track Races" value={totals.roadAndTrackRaceCount} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedFilteredRacers.map(([racerId, racer]) => (
            <RiderCard key={racerId} racerId={racerId} racer={racer} year={year} />
          ))}
        </div>
      </PageContainer>
    </PageOverlay>
  );
}

function SummaryCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-3 rounded-lg bg-white dark:bg-gray-700 shadow-sm">
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className="text-xl font-bold text-gray-800 dark:text-white">{value}</div>
    </div>
  );
}
