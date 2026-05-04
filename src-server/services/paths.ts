import path from 'node:path';
import fs from 'node:fs';
import { env } from '../config/env';
import { logger } from '../config/logger';

const log = logger.child({ component: 'paths' });

export const CACHE_DIR = env.CACHE_DIR;
export const RACERS_DIR = path.join(CACHE_DIR, 'racers');
export const CLUBS_DIR = path.join(CACHE_DIR, 'clubs');
export const RACERS_FILE = path.join(RACERS_DIR, 'racers.json');
export const CLUBS_FILE = path.join(CLUBS_DIR, 'clubs.json');

// Ensure required directories exist at boot. Sync is fine here because we
// only run it once during startup before the HTTP server starts listening.
for (const dir of [CACHE_DIR, RACERS_DIR, CLUBS_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    log.info({ dir }, 'cache_dir_created');
  }
}

export function probeCacheDir(): void {
  try {
    const stat = fs.statSync(CACHE_DIR);
    let writable = false;
    try {
      fs.accessSync(CACHE_DIR, fs.constants.W_OK);
      writable = true;
    } catch {
      writable = false;
    }
    const entries = fs.readdirSync(CACHE_DIR);
    const cacheFiles = entries.filter((f) => f.endsWith('.json'));
    let totalBytes = 0;
    for (const f of cacheFiles) {
      try {
        totalBytes += fs.statSync(path.join(CACHE_DIR, f)).size;
      } catch {
        // ignore individual file stat failures
      }
    }
    log.info(
      {
        dir: CACHE_DIR,
        exists: true,
        is_directory: stat.isDirectory(),
        writable,
        mode: '0' + (stat.mode & 0o777).toString(8),
        file_count: cacheFiles.length,
        total_bytes: totalBytes,
        mtime: stat.mtime.toISOString(),
      },
      'cache_dir_status',
    );
    if (!writable) {
      log.error(
        { dir: CACHE_DIR, hint: 'cache writes will fail; check volume mount / file permissions' },
        'cache_dir_not_writable',
      );
    }
  } catch (err) {
    log.error({ err, dir: CACHE_DIR }, 'cache_dir_probe_failed');
  }
}
