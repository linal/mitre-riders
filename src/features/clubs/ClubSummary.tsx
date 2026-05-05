import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAllRaceData } from '../../shared/hooks/queries';
import { ErrorBanner, PageContainer } from '../../shared/ui/PageContainer';
import { PageOverlay } from '../../shared/ui/PageOverlay';
import type { AllRaceData, RaceData } from '../../shared/api/types';

interface DisciplineSummary {
  riders: number;
  races: number;
  points: number;
  regionalPoints: number;
  nationalPoints: number;
}

interface Summary {
  activeRiders: number;
  totalRaces: number;
  roadAndTrack: DisciplineSummary;
  categories: Record<string, { count: number; points: number; races: number }>;
}

const EMPTY_DISCIPLINE: DisciplineSummary = {
  riders: 0,
  races: 0,
  points: 0,
  regionalPoints: 0,
  nationalPoints: 0,
};

const EMPTY_SUMMARY: Summary = {
  activeRiders: 0,
  totalRaces: 0,
  roadAndTrack: EMPTY_DISCIPLINE,
  categories: {},
};

function calculateSummary(data: AllRaceData, clubName: string | null): Summary {
  const summary: Summary = {
    activeRiders: 0,
    totalRaces: 0,
    roadAndTrack: { ...EMPTY_DISCIPLINE },
    categories: {},
  };

  for (const rider of Object.values(data) as RaceData[]) {
    if (clubName && rider.club !== clubName) continue;
    if (rider.raceCount > 0) summary.activeRiders++;
    summary.totalRaces += rider.raceCount || 0;

    if (rider.roadAndTrackRaceCount > 0) {
      summary.roadAndTrack.riders++;
      summary.roadAndTrack.races += rider.roadAndTrackRaceCount || 0;
      summary.roadAndTrack.points += rider.roadAndTrackPoints || 0;
      summary.roadAndTrack.regionalPoints += rider.roadRegionalPoints || 0;
      summary.roadAndTrack.nationalPoints += rider.roadNationalPoints || 0;
    }

    const category = rider.category || 'Unlicensed';
    if (!summary.categories[category]) {
      summary.categories[category] = { count: 0, points: 0, races: 0 };
    }
    summary.categories[category].count++;
    summary.categories[category].points += rider.points || 0;
    summary.categories[category].races += rider.raceCount || 0;
  }

  return summary;
}

function calculateChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function FormattedChange({
  current,
  previous,
}: {
  current: number;
  previous: number;
}) {
  const change = calculateChange(current, previous);
  const colorClass =
    change > 0 ? 'text-green-500' : change < 0 ? 'text-red-500' : 'text-gray-500';
  const sign = change > 0 ? '+' : '';
  return (
    <span className={colorClass}>
      {sign}
      {change.toFixed(1)}% ({previous} → {current})
    </span>
  );
}

export default function ClubSummary() {
  const { clubName } = useParams<{ clubName: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentYear = String(new Date().getFullYear());
  const [year, setYear] = useState(searchParams.get('year') || currentYear);
  const [showComparison, setShowComparison] = useState(true);

  const decodedClub = clubName ? decodeURIComponent(clubName) : null;
  const prevYear = String(parseInt(year, 10) - 1);

  const { data: currentData, isFetching: loadingCurrent, error: errorCurrent } =
    useAllRaceData(year);
  const { data: prevData, isFetching: loadingPrev } =
    useAllRaceData(showComparison ? prevYear : null);

  const summary = useMemo(
    () => (currentData ? calculateSummary(currentData, decodedClub) : EMPTY_SUMMARY),
    [currentData, decodedClub],
  );
  const prevSummary = useMemo(
    () => (prevData ? calculateSummary(prevData, decodedClub) : EMPTY_SUMMARY),
    [prevData, decodedClub],
  );

  useEffect(() => {
    const params = new URLSearchParams();
    if (year !== currentYear) params.set('year', year);
    setSearchParams(params, { replace: true });
  }, [year, currentYear, setSearchParams]);

  const isLoading = loadingCurrent || (showComparison && loadingPrev);

  return (
    <PageOverlay active={isLoading} text="Loading club summary data...">
      <PageContainer>
        <div className="border-l-4 border-blue-600 rounded shadow-md p-4 mb-6 mx-2 bg-white dark:bg-gray-800">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-medium text-gray-800 dark:text-white">
              Club Summary {decodedClub && `- ${decodedClub}`}
            </h3>
            {clubName && (
              <Link
                to={`/clubs/${clubName}/riders`}
                className="px-3 py-1 rounded text-sm text-white bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
              >
                View Riders
              </Link>
            )}
          </div>
          <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            View statistics by year with year-over-year comparisons.
            <Link to="/about" className="ml-1 text-blue-500 hover:underline">
              Learn more
            </Link>
            .
          </p>
        </div>

        {errorCurrent && <ErrorBanner message={errorCurrent.message} />}

        <div className="p-4 rounded-lg bg-gray-100 dark:bg-gray-800">
          <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4">
            <div className="flex-1">
              <label
                htmlFor="year"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Year
              </label>
              <select
                id="year"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600"
              >
                {Array.from({ length: 6 }).map((_, i) => {
                  const y = String(parseInt(currentYear, 10) - i);
                  return (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="flex-shrink-0 self-end flex space-x-2">
              <button
                onClick={() => setShowComparison((s) => !s)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-500 hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                {showComparison ? 'Hide Comparison' : 'Show Comparison'}
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-gray-100 dark:bg-gray-800">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-medium text-gray-800 dark:text-white">Overall Summary</h3>
            {showComparison && (
              <div className="text-sm text-gray-600 dark:text-gray-300">
                Comparing {year} with {prevYear}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard
              label="Active Riders"
              current={summary.activeRiders}
              previous={prevSummary.activeRiders}
              showComparison={showComparison}
            />
            <SummaryCard
              label="Total Races"
              current={summary.totalRaces}
              previous={prevSummary.totalRaces}
              showComparison={showComparison}
            />
            <SummaryCard
              label="Road & Track Points"
              current={summary.roadAndTrack.points}
              previous={prevSummary.roadAndTrack.points}
              showComparison={showComparison}
            />
            <SummaryCard
              label="Road & Track Races"
              current={summary.roadAndTrack.races}
              previous={prevSummary.roadAndTrack.races}
              showComparison={showComparison}
            />
          </div>
        </div>

        <div className="p-4 rounded-lg bg-gray-100 dark:bg-gray-800">
          <h3 className="text-lg font-medium mb-3 text-gray-800 dark:text-white">Road & Track</h3>
          <div className="space-y-3">
            <SummaryCard
              variant="row"
              label="Active Riders"
              current={summary.roadAndTrack.riders}
              previous={prevSummary.roadAndTrack.riders}
              showComparison={showComparison}
            />
            <SummaryCard
              variant="row"
              label="Total Races"
              current={summary.roadAndTrack.races}
              previous={prevSummary.roadAndTrack.races}
              showComparison={showComparison}
            />
            <SummaryCard
              variant="row"
              label="Total Points"
              current={summary.roadAndTrack.points}
              previous={prevSummary.roadAndTrack.points}
              showComparison={showComparison}
            />
            <div className="grid grid-cols-2 gap-3">
              <SummaryCard
                variant="row"
                label="Regional Points"
                current={summary.roadAndTrack.regionalPoints}
                previous={prevSummary.roadAndTrack.regionalPoints}
                showComparison={showComparison}
              />
              <SummaryCard
                variant="row"
                label="National Points"
                current={summary.roadAndTrack.nationalPoints}
                previous={prevSummary.roadAndTrack.nationalPoints}
                showComparison={showComparison}
              />
            </div>
          </div>
        </div>

        {showComparison && (
          <div className="p-4 rounded-lg bg-gray-100 dark:bg-gray-800">
            <h3 className="text-lg font-medium mb-3 text-gray-800 dark:text-white">
              Year-over-Year Comparison Summary
            </h3>
            <div className="p-4 rounded-lg bg-white dark:bg-gray-700 shadow-sm">
              <p className="mb-2 text-gray-600 dark:text-gray-300">
                Comparing {year} with {prevYear}:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  Active riders: {summary.activeRiders} vs {prevSummary.activeRiders} (
                  <FormattedChange
                    current={summary.activeRiders}
                    previous={prevSummary.activeRiders}
                  />
                  )
                </li>
                <li>
                  Total races: {summary.totalRaces} vs {prevSummary.totalRaces} (
                  <FormattedChange
                    current={summary.totalRaces}
                    previous={prevSummary.totalRaces}
                  />
                  )
                </li>
                <li>
                  Road & Track points: {summary.roadAndTrack.points} vs{' '}
                  {prevSummary.roadAndTrack.points} (
                  <FormattedChange
                    current={summary.roadAndTrack.points}
                    previous={prevSummary.roadAndTrack.points}
                  />
                  )
                </li>
              </ul>
            </div>
          </div>
        )}

        <div className="p-4 rounded-lg bg-gray-100 dark:bg-gray-800">
          <h3 className="text-lg font-medium mb-3 text-gray-800 dark:text-white">Categories</h3>
          <div className="p-4 rounded-lg bg-white dark:bg-gray-700 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(summary.categories).map(([cat, stats]) => (
                <div
                  key={cat}
                  className="rounded-md p-3 border bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700"
                >
                  <div className="text-sm font-medium text-gray-800 dark:text-white">{cat}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    Riders: {stats.count}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    Races: {stats.races}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    Points: {stats.points}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </PageContainer>
    </PageOverlay>
  );
}

function SummaryCard({
  label,
  current,
  previous,
  showComparison,
  variant = 'card',
}: {
  label: string;
  current: number;
  previous: number;
  showComparison: boolean;
  variant?: 'card' | 'row';
}) {
  const valueSize = variant === 'card' ? 'text-2xl' : 'text-xl';
  const labelSize = variant === 'card' ? 'text-sm' : 'text-sm';
  return (
    <div className="p-3 rounded-lg bg-white dark:bg-gray-700 shadow-sm">
      <div className={`${labelSize} text-gray-500 dark:text-gray-400`}>{label}</div>
      <div className={`${valueSize} font-bold text-gray-800 dark:text-white`}>
        {current}
        {showComparison && (
          <span className="ml-2 text-sm">
            <FormattedChange current={current} previous={previous} />
          </span>
        )}
      </div>
    </div>
  );
}
