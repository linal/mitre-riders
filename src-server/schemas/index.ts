import { z } from 'zod';

export const yearSchema = z
  .string()
  .regex(/^\d{4}$/, 'Year must be a 4-digit number');

export const yearParam = z.object({ year: yearSchema });

export const raceDataQuery = z.object({
  year: yearSchema,
});

export const racerIdQuery = z.object({
  person_id: z.string().min(1),
  year: yearSchema,
});

export const racerArray = z.array(
  z.object({
    bc: z.string().min(1),
    name: z.string().optional(),
    club: z.string().optional(),
  }),
);

export const racerAddBody = z.object({
  bc: z.string().min(1, 'Missing BC number'),
});

export const bcParam = z.object({
  bc: z.string().min(1),
});

export const buildCacheBody = z.object({
  year: yearSchema,
  racerId: z.string().min(1).optional(),
  discipline: z.string().optional(),
});

export const clubNameParam = z.object({
  clubName: z.string().min(1),
});
