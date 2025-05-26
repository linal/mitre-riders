import { useState, useEffect, useContext } from 'react';
import { ThemeContext } from '../main';
import { getAuth } from 'firebase/auth';

function ClubsManager() {
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteStatus, setDeleteStatus] = useState(null);
  const { darkMode } = useContext(ThemeContext);

  // Fetch clubs on component mount
  useEffect(() => {
    fetchClubs();
  }, []);

  // Function to fetch clubs
  const fetchClubs = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/clubs');
      if (!response.ok) {
        throw new Error(`Failed to fetch clubs: ${response.status}`);
      }
      const data = await response.json();
      setClubs(data);
      setError(null);
    } catch (err) {
      setError(`Error loading clubs: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Function to delete a club
  const deleteClub = async (clubName) => {
    if (!confirm(`Are you sure you want to delete the club "${clubName}"?`)) {
      return;
    }

    try {
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) {
        throw new Error('You must be logged in to delete a club');
      }
      
      const token = await user.getIdToken();
      setDeleteStatus({ type: 'loading', message: `Deleting ${clubName}...` });
      const response = await fetch(`/api/clubs/${encodeURIComponent(clubName)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();
      
      if (response.ok) {
        setDeleteStatus({ type: 'success', message: result.message });
        // Refresh the clubs list
        fetchClubs();
      } else {
        setDeleteStatus({ type: 'error', message: result.message || 'Failed to delete club' });
      }
    } catch (err) {
      setDeleteStatus({ type: 'error', message: `Error: ${err.message}` });
    }
  };

  return (
    <div className={`p-4 ${darkMode ? 'text-white' : ''}`}>
      <h2 className="text-xl font-bold mb-4">Manage Clubs</h2>
      
      {/* Status message */}
      {deleteStatus && (
        <div className={`p-3 mb-4 rounded ${
          deleteStatus.type === 'success' ? 
            (darkMode ? 'bg-green-800 text-green-100' : 'bg-green-100 text-green-800') : 
          deleteStatus.type === 'error' ? 
            (darkMode ? 'bg-red-800 text-red-100' : 'bg-red-100 text-red-800') : 
            (darkMode ? 'bg-blue-800 text-blue-100' : 'bg-blue-100 text-blue-800')
        }`}>
          {deleteStatus.message}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className={`p-3 mb-4 rounded ${darkMode ? 'bg-red-800 text-red-100' : 'bg-red-100 text-red-800'}`}>
          {error}
        </div>
      )}

      {/* Loading indicator */}
      {loading ? (
        <div className={`${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>Loading clubs...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className={`min-w-full ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border`}>
            <thead>
              <tr className={darkMode ? 'bg-gray-700' : ''}>
                <th className={`px-4 py-2 border-b ${darkMode ? 'border-gray-600' : ''} text-left`}>Club Name</th>
                <th className={`px-4 py-2 border-b ${darkMode ? 'border-gray-600' : ''} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {clubs.length === 0 ? (
                <tr>
                  <td colSpan="2" className={`px-4 py-2 text-center ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                    No clubs found
                  </td>
                </tr>
              ) : (
                clubs.map((club) => (
                  <tr key={club} className={darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}>
                    <td className={`px-4 py-2 border-b ${darkMode ? 'border-gray-600' : ''}`}>{club}</td>
                    <td className={`px-4 py-2 border-b ${darkMode ? 'border-gray-600' : ''} text-right`}>
                      <button
                        onClick={() => deleteClub(club)}
                        className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
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
    </div>
  );
}

export default ClubsManager;