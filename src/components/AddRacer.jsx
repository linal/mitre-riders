import React, { useState, useContext } from 'react';
import { ThemeContext } from '../main';

const AddRacer = () => {
  const { darkMode } = useContext(ThemeContext);
  const [bcNumber, setBcNumber] = useState('');
  const [status, setStatus] = useState({ message: '', isError: false });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!bcNumber.trim()) {
      setStatus({ message: 'Please enter a BC number', isError: true });
      return;
    }
    
    setIsLoading(true);
    setStatus({ message: '', isError: false });
    
    try {
      const response = await fetch('/api/racers/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bc: bcNumber.trim() }),
      });
      
      const data = await response.json().catch(() => null);
      
      if (!response.ok) {
        throw new Error(data?.message || response.statusText || 'Failed to add racer');
      }
      
      setStatus({ message: `Racer with BC number ${bcNumber} added successfully!`, isError: false });
      setBcNumber('');
    } catch (error) {
      setStatus({ message: error.message || 'Failed to add racer', isError: true });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`p-6 ${darkMode ? 'bg-gray-800 text-white' : 'bg-white'} rounded-lg shadow-md`}>
      <h2 className="text-xl font-bold mb-4">Add New Racer</h2>
      
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
            className={`w-full p-2 border rounded-md ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
            placeholder="Enter BC number"
            disabled={isLoading}
          />
        </div>
        
        <button
          type="submit"
          disabled={isLoading}
          className={`px-4 py-2 rounded-md ${
            darkMode 
              ? 'bg-blue-600 hover:bg-blue-700 text-white' 
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isLoading ? 'Adding...' : 'Add Racer'}
        </button>
      </form>
      
      {status.message && (
        <div className={`mt-4 p-3 rounded-md ${
          status.isError 
            ? (darkMode ? 'bg-red-900 text-red-200' : 'bg-red-100 text-red-800') 
            : (darkMode ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-800')
        }`}>
          {status.message}
        </div>
      )}
    </div>
  );
};

export default AddRacer;