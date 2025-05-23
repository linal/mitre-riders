const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');

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

// Disk-based cache with in-memory lookup
const cache = {};
const CACHE_TTL_MS = process.env.NODE_ENV === 'production' 
  ? 24 * 60 * 60 * 1000  // 24 hours in production
  : 10 * 60 * 1000;      // 10 minutes in development

// Racer information stored on server
const racers = [
  /* Mitre */
  { name: "Marek Shafer", bc: "670931", club: "Brighton Mitre CC" },
  { name: "Alwyn Frank", bc: "482041", club: "Brighton Mitre CC" },
  { name: "Nathan Cozens", bc: "987321", club: "Brighton Mitre CC" },
  { name: "Cesare Masset", bc: "1148505", club: "Brighton Mitre CC" },
  { name: "John Tindell", bc: "529480", club: "Brighton Mitre CC" },
  { name: "Jack Smith", bc: "40747", club: "Brighton Mitre CC" },
  { name: "Daniel Magrizos", bc: "925710", club: "Brighton Mitre CC" },
  { name: "Seamus Mcalister", bc: "750617", club: "Brighton Mitre CC" },
  { name: "Ben Weaterton", bc: "1149921", club: "Brighton Mitre CC" },
  { name: "Thomas Houghton", bc: "57471", club: "Brighton Mitre CC" },
  { name: "Jash Hutheesing", bc: "1040818", club: "Brighton Mitre CC" },
  { name: "Karla Boddy", bc: "133044", club: "Brighton Mitre CC" },
  { name: "Ernesto Battinelli", bc: "746844", club: "Brighton Mitre CC" },
  { name: "Russell Bickle", bc: "442746", club: "Brighton Mitre CC" },
  { name: "Mark Day", bc: "651560", club: "Brighton Mitre CC" },
  /* SVRC */
  { name: "Richard Mount", bc: "335910", club: "Sussex Revolution Velo Club" },
  { name: "James Di Rico", bc: "29982", club: "Sussex Revolution Velo Club" },
  { name: "Gemma Lewis", bc: "1128565", club: "Sussex Revolution Velo Club" },
  { name: "Joshua Dunne", bc: "219770", club: "Sussex Revolution Velo Club" }
];

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

// New endpoint to build cache for all racers
app.post('/api/build-cache', async (req, res) => {
  const { year } = req.body || req.query;
  
  if (!year) {
    return res.status(400).send("Missing year parameter");
  }
  
  const now = Date.now();
  const results = {
    success: true,
    totalRacers: racers.length,
    cached: 0,
    failed: 0,
    skipped: 0,
    details: []
  };
  
  try {
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
          ...cache[cacheKey].data,
          name: racer.name,
          club: racer.club
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
            ...cacheEntry.data,
            name: racer.name,
            club: racer.club
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
        name: racer.name,
        club: racer.club,
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
  
  // Deduplicate races based on event ID in URL for regular points
  const regularTbodyStart = regularHtml.indexOf("<tbody>");
  const regularTbodyEnd = regularHtml.indexOf("</tbody>");
  
  if (regularTbodyStart !== -1 && regularTbodyEnd !== -1) {
    const tbody = regularHtml.slice(regularTbodyStart, regularTbodyEnd);
    const eventIdMatches = [...tbody.matchAll(/\/events\/details\/(\d+)\//g)];
    const uniqueEventIds = new Set(eventIdMatches.map(match => match[1]));
    regularRaceCount = uniqueEventIds.size;
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
  
  // Deduplicate races based on event ID in URL for cyclocross points
  const cyclocrossTbodyStart = cyclocrossHtml.indexOf("<tbody>");
  const cyclocrossTbodyEnd = cyclocrossHtml.indexOf("</tbody>");
  
  if (cyclocrossTbodyStart !== -1 && cyclocrossTbodyEnd !== -1) {
    const tbody = cyclocrossHtml.slice(cyclocrossTbodyStart, cyclocrossTbodyEnd);
    const eventIdMatches = [...tbody.matchAll(/\/events\/details\/(\d+)\//g)];
    const uniqueEventIds = new Set(eventIdMatches.map(match => match[1]));
    cyclocrossRaceCount = uniqueEventIds.size;
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

  // Combine results
  return { 
    raceCount: regularRaceCount + cyclocrossRaceCount, 
    points: regularPoints + cyclocrossPoints,
    roadAndTrackPoints: regularPoints,
    cyclocrossPoints,
    roadAndTrackRaceCount: regularRaceCount,
    cyclocrossRaceCount,
    category
  };
}

// Serve React app for all unmatched routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`App running in ${process.env.NODE_ENV || 'development'} mode on http://localhost:${PORT}`);
});