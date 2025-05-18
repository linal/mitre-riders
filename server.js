const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Serve static frontend from /client
app.use(cors());
app.use(express.static(path.join(__dirname, 'client')));

// Simple in-memory cache
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
  const now = Date.now();
  const cacheDurationMinutes = CACHE_TTL_MS / (60 * 1000);

  if (cache[cacheKey] && now - cache[cacheKey].timestamp < CACHE_TTL_MS) {
    console.log(`Cache HIT for ${cacheKey}. Cache duration: ${cacheDurationMinutes} minutes`);
    return res.json(cache[cacheKey].data);
  }
  
  console.log(`Cache MISS for ${cacheKey}. Cache duration: ${cacheDurationMinutes} minutes`);

  try {
    const result = await fetchRacerData(person_id, year);
    cache[cacheKey] = { data: result, timestamp: now };
    res.json(result);
  } catch (err) {
    console.error("Error fetching or parsing race data:", err.message);
    res.status(500).send("Failed to fetch race data");
  }
});

// Endpoint to get all racers
app.get('/api/racers', (req, res) => {
  res.json(racers);
});

// Endpoint to get all race data
app.get('/api/all-race-data', async (req, res) => {
  const { year } = req.query;
  
  if (!year) {
    return res.status(400).send("Missing year parameter");
  }
  
  const now = Date.now();
  const cacheDurationMinutes = CACHE_TTL_MS / (60 * 1000);
  const results = {};
  
  try {
    // Process each racer, using cache when available
    for (const racer of racers) {
      const racerId = racer.bc;
      const cacheKey = `${racerId}_${year}`;
      
      if (cache[cacheKey] && now - cache[cacheKey].timestamp < CACHE_TTL_MS) {
        console.log(`Cache HIT for ${cacheKey}. Cache duration: ${cacheDurationMinutes} minutes`);
        results[racerId] = {
          ...cache[cacheKey].data,
          name: racer.name,
          club: racer.club
        };
      } else {
        console.log(`Cache MISS for ${cacheKey}. Cache duration: ${cacheDurationMinutes} minutes`);
        const result = await fetchRacerData(racerId, year);
        cache[cacheKey] = { data: result, timestamp: now };
        results[racerId] = {
          ...result,
          name: racer.name,
          club: racer.club
        };
      }
    }
    
    res.json(results);
  } catch (err) {
    console.error("Error fetching or parsing race data:", err.message);
    res.status(500).send("Failed to fetch race data");
  }
});

// Helper function to fetch and process racer data
async function fetchRacerData(person_id, year) {
  // Fetch regular points (d=4)
  const regularUrl = `https://www.britishcycling.org.uk/points?d=4&person_id=${person_id}&year=${year}`;
  console.log(regularUrl);
  const regularResponse = await fetch(regularUrl);
  const regularHtml = await regularResponse.text();

  // Fetch cyclocross points (d=6)
  const cyclocrossUrl = `https://www.britishcycling.org.uk/points?d=6&person_id=${person_id}&year=${year}`;
  console.log(cyclocrossUrl);
  const cyclocrossResponse = await fetch(cyclocrossUrl);
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
  console.log(`App running on http://localhost:${PORT}`);
});