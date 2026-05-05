import { Router } from 'express';
import { requireAdmin, verifyToken } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { bcParam, racerArray, racerAddBody } from '../schemas';
import { addRacer, listRacers, removeRacer, replaceRacers } from '../services/racersStore';
import { HttpError } from '../middleware/error';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    res.json(await listRacers());
  } catch (err) {
    next(err);
  }
});

router.post('/', verifyToken, requireAdmin, validate('body', racerArray), async (req, res, next) => {
  try {
    const count = await replaceRacers(req.body as Awaited<ReturnType<typeof racerArray.parse>>);
    res.json({ success: true, count });
  } catch (err) {
    next(err);
  }
});

router.post('/add', verifyToken, requireAdmin, validate('body', racerAddBody), async (req, res, next) => {
  try {
    const { bc } = req.body as { bc: string };
    const result = await addRacer(bc);
    if (!result.added) throw new HttpError(400, 'BC number already exists');
    res.json({ success: true, bc, count: result.count });
  } catch (err) {
    next(err);
  }
});

router.delete('/:bc', verifyToken, requireAdmin, validate('params', bcParam), async (req, res, next) => {
  try {
    const { bc } = req.params as { bc: string };
    const result = await removeRacer(bc);
    if (!result.removed) throw new HttpError(404, 'BC number not found');
    res.json({ success: true, bc, count: result.count });
  } catch (err) {
    next(err);
  }
});

export default router;
