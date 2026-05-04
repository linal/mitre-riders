// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const puppeteer = require('puppeteer');
const { fetchRacerData } = require('./services/racerDataService');
const { fetchRacerData: fetchRacerDataAxios } = require('./services/axiosRacerService');
const { logger, classifyError, randomId } = require('./services/logger');
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

// Probe the cache directory at boot so we know up-front whether it's
// writable and how many cached files survived the previous run. This is
// critical when running in containers where volumes may not be mounted.
function probeCacheDir() {
  try {
    const stat = fs.statSync(CACHE_DIR);
    let writable = false;
    try {
      fs.accessSync(CACHE_DIR, fs.constants.W_OK);
      writable = true;
    } catch (_e) {
      writable = false;
    }
    const entries = fs.readdirSync(CACHE_DIR);
    const cacheFiles = entries.filter(f => f.endsWith('.json'));
    let totalBytes = 0;
    for (const f of cacheFiles) {
      try {
        totalBytes += fs.statSync(path.join(CACHE_DIR, f)).size;
      } catch (_e) {
        // ignore individual file stat failures
      }
    }
    log.info('cache_dir_status', {
      dir: CACHE_DIR,
      exists: true,
      is_directory: stat.isDirectory(),
      writable,
      mode: '0' + (stat.mode & 0o777).toString(8),
      file_count: cacheFiles.length,
      total_bytes: totalBytes,
      mtime: stat.mtime.toISOString(),
    });
    if (!writable) {
      log.error('cache_dir_not_writable', {
        dir: CACHE_DIR,
        hint: 'cache writes will fail; check volume mount / file permissions',
      });
    }
  } catch (err) {
    log.error('cache_dir_probe_failed', { dir: CACHE_DIR, err });
  }
}
probeCacheDir();

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

// Read whatever cache we wrote previously for this rider. Returned shape is
// trimmed to the few fields most useful for spotting churn between rebuilds.
function readPreviousCache(cacheFilePath) {
  if (!fs.existsSync(cacheFilePath)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
    if (!raw || !raw.data) return null;
    return {
      timestamp: raw.timestamp,
      points: raw.data.points,
      race_count: raw.data.raceCount,
      regional_points: raw.data.regionalPoints,
      national_points: raw.data.nationalPoints,
      name: raw.data.name,
      club: raw.data.club,
      category: raw.data.category,
    };
  } catch (_e) {
    return { unreadable: true };
  }
}

// Build (or rebuild) the cache for a single racer. All logging needed to
// understand *why* the cache did or didn't get built lives here, so the same
// trace works whether we're rebuilding one rider or the whole roster.
async function buildCacheForRacer(racer, year, opts) {
  const { now, index, total, batchLog } = opts;
  const racerId = racer.bc;
  const cacheKey = `${racerId}_${year}_road-track`;
  const cacheFilePath = path.join(CACHE_DIR, `${cacheKey}.json`);

  const attemptLog = batchLog.child({
    op: 'build_cache',
    racer_id: racerId,
    racer_known_name: racer.name || null,
    cache_key: cacheKey,
    cache_path: cacheFilePath,
    attempt_index: index,
    attempt_total: total,
  });

  const previous = readPreviousCache(cacheFilePath);
  const attemptStart = Date.now();
  attemptLog.info('cache_build_attempt', {
    description: `Starting fetch + cache write for racer ${index}/${total}`,
    previous_cache: previous,
  });

  // Capture everything we want to know about this attempt in one record so
  // we can emit a single self-describing 'cache_attempt_summary' line at
  // the end. This is the line an LLM should read to understand the attempt.
  const summary = {
    description: '',
    outcome: 'unknown',
    duration_ms: 0,
    fetch_duration_ms: null,
    write_duration_ms: null,
    persisted: null,
    bytes_written: null,
    bytes_on_disk: null,
    cloudflare_seen: null,
    cloudflare_resolved: null,
    html_length: null,
    page_title: null,
    name_extracted: null,
    parse_warnings: [],
    suspicious_values: false,
    error_class: null,
    error_message: null,
    values: null,
    previous_values: previous,
    delta: null,
  };

  let result;
  const fetchStart = Date.now();
  try {
    result = await fetchRacerDataWrapper(racerId, year, 'road-track');
  } catch (err) {
    summary.fetch_duration_ms = Date.now() - fetchStart;
    summary.duration_ms = Date.now() - attemptStart;
    summary.outcome = 'failed';
    summary.error_class = classifyError(err);
    summary.error_message = err.message;
    summary.persisted = false;
    summary.description =
      `Fetch failed (${summary.error_class}): ${err.message}. ` +
      `Cache was NOT updated. Previous cache ${previous ? 'still exists' : 'did not exist'}.`;

    attemptLog.error('cache_build_failed', {
      duration_ms: summary.duration_ms,
      fetch_duration_ms: summary.fetch_duration_ms,
      reason: err.message,
      error_class: summary.error_class,
      err,
      cache_written: false,
      previous_cache_exists: !!previous,
    });
    attemptLog.info('cache_attempt_summary', summary);

    return {
      status: 'failed',
      detail: { racerId, name: racer.name, status: 'failed', error: err.message, error_class: summary.error_class },
      summary,
    };
  }
  summary.fetch_duration_ms = Date.now() - fetchStart;

  const diagnostics = result._diagnostics || {};
  summary.cloudflare_seen = diagnostics.cloudflare_seen ?? null;
  summary.cloudflare_resolved = diagnostics.cloudflare_resolved ?? null;
  summary.html_length = diagnostics.html_length ?? null;
  summary.page_title = diagnostics.page_title ?? null;
  summary.name_extracted = diagnostics.name_extracted ?? null;
  summary.parse_warnings = (diagnostics.parse && diagnostics.parse.warnings) || [];

  // Strip the diagnostics blob before persisting so the on-disk cache stays
  // identical to what consumers expect.
  const persistableResult = { ...result };
  delete persistableResult._diagnostics;

  const cacheEntry = { data: persistableResult, timestamp: now };

  summary.values = {
    name: persistableResult.name,
    club: persistableResult.club,
    club_id: persistableResult.clubId,
    category: persistableResult.category,
    points: persistableResult.points,
    race_count: persistableResult.raceCount,
    road_and_track_points: persistableResult.roadAndTrackPoints,
    road_and_track_race_count: persistableResult.roadAndTrackRaceCount,
    regional_points: persistableResult.regionalPoints,
    national_points: persistableResult.nationalPoints,
  };
  if (previous) {
    summary.delta = {
      points: (summary.values.points ?? 0) - (previous.points ?? 0),
      race_count: (summary.values.race_count ?? 0) - (previous.race_count ?? 0),
      regional_points: (summary.values.regional_points ?? 0) - (previous.regional_points ?? 0),
      national_points: (summary.values.national_points ?? 0) - (previous.national_points ?? 0),
      category_changed: summary.values.category !== previous.category,
      club_changed: summary.values.club !== previous.club,
    };
  }

  attemptLog.info('cache_values_extracted', {
    duration_ms: Date.now() - attemptStart,
    fetch_duration_ms: summary.fetch_duration_ms,
    timestamp: cacheEntry.timestamp,
    values: summary.values,
    diagnostics: {
      cloudflare_seen: summary.cloudflare_seen,
      cloudflare_resolved: summary.cloudflare_resolved,
      html_length: summary.html_length,
      page_title: summary.page_title,
      name_extracted: summary.name_extracted,
      parse_warnings: summary.parse_warnings,
    },
  });

  // Heuristic: if the page parsed but every meaningful field is empty/zero,
  // we almost certainly hit a layout change or a partial Cloudflare bypass.
  // Caching that would mask the real problem, so warn loudly.
  const looksEmpty =
    !persistableResult.name &&
    !persistableResult.club &&
    !persistableResult.category &&
    persistableResult.points === 0 &&
    persistableResult.raceCount === 0;
  summary.suspicious_values = looksEmpty || summary.parse_warnings.length > 0;
  if (looksEmpty) {
    attemptLog.warn('cache_values_suspicious', {
      reason: 'all_extracted_fields_empty_or_zero',
      values: persistableResult,
    });
  }

  cache[cacheKey] = cacheEntry;

  const writeStart = Date.now();
  let bytesWritten = 0;
  try {
    const serialized = JSON.stringify(cacheEntry);
    fs.writeFileSync(cacheFilePath, serialized, 'utf8');
    bytesWritten = Buffer.byteLength(serialized, 'utf8');
  } catch (writeErr) {
    summary.write_duration_ms = Date.now() - writeStart;
    summary.duration_ms = Date.now() - attemptStart;
    summary.outcome = 'failed';
    summary.error_class = classifyError(writeErr);
    summary.error_message = writeErr.message;
    summary.persisted = false;
    summary.description =
      `Fetch succeeded but disk write failed (${summary.error_class}): ${writeErr.message}. ` +
      `Cache directory may be read-only or out of space.`;
    attemptLog.error('cache_disk_write_failed', {
      err: writeErr,
      error_class: summary.error_class,
      intended_payload: cacheEntry,
    });
    attemptLog.info('cache_attempt_summary', summary);
    return {
      status: 'failed',
      detail: { racerId, name: racer.name, status: 'failed', error: writeErr.message, error_class: summary.error_class },
      summary,
    };
  }
  summary.write_duration_ms = Date.now() - writeStart;
  summary.bytes_written = bytesWritten;

  // writeFileSync doesn't actually prove the file landed on disk in a
  // container with an unmounted volume - the kernel can happily write to
  // an ephemeral overlay that disappears on restart. Stat the file
  // afterwards and compare sizes so any discrepancy is loud.
  let bytesOnDisk = null;
  try {
    const stat = fs.statSync(cacheFilePath);
    bytesOnDisk = stat.size;
    if (bytesOnDisk !== bytesWritten) {
      attemptLog.warn('cache_disk_size_mismatch', {
        bytes_written: bytesWritten,
        bytes_on_disk: bytesOnDisk,
      });
    }
  } catch (statErr) {
    attemptLog.error('cache_disk_verify_failed', {
      err: statErr,
      hint: 'write reported success but file does not exist - check volume mount',
    });
  }
  summary.bytes_on_disk = bytesOnDisk;
  summary.persisted = bytesOnDisk !== null;
  summary.duration_ms = Date.now() - attemptStart;
  summary.outcome = 'cached';
  summary.description = summary.suspicious_values
    ? `Cached racer "${summary.values.name || racer.name || racerId}" but extracted values look suspicious ` +
      `(${summary.parse_warnings.join(', ') || 'all-empty'}). Investigate before trusting.`
    : `Cached racer "${summary.values.name || racer.name || racerId}" with ${summary.values.points} pts ` +
      `over ${summary.values.race_count} races (${bytesOnDisk} bytes on disk).`;

  attemptLog.info('cache_built', {
    duration_ms: summary.duration_ms,
    fetch_duration_ms: summary.fetch_duration_ms,
    write_duration_ms: summary.write_duration_ms,
    bytes_written: bytesWritten,
    bytes_on_disk: bytesOnDisk,
    persisted: summary.persisted,
    timestamp: cacheEntry.timestamp,
    name: persistableResult.name,
    points: persistableResult.points,
    race_count: persistableResult.raceCount,
    delta: summary.delta,
  });
  attemptLog.info('cache_attempt_summary', summary);

  // Update racers file with the freshly-fetched name.
  try {
    if (persistableResult.name && (!racer.name || racer.name !== persistableResult.name)) {
      racer.name = persistableResult.name;
      fs.writeFileSync(RACERS_FILE, JSON.stringify(racers, null, 2), 'utf8');
      attemptLog.debug('racers_file_name_updated', { name: persistableResult.name });
    }
  } catch (writeErr) {
    attemptLog.error('racers_file_name_update_failed', { err: writeErr });
  }

  return {
    status: 'cached',
    detail: { racerId, name: persistableResult.name, status: 'cached' },
    summary,
  };
}

// New endpoint to build cache for all racers - PROTECTED
app.post('/api/build-cache', verifyToken, async (req, res) => {
  const { year, racerId } = req.body || req.query;

  if (!year) {
    return res.status(400).send("Missing year parameter");
  }

  const now = Date.now();
  const targets = racerId
    ? racers.filter(r => r.bc === racerId)
    : racers.slice();

  if (racerId && targets.length === 0) {
    log.warn('cache_build_racer_not_found', { racer_id: racerId, year });
    return res.status(404).json({
      success: false,
      message: `Racer with ID ${racerId} not found`,
    });
  }

  const results = {
    success: true,
    totalRacers: targets.length,
    cached: 0,
    failed: 0,
    skipped: 0,
    details: [],
  };

  // Snapshot the cache directory so we can report what actually changed
  // on disk during this batch. If 'cached' counts go up but the on-disk
  // file count stays flat, we know the volume isn't being persisted.
  const snapshotCacheDir = () => {
    try {
      const files = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.json'));
      let totalBytes = 0;
      for (const f of files) {
        try { totalBytes += fs.statSync(path.join(CACHE_DIR, f)).size; } catch (_e) { /* ignore */ }
      }
      return { file_count: files.length, total_bytes: totalBytes };
    } catch (err) {
      return { file_count: null, total_bytes: null, error: err.message };
    }
  };

  // Bind a batch-scoped logger so every line emitted during this rebuild
  // shares a `batch_id`. An LLM (or jq) can then filter to a single
  // rebuild's lifecycle without time-window guessing.
  const batchId = randomId('cache');
  const batchLog = log.child({ batch_id: batchId, op: 'cache_rebuild' });

  const before = snapshotCacheDir();
  const memBefore = process.memoryUsage();
  batchLog.info('cache_build_batch_start', {
    description:
      `Beginning ${racerId ? 'single-racer' : 'full'} cache rebuild for year ${year}: ` +
      `${targets.length} racer(s) to fetch from britishcycling.org.uk via Puppeteer, ` +
      `writing JSON cache files to ${CACHE_DIR}.`,
    schema: 'cache_build/v1',
    total_racers: targets.length,
    year,
    scope: racerId ? 'single' : 'all',
    target_racer_id: racerId || null,
    cache_dir: CACHE_DIR,
    cache_dir_files_before: before.file_count,
    cache_dir_bytes_before: before.total_bytes,
    env: {
      node_env: process.env.NODE_ENV || 'development',
      node_version: process.version,
      platform: process.platform,
      pid: process.pid,
      uptime_s: Math.round(process.uptime()),
      heap_mb: +(memBefore.heapUsed / 1024 / 1024).toFixed(1),
      rss_mb: +(memBefore.rss / 1024 / 1024).toFixed(1),
    },
  });

  const batchStart = Date.now();
  const summaries = [];
  // Emit a progress checkpoint roughly this often so a long rebuild's
  // trajectory is visible without reading every per-attempt line.
  const PROGRESS_EVERY = Math.max(1, Math.min(5, Math.ceil(targets.length / 6)));

  try {
    for (let i = 0; i < targets.length; i++) {
      const racer = targets[i];
      const outcome = await buildCacheForRacer(racer, year, {
        now,
        index: i + 1,
        total: targets.length,
        batchLog,
      });

      if (outcome.status === 'cached') results.cached++;
      else if (outcome.status === 'failed') results.failed++;
      else results.skipped++;
      results.details.push(outcome.detail);
      if (outcome.summary) summaries.push(outcome.summary);

      // Periodic progress checkpoint. Includes rolling stats so an LLM
      // skimming the log can answer "is this rebuild healthy?" at a glance.
      const completed = i + 1;
      const isLast = completed === targets.length;
      if (completed % PROGRESS_EVERY === 0 || isLast) {
        const elapsed = Date.now() - batchStart;
        const avgPerRacer = elapsed / completed;
        const remaining = targets.length - completed;
        const successCount = summaries.filter(s => s.outcome === 'cached').length;
        const persistedCount = summaries.filter(s => s.persisted === true).length;
        const cloudflareCount = summaries.filter(s => s.cloudflare_seen).length;
        const suspiciousCount = summaries.filter(s => s.suspicious_values).length;
        const errorBreakdown = summaries.reduce((acc, s) => {
          if (s.error_class) acc[s.error_class] = (acc[s.error_class] || 0) + 1;
          return acc;
        }, {});

        batchLog.info('cache_build_progress', {
          description:
            `Progress checkpoint: ${completed}/${targets.length} racers processed, ` +
            `${successCount} cached, ${results.failed} failed, ` +
            `~${Math.round(remaining * avgPerRacer / 1000)}s remaining at current rate.`,
          completed,
          remaining,
          total: targets.length,
          percent_complete: +((completed / targets.length) * 100).toFixed(1),
          elapsed_ms: elapsed,
          avg_ms_per_racer: Math.round(avgPerRacer),
          eta_ms: Math.round(remaining * avgPerRacer),
          cached: results.cached,
          failed: results.failed,
          persisted: persistedCount,
          cloudflare_challenges: cloudflareCount,
          suspicious_extractions: suspiciousCount,
          error_breakdown: errorBreakdown,
        });
      }
    }

    const after = snapshotCacheDir();
    const memAfter = process.memoryUsage();
    const elapsed = Date.now() - batchStart;

    // Build the headline summary the same way an LLM would: classify
    // failures, surface suspicious extractions, and call out persistence
    // problems explicitly.
    const errorBreakdown = summaries.reduce((acc, s) => {
      if (s.error_class) acc[s.error_class] = (acc[s.error_class] || 0) + 1;
      return acc;
    }, {});
    const cachedSummaries = summaries.filter(s => s.outcome === 'cached');
    const persistedCount = cachedSummaries.filter(s => s.persisted === true).length;
    const suspiciousCount = cachedSummaries.filter(s => s.suspicious_values).length;
    const cloudflareCount = summaries.filter(s => s.cloudflare_seen).length;
    const cloudflareResolvedCount = summaries.filter(s => s.cloudflare_resolved).length;
    const fastest = cachedSummaries.reduce((min, s) =>
      !min || s.duration_ms < min.duration_ms ? s : min, null);
    const slowest = cachedSummaries.reduce((max, s) =>
      !max || s.duration_ms > max.duration_ms ? s : max, null);
    const avgFetchMs = cachedSummaries.length
      ? Math.round(cachedSummaries.reduce((a, s) => a + (s.fetch_duration_ms || 0), 0) / cachedSummaries.length)
      : null;

    const filesDelta = (after.file_count != null && before.file_count != null)
      ? after.file_count - before.file_count
      : null;
    const persistenceLooksBroken =
      results.cached > 0 &&
      after.file_count != null &&
      before.file_count != null &&
      after.file_count === before.file_count &&
      before.file_count === 0;

    const description = (() => {
      const headline = `Rebuild finished: ${results.cached}/${results.totalRacers} cached, ` +
        `${results.failed} failed in ${(elapsed / 1000).toFixed(1)}s.`;
      const notes = [];
      if (persistenceLooksBroken) {
        notes.push('CRITICAL: writes succeeded in-process but no files exist on disk - cache directory likely not persisted (volume not mounted?).');
      }
      if (suspiciousCount > 0) {
        notes.push(`${suspiciousCount} cache entries have suspicious values (parser may be out of sync with site HTML).`);
      }
      if (cloudflareCount > 0) {
        notes.push(`${cloudflareCount} attempts hit Cloudflare challenge (${cloudflareResolvedCount} resolved, ${cloudflareCount - cloudflareResolvedCount} blocked).`);
      }
      if (Object.keys(errorBreakdown).length) {
        const classes = Object.entries(errorBreakdown).map(([k, v]) => `${k}=${v}`).join(', ');
        notes.push(`Error classes: ${classes}.`);
      }
      return notes.length ? `${headline} ${notes.join(' ')}` : headline;
    })();

    batchLog.info('cache_build_batch_done', {
      description,
      schema: 'cache_build/v1',
      duration_ms: elapsed,
      duration_human: `${(elapsed / 1000).toFixed(1)}s`,
      total_racers: results.totalRacers,
      cached: results.cached,
      failed: results.failed,
      skipped: results.skipped,
      persisted: persistedCount,
      suspicious_extractions: suspiciousCount,
      cloudflare_challenges: cloudflareCount,
      cloudflare_resolved: cloudflareResolvedCount,
      cloudflare_blocked: cloudflareCount - cloudflareResolvedCount,
      error_breakdown: errorBreakdown,
      avg_fetch_ms: avgFetchMs,
      fastest_attempt_ms: fastest ? fastest.duration_ms : null,
      slowest_attempt_ms: slowest ? slowest.duration_ms : null,
      year,
      cache_dir: CACHE_DIR,
      cache_dir_files_before: before.file_count,
      cache_dir_files_after: after.file_count,
      cache_dir_files_delta: filesDelta,
      cache_dir_bytes_before: before.total_bytes,
      cache_dir_bytes_after: after.total_bytes,
      mem: {
        heap_mb_before: +(memBefore.heapUsed / 1024 / 1024).toFixed(1),
        heap_mb_after: +(memAfter.heapUsed / 1024 / 1024).toFixed(1),
        rss_mb_after: +(memAfter.rss / 1024 / 1024).toFixed(1),
      },
    });

    if (persistenceLooksBroken) {
      batchLog.error('cache_writes_not_persisted', {
        reported_cached: results.cached,
        file_count_before: before.file_count,
        file_count_after: after.file_count,
        cache_dir: CACHE_DIR,
        hint: 'writes claimed success but no files appeared on disk - volume likely not mounted',
      });
    }

    res.json(results);
  } catch (err) {
    batchLog.error('cache_build_batch_failed', {
      description: `Cache rebuild aborted by an outer-loop exception: ${err.message}. Partial results captured below.`,
      err,
      error_class: classifyError(err),
      year,
      duration_ms: Date.now() - batchStart,
      partial_results: {
        cached: results.cached,
        failed: results.failed,
        skipped: results.skipped,
      },
    });
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