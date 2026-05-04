import { api } from './client';
import type {
  AllRaceData,
  BuildCacheResponse,
  CacheListResponse,
  Racer,
} from './types';

// Typed wrappers around the backend REST API. Components/hooks should never
// call `api.*` directly so that endpoint shapes live in one place.

export const clubsApi = {
  list: () => api.get<string[]>('/api/clubs'),
  delete: (clubName: string) =>
    api.delete<{ success: boolean; message: string }>(
      `/api/clubs/${encodeURIComponent(clubName)}`,
      { auth: true },
    ),
};

export const racersApi = {
  list: () => api.get<Racer[]>('/api/racers'),
  add: (bc: string) =>
    api.post<{ success: boolean; bc: string; count: number }>('/api/racers/add', { bc }, { auth: true }),
  remove: (bc: string) =>
    api.delete<{ success: boolean; bc: string; count: number }>(
      `/api/racers/${encodeURIComponent(bc)}`,
      { auth: true },
    ),
};

export const raceDataApi = {
  all: (year: string) =>
    api.get<AllRaceData>(`/api/all-race-data?year=${encodeURIComponent(year)}`),
};

export const cacheApi = {
  list: (year: string) => api.get<CacheListResponse>(`/api/cache/${encodeURIComponent(year)}`),
  delete: (year: string) =>
    api.delete<{ success: boolean; totalFiles: number; removedFiles: number }>(
      `/api/cache/${encodeURIComponent(year)}`,
      { auth: true },
    ),
  build: (input: { year: string; racerId?: string; discipline?: string }) =>
    api.post<BuildCacheResponse>('/api/build-cache', input, { auth: true }),
};
