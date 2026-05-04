import { Link } from 'react-router-dom';
import { useClubs } from '../../shared/hooks/queries';
import { ErrorBanner, PageContainer } from '../../shared/ui/PageContainer';
import { PageOverlay } from '../../shared/ui/PageOverlay';

export default function ClubsList() {
  const { data: clubs = [], isLoading, error } = useClubs();

  return (
    <PageOverlay active={isLoading} text="Loading clubs...">
      <PageContainer>
        <div className="border-l-4 border-blue-600 rounded shadow-md p-4 mb-6 mx-2 bg-white dark:bg-gray-800">
          <h3 className="text-lg font-medium text-gray-800 dark:text-white mb-2">Clubs</h3>
          <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            Browse British cycling clubs and view their members&apos; race points. Select a club
            to see detailed rider information.
          </p>
          <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            <Link to="/about" className="text-blue-500 hover:underline">
              Learn more
            </Link>{' '}
            about how this application works.
          </p>
        </div>

        {error && <ErrorBanner message={error.message} />}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clubs.map((club) => (
            <Link
              key={club}
              to={`/clubs/${encodeURIComponent(club)}/riders`}
              className="block p-4 rounded-lg shadow-md transition-transform transform hover:scale-105 bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700"
            >
              <h3 className="text-lg font-medium text-gray-800 dark:text-white">{club}</h3>
            </Link>
          ))}
        </div>

        {clubs.length === 0 && !isLoading && !error && (
          <div className="p-4 text-center rounded-lg bg-gray-100 dark:bg-gray-800">
            <p>No clubs found. Add racers to see their clubs.</p>
          </div>
        )}
      </PageContainer>
    </PageOverlay>
  );
}
