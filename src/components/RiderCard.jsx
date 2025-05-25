import React, { useContext } from "react";
import { ThemeContext } from "../main";

export default function RiderCard({ racerId, racer, year, raceTypeFilter }) {
  const { darkMode } = useContext(ThemeContext);

  return (
    <div className={`rounded-2xl shadow-md border p-4 space-y-2 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white'}`}>
      <div className={`text-xl font-semibold ${darkMode ? 'text-white' : ''}`}>{racer.name}</div>
      <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>BC No: {racerId}</div>
      <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Club: {racer.club}</div>
      {racer.category && (
        <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          Category: <span className="font-medium">{racer.category}</span>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex gap-2 items-center flex-wrap">
          {(raceTypeFilter === "all") && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Total Races: {racer.raceCount}
            </span>
          )}
          {racer.roadAndTrackRaceCount > 0 && (raceTypeFilter === "all" || raceTypeFilter === "roadAndTrack") && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Road & Track: {racer.roadAndTrackRaceCount} races
            </span>
          )}
          {racer.cyclocrossRaceCount > 0 && (raceTypeFilter === "all" || raceTypeFilter === "cyclocross") && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
              Cyclocross: {racer.cyclocrossRaceCount} races
            </span>
          )}
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {racer.roadAndTrackPoints > 0 && (raceTypeFilter === "all" || raceTypeFilter === "roadAndTrack") && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Road & Track: {racer.roadAndTrackPoints} pts
            </span>
          )}
          {racer.cyclocrossPoints > 0 && (raceTypeFilter === "all" || raceTypeFilter === "cyclocross") && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
              Cyclocross: {racer.cyclocrossPoints} pts
            </span>
          )}
        </div>
        {/* Regional and National Points - Road & Track */}
        {((racer.roadRegionalPoints > 0 || racer.roadNationalPoints > 0) && (raceTypeFilter === "all" || raceTypeFilter === "roadAndTrack")) && (
          <div className="flex gap-2 items-center flex-wrap">
            {racer.roadRegionalPoints > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                Road Regional: {racer.roadRegionalPoints} pts
              </span>
            )}
            {racer.roadNationalPoints > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                Road National: {racer.roadNationalPoints} pts
              </span>
            )}
          </div>
        )}
        
        {/* Regional and National Points - Cyclocross */}
        {((racer.cxRegionalPoints > 0 || racer.cxNationalPoints > 0) && (raceTypeFilter === "all" || raceTypeFilter === "cyclocross")) && (
          <div className="flex gap-2 items-center flex-wrap">
            {racer.cxRegionalPoints > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                CX Regional: {racer.cxRegionalPoints} pts
              </span>
            )}
            {racer.cxNationalPoints > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                CX National: {racer.cxNationalPoints} pts
              </span>
            )}
          </div>
        )}
      </div>
      <div className="flex gap-2 mt-2">
        {racer.roadAndTrackRaceCount > 0 && (
          <button
            onClick={() => window.open(`https://www.britishcycling.org.uk/points?d=4&person_id=${racerId}&year=${year}`, "_blank")}
            className={`flex items-center px-3 py-1.5 rounded text-xs font-medium transition-colors duration-200 ${
              darkMode 
                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
            </svg>
            Road Results
          </button>
        )}
        {racer.cyclocrossRaceCount > 0 && (
          <button
            onClick={() => window.open(`https://www.britishcycling.org.uk/points?d=6&person_id=${racerId}&year=${year}`, "_blank")}
            className={`flex items-center px-3 py-1.5 rounded text-xs font-medium transition-colors duration-200 ${
              darkMode 
                ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                : 'bg-purple-500 hover:bg-purple-600 text-white'
            }`}
          >
            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
            </svg>
            CX Results
          </button>
        )}
      </div>
    </div>
  );
}