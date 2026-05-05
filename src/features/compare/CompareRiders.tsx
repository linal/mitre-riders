import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAllRaceData, useRacers } from '../../shared/hooks/queries';
import { ErrorBanner, PageContainer, SuccessBanner } from '../../shared/ui/PageContainer';
import type { RaceData, Racer } from '../../shared/api/types';

export default function CompareRiders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialYear = searchParams.get('year') || String(new Date().getFullYear());

  const [riderA, setRiderA] = useState(searchParams.get('riderA') || '');
  const [riderB, setRiderB] = useState(searchParams.get('riderB') || '');
  const [year, setYear] = useState(initialYear);

  const { data: riders = [], isLoading: ridersLoading, error: ridersError } = useRacers();

  const canCompare = !!(
    riderA &&
    riderB &&
    riderA !== riderB &&
    year &&
    !ridersLoading &&
    !ridersError
  );

  const {
    data: allData,
    isFetching: comparing,
    error: compareError,
  } = useAllRaceData(canCompare ? year : null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (riderA) params.set('riderA', riderA);
    if (riderB) params.set('riderB', riderB);
    if (year) params.set('year', year);
    setSearchParams(params, { replace: true });
  }, [riderA, riderB, year, setSearchParams]);

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 7 }, (_, i) => String(current - i));
  }, []);

  const riderAData: RaceData | null = canCompare && allData ? allData[riderA] || null : null;
  const riderBData: RaceData | null = canCompare && allData ? allData[riderB] || null : null;

  const aName = useMemo(
    () => riders.find((r) => r.bc === riderA)?.name || riderAData?.name || riderA,
    [riders, riderA, riderAData],
  );
  const bName = useMemo(
    () => riders.find((r) => r.bc === riderB)?.name || riderBData?.name || riderB,
    [riders, riderB, riderBData],
  );

  return (
    <PageContainer>
      <div className="border-l-4 border-blue-600 rounded shadow-md p-4 mb-6 mx-2 bg-white dark:bg-gray-800">
        <h3 className="text-lg font-medium text-gray-800 dark:text-white">Compare Riders</h3>
        <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
          Select two riders and a year. The URL updates so you can share it.
        </p>
      </div>

      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md space-y-4">
        {ridersLoading && (
          <div className="text-sm text-gray-600 dark:text-gray-300">Loading riders...</div>
        )}
        {ridersError && <ErrorBanner message={ridersError.message} />}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <RiderSelect
            label="Rider A"
            value={riderA}
            onChange={setRiderA}
            riders={riders}
            disabled={ridersLoading || !!ridersError}
          />
          <RiderSelect
            label="Rider B"
            value={riderB}
            onChange={setRiderB}
            riders={riders}
            disabled={ridersLoading || !!ridersError}
          />
        </div>

        <div className="max-w-xs">
          <label className="block mb-2 text-sm font-medium">Year</label>
          <select
            className="w-full p-2 border rounded-md bg-white border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            value={year}
            onChange={(e) => setYear(e.target.value)}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {compareError && <ErrorBanner message={compareError.message} />}
        {canCompare && allData && riderAData && riderBData && !comparing && !compareError && (
          <SuccessBanner message={`Comparing ${aName} vs ${bName} for ${year}.`} />
        )}
        {canCompare && allData && (!riderAData || !riderBData) && (
          <ErrorBanner message="Comparison data not found for one or both riders." />
        )}
      </div>

      {riderAData && riderBData && (
        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 items-end">
            <RiderHeader
              title="Rider A"
              rider={riders.find((r) => r.bc === riderA)}
              data={riderAData}
            />
            <div />
            <RiderHeader
              title="Rider B"
              rider={riders.find((r) => r.bc === riderB)}
              data={riderBData}
            />
          </div>

          <div className="grid grid-cols-1">
            <StatRow label="Total Points" aValue={riderAData.points} bValue={riderBData.points} />
            <StatRow
              label="Total Races"
              aValue={riderAData.raceCount}
              bValue={riderBData.raceCount}
            />
            <StatRow
              label="Road & Track Points"
              aValue={riderAData.roadAndTrackPoints}
              bValue={riderBData.roadAndTrackPoints}
            />
            <StatRow
              label="Road & Track Races"
              aValue={riderAData.roadAndTrackRaceCount}
              bValue={riderBData.roadAndTrackRaceCount}
            />
            <StatRow
              label="Road Regional Points"
              aValue={riderAData.roadRegionalPoints}
              bValue={riderBData.roadRegionalPoints}
            />
            <StatRow
              label="Road National Points"
              aValue={riderAData.roadNationalPoints}
              bValue={riderBData.roadNationalPoints}
            />
          </div>
        </div>
      )}
    </PageContainer>
  );
}

function RiderSelect({
  label,
  value,
  onChange,
  riders,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  riders: Racer[];
  disabled: boolean;
}) {
  return (
    <div>
      <label className="block mb-2 text-sm font-medium">{label}</label>
      <select
        className="w-full p-2 border rounded-md bg-white border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        <option value="">Select rider...</option>
        {riders.map((r) => (
          <option key={r.bc} value={r.bc}>
            {(r.name ? r.name : 'Unknown') + ` (${r.bc})`}
          </option>
        ))}
      </select>
    </div>
  );
}

function StatRow({
  label,
  aValue,
  bValue,
}: {
  label: string;
  aValue: number | undefined;
  bValue: number | undefined;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center py-2 border-t border-gray-200 dark:border-gray-700">
      <div className="text-sm text-gray-600 dark:text-gray-300">{label}</div>
      <div className="text-base font-medium text-gray-800 dark:text-white">{aValue ?? 0}</div>
      <div className="text-base font-medium text-gray-800 dark:text-white">{bValue ?? 0}</div>
    </div>
  );
}

function RiderHeader({
  title,
  rider,
  data,
}: {
  title: string;
  rider?: Racer;
  data: RaceData;
}) {
  return (
    <div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{title}</div>
      <div className="text-lg font-semibold text-gray-800 dark:text-white">
        {rider?.name || data?.name || 'Unknown'}
      </div>
      <div className="text-sm text-gray-600 dark:text-gray-300">
        {rider?.bc} • {data?.club || 'Unknown'} {data?.category ? `• ${data.category}` : ''}
      </div>
    </div>
  );
}
