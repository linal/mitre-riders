import { Router } from 'express';
import { verifyToken } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { clubNameParam } from '../schemas';
import { deleteClub, getClubsFile, listClubNames } from '../services/clubsStore';
import { HttpError } from '../middleware/error';

const router = Router();

router.get('/clubs', async (_req, res, next) => {
  try {
    res.json(await listClubNames());
  } catch (err) {
    next(err);
  }
});

router.get('/clubs-file', async (_req, res, next) => {
  try {
    res.json(await getClubsFile());
  } catch (err) {
    next(err);
  }
});

router.delete(
  '/clubs/:clubName',
  verifyToken,
  validate('params', clubNameParam),
  async (req, res, next) => {
    try {
      const { clubName } = req.params as { clubName: string };
      const result = await deleteClub(clubName);
      if (!result.existed) throw new HttpError(404, `Club '${clubName}' not found`);
      res.json({
        success: true,
        message: `Club '${clubName}' removed successfully`,
        remainingClubs: result.remaining,
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
