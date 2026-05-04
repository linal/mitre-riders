// Thin TypeScript wrapper around the existing Puppeteer-based scraper.
// We keep the original implementation in JavaScript (services/racerDataService.js)
// since it has substantial domain logic and battle-tested instrumentation -
// rewriting it isn't part of this refactor's scope. Just type the surface.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const racerDataService = require('../../services/racerDataService');
import { CLUBS_FILE } from './paths';

export interface RacerScrapeResult {
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
  _diagnostics?: {
    html_length?: number;
    page_title?: string | null;
    cloudflare_seen?: boolean;
    cloudflare_resolved?: boolean;
    name_extracted?: boolean;
    club_extracted?: boolean;
    category_extracted?: boolean;
    parse?: { warnings?: string[] } | null;
  };
}

export async function scrapeRacer(
  personId: string,
  year: string,
  discipline: string = 'road-track',
): Promise<RacerScrapeResult> {
  return racerDataService.fetchRacerData(personId, year, CLUBS_FILE, discipline);
}
