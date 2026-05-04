import { useEffect, useState } from 'react';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../shared/hooks/useAuth';
import { ErrorBanner } from '../../shared/ui/PageContainer';

export default function RegisterUser() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) navigate('/');
  }, [user, navigate]);

  const handleGoogleSignUp = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithPopup(getAuth(), new GoogleAuthProvider());
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? `Failed to register: ${err.message}` : 'Failed to register');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-md dark:bg-gray-800">
      <h2 className="text-2xl font-bold mb-6 text-center dark:text-white">Register New User</h2>
      {error && <div className="mb-4"><ErrorBanner message={error} /></div>}
      <button
        onClick={handleGoogleSignUp}
        disabled={loading}
        className="w-full flex items-center justify-center bg-white hover:bg-gray-100 text-gray-800 font-semibold py-2 px-4 border border-gray-300 rounded-lg shadow-sm mb-4 dark:bg-gray-700 dark:text-white dark:border-gray-600 dark:hover:bg-gray-600 disabled:opacity-50"
      >
        <img
          src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
          alt="Google logo"
          className="w-5 h-5 mr-2"
        />
        {loading ? 'Registering...' : 'Sign up with Google'}
      </button>
    </div>
  );
}
