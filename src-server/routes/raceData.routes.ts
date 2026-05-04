import { Router } from 'express';
import { validate } from '../middleware/validate';
import { racerIdQuery, raceDataQuery } from '../schemas';
import { getAllRaceData, getRaceData } from '../services/cacheStore';

const router = Router();

router.get('/race-data', validate('query', racerIdQuery), async (req, res, next) => {
  try {
    const { person_id, year } = req.query as unknown as { person_id: string; year: string };
    const data = await getRaceData(person_id, year);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/all-race-data', validate('query', raceDataQuery), async (req, res, next) => {
  try {
    const { year } = req.query as unknown as { year: string };
    res.json(await getAllRaceData(year));
  } catch (err) {
    next(err);
  }
});

export default router;
