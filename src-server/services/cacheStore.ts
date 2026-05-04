import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { Logger } from 'pino';
import { env } from '../config/env';
import { logger, classifyError, randomId } from '../config/logger';
import { CACHE_DIR } from './paths';
import { listRacers, updateRacerName, type Racer } from './racersStore';
import { scrapeRacer, type RacerScrapeResult } from './racerScraper';

const log = logger.child({ component: 'cache_store' });

const CACHE_TTL_MS = env.IS_PRODUCTION ? 24 * 60 * 60 * 1000 : 10 * 60 * 1000;

interface CacheEntry {
  data: Omit<RacerScrapeResult, '_diagnostics'>;
  timestamp: number;
}

// In-memory layer in front of the on-disk JSON cache files.
const memoryCache: Record<string, CacheEntry> = {};

function cacheKey(racerId: string, year: string): string {
  return `${racerId}_${year}_road-track`;
}

function cacheFilePath(key: string): string {
  return path.join(CACHE_DIR, `${key}.json`);
}

function isPreviousYear(year: string): boolean {
  return Number(year) < new Date().getFullYear();
}

async function readDiskEntry(filePath: string): Promise<CacheEntry | null> {
  if (!existsSync(filePath)) return null;
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as CacheEntry;
  } catch (err) {
    log.error({ err, path: filePath }, 'cache_read_failed');
    return null;
  }
}

export async function getRaceData(
  racerId: string,
  year: string,
): Promise<RacerScrapeResult> {
  const key = cacheKey(racerId, year);
  const filePath = cacheFilePath(key);
  const now = Date.now();
  const previousYear = isPreviousYear(year);

  const memEntry = memoryCache[key];
  if (memEntry && (previousYear || now - memEntry.timestamp < CACHE_TTL_MS)) {
    log.info(
      { source: 'memory', cache_key: key, previous_year: previousYear },
      'cache_hit',
    );
    return memEntry.data as RacerScrapeResult;
  }

  const diskEntry = await readDiskEntry(filePath);
  if (
    diskEntry &&
    (!env.IS_PRODUCTION || previousYear || now - diskEntry.timestamp < CACHE_TTL_MS)
  ) {
    log.info(
      {
        source: 'disk',
        cache_key: key,
        previous_year: previousYear,
        local_dev: !env.IS_PRODUCTION,
      },
      'cache_hit',
    );
    memoryCache[key] = diskEntry;
    return diskEntry.data as RacerScrapeResult;
  }

  log.info({ cache_key: key, ttl_minutes: CACHE_TTL_MS / 60_000 }, 'cache_miss');
  try {
    const result = await scrapeRacer(racerId, year, 'road-track');
    const persistable: Omit<RacerScrapeResult, '_diagnostics'> = { ...result };
    delete (persistable as { _diagnostics?: unknown })._diagnostics;
    const entry: CacheEntry = { data: persistable, timestamp: now };
    memoryCache[key] = entry;
    await fs.writeFile(filePath, JSON.stringify(entry), 'utf8').catch((err) => {
      log.error({ err, path: filePath }, 'cache_write_failed');
    });
    return result;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    if (/500 error/.test(error.message)) {
      log.error({ err: error, racer_id: racerId, year }, 'bc_api_500');
    } else {
      log.error({ err: error, racer_id: racerId, year }, 'race_data_fetch_failed');
    }
    // Stale cache fallback for non-500s.
    if (!/500 error/.test(error.message) && diskEntry) {
      log.warn({ cache_key: key, reason: error.message }, 'cache_stale_served');
      return diskEntry.data as RacerScrapeResult;
    }
    throw error;
  }
}

interface RaceDataLike {
  raceCount: number;
  points: number;
  roadAndTrackPoints: number;
  cyclocrossPoints: number;
  roadAndTrackRaceCount: number;
  cyclocrossRaceCount: number;
  category: string;
  name: string;
  club: string;
  clubId?: string;
  regionalPoints: number;
  nationalPoints: number;
  roadRegionalPoints: number;
  roadNationalPoints: number;
  cxRegionalPoints: number;
  cxNationalPoints: number;
  error?: string;
}

const EMPTY_RESULT = (racer: Racer): RaceDataLike => ({
  raceCount: 0,
  points: 0,
  roadAndTrackPoints: 0,
  cyclocrossPoints: 0,
  roadAndTrackRaceCount: 0,
  cyclocrossRaceCount: 0,
  category: '',
  name: racer.name || 'Unknown',
  club: racer.club || 'Unknown',
  regionalPoints: 0,
  nationalPoints: 0,
  roadRegionalPoints: 0,
  roadNationalPoints: 0,
  cxRegionalPoints: 0,
  cxNationalPoints: 0,
  error: 'No cached data available',
});

export async function getAllRaceData(year: string): Promise<Record<string, RaceDataLike>> {
  const racers = await listRacers();
  const results: Record<string, RaceDataLike> = {};

  for (const racer of racers) {
    const key = cacheKey(racer.bc, year);
    const filePath = cacheFilePath(key);
    let entry: CacheEntry | null = memoryCache[key] ?? null;
    if (!entry) entry = await readDiskEntry(filePath);

    if (entry) {
      memoryCache[key] = entry;
      results[racer.bc] = entry.data as RaceDataLike;
    } else {
      log.debug({ racer_id: racer.bc, year }, 'cache_missing');
      results[racer.bc] = EMPTY_RESULT(racer);
    }
  }

  return results;
}

export interface CacheFileInfo {
  filename: string;
  racerId: string;
  year: string;
  lastBuilt: number | null;
}

export async function listCacheFiles(year: string): Promise<CacheFileInfo[]> {
  const files = await fs.readdir(CACHE_DIR);
  const matching = files.filter((f) => f.includes(`_${year}_`) && f.endsWith('.json'));
  const out: CacheFileInfo[] = [];
  for (const filename of matching) {
    const racerId = filename.split('_')[0];
    let timestamp: number | null = null;
    try {
      const raw = await fs.readFile(path.join(CACHE_DIR, filename), 'utf8');
      timestamp = (JSON.parse(raw) as CacheEntry).timestamp;
    } catch (err) {
      log.error({ err, file: filename }, 'cache_timestamp_read_failed');
    }
    out.push({ filename, racerId, year, lastBuilt: timestamp });
  }
  return out;
}

export async function deleteCacheForYear(
  year: string,
): Promise<{ totalFiles: number; removedFiles: number; errors: { file: string; error: string }[] }> {
  const files = await fs.readdir(CACHE_DIR);
  const matching = files.filter((f) => f.includes(`_${year}_`) && f.endsWith('.json'));
  let removedCount = 0;
  const errors: { file: string; error: string }[] = [];
  for (const filename of matching) {
    try {
      await fs.unlink(path.join(CACHE_DIR, filename));
      removedCount++;
      const key = filename.replace('.json', '');
      delete memoryCache[key];
    } catch (err) {
      errors.push({ file: filename, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return { totalFiles: matching.length, removedFiles: removedCount, errors };
}

interface BuildOpts {
  index: number;
  total: number;
  now: number;
  batchLog: Logger;
}

interface BuildOutcome {
  status: 'cached' | 'failed' | 'skipped';
  detail: { racerId: string; name?: string; status: string; error?: string; error_class?: string };
  summary: AttemptSummary;
}

interface AttemptSummary {
  description: string;
  outcome: string;
  duration_ms: number;
  fetch_duration_ms: number | null;
  write_duration_ms: number | null;
  persisted: boolean | null;
  bytes_written: number | null;
  bytes_on_disk: number | null;
  cloudflare_seen: boolean | null;
  cloudflare_resolved: boolean | null;
  html_length: number | null;
  page_title: string | null;
  name_extracted: boolean | null;
  parse_warnings: string[];
  suspicious_values: boolean;
  error_class: string | null;
  error_message: string | null;
  values: Record<string, unknown> | null;
  previous_values: PreviousCache | null;
  delta: Record<string, unknown> | null;
}

interface PreviousCache {
  timestamp?: number;
  points?: number;
  race_count?: number;
  regional_points?: number;
  national_points?: number;
  name?: string;
  club?: string;
  category?: string;
  unreadable?: boolean;
}

async function readPreviousCache(filePath: string): Promise<PreviousCache | null> {
  if (!existsSync(filePath)) return null;
  try {
    const raw = JSON.parse(await fs.readFile(filePath, 'utf8')) as CacheEntry;
    if (!raw || !raw.data) return null;
    const d = raw.data as RacerScrapeResult;
    return {
      timestamp: raw.timestamp,
      points: d.points,
      race_count: d.raceCount,
      regional_points: d.regionalPoints,
      national_points: d.nationalPoints,
      name: d.name,
      club: d.club,
      category: d.category,
    };
  } catch {
    return { unreadable: true };
  }
}

async function buildCacheForRacer(racer: Racer, year: string, opts: BuildOpts): Promise<BuildOutcome> {
  const racerId = racer.bc;
  const key = cacheKey(racerId, year);
  const filePath = cacheFilePath(key);
  const attemptLog = opts.batchLog.child({
    op: 'build_cache',
    racer_id: racerId,
    racer_known_name: racer.name || null,
    cache_key: key,
    cache_path: filePath,
    attempt_index: opts.index,
    attempt_total: opts.total,
  });

  const previous = await readPreviousCache(filePath);
  const attemptStart = Date.now();
  attemptLog.info(
    { description: `Starting fetch + cache write for racer ${opts.index}/${opts.total}`, previous_cache: previous },
    'cache_build_attempt',
  );

  const summary: AttemptSummary = {
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

  const fetchStart = Date.now();
  let result: RacerScrapeResult;
  try {
    result = await scrapeRacer(racerId, year, 'road-track');
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    summary.fetch_duration_ms = Date.now() - fetchStart;
    summary.duration_ms = Date.now() - attemptStart;
    summary.outcome = 'failed';
    summary.error_class = classifyError(error);
    summary.error_message = error.message;
    summary.persisted = false;
    summary.description =
      `Fetch failed (${summary.error_class}): ${error.message}. ` +
      `Cache was NOT updated. Previous cache ${previous ? 'still exists' : 'did not exist'}.`;
    attemptLog.error(
      {
        duration_ms: summary.duration_ms,
        fetch_duration_ms: summary.fetch_duration_ms,
        reason: error.message,
        error_class: summary.error_class,
        err: error,
        cache_written: false,
        previous_cache_exists: !!previous,
      },
      'cache_build_failed',
    );
    attemptLog.info(summary, 'cache_attempt_summary');
    return {
      status: 'failed',
      detail: { racerId, name: racer.name, status: 'failed', error: error.message, error_class: summary.error_class },
      summary,
    };
  }

  summary.fetch_duration_ms = Date.now() - fetchStart;
  const diagnostics = result._diagnostics ?? {};
  summary.cloudflare_seen = diagnostics.cloudflare_seen ?? null;
  summary.cloudflare_resolved = diagnostics.cloudflare_resolved ?? null;
  summary.html_length = diagnostics.html_length ?? null;
  summary.page_title = diagnostics.page_title ?? null;
  summary.name_extracted = diagnostics.name_extracted ?? null;
  summary.parse_warnings = diagnostics.parse?.warnings ?? [];

  const persistableResult = { ...result };
  delete (persistableResult as { _diagnostics?: unknown })._diagnostics;
  const cacheEntry: CacheEntry = { data: persistableResult, timestamp: opts.now };

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
      points: (persistableResult.points ?? 0) - (previous.points ?? 0),
      race_count: (persistableResult.raceCount ?? 0) - (previous.race_count ?? 0),
      regional_points: (persistableResult.regionalPoints ?? 0) - (previous.regional_points ?? 0),
      national_points: (persistableResult.nationalPoints ?? 0) - (previous.national_points ?? 0),
      category_changed: persistableResult.category !== previous.category,
      club_changed: persistableResult.club !== previous.club,
    };
  }

  attemptLog.info(
    {
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
    },
    'cache_values_extracted',
  );

  const looksEmpty =
    !persistableResult.name &&
    !persistableResult.club &&
    !persistableResult.category &&
    persistableResult.points === 0 &&
    persistableResult.raceCount === 0;
  summary.suspicious_values = looksEmpty || summary.parse_warnings.length > 0;
  if (looksEmpty) {
    attemptLog.warn(
      { reason: 'all_extracted_fields_empty_or_zero', values: persistableResult },
      'cache_values_suspicious',
    );
  }

  memoryCache[key] = cacheEntry;

  const writeStart = Date.now();
  let bytesWritten = 0;
  try {
    const serialized = JSON.stringify(cacheEntry);
    await fs.writeFile(filePath, serialized, 'utf8');
    bytesWritten = Buffer.byteLength(serialized, 'utf8');
  } catch (writeErr) {
    const error = writeErr instanceof Error ? writeErr : new Error(String(writeErr));
    summary.write_duration_ms = Date.now() - writeStart;
    summary.duration_ms = Date.now() - attemptStart;
    summary.outcome = 'failed';
    summary.error_class = classifyError(error);
    summary.error_message = error.message;
    summary.persisted = false;
    summary.description =
      `Fetch succeeded but disk write failed (${summary.error_class}): ${error.message}. ` +
      `Cache directory may be read-only or out of space.`;
    attemptLog.error(
      { err: error, error_class: summary.error_class, intended_payload: cacheEntry },
      'cache_disk_write_failed',
    );
    attemptLog.info(summary, 'cache_attempt_summary');
    return {
      status: 'failed',
      detail: { racerId, name: racer.name, status: 'failed', error: error.message, error_class: summary.error_class },
      summary,
    };
  }
  summary.write_duration_ms = Date.now() - writeStart;
  summary.bytes_written = bytesWritten;

  let bytesOnDisk: number | null = null;
  try {
    const stat = await fs.stat(filePath);
    bytesOnDisk = stat.size;
    if (bytesOnDisk !== bytesWritten) {
      attemptLog.warn(
        { bytes_written: bytesWritten, bytes_on_disk: bytesOnDisk },
        'cache_disk_size_mismatch',
      );
    }
  } catch (statErr) {
    attemptLog.error(
      { err: statErr, hint: 'write reported success but file does not exist - check volume mount' },
      'cache_disk_verify_failed',
    );
  }
  summary.bytes_on_disk = bytesOnDisk;
  summary.persisted = bytesOnDisk !== null;
  summary.duration_ms = Date.now() - attemptStart;
  summary.outcome = 'cached';
  summary.description = summary.suspicious_values
    ? `Cached racer "${persistableResult.name || racer.name || racerId}" but extracted values look suspicious ` +
      `(${summary.parse_warnings.join(', ') || 'all-empty'}). Investigate before trusting.`
    : `Cached racer "${persistableResult.name || racer.name || racerId}" with ${persistableResult.points} pts ` +
      `over ${persistableResult.raceCount} races (${bytesOnDisk} bytes on disk).`;

  attemptLog.info(
    {
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
    },
    'cache_built',
  );
  attemptLog.info(summary, 'cache_attempt_summary');

  if (persistableResult.name) {
    try {
      await updateRacerName(racerId, persistableResult.name);
    } catch (writeErr) {
      attemptLog.error({ err: writeErr }, 'racers_file_name_update_failed');
    }
  }

  return {
    status: 'cached',
    detail: { racerId, name: persistableResult.name, status: 'cached' },
    summary,
  };
}

interface SnapshotResult {
  file_count: number | null;
  total_bytes: number | null;
  error?: string;
}

async function snapshotCacheDir(): Promise<SnapshotResult> {
  try {
    const files = (await fs.readdir(CACHE_DIR)).filter((f) => f.endsWith('.json'));
    let totalBytes = 0;
    for (const f of files) {
      try {
        totalBytes += (await fs.stat(path.join(CACHE_DIR, f))).size;
      } catch {
        // ignore individual stat failures
      }
    }
    return { file_count: files.length, total_bytes: totalBytes };
  } catch (err) {
    return {
      file_count: null,
      total_bytes: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export interface BuildBatchResult {
  success: boolean;
  totalRacers: number;
  cached: number;
  failed: number;
  skipped: number;
  details: BuildOutcome['detail'][];
}

export async function buildCacheBatch(
  year: string,
  racerId?: string,
): Promise<BuildBatchResult> {
  const allRacers = await listRacers();
  const targets = racerId ? allRacers.filter((r) => r.bc === racerId) : allRacers.slice();
  const now = Date.now();

  if (racerId && targets.length === 0) {
    log.warn({ racer_id: racerId, year }, 'cache_build_racer_not_found');
    throw new Error(`Racer with ID ${racerId} not found`);
  }

  const results: BuildBatchResult = {
    success: true,
    totalRacers: targets.length,
    cached: 0,
    failed: 0,
    skipped: 0,
    details: [],
  };

  const batchId = randomId('cache');
  const batchLog = log.child({ batch_id: batchId, op: 'cache_rebuild' });

  const before = await snapshotCacheDir();
  const memBefore = process.memoryUsage();
  batchLog.info(
    {
      description:
        `Beginning ${racerId ? 'single-racer' : 'full'} cache rebuild for year ${year}: ` +
        `${targets.length} racer(s) to fetch via Puppeteer, writing JSON cache files to ${CACHE_DIR}.`,
      schema: 'cache_build/v1',
      total_racers: targets.length,
      year,
      scope: racerId ? 'single' : 'all',
      target_racer_id: racerId || null,
      cache_dir: CACHE_DIR,
      cache_dir_files_before: before.file_count,
      cache_dir_bytes_before: before.total_bytes,
      env: {
        node_env: env.NODE_ENV,
        node_version: process.version,
        platform: process.platform,
        pid: process.pid,
        uptime_s: Math.round(process.uptime()),
        heap_mb: +(memBefore.heapUsed / 1024 / 1024).toFixed(1),
        rss_mb: +(memBefore.rss / 1024 / 1024).toFixed(1),
      },
    },
    'cache_build_batch_start',
  );

  const batchStart = Date.now();
  const summaries: AttemptSummary[] = [];
  const PROGRESS_EVERY = Math.max(1, Math.min(5, Math.ceil(targets.length / 6)));

  for (let i = 0; i < targets.length; i++) {
    const outcome = await buildCacheForRacer(targets[i], year, {
      now,
      index: i + 1,
      total: targets.length,
      batchLog,
    });
    if (outcome.status === 'cached') results.cached++;
    else if (outcome.status === 'failed') results.failed++;
    else results.skipped++;
    results.details.push(outcome.detail);
    summaries.push(outcome.summary);

    const completed = i + 1;
    const isLast = completed === targets.length;
    if (completed % PROGRESS_EVERY === 0 || isLast) {
      const elapsed = Date.now() - batchStart;
      const avgPerRacer = elapsed / completed;
      const remaining = targets.length - completed;
      const successCount = summaries.filter((s) => s.outcome === 'cached').length;
      const persistedCount = summaries.filter((s) => s.persisted === true).length;
      const cloudflareCount = summaries.filter((s) => s.cloudflare_seen).length;
      const suspiciousCount = summaries.filter((s) => s.suspicious_values).length;
      const errorBreakdown = summaries.reduce<Record<string, number>>((acc, s) => {
        if (s.error_class) acc[s.error_class] = (acc[s.error_class] || 0) + 1;
        return acc;
      }, {});

      batchLog.info(
        {
          description:
            `Progress checkpoint: ${completed}/${targets.length} racers processed, ` +
            `${successCount} cached, ${results.failed} failed, ` +
            `~${Math.round((remaining * avgPerRacer) / 1000)}s remaining at current rate.`,
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
        },
        'cache_build_progress',
      );
    }
  }

  const after = await snapshotCacheDir();
  const memAfter = process.memoryUsage();
  const elapsed = Date.now() - batchStart;
  const errorBreakdown = summaries.reduce<Record<string, number>>((acc, s) => {
    if (s.error_class) acc[s.error_class] = (acc[s.error_class] || 0) + 1;
    return acc;
  }, {});
  const cachedSummaries = summaries.filter((s) => s.outcome === 'cached');
  const persistedCount = cachedSummaries.filter((s) => s.persisted === true).length;
  const suspiciousCount = cachedSummaries.filter((s) => s.suspicious_values).length;
  const cloudflareCount = summaries.filter((s) => s.cloudflare_seen).length;
  const cloudflareResolvedCount = summaries.filter((s) => s.cloudflare_resolved).length;
  const fastest = cachedSummaries.reduce<AttemptSummary | null>(
    (min, s) => (!min || s.duration_ms < min.duration_ms ? s : min),
    null,
  );
  const slowest = cachedSummaries.reduce<AttemptSummary | null>(
    (max, s) => (!max || s.duration_ms > max.duration_ms ? s : max),
    null,
  );
  const avgFetchMs = cachedSummaries.length
    ? Math.round(
        cachedSummaries.reduce((a, s) => a + (s.fetch_duration_ms || 0), 0) /
          cachedSummaries.length,
      )
    : null;
  const filesDelta =
    after.file_count != null && before.file_count != null ? after.file_count - before.file_count : null;
  const persistenceLooksBroken =
    results.cached > 0 &&
    after.file_count != null &&
    before.file_count != null &&
    after.file_count === before.file_count &&
    before.file_count === 0;

  const headline = `Rebuild finished: ${results.cached}/${results.totalRacers} cached, ${results.failed} failed in ${(elapsed / 1000).toFixed(1)}s.`;
  const notes: string[] = [];
  if (persistenceLooksBroken) {
    notes.push(
      'CRITICAL: writes succeeded in-process but no files exist on disk - cache directory likely not persisted (volume not mounted?).',
    );
  }
  if (suspiciousCount > 0) {
    notes.push(`${suspiciousCount} cache entries have suspicious values (parser may be out of sync with site HTML).`);
  }
  if (cloudflareCount > 0) {
    notes.push(
      `${cloudflareCount} attempts hit Cloudflare challenge (${cloudflareResolvedCount} resolved, ${cloudflareCount - cloudflareResolvedCount} blocked).`,
    );
  }
  if (Object.keys(errorBreakdown).length) {
    notes.push(`Error classes: ${Object.entries(errorBreakdown).map(([k, v]) => `${k}=${v}`).join(', ')}.`);
  }
  const description = notes.length ? `${headline} ${notes.join(' ')}` : headline;

  batchLog.info(
    {
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
    },
    'cache_build_batch_done',
  );

  if (persistenceLooksBroken) {
    batchLog.error(
      {
        reported_cached: results.cached,
        file_count_before: before.file_count,
        file_count_after: after.file_count,
        cache_dir: CACHE_DIR,
        hint: 'writes claimed success but no files appeared on disk - volume likely not mounted',
      },
      'cache_writes_not_persisted',
    );
  }

  return results;
}
