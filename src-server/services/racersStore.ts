import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { logger } from '../config/logger';
import { RACERS_FILE } from './paths';

const log = logger.child({ component: 'racers_store' });

export interface Racer {
  bc: string;
  name?: string;
  club?: string;
}

let racers: Racer[] = [];
let loaded = false;

export async function loadRacers(): Promise<Racer[]> {
  try {
    if (existsSync(RACERS_FILE)) {
      const data = await fs.readFile(RACERS_FILE, 'utf8');
      racers = JSON.parse(data) as Racer[];
      log.info({ count: racers.length, path: RACERS_FILE }, 'racers_loaded');
    } else {
      racers = [];
    }
  } catch (err) {
    log.error({ err, path: RACERS_FILE }, 'racers_load_failed');
    racers = [];
  }
  loaded = true;
  return racers;
}

async function ensureLoaded(): Promise<void> {
  if (!loaded) await loadRacers();
}

async function persist(): Promise<void> {
  await fs.writeFile(RACERS_FILE, JSON.stringify(racers, null, 2), 'utf8');
}

export async function listRacers(): Promise<Racer[]> {
  await ensureLoaded();
  return racers.slice();
}

export async function replaceRacers(next: Racer[]): Promise<number> {
  await ensureLoaded();
  racers = next;
  await persist();
  return racers.length;
}

export async function addRacer(bc: string): Promise<{ added: boolean; count: number }> {
  await ensureLoaded();
  if (racers.some((r) => r.bc === bc)) return { added: false, count: racers.length };
  racers.push({ bc });
  await persist();
  return { added: true, count: racers.length };
}

export async function removeRacer(bc: string): Promise<{ removed: boolean; count: number }> {
  await ensureLoaded();
  const initial = racers.length;
  racers = racers.filter((r) => r.bc !== bc);
  if (racers.length === initial) return { removed: false, count: racers.length };
  await persist();
  return { removed: true, count: racers.length };
}

export async function updateRacerName(bc: string, name: string): Promise<void> {
  await ensureLoaded();
  const racer = racers.find((r) => r.bc === bc);
  if (racer && racer.name !== name) {
    racer.name = name;
    await persist();
  }
}

// Test seam.
export function _resetForTests(): void {
  racers = [];
  loaded = false;
}
