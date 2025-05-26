const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');
// Firebase Admin SDK for server-side operations
const { initializeApp } = require('firebase/app');

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBW72KiOT4TYXx8tbTQA2g1GjRMA4-yJ3k",
  authDomain: "mitre-riders.firebaseapp.com",
  projectId: "mitre-riders",
  storageBucket: "mitre-riders.firebasestorage.app",
  messagingSenderId: "701709492859",
  appId: "1:701709492859:web:00f2529f28b096f94038de"
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);

const app = express();
const PORT = process.env.PORT || 3001;

// Serve static frontend from /client
app.use(cors());
app.use(express.json()); // Add JSON body parser for POST requests
app.use(express.static(path.join(__dirname, 'client')));

// Configure cache directory based on environment
const CACHE_DIR = process.env.NODE_ENV === 'production' 
  ? '/data'
  : path.join(__dirname, 'cache');

// Create cache directory if it doesn't exist
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  console.log(`Created cache directory: ${CACHE_DIR}`);
}

// Configure racers directory
const RACERS_DIR = path.join(CACHE_DIR, 'racers');
if (!fs.existsSync(RACERS_DIR)) {
  fs.mkdirSync(RACERS_DIR, { recursive: true });
  console.log(`Created racers directory: ${RACERS_DIR}`);
}

// Configure clubs directory
const CLUBS_DIR = path.join(CACHE_DIR, 'clubs');
if (!fs.existsSync(CLUBS_DIR)) {
  fs.mkdirSync(CLUBS_DIR, { recursive: true });
  console.log(`Created clubs directory: ${CLUBS_DIR}`);
}
const CLUBS_FILE = path.join(CLUBS_DIR, 'clubs.json');

// Disk-based cache with in-memory lookup
const cache = {};
const CACHE_TTL_MS = process.env.NODE_ENV === 'production' 
  ? 24 * 60 * 60 * 1000  // 24 hours in production
  : 10 * 60 * 1000;      // 10 minutes in development

// Racer information loaded from file or default list
const RACERS_FILE = path.join(RACERS_DIR, 'racers.json');
let racers = [];

// Load racers from file or use default list
function loadRacers() {
  try {
    if (fs.existsSync(RACERS_FILE)) {
      const data = fs.readFileSync(RACERS_FILE, 'utf8');
      racers = JSON.parse(data);
      console.log(`Loaded ${racers.length} racers from ${RACERS_FILE}`);
    }
  } catch (err) {
    console.error(`Error loading racers: ${err.message}`);
    // Fallback to empty array if there's an error
    racers = [];
  }
}

// Load racers on startup
loadRacers();

// Original endpoint for single racer data
app.get('/api/race-data', async (req, res) => {
  const { person_id, year } = req.query;
  if (!person_id || !year) {
    return res.status(400).send("Missing parameters");
  }

  const cacheKey = `${person_id}_${year}`;
  const cacheFilePath = path.join(CACHE_DIR, `${cacheKey}.json`);
  const now = Date.now();
  const cacheDurationMinutes = CACHE_TTL_MS / (60 * 1000);
  const currentYear = new Date().getFullYear().toString();
  const isPreviousYear = year < currentYear;

  // Check memory cache first
  if (cache[cacheKey]) {
    // Previous years never expire, current year uses TTL
    if (isPreviousYear || now - cache[cacheKey].timestamp < CACHE_TTL_MS) {
      console.log(`Memory cache HIT for ${cacheKey}${isPreviousYear ? ' (previous year - never expires)' : ''}`);
      return res.json(cache[cacheKey].data);
    }
  }
  
  // Check if cache file exists
  if (fs.existsSync(cacheFilePath)) {
    try {
      const fileContent = fs.readFileSync(cacheFilePath, 'utf8');
      const cacheEntry = JSON.parse(fileContent);
      
      // When running locally, always use cache if it exists
      // In production, previous years never expire, current year uses TTL
      if (process.env.NODE_ENV !== 'production' || isPreviousYear || now - cacheEntry.timestamp < CACHE_TTL_MS) {
        console.log(`Disk cache HIT for ${cacheKey}${process.env.NODE_ENV !== 'production' ? ' (local environment - always using cache)' : isPreviousYear ? ' (previous year - never expires)' : ''}`);
        // Update memory cache
        cache[cacheKey] = cacheEntry;
        return res.json(cacheEntry.data);
      }
    } catch (err) {
      console.error(`Error reading cache file ${cacheFilePath}:`, err.message);
    }
  }
  
  console.log(`Cache MISS for ${cacheKey}. Cache duration: ${cacheDurationMinutes} minutes`);

  try {
    const result = await fetchRacerData(person_id, year);
    const cacheEntry = { data: result, timestamp: now };
    
    // Update memory cache
    cache[cacheKey] = cacheEntry;
    
    // Write to disk cache
    fs.writeFile(cacheFilePath, JSON.stringify(cacheEntry), 'utf8', (err) => {
      if (err) {
        console.error(`Error writing cache file ${cacheFilePath}:`, err.message);
      }
    });
    
    res.json(result);
  } catch (err) {
    if (err.message.includes('500 error')) {
      console.error(`BC API server error (500) when fetching data for ${person_id}_${year}: ${err.message}`);
    } else {
      console.error("Error fetching or parsing race data:", err.message);
    }
    
    // If it's not a 500 error and we have a cached version, return that instead
    if (!err.message.includes('500 error') && fs.existsSync(cacheFilePath)) {
      try {
        const fileContent = fs.readFileSync(cacheFilePath, 'utf8');
        const cacheEntry = JSON.parse(fileContent);
        console.log(`Using cached data for ${cacheKey} due to non-500 error`);
        return res.json(cacheEntry.data);
      } catch (cacheErr) {
        console.error(`Error reading cache during error recovery:`, cacheErr.message);
      }
    }
    
    res.status(500).send("Failed to fetch race data");
  }
});

// Endpoint to get all racers
app.get('/api/racers', (req, res) => {
  res.json(racers);
});

// Endpoint to update racers list
app.post('/api/racers', express.json(), (req, res) => {
  try {
    const newRacers = req.body;
    
    if (!Array.isArray(newRacers)) {
      return res.status(400).send("Invalid format: expected an array of racers");
    }
    
    // Update racers list
    racers = newRacers;
    
    // Save to file
    fs.writeFileSync(RACERS_FILE, JSON.stringify(racers, null, 2), 'utf8');
    
    res.json({ success: true, count: racers.length });
  } catch (err) {
    console.error(`Error updating racers: ${err.message}`);
    res.status(500).send("Failed to update racers list");
  }
});

// Endpoint to add a single racer by BC number
app.post('/api/racers/add', express.json(), (req, res) => {
  try {
    const { bc } = req.body;
    
    if (!bc) {
      return res.status(400).json({ message: "Missing BC number" });
    }
    
    // Check if BC number already exists
    if (racers.some(racer => racer.bc === bc)) {
      return res.status(400).json({ message: "BC number already exists" });
    }
    
    // Add new racer
    racers.push({ bc });
    
    // Save to file
    fs.writeFileSync(RACERS_FILE, JSON.stringify(racers, null, 2), 'utf8');
    
    res.json({ success: true, bc, count: racers.length });
  } catch (err) {
    console.error(`Error adding racer: ${err.message}`);
    res.status(500).json({ message: "Failed to add racer" });
  }
});

// New endpoint to build cache for all racers
app.post('/api/build-cache', async (req, res) => {
  const { year, racerId } = req.body || req.query;
  
  if (!year) {
    return res.status(400).send("Missing year parameter");
  }
  
  const now = Date.now();
  const results = {
    success: true,
    totalRacers: racerId ? 1 : racers.length,
    cached: 0,
    failed: 0,
    skipped: 0,
    details: []
  };
  
  try {
    // If racerId is provided, only build cache for that racer
    if (racerId) {
      const racer = racers.find(r => r.bc === racerId);
      
      if (!racer) {
        return res.status(404).json({ 
          success: false, 
          message: `Racer with ID ${racerId} not found` 
        });
      }
      
      const cacheKey = `${racerId}_${year}`;
      const cacheFilePath = path.join(CACHE_DIR, `${cacheKey}.json`);
      
      try {
        // Fetch data from BC API
        const result = await fetchRacerData(racerId, year);
        const cacheEntry = { data: result, timestamp: now };
        
        // Update memory cache
        cache[cacheKey] = cacheEntry;
        
        // Write to disk cache
        fs.writeFileSync(cacheFilePath, JSON.stringify(cacheEntry), 'utf8');
        
        results.cached++;
        results.details.push({
          racerId,
          name: result.name,
          status: 'cached'
        });
      } catch (err) {
        results.failed++;
        results.details.push({
          racerId,
          name: racer.name,
          status: 'failed',
          error: err.message
        });
        console.error(`Error building cache for ${racerId}_${year}:`, err.message);
      }
    } else {
      // Process each racer and build cache
      for (const racer of racers) {
        const racerId = racer.bc;
        const cacheKey = `${racerId}_${year}`;
        const cacheFilePath = path.join(CACHE_DIR, `${cacheKey}.json`);
        
        try {
          // Fetch data from BC API
          const result = await fetchRacerData(racerId, year);
          const cacheEntry = { data: result, timestamp: now };
          
          // Update memory cache
          cache[cacheKey] = cacheEntry;
          
          // Write to disk cache
          fs.writeFileSync(cacheFilePath, JSON.stringify(cacheEntry), 'utf8');
          
          results.cached++;
          results.details.push({
            racerId,
            name: racer.name,
            status: 'cached'
          });
          
        } catch (err) {
          results.failed++;
          results.details.push({
            racerId,
            name: racer.name,
            status: 'failed',
            error: err.message
          });
          console.error(`Error building cache for ${racerId}_${year}:`, err.message);
        }
      }
    }
    
    res.json(results);
  } catch (err) {
    console.error("Error building cache:", err.message);
    res.status(500).send("Failed to build cache");
  }
});

// Updated endpoint to get all race data (only from cache)
app.get('/api/all-race-data', async (req, res) => {
  const { year } = req.query;
  
  if (!year) {
    return res.status(400).send("Missing year parameter");
  }
  
  const results = {};
  const missingData = [];
  
  try {
    // Process each racer, using ONLY cache
    for (const racer of racers) {
      const racerId = racer.bc;
      const cacheKey = `${racerId}_${year}`;
      const cacheFilePath = path.join(CACHE_DIR, `${cacheKey}.json`);
      
      // Check memory cache first
      if (cache[cacheKey]) {
        console.log(`Memory cache HIT for ${cacheKey}`);
        results[racerId] = {
          ...cache[cacheKey].data
        };
        continue; // Skip to next racer
      } 
      // Check disk cache
      else if (fs.existsSync(cacheFilePath)) {
        try {
          const fileContent = fs.readFileSync(cacheFilePath, 'utf8');
          const cacheEntry = JSON.parse(fileContent);
          
          console.log(`Disk cache HIT for ${cacheKey}`);
          // Update memory cache
          cache[cacheKey] = cacheEntry;
          results[racerId] = {
            ...cacheEntry.data
          };
          continue; // Skip to next racer
        } catch (err) {
          console.error(`Error reading cache file ${cacheFilePath}:`, err.message);
          missingData.push(racerId);
        }
      } else {
        // No cache available
        console.log(`No cache available for ${cacheKey}`);
        missingData.push(racerId);
      }
      
      // Add empty result for racers with no cache
      results[racerId] = {
        raceCount: 0,
        points: 0,
        roadAndTrackPoints: 0,
        cyclocrossPoints: 0,
        roadAndTrackRaceCount: 0,
        cyclocrossRaceCount: 0,
        category: '',
        name: racer.name || 'Unknown',
        club: racer.club || 'Unknown',
        error: 'No cached data available'
      };
    }
    
    res.json(results);
  } catch (err) {
    console.error("Error fetching cached race data:", err.message);
    res.status(500).send("Failed to fetch race data");
  }
});

// RESTful endpoint to get cache files by year
app.get('/api/cache/:year', (req, res) => {
  const { year } = req.params;
  
  if (!year || !/^\d{4}$/.test(year)) {
    return res.status(400).send("Invalid year format. Please provide a 4-digit year.");
  }
  
  try {
    const files = fs.readdirSync(CACHE_DIR);
    const matchingFiles = files.filter(file => {
      return file.includes(`_${year}.json`);
    });
    
    const result = matchingFiles.map(file => {
      const racerId = file.split('_')[0];
      return {
        filename: file,
        racerId,
        year
      };
    });
    
    res.json({
      count: result.length,
      files: result
    });
  } catch (err) {
    console.error(`Error listing cache files for year ${year}:`, err.message);
    res.status(500).send(`Failed to list cache files for year ${year}`);
  }
});

// RESTful endpoint to delete cache files by year
app.delete('/api/cache/:year', (req, res) => {
  const { year } = req.params;
  
  if (!year || !/^\d{4}$/.test(year)) {
    return res.status(400).send("Invalid year format. Please provide a 4-digit year.");
  }
  
  try {
    const files = fs.readdirSync(CACHE_DIR);
    const matchingFiles = files.filter(file => {
      return file.includes(`_${year}.json`);
    });
    
    let removedCount = 0;
    const errors = [];
    
    matchingFiles.forEach(file => {
      const filePath = path.join(CACHE_DIR, file);
      try {
        fs.unlinkSync(filePath);
        removedCount++;
        
        // Also remove from memory cache if present
        const racerId = file.split('_')[0];
        const cacheKey = `${racerId}_${year}`;
        if (cache[cacheKey]) {
          delete cache[cacheKey];
        }
      } catch (err) {
        errors.push({ file, error: err.message });
      }
    });
    
    res.json({
      success: true,
      totalFiles: matchingFiles.length,
      removedFiles: removedCount,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err) {
    console.error(`Error removing cache files for year ${year}:`, err.message);
    res.status(500).send(`Failed to remove cache files for year ${year}`);
  }
});

// Endpoint to get club names from the club cache
app.get('/api/clubs', (req, res) => {
  try {
    if (fs.existsSync(CLUBS_FILE)) {
      const clubsData = fs.readFileSync(CLUBS_FILE, 'utf8');
      const clubs = JSON.parse(clubsData);
      const clubNames = Object.keys(clubs);
      
      res.json(clubNames);
    } else {
      res.json([]);
    }
  } catch (err) {
    console.error(`Error fetching club names: ${err.message}`);
    res.status(500).send("Failed to fetch club names");
  }
});

// Endpoint to get the entire clubs file
app.get('/api/clubs-file', (req, res) => {
  try {
    if (fs.existsSync(CLUBS_FILE)) {
      const clubsData = fs.readFileSync(CLUBS_FILE, 'utf8');
      const clubs = JSON.parse(clubsData);
      
      res.json(clubs);
    } else {
      res.json({});
    }
  } catch (err) {
    console.error(`Error fetching clubs file: ${err.message}`);
    res.status(500).send("Failed to fetch clubs file");
  }
});

// Endpoint to delete a club
app.delete('/api/clubs/:clubName', (req, res) => {
  try {
    const { clubName } = req.params;
    
    if (!clubName) {
      return res.status(400).json({ success: false, message: "Club name is required" });
    }
    
    // Check if clubs file exists
    if (!fs.existsSync(CLUBS_FILE)) {
      return res.status(404).json({ success: false, message: "Clubs data not found" });
    }
    
    // Read clubs data
    const clubsData = fs.readFileSync(CLUBS_FILE, 'utf8');
    const clubs = JSON.parse(clubsData);
    
    // Check if club exists
    if (!clubs[clubName]) {
      return res.status(404).json({ success: false, message: `Club '${clubName}' not found` });
    }
    
    // Remove the club
    delete clubs[clubName];
    
    // Write updated clubs data
    fs.writeFileSync(CLUBS_FILE, JSON.stringify(clubs, null, 2), 'utf8');
    
    res.json({ 
      success: true, 
      message: `Club '${clubName}' removed successfully`,
      remainingClubs: Object.keys(clubs).length
    });
  } catch (err) {
    console.error(`Error removing club: ${err.message}`);
    res.status(500).json({ success: false, message: "Failed to remove club" });
  }
});

// Helper function to fetch and process racer data
async function fetchRacerData(person_id, year) {
  // Fetch regular points (d=4)
  const regularUrl = `https://www.britishcycling.org.uk/points?d=4&person_id=${person_id}&year=${year}`;
  console.log(regularUrl);
  const regularResponse = await fetch(regularUrl);
  
  // Check for server error
  if (regularResponse.status === 500) {
    throw new Error('BC website returned 500 error for regular points');
  }
  
  const regularHtml = await regularResponse.text();

  // Extract name from the HTML
  let name = '';
  const nameRegex = /<h1 class="article__header__title-opener">Points: ([^<]+)<\/h1>/;
  const nameMatch = regularHtml.match(nameRegex);
  if (nameMatch && nameMatch[1]) {
    name = nameMatch[1].trim();
  }

  // Extract club from the HTML
  let club = '';
  let clubId = '';
  const currentYear = new Date().getFullYear().toString();
  
  if (year === currentYear) {
    // For current year, use Current Club
    const currentClubRegex = /<dd>Current Club: <a[^>]*href="\/clubpoints\/\?club_id=(\d+)[^"]*">([^<]+)<\/a>/;
    const currentClubMatch = regularHtml.match(currentClubRegex);
    if (currentClubMatch && currentClubMatch[2]) {
      club = currentClubMatch[2].trim();
      clubId = currentClubMatch[1];
    }
    
    // If Current Club not found, fall back to Year End Club
    if (!club) {
      const yearEndClubRegex = /<dd>Year End Club: <a[^>]*href="\/clubpoints\/\?club_id=(\d+)[^"]*">([^<]+)<\/a>/;
      const yearEndClubMatch = regularHtml.match(yearEndClubRegex);
      if (yearEndClubMatch && yearEndClubMatch[2]) {
        club = yearEndClubMatch[2].trim();
        clubId = yearEndClubMatch[1];
      }
    }
  } else {
    // For other years, use Year End Club
    const yearEndClubRegex = /<dd>Year End Club: <a[^>]*href="\/clubpoints\/\?club_id=(\d+)[^"]*">([^<]+)<\/a>/;
    const yearEndClubMatch = regularHtml.match(yearEndClubRegex);
    if (yearEndClubMatch && yearEndClubMatch[2]) {
      club = yearEndClubMatch[2].trim();
      clubId = yearEndClubMatch[1];
    }
    
    // If Year End Club not found, fall back to Current Club
    if (!club) {
      const currentClubRegex = /<dd>Current Club: <a[^>]*href="\/clubpoints\/\?club_id=(\d+)[^"]*">([^<]+)<\/a>/;
      const currentClubMatch = regularHtml.match(currentClubRegex);
      if (currentClubMatch && currentClubMatch[2]) {
        club = currentClubMatch[2].trim();
        clubId = currentClubMatch[1];
      }
    }
  }

  // Sleep for 3 seconds to avoid overwhelming the BC website
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Fetch cyclocross points (d=6)
  const cyclocrossUrl = `https://www.britishcycling.org.uk/points?d=6&person_id=${person_id}&year=${year}`;
  console.log(cyclocrossUrl);
  const cyclocrossResponse = await fetch(cyclocrossUrl);
  
  // Check for server error
  if (cyclocrossResponse.status === 500) {
    throw new Error('BC website returned 500 error for cyclocross points');
  }
  
  const cyclocrossHtml = await cyclocrossResponse.text();

  // Extract rider category from the Road & Track results
  let category = '';
  const categoryRegex = /<dd>Category:\s*([^<]+)<\/dd>/;
  const categoryMatch = regularHtml.match(categoryRegex);
  if (categoryMatch && categoryMatch[1]) {
    category = categoryMatch[1].trim();
  }

  // Process regular points
  let regularRaceCount = 0;
  let regularPoints = 0;
  let regionalPoints = 0;
  let nationalPoints = 0;
  
  // Deduplicate races based on event ID in URL for regular points
  const regularTbodyStart = regularHtml.indexOf("<tbody>");
  const regularTbodyEnd = regularHtml.indexOf("</tbody>");
  
  if (regularTbodyStart !== -1 && regularTbodyEnd !== -1) {
    const tbody = regularHtml.slice(regularTbodyStart, regularTbodyEnd);
    const eventIdMatches = [...tbody.matchAll(/\/events\/details\/(\d+)\//g)];
    const uniqueEventIds = new Set(eventIdMatches.map(match => match[1]));
    regularRaceCount = uniqueEventIds.size;
    
    // Process each race to categorize points as regional or national
    const rows = tbody.split("<tr>");
    for (let i = 1; i < rows.length; i++) { // Skip first empty element
      const row = rows[i];
      const cells = row.split("<td>");
      
      // Check if we have enough cells and the points cell has a value
      if (cells.length >= 6) {
        // Extract category from the second cell
        const categoryCell = cells[2];
        const pointsCell = cells[5];
        
        // Extract points value
        const pointsEndIndex = pointsCell.indexOf("</td>");
        if (pointsEndIndex !== -1) {
          const pointsValue = pointsCell.substring(0, pointsEndIndex).trim();
          const points = isNaN(Number(pointsValue)) ? 0 : Number(pointsValue);
          
          // Categorize points based on race category
          if (categoryCell.includes("National")) {
            nationalPoints += points;
          } else {
            regionalPoints += points;
          }
        }
      }
    }
  }

  // Extract total points from <tfoot> for regular points
  const regularTfootStart = regularHtml.indexOf("<tfoot>");
  if (regularTfootStart !== -1) {
    let pos = regularHtml.indexOf("<td>", regularTfootStart);
    for (let i = 0; i < 4 && pos !== -1; i++) {
      pos = regularHtml.indexOf("<td>", pos + 1);
    }
    if (pos !== -1) {
      const start = pos + 4;
      const end = regularHtml.indexOf("</td>", start);
      const value = regularHtml.slice(start, end).trim();
      regularPoints = isNaN(Number(value)) ? 0 : Number(value);
    }
  }

  // Process cyclocross points
  let cyclocrossRaceCount = 0;
  let cyclocrossPoints = 0;
  let cyclocrossRegionalPoints = 0;
  let cyclocrossNationalPoints = 0;
  
  // Deduplicate races based on event ID in URL for cyclocross points
  const cyclocrossTbodyStart = cyclocrossHtml.indexOf("<tbody>");
  const cyclocrossTbodyEnd = cyclocrossHtml.indexOf("</tbody>");
  
  if (cyclocrossTbodyStart !== -1 && cyclocrossTbodyEnd !== -1) {
    const tbody = cyclocrossHtml.slice(cyclocrossTbodyStart, cyclocrossTbodyEnd);
    const eventIdMatches = [...tbody.matchAll(/\/events\/details\/(\d+)\//g)];
    const uniqueEventIds = new Set(eventIdMatches.map(match => match[1]));
    cyclocrossRaceCount = uniqueEventIds.size;
    
    // Process each race to categorize points as regional or national
    const rows = tbody.split("<tr>");
    for (let i = 1; i < rows.length; i++) { // Skip first empty element
      const row = rows[i];
      const cells = row.split("<td>");
      
      // Check if we have enough cells and the points cell has a value
      if (cells.length >= 6) {
        // Extract category from the second cell
        const categoryCell = cells[2];
        const pointsCell = cells[5];
        
        // Extract points value
        const pointsEndIndex = pointsCell.indexOf("</td>");
        if (pointsEndIndex !== -1) {
          const pointsValue = pointsCell.substring(0, pointsEndIndex).trim();
          const points = isNaN(Number(pointsValue)) ? 0 : Number(pointsValue);
          
          // Categorize points based on race category
          if (categoryCell.includes("National")) {
            cyclocrossNationalPoints += points;
          } else {
            cyclocrossRegionalPoints += points;
          }
        }
      }
    }
  }

  // If club is still not found, try to extract from cyclocross HTML
  if (!club) {
    const currentYear = new Date().getFullYear().toString();
    
    if (year === currentYear) {
      // For current year, use Current Club from cyclocross HTML
      const cxCurrentClubRegex = /<dd>Current Club: <a[^>]*href="\/clubpoints\/\?club_id=(\d+)[^"]*">([^<]+)<\/a>/;
      const cxCurrentClubMatch = cyclocrossHtml.match(cxCurrentClubRegex);
      if (cxCurrentClubMatch && cxCurrentClubMatch[2]) {
        club = cxCurrentClubMatch[2].trim();
        clubId = cxCurrentClubMatch[1];
      } else {
        // Fall back to Year End Club
        const cxYearEndClubRegex = /<dd>Year End Club: <a[^>]*href="\/clubpoints\/\?club_id=(\d+)[^"]*">([^<]+)<\/a>/;
        const cxYearEndClubMatch = cyclocrossHtml.match(cxYearEndClubRegex);
        if (cxYearEndClubMatch && cxYearEndClubMatch[2]) {
          club = cxYearEndClubMatch[2].trim();
          clubId = cxYearEndClubMatch[1];
        }
      }
    } else {
      // For other years, use Year End Club from cyclocross HTML
      const cxYearEndClubRegex = /<dd>Year End Club: <a[^>]*href="\/clubpoints\/\?club_id=(\d+)[^"]*">([^<]+)<\/a>/;
      const cxYearEndClubMatch = cyclocrossHtml.match(cxYearEndClubRegex);
      if (cxYearEndClubMatch && cxYearEndClubMatch[2]) {
        club = cxYearEndClubMatch[2].trim();
        clubId = cxYearEndClubMatch[1];
      } else {
        // Fall back to Current Club
        const cxCurrentClubRegex = /<dd>Current Club: <a[^>]*href="\/clubpoints\/\?club_id=(\d+)[^"]*">([^<]+)<\/a>/;
        const cxCurrentClubMatch = cyclocrossHtml.match(cxCurrentClubRegex);
        if (cxCurrentClubMatch && cxCurrentClubMatch[2]) {
          club = cxCurrentClubMatch[2].trim();
          clubId = cxCurrentClubMatch[1];
        }
      }
    }
  }

  // Extract total points from <tfoot> for cyclocross points
  const cyclocrossTfootStart = cyclocrossHtml.indexOf("<tfoot>");
  if (cyclocrossTfootStart !== -1) {
    let pos = cyclocrossHtml.indexOf("<td>", cyclocrossTfootStart);
    for (let i = 0; i < 4 && pos !== -1; i++) {
      pos = cyclocrossHtml.indexOf("<td>", pos + 1);
    }
    if (pos !== -1) {
      const start = pos + 4;
      const end = cyclocrossHtml.indexOf("</td>", start);
      const value = cyclocrossHtml.slice(start, end).trim();
      cyclocrossPoints = isNaN(Number(value)) ? 0 : Number(value);
    }
  }

  // We no longer add members to clubs, but we still want to store club ID if found
  if (club && clubId) {
    try {
      let clubs = {};
      
      // Read existing clubs data if file exists
      if (fs.existsSync(CLUBS_FILE)) {
        const clubsData = fs.readFileSync(CLUBS_FILE, 'utf8');
        clubs = JSON.parse(clubsData);
      }
      
      // Add or update club entry with ID but don't modify members
      if (!clubs[club]) {
        clubs[club] = { id: clubId, members: [] };
      } else if (!clubs[club].id) {
        clubs[club].id = clubId;
      }
      
      // Write updated clubs data
      fs.writeFileSync(CLUBS_FILE, JSON.stringify(clubs, null, 2), 'utf8');
    } catch (err) {
      console.error(`Error updating clubs cache: ${err.message}`);
    }
  }

  // Combine results
  return { 
    raceCount: regularRaceCount + cyclocrossRaceCount, 
    points: regularPoints + cyclocrossPoints,
    roadAndTrackPoints: regularPoints,
    cyclocrossPoints,
    roadAndTrackRaceCount: regularRaceCount,
    cyclocrossRaceCount,
    category,
    name,
    club,
    clubId,
    regionalPoints: regionalPoints + cyclocrossRegionalPoints,
    nationalPoints: nationalPoints + cyclocrossNationalPoints,
    roadRegionalPoints: regionalPoints,
    roadNationalPoints: nationalPoints,
    cxRegionalPoints: cyclocrossRegionalPoints,
    cxNationalPoints: cyclocrossNationalPoints
  };
}

// Serve React app for all unmatched routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`App running in ${process.env.NODE_ENV || 'development'} mode on http://localhost:${PORT}`);
});