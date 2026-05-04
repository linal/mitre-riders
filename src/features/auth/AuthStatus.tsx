import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../shared/hooks/useAuth';

export default function AuthStatus() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex items-center">
      {user ? (
        <span className="text-sm mr-2">{user.displayName || user.email}</span>
      ) : (
        <button
          onClick={() => navigate('/login')}
          className="text-sm bg-blue-500 hover:bg-blue-600 text-white py-1 px-2 rounded"
        >
          Login
        </button>
      )}
    </div>
  );
}
