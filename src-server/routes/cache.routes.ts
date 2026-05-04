import { Router } from 'express';
import { verifyToken } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { buildCacheBody, yearParam } from '../schemas';
import {
  buildCacheBatch,
  deleteCacheForYear,
  listCacheFiles,
} from '../services/cacheStore';

const router = Router();

router.get('/cache/:year', validate('params', yearParam), async (req, res, next) => {
  try {
    const { year } = req.params as { year: string };
    const files = await listCacheFiles(year);
    res.json({ count: files.length, files });
  } catch (err) {
    next(err);
  }
});

router.delete(
  '/cache/:year',
  verifyToken,
  validate('params', yearParam),
  async (req, res, next) => {
    try {
      const { year } = req.params as { year: string };
      const result = await deleteCacheForYear(year);
      res.json({
        success: true,
        totalFiles: result.totalFiles,
        removedFiles: result.removedFiles,
        errors: result.errors.length > 0 ? result.errors : undefined,
      });
    } catch (err) {
      next(err);
    }
  },
);

router.post('/build-cache', verifyToken, validate('body', buildCacheBody), async (req, res, next) => {
  try {
    const { year, racerId } = req.body as { year: string; racerId?: string };
    const results = await buildCacheBatch(year, racerId);
    res.json(results);
  } catch (err) {
    next(err);
  }
});

export default router;
