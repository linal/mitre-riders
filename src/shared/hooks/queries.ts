import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cacheApi, clubsApi, raceDataApi, racersApi } from '../api/endpoints';
import type { AllRaceData, BuildCacheResponse, CacheListResponse, Racer } from '../api/types';

const FIVE_MINUTES = 5 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

// ---- Queries -------------------------------------------------------------

export function useClubs() {
  return useQuery({
    queryKey: ['clubs'],
    queryFn: clubsApi.list,
    staleTime: FIVE_MINUTES,
  });
}

export function useRacers() {
  return useQuery({
    queryKey: ['racers'],
    queryFn: racersApi.list,
    staleTime: FIVE_MINUTES,
  });
}

export function useAllRaceData(year: string | null | undefined) {
  return useQuery({
    queryKey: ['raceData', year],
    queryFn: () => raceDataApi.all(year as string),
    enabled: !!year,
    // Previous-year data is effectively immutable on the backend; the current
    // year may change as the cache rebuilds, but a 5-minute window is fine.
    staleTime: isPreviousYear(year) ? ONE_HOUR : FIVE_MINUTES,
  });
}

function isPreviousYear(year: string | null | undefined): boolean {
  if (!year) return false;
  return Number(year) < new Date().getFullYear();
}

export function useCacheList(year: string | null | undefined) {
  return useQuery({
    queryKey: ['cache', year],
    queryFn: () => cacheApi.list(year as string),
    enabled: !!year,
    staleTime: 30_000,
  });
}

// ---- Mutations -----------------------------------------------------------

export function useDeleteClub() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (clubName: string) => clubsApi.delete(clubName),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clubs'] });
    },
  });
}

export function useAddRacer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bc: string) => racersApi.add(bc),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['racers'] });
    },
  });
}

export function useRemoveRacer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bc: string) => racersApi.remove(bc),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['racers'] });
    },
  });
}

export function useDeleteCache(year: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => cacheApi.delete(year),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cache', year] });
      qc.invalidateQueries({ queryKey: ['raceData', year] });
    },
  });
}

export function useBuildCache(year: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { racerId?: string; discipline?: string }) =>
      cacheApi.build({ year, ...input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cache', year] });
      qc.invalidateQueries({ queryKey: ['raceData', year] });
    },
  });
}

// Re-export types for convenience.
export type { AllRaceData, BuildCacheResponse, CacheListResponse, Racer };
