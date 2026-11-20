import fs from 'fs';
import { Meeting } from '../models/Meeting';
import { transcribeWithDiarization } from './diarization.service';
import { finalizeMeetingIntelligence } from '../controllers/meeting.controller';
import logger from './logger.service';

/**
 * The AI pipeline runs in-process and is fire-and-forget. If the server dies
 * mid-run, the meeting is left in `processing` with nothing left to advance it —
 * the user sees a spinner forever. On boot we adopt those orphans: anything that
 * has been `processing` longer than any real run could take is either resumed
 * (if we still have the transcript or the audio) or failed honestly.
 *
 * This is a safety net, not a queue. A restart *during* the sweep re-runs it on
 * the next boot, which is safe because each step is idempotent. Replacing this
 * with BullMQ + Redis remains the real fix for concurrency and retries.
 */

/** Longer than the slowest plausible pipeline run, so we never adopt a live job. */
const STALE_AFTER_MS = 30 * 60 * 1000;

const resumeMeeting = async (meetingId: string): Promise<void> => {
  const meeting = await Meeting.findById(meetingId);
  if (!meeting) return;

  const mode = meeting.tags?.[0] || 'Default';
  let transcript = meeting.transcript;

  if (!transcript || !transcript.trim()) {
    // No transcript: we can only resume if the source audio survived the restart.
    if (!meeting.audioUrl || !fs.existsSync(meeting.audioUrl)) {
      throw new Error('audio is no longer on disk and no transcript was saved');
    }
    const result = await transcribeWithDiarization(meeting.audioUrl);
    transcript = result.transcript;
    await Meeting.findByIdAndUpdate(meetingId, { transcript, diarized: result.diarized });
  }

  await finalizeMeetingIntelligence(meetingId, transcript, [], mode);
};

export const recoverStuckMeetings = async (): Promise<void> => {
  try {
    const cutoff = new Date(Date.now() - STALE_AFTER_MS);
    const stuck = await Meeting.find({ status: 'processing', updatedAt: { $lt: cutoff } }).select('_id');

    if (stuck.length === 0) {
      logger.info('[Recovery] No stuck meetings found');
      return;
    }

    logger.warn(`[Recovery] Found ${stuck.length} meeting(s) stuck in processing — adopting them`);

    for (const { _id } of stuck) {
      const id = String(_id);
      try {
        await resumeMeeting(id);
        logger.info(`[Recovery] Resumed meeting ${id}`);
      } catch (error: any) {
        // Failing loudly beats an eternal spinner: the user can retry from the UI.
        await Meeting.findByIdAndUpdate(id, { status: 'error' });
        logger.error(`[Recovery] Could not resume meeting ${id}, marked as error: ${error.message}`);
      }
    }
  } catch (error: any) {
    logger.error(`[Recovery] Sweep failed: ${error.message}`);
  }
};
