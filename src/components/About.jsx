import React, { useContext } from "react";
import { ThemeContext } from "../main";

export default function About() {
  const { darkMode } = useContext(ThemeContext);

  return (
    <div className={`p-4 space-y-4 ${darkMode ? 'dark bg-gray-900 text-white' : 'bg-white'}`}>
      <div className={`border-l-4 border-blue-600 rounded shadow-md p-4 mb-6 mx-2 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <h2 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>About British Cycling Club Viewer</h2>
        
        <section className="mb-6">
          <h3 className={`text-lg font-medium mb-2 ${darkMode ? 'text-white' : 'text-gray-800'}`}>Overview</h3>
          <p className={`text-sm leading-relaxed ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            British Cycling Club Viewer displays race data for club members from the British Cycling website.
            You can view points across different disciplines (Road & Track, Cyclocross) and filter/sort riders by various criteria.
          </p>
        </section>

        <section className="mb-6">
          <h3 className={`text-lg font-medium mb-2 ${darkMode ? 'text-white' : 'text-gray-800'}`}>How It Works</h3>
          <p className={`text-sm leading-relaxed ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            Data is fetched from the British Cycling Website when you select a year or click "Go". 
            Results include both Road & Track and Cyclocross points and race counts. 
            The server filters out duplicate race entries by extracting unique event IDs from the HTML response, 
            ensuring each race is only counted once even if a rider participated in multiple events within the same race.
          </p>
        </section>

        <section className="mb-6">
          <h3 className={`text-lg font-medium mb-2 ${darkMode ? 'text-white' : 'text-gray-800'}`}>Caching System</h3>
          <p className={`text-sm leading-relaxed ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            The application implements a two-level caching system:
            <ul className="list-disc pl-5 mt-2">
              <li>In-memory cache for quick access</li>
              <li>Disk-based cache for persistence</li>
            </ul>
            <br />
            Cache duration:
            <ul className="list-disc pl-5 mt-2">
              <li>Development: 10 minutes</li>
              <li>Production: 24 hours</li>
              <li>Previous years' data: Never expires</li>
            </ul>
          </p>
        </section>

        <section className="mb-6">
          <h3 className={`text-lg font-medium mb-2 ${darkMode ? 'text-white' : 'text-gray-800'}`}>Features</h3>
          <ul className={`list-disc pl-5 text-sm leading-relaxed ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            <li>View race points for multiple riders simultaneously</li>
            <li>Filter riders by name, club, race type, and category</li>
            <li>Sort riders by name, race count, or points</li>
            <li>Toggle between light and dark mode</li>
            <li>Responsive design for desktop and mobile</li>
            <li>Summary statistics showing total races and points</li>
          </ul>
        </section>

        <section>
          <h3 className={`text-lg font-medium mb-2 ${darkMode ? 'text-white' : 'text-gray-800'}`}>Data Accuracy</h3>
          <p className={`text-sm leading-relaxed ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            <strong>Note:</strong> All data is pulled directly from the British Cycling website, so any inaccuracies there will be reflected here.
          </p>
          <div className="mt-4">
            <a href="https://github.com/linal/mitre-riders" target="_blank" className="text-blue-500 hover:underline inline-flex items-center">
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              GitHub Repository
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}