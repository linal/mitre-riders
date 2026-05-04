// Shared types for API payloads. These mirror the response shapes produced
// by the Express backend in src-server/. When the backend evolves, update
// these types and the consumer code will surface the change through tsc.

export interface RaceData {
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

export type AllRaceData = Record<string, RaceData>;

export interface Racer {
  bc: string;
  name?: string;
  club?: string;
}

export interface CacheFile {
  filename: string;
  racerId: string;
  year: string;
  lastBuilt: number | null;
}

export interface CacheListResponse {
  count: number;
  files: CacheFile[];
}

export interface BuildCacheResponse {
  success: boolean;
  totalRacers: number;
  cached: number;
  failed: number;
  skipped: number;
  details: Array<{
    racerId: string;
    name?: string;
    status: string;
    error?: string;
    error_class?: string;
  }>;
}
