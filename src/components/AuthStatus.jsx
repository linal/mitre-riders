import React, { useState, useEffect } from 'react';
import { getAuth, signOut, onAuthStateChanged } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';

const AuthStatus = () => {
  const auth = getAuth();
  const [user, setUser] = useState(auth.currentUser);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, [auth]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="flex items-center">
      {user ? (
        <div className="flex items-center">
          <span className="text-sm mr-2">
            {user.displayName || user.email}
          </span>
          <button
            onClick={handleLogout}
            className="text-sm bg-red-500 hover:bg-red-600 text-white py-1 px-2 rounded"
          >
            Logout
          </button>
        </div>
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
};

export default AuthStatus;