import { Response } from 'express';
import fs from 'fs';
import { Meeting } from '../models/Meeting';
import { AuthRequest } from '../middleware/auth.middleware';
import { transcribeAudio } from '../services/transcription.service';
import { finalizeMeetingIntelligence } from './meeting.controller';
import { fail } from '../utils/respond';

/**
 * Live / streaming transcription mode (#3).
 *
 * The device records in short rolling chunks and POSTs each one; the backend
 * transcribes it immediately and appends to the meeting's growing transcript,
 * giving a near-live rolling transcript. On stop, the full accumulated transcript
 * is run through the normal intelligence stage (extraction, embeddings, etc.).
 */

const stamp = (sec: number): string => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `[${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}]`;
};

// Start a live session — creates a placeholder meeting we append to.
export const startLive = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, projectId, mode } = req.body;
    const meeting = new Meeting({
      userId: req.userId,
      title: title || 'Live Session',
      status: 'processing',
      liveMode: true,
      transcript: '',
      tags: mode && mode !== 'Default' ? [mode] : [],
      projectId: projectId || undefined,
    });
    await meeting.save();
    res.status(201).json({ meetingId: meeting._id, title: meeting.title });
  } catch (error) {
    fail(res, 500, "We couldn't start live transcription. Please try again.", error);
  }
};

// Append one transcribed audio chunk to the live transcript.
export const appendLiveChunk = async (req: AuthRequest, res: Response): Promise<void> => {
  const file = (req.files as any)?.['audio']?.[0] || (req as any).file;
  try {
    const { id } = req.params;
    const offsetSec = parseFloat(req.body.offsetSec || '0');

    const meeting = await Meeting.findOne({ _id: id, userId: req.userId });
    if (!meeting) {
      res.status(404).json({ message: "That live session has ended or is no longer available." });
      return;
    }
    if (!file) {
      res.status(400).json({ message: "Part of the live recording didn't arrive. Check your connection." });
      return;
    }

    let text = '';
    try {
      text = (await transcribeAudio(file.path)).trim();
    } catch (e) {
      console.error('[Live] chunk transcription failed:', e);
    }

    let segment = '';
    if (text) {
      // If the model already produced [MM:SS] Speaker labels, keep them; otherwise stamp it.
      segment = /^\[\d/.test(text) ? text : `${stamp(offsetSec)} ${text}`;
      const updated = (meeting.transcript ? meeting.transcript + '\n' : '') + segment;
      meeting.transcript = updated;
      await meeting.save();
    }

    res.status(200).json({ segment, transcript: meeting.transcript });
  } catch (error) {
    fail(res, 500, "We lost part of the live recording. Check your connection and try again.", error);
  } finally {
    if (file?.path && fs.existsSync(file.path)) {
      try { fs.unlinkSync(file.path); } catch { /* noop */ }
    }
  }
};

// Stop the live session and run full intelligence extraction on the transcript.
export const stopLive = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { duration, mode, bookmarks } = req.body;

    const meeting = await Meeting.findOne({ _id: id, userId: req.userId });
    if (!meeting) {
      res.status(404).json({ message: "That live session has ended or is no longer available." });
      return;
    }

    if (duration) meeting.duration = parseInt(duration);
    await meeting.save();

    if (!meeting.transcript || !meeting.transcript.trim()) {
      meeting.status = 'ready';
      await meeting.save();
      res.status(200).json({ meetingId: meeting._id, status: 'ready', message: 'No speech captured.' });
      return;
    }

    // Respond immediately; finalize asynchronously (mirrors the batch pipeline UX).
    res.status(200).json({ meetingId: meeting._id, status: 'processing' });

    finalizeMeetingIntelligence(
      String(meeting._id),
      meeting.transcript,
      bookmarks ? (typeof bookmarks === 'string' ? JSON.parse(bookmarks) : bookmarks) : [],
      mode || (meeting.tags?.[0]) || 'Default'
    ).catch(async (e) => {
      console.error('[Live] finalize failed:', e);
      await Meeting.findByIdAndUpdate(id, { status: 'error' });
    });
  } catch (error) {
    fail(res, 500, "We couldn't finish the live session. Your audio is safe — please try again.", error);
  }
};
