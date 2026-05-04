import { env } from './config/env';
import { logger } from './config/logger';
import './config/firebase';
import { createApp } from './app';
import { probeCacheDir } from './services/paths';
import { loadRacers } from './services/racersStore';

async function main() {
  probeCacheDir();
  await loadRacers();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, node_env: env.NODE_ENV, url: `http://localhost:${env.PORT}` },
      'server_started',
    );
  });

  // Graceful shutdown - drain in-flight requests so Fly's deploy doesn't
  // chop off a Puppeteer fetch mid-flight.
  const shutdown = (signal: string) => {
    logger.info({ signal }, 'shutdown_requested');
    server.close((err) => {
      if (err) {
        logger.error({ err }, 'shutdown_error');
        process.exit(1);
      }
      logger.info('shutdown_complete');
      process.exit(0);
    });
    // Force exit if shutdown stalls.
    setTimeout(() => {
      logger.error('shutdown_timeout_force_exit');
      process.exit(1);
    }, 15_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'unhandled_rejection');
  });
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'uncaught_exception');
    process.exit(1);
  });
}

main().catch((err) => {
  logger.fatal({ err }, 'startup_failed');
  process.exit(1);
});
