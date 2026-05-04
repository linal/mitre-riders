import admin from 'firebase-admin';
import { env } from './env';
import { logger } from './logger';

// Initialise Firebase Admin once per process. Prefer explicit env-driven
// credentials; fall back to GOOGLE_APPLICATION_CREDENTIALS / Application
// Default Credentials so local dev with `gcloud auth` keeps working.
if (admin.apps.length === 0) {
  if (env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY && env.FIREBASE_PROJECT_ID) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY,
      }),
      projectId: env.FIREBASE_PROJECT_ID,
    });
    logger.info({ source: 'env_credentials' }, 'firebase_initialised');
  } else {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: env.FIREBASE_PROJECT_ID,
    });
    logger.info(
      { source: 'application_default' },
      env.FIREBASE_PROJECT_ID
        ? 'firebase_initialised'
        : 'firebase_initialised_without_project_id',
    );
  }
}

export { admin };
