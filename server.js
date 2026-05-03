// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const puppeteer = require('puppeteer');
const { fetchRacerData } = require('./services/racerDataService');
const { fetchRacerData: fetchRacerDataAxios } = require('./services/axiosRacerService');
const { logger } = require('./services/logger');
const path = require('path');
const fs = require('fs');
// Firebase Admin SDK for server-side operations
const admin = require('firebase-admin');

const log = logger.child({ component: 'server' });

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBW72KiOT4TYXx8tbTQA2g1GjRMA4-yJ3k",
  authDomain: "mitre-riders.firebaseapp.com",
  projectId: "mitre-riders",
  storageBucket: "mitre-riders.firebasestorage.app",
  messagingSenderId: "701709492859",
  appId: "1:701709492859:web:00f2529f28b096f94038de"
};

// For development, use a simpler approach that doesn't require service account credentials
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: firebaseConfig.projectId
});

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware to verify Firebase ID token
const verifyToken = async (req, res, next) => {
  const idToken = req.headers.authorization?.split('Bearer ')[1];

  if (!idToken) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  try {
    // Verify the ID token using Firebase Admin SDK
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    log.error('auth_token_invalid', { err: error });
    return res.status(403).json({ error: 'Forbidden: Invalid token' });
  }
};

// Serve static frontend from /client
app.use(cors());
app.use(express.json()); // Add JSON body parser for POST requests

// Middleware to log all non-GET requests
app.use((req, res, next) => {
  if (req.method !== 'GET') {
    log.info('http_request', {
      method: req.method,
      path: req.originalUrl,
      body: req.body,
    });
  }
  next();
});

app.use(express.static(path.join(__dirname, 'client')));

// Configure cache directory based on environment
const CACHE_DIR = process.env.NODE_ENV === 'production'
  ? '/data'
  : path.join(__dirname, 'cache');

// Create cache directory if it doesn't exist
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  log.info('cache_dir_created', { dir: CACHE_DIR });
}

// Configure racers directory
const RACERS_DIR = path.join(CACHE_DIR, 'racers');
if (!fs.existsSync(RACERS_DIR)) {
  fs.mkdirSync(RACERS_DIR, { recursive: true });
  log.info('racers_dir_created', { dir: RACERS_DIR });
}

// Configure clubs directory
const CLUBS_DIR = path.join(CACHE_DIR, 'clubs');
if (!fs.existsSync(CLUBS_DIR)) {
  fs.mkdirSync(CLUBS_DIR, { recursive: true });
  log.info('clubs_dir_created', { dir: CLUBS_DIR });
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
      log.info('racers_loaded', { count: racers.length, path: RACERS_FILE });
    }
  } catch (err) {
    log.error('racers_load_failed', { err, path: RACERS_FILE });
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

  const cacheKey = `${person_id}_${year}_road-track`;
  const cacheFilePath = path.join(CACHE_DIR, `${cacheKey}.json`);
  const now = Date.now();
  const cacheDurationMinutes = CACHE_TTL_MS / (60 * 1000);
  const currentYear = new Date().getFullYear().toString();
  const isPreviousYear = year < currentYear;

  // Check memory cache first
  if (cache[cacheKey]) {
    if (isPreviousYear || now - cache[cacheKey].timestamp < CACHE_TTL_MS) {
      log.info('cache_hit', {
        source: 'memory',
        cache_key: cacheKey,
        previous_year: isPreviousYear,
      });
      return res.json(cache[cacheKey].data);
    }
  }

  // Check if cache file exists
  if (fs.existsSync(cacheFilePath)) {
    try {
      const fileContent = fs.readFileSync(cacheFilePath, 'utf8');
      const cacheEntry = JSON.parse(fileContent);

      // Locally always serve disk cache; in production previous years never
      // expire and current year uses TTL.
      if (process.env.NODE_ENV !== 'production' || isPreviousYear || now - cacheEntry.timestamp < CACHE_TTL_MS) {
        log.info('cache_hit', {
          source: 'disk',
          cache_key: cacheKey,
          previous_year: isPreviousYear,
          local_dev: process.env.NODE_ENV !== 'production',
        });
        cache[cacheKey] = cacheEntry;
        return res.json(cacheEntry.data);
      }
    } catch (err) {
      log.error('cache_read_failed', { err, path: cacheFilePath });
    }
  }

  log.info('cache_miss', { cache_key: cacheKey, ttl_minutes: cacheDurationMinutes });

  try {
    const result = await fetchRacerDataWrapper(person_id, year, 'road-track');
    const cacheEntry = { data: result, timestamp: now };

    // Update memory cache
    cache[cacheKey] = cacheEntry;

    // Write to disk cache
    fs.writeFile(cacheFilePath, JSON.stringify(cacheEntry), 'utf8', (err) => {
      if (err) {
        log.error('cache_write_failed', { err, path: cacheFilePath });
      }
    });

    res.json(result);
  } catch (err) {
    if (err.message.includes('500 error')) {
      log.error('bc_api_500', { err, person_id, year });
    } else {
      log.error('race_data_fetch_failed', { err, person_id, year });
    }

    // Fall back to stale cache for non-500 errors.
    if (!err.message.includes('500 error') && fs.existsSync(cacheFilePath)) {
      try {
        const fileContent = fs.readFileSync(cacheFilePath, 'utf8');
        const cacheEntry = JSON.parse(fileContent);
        log.warn('cache_stale_served', { cache_key: cacheKey, reason: err.message });
        return res.json(cacheEntry.data);
      } catch (cacheErr) {
        log.error('cache_recovery_read_failed', { err: cacheErr, path: cacheFilePath });
      }
    }

    res.status(500).send("Failed to fetch race data");
  }
});

// Endpoint to get all racers
app.get('/api/racers', (req, res) => {
  res.json(racers);
});

// Endpoint to update racers list - PROTECTED
app.post('/api/racers', verifyToken, (req, res) => {
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
    log.error('racers_update_failed', { err });
    res.status(500).send("Failed to update racers list");
  }
});

// Endpoint to add a single racer by BC number - PROTECTED
app.post('/api/racers/add', verifyToken, (req, res) => {
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
    log.error('racer_add_failed', { err });
    res.status(500).json({ message: "Failed to add racer" });
  }
});

// Endpoint to remove a racer by BC number - PROTECTED
app.delete('/api/racers/:bc', verifyToken, (req, res) => {
  try {
    const { bc } = req.params;

    if (!bc) {
      return res.status(400).json({ message: "Missing BC number" });
    }

    // Check if BC number exists
    const initialLength = racers.length;
    racers = racers.filter(racer => racer.bc !== bc);

    if (racers.length === initialLength) {
      return res.status(404).json({ message: "BC number not found" });
    }

    // Save to file
    fs.writeFileSync(RACERS_FILE, JSON.stringify(racers, null, 2), 'utf8');

    res.json({ success: true, bc, count: racers.length });
  } catch (err) {
    log.error('racer_remove_failed', { err });
    res.status(500).json({ message: "Failed to remove racer" });
  }
});

// New endpoint to build cache for all racers - PROTECTED
app.post('/api/build-cache', verifyToken, async (req, res) => {
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

      const cacheKey = `${racerId}_${year}_road-track`;
      const cacheFilePath = path.join(CACHE_DIR, `${cacheKey}.json`);

      try {
        // Fetch data from BC API
        const result = await fetchRacerDataWrapper(racerId, year, 'road-track');
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

        // Update racers file with fetched name
        try {
          if (result.name && (!racer.name || racer.name !== result.name)) {
            racer.name = result.name;
            fs.writeFileSync(RACERS_FILE, JSON.stringify(racers, null, 2), 'utf8');
          }
        } catch (writeErr) {
          log.error('racers_file_name_update_failed', { err: writeErr, racer_id: racerId });
        }
      } catch (err) {
        results.failed++;
        results.details.push({
          racerId,
          name: racer.name,
          status: 'failed',
          error: err.message
        });
        log.error('cache_build_failed', { err, racer_id: racerId, year });
      }
    } else {
      // Process each racer and build cache
      for (const racer of racers) {
        const racerId = racer.bc;
        const cacheKey = `${racerId}_${year}_road-track`;
        const cacheFilePath = path.join(CACHE_DIR, `${cacheKey}.json`);

        try {
          // Fetch data from BC API
          const result = await fetchRacerDataWrapper(racerId, year, 'road-track');
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

          // Update racers file with fetched name
          try {
            if (result.name && (!racer.name || racer.name !== result.name)) {
              racer.name = result.name;
              fs.writeFileSync(RACERS_FILE, JSON.stringify(racers, null, 2), 'utf8');
            }
          } catch (writeErr) {
            log.error('racers_file_name_update_failed', { err: writeErr, racer_id: racerId });
          }
        } catch (err) {
          results.failed++;
          results.details.push({
            racerId,
            name: racer.name,
            status: 'failed',
            error: err.message
          });
          log.error('cache_build_failed', { err, racer_id: racerId, year });
        }
      }
    }

    res.json(results);
  } catch (err) {
    log.error('cache_build_batch_failed', { err, year });
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
      
      // Use road-track cache only
      let cacheKey = `${racerId}_${year}_road-track`;
      let cacheFilePath = path.join(CACHE_DIR, `${cacheKey}.json`);
      
      // Check if requested discipline cache exists, if not try other disciplines
      let cacheEntry = null;
      if (cache[cacheKey]) {
        cacheEntry = cache[cacheKey];
      } else if (fs.existsSync(cacheFilePath)) {
        try {
          const fileContent = fs.readFileSync(cacheFilePath, 'utf8');
          cacheEntry = JSON.parse(fileContent);
        } catch (err) {
          log.error('cache_read_failed', { err, path: cacheFilePath });
        }
      }

      if (cacheEntry) {
        log.debug('cache_hit', { cache_key: cacheKey, source: cache[cacheKey] ? 'memory' : 'disk' });
        if (!cache[cacheKey]) {
          cache[cacheKey] = cacheEntry;
        }
        results[racerId] = {
          ...cacheEntry.data
        };
      } else {
        log.debug('cache_missing', { racer_id: racerId, year });
        missingData.push(racerId);
        
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
    }

    res.json(results);
  } catch (err) {
    log.error('all_race_data_failed', { err });
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
      const filePath = path.join(CACHE_DIR, file);
      let timestamp = null;

      // Read the file to get the timestamp
      try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const cacheEntry = JSON.parse(fileContent);
        timestamp = cacheEntry.timestamp;
      } catch (readErr) {
        log.error('cache_timestamp_read_failed', { err: readErr, file });
      }

      return {
        filename: file,
        racerId,
        year,
        lastBuilt: timestamp
      };
    });

    res.json({
      count: result.length,
      files: result
    });
  } catch (err) {
    log.error('cache_list_failed', { err, year });
    res.status(500).send(`Failed to list cache files for year ${year}`);
  }
});

// RESTful endpoint to delete cache files by year - PROTECTED
app.delete('/api/cache/:year', verifyToken, (req, res) => {
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
        // Extract cache key from filename (format: racerId_year_discipline.json)
        const cacheKey = file.replace('.json', '');
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
    log.error('cache_delete_failed', { err, year });
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
    log.error('clubs_fetch_failed', { err });
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
    log.error('clubs_file_fetch_failed', { err });
    res.status(500).send("Failed to fetch clubs file");
  }
});

// Endpoint to delete a club - PROTECTED
app.delete('/api/clubs/:clubName', verifyToken, (req, res) => {
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
    log.error('club_remove_failed', { err });
    res.status(500).json({ success: false, message: "Failed to remove club" });
  }
});

// Wrapper function using only puppeteer
async function fetchRacerDataWrapper(person_id, year, discipline = 'both') {
  return await fetchRacerData(person_id, year, CLUBS_FILE, discipline);
}

// Serve React app for all unmatched routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'index.html'));
});

app.listen(PORT, () => {
  log.info('server_started', {
    port: PORT,
    node_env: process.env.NODE_ENV || 'development',
    url: `http://localhost:${PORT}`,
  });
});