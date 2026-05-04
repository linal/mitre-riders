import { useState } from 'react';
import { useClubs, useDeleteClub } from '../../shared/hooks/queries';
import {
  ErrorBanner,
  PageContainer,
  PageHeader,
  SuccessBanner,
} from '../../shared/ui/PageContainer';

export default function ClubsManager() {
  const { data: clubs = [], isLoading, error } = useClubs();
  const deleteClub = useDeleteClub();
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleDelete = async (clubName: string) => {
    if (!window.confirm(`Are you sure you want to delete the club "${clubName}"?`)) return;
    try {
      const result = await deleteClub.mutateAsync(clubName);
      setStatus({ type: 'success', message: result.message });
    } catch (err) {
      setStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to delete club',
      });
    }
  };

  return (
    <PageContainer>
      <PageHeader title="Manage Clubs" />

      {status &&
        (status.type === 'success' ? (
          <SuccessBanner message={status.message} />
        ) : (
          <ErrorBanner message={status.message} />
        ))}

      {error && <ErrorBanner message={error.message} />}

      {isLoading ? (
        <div className="text-gray-500 dark:text-gray-300">Loading clubs...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-700">
                <th className="px-4 py-2 border-b border-gray-200 dark:border-gray-600 text-left">
                  Club Name
                </th>
                <th className="px-4 py-2 border-b border-gray-200 dark:border-gray-600 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {clubs.length === 0 ? (
                <tr>
                  <td
                    colSpan={2}
                    className="px-4 py-2 text-center text-gray-500 dark:text-gray-300"
                  >
                    No clubs found
                  </td>
                </tr>
              ) : (
                clubs.map((club) => (
                  <tr key={club} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-2 border-b border-gray-200 dark:border-gray-600">
                      {club}
                    </td>
                    <td className="px-4 py-2 border-b border-gray-200 dark:border-gray-600 text-right">
                      <button
                        onClick={() => handleDelete(club)}
                        disabled={deleteClub.isPending}
                        className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </PageContainer>
  );
}
