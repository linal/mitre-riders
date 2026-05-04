import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { logger } from '../config/logger';
import { CLUBS_FILE } from './paths';

const log = logger.child({ component: 'clubs_store' });

interface ClubRecord {
  id?: string;
  members?: string[];
}

type ClubsFile = Record<string, ClubRecord>;

async function readClubs(): Promise<ClubsFile> {
  if (!existsSync(CLUBS_FILE)) return {};
  try {
    const raw = await fs.readFile(CLUBS_FILE, 'utf8');
    return JSON.parse(raw) as ClubsFile;
  } catch (err) {
    log.error({ err, path: CLUBS_FILE }, 'clubs_read_failed');
    return {};
  }
}

async function writeClubs(clubs: ClubsFile): Promise<void> {
  await fs.writeFile(CLUBS_FILE, JSON.stringify(clubs, null, 2), 'utf8');
}

export async function listClubNames(): Promise<string[]> {
  return Object.keys(await readClubs()).sort();
}

export async function getClubsFile(): Promise<ClubsFile> {
  return readClubs();
}

export async function deleteClub(name: string): Promise<{ existed: boolean; remaining: number }> {
  const clubs = await readClubs();
  if (!clubs[name]) return { existed: false, remaining: Object.keys(clubs).length };
  delete clubs[name];
  await writeClubs(clubs);
  return { existed: true, remaining: Object.keys(clubs).length };
}
