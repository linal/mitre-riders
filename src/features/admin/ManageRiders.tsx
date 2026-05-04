import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAddRacer, useRacers, useRemoveRacer } from '../../shared/hooks/queries';
import {
  ErrorBanner,
  PageContainer,
  PageHeader,
  SuccessBanner,
} from '../../shared/ui/PageContainer';

export default function ManageRiders() {
  const [bcNumber, setBcNumber] = useState('');
  const [status, setStatus] = useState<{ message: string; isError: boolean } | null>(null);

  const { data: riders = [], isLoading: ridersLoading, error: ridersError, refetch } = useRacers();
  const addRacer = useAddRacer();
  const removeRacer = useRemoveRacer();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = bcNumber.trim();
    if (!trimmed) {
      setStatus({ message: 'Please enter a BC number', isError: true });
      return;
    }
    try {
      await addRacer.mutateAsync(trimmed);
      setStatus({ message: `Rider with BC number ${trimmed} added successfully!`, isError: false });
      setBcNumber('');
    } catch (err) {
      setStatus({
        message: err instanceof Error ? err.message : 'Failed to add rider',
        isError: true,
      });
    }
  };

  const handleRemoveRider = async (bc: string) => {
    if (!window.confirm(`Are you sure you want to remove rider with BC number ${bc}?`)) return;
    try {
      await removeRacer.mutateAsync(bc);
      setStatus({ message: `Rider with BC number ${bc} removed successfully!`, isError: false });
    } catch (err) {
      setStatus({
        message: err instanceof Error ? err.message : 'Failed to remove rider',
        isError: true,
      });
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Manage Riders"
        description={
          <>
            Add new riders by entering their British Cycling ID number or view existing riders.
            <Link to="/about" className="ml-1 text-blue-500 hover:underline">
              Learn more
            </Link>
            .
          </>
        }
      />

      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md mb-6">
        <h4 className="text-md font-medium mb-4 text-gray-800 dark:text-white">Add New Rider</h4>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="bcNumber" className="block mb-2 text-sm font-medium">
              BC Number
            </label>
            <input
              type="text"
              id="bcNumber"
              value={bcNumber}
              onChange={(e) => setBcNumber(e.target.value)}
              className="w-full p-2 border rounded-md bg-white border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="Enter BC number"
              disabled={addRacer.isPending}
            />
          </div>
          <button
            type="submit"
            disabled={addRacer.isPending}
            className="px-4 py-2 rounded-md text-white bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-50"
          >
            {addRacer.isPending ? 'Adding...' : 'Add Rider'}
          </button>
        </form>

        {status && (
          <div className="mt-4">
            {status.isError ? (
              <ErrorBanner message={status.message} />
            ) : (
              <SuccessBanner message={status.message} />
            )}
          </div>
        )}
      </div>

      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <h4 className="text-md font-medium mb-4 text-gray-800 dark:text-white">Riders List</h4>
        {ridersError && <ErrorBanner message={ridersError.message} />}

        {ridersLoading ? (
          <div className="text-center py-4">Loading riders...</div>
        ) : riders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-gray-700 dark:text-gray-200">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-700">
                  <th className="px-4 py-2 text-left">BC Number</th>
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {riders.map((rider) => (
                  <tr
                    key={rider.bc}
                    className="border-t border-gray-200 dark:border-gray-700"
                  >
                    <td className="px-4 py-2 font-mono">{rider.bc}</td>
                    <td className="px-4 py-2">{rider.name || '-'}</td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => handleRemoveRider(rider.bc)}
                        disabled={removeRacer.isPending}
                        className="px-2 py-1 rounded-md text-sm text-white bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500 dark:text-gray-400">
            No riders found. Add a rider using the form above.
          </div>
        )}

        <button
          onClick={() => refetch()}
          disabled={ridersLoading}
          className="mt-4 px-4 py-2 rounded-md text-gray-800 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:text-white dark:hover:bg-gray-700 disabled:opacity-50"
        >
          {ridersLoading ? 'Refreshing...' : 'Refresh List'}
        </button>
      </div>
    </PageContainer>
  );
}
