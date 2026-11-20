import { Response } from 'express';
import logger from '../services/logger.service';

/**
 * The one way a handler is allowed to report a failure.
 *
 * Serializing the caught error back to the client (`res.json({ message, error })`)
 * leaked Mongoose validation internals, driver messages and stack frames to anyone
 * holding a token — and put text no human can act on in front of the user. The real
 * error goes to the logs (and Sentry); the client only ever sees `message`, which
 * must be written for a person.
 */
export const fail = (res: Response, status: number, message: string, error?: unknown): void => {
  if (error) {
    const detail = error instanceof Error ? error.stack || error.message : JSON.stringify(error);
    logger.error(`[${status}] ${message} :: ${detail}`);
  }
  res.status(status).json({ message });
};
