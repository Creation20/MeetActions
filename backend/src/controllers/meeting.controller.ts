import { Request, Response } from 'express';
import { Meeting } from '../models/Meeting';
import { User } from '../models/User';
import { SpeakerProfile } from '../models/SpeakerProfile';
import { KnowledgeEntity } from '../models/KnowledgeEntity';
import { transcribeAudio } from '../services/transcription.service';
import { transcribeWithDiarization } from '../services/diarization.service';
import { extractMeetingData } from '../services/extraction.service';
import { translateContent } from '../services/translation.service';
import { calculateCoachMetrics } from '../services/metrics.service';
import { generateEmbeddings, chunkTranscript, rankChunksByQuery } from '../services/ai.service';
import { sendRecapEmail, isEmailConfigured } from '../services/email.service';
import { MODELS } from '../config/models';
import Groq from 'groq-sdk';
import { AuthRequest } from '../middleware/auth.middleware';
import { PremiumRequest } from '../middleware/premium.middleware';
import fs from 'fs';
import path from 'path';
import { fail } from '../utils/respond';

// Pull the first [MM:SS] (or [HH:MM:SS]) timestamp out of a chunk of transcript text.
const firstTimestamp = (text: string): string | undefined => {
  const m = text.match(/\[(\d{1,2}:\d{2}(?::\d{2})?)\]/);
  return m ? m[1] : undefined;
};

const safeJsonParse = (text: string): any => {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { /* noop */ }
    }
    return null;
  }
};

export const askMeeting = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const { id } = req.params;
    const { question } = req.body;

    const meeting = await Meeting.findOne({ _id: id, $or: [{ userId: req.userId }, { sharedWith: req.userId }] });
    if (!meeting) {
      res.status(404).json({ message: "That meeting is no longer available." });
      return;
    }

    // RAG retrieval: rank this meeting's chunks against the question so citations are grounded.
    const ranked = await rankChunksByQuery(
      [{ _id: meeting._id, title: meeting.title, date: meeting.date, chunks: meeting.chunks }],
      question,
      5
    );

    // Fall back to raw transcript if no embeddings exist yet.
    const contextBlocks = ranked.length
      ? ranked.map((r, i) => `[SOURCE ${i + 1}]\n${r.content}`).join('\n\n')
      : (meeting.transcript || '').slice(0, 6000);

    const prompt = `
      You are an expert AI assistant for a session titled "${meeting.title}".
      Answer the user's question using ONLY the sources below.
      For every claim, cite the source it came from. If the answer is not in the sources, say so honestly.

      SOURCES:
      ${contextBlocks}

      SUMMARY (for context only): ${meeting.summary || 'N/A'}

      USER QUESTION: "${question}"

      Respond with a JSON object of this exact shape:
      {
        "answer": "your concise, direct answer in markdown",
        "citations": [{ "quote": "the exact sentence(s) from a source that support the answer", "sourceIndex": 1 }]
      }
      Include 0-3 of the most relevant citations. Quotes must be copied verbatim from the sources.
    `;

    const response = await groq.chat.completions.create({
      model: MODELS.chat,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const parsed = safeJsonParse(response.choices[0]?.message?.content || '') || {};
    const citations = (parsed.citations || []).map((c: any) => {
      const src = ranked[(c.sourceIndex || 1) - 1];
      return {
        quote: c.quote,
        timestamp: src ? firstTimestamp(src.content) : firstTimestamp(c.quote || ''),
        meetingId: meeting._id,
        meetingTitle: meeting.title,
      };
    }).filter((c: any) => c.quote);

    res.status(200).json({ answer: parsed.answer || response.choices[0]?.message?.content, citations });
  } catch (error) {
    fail(res, 500, "The assistant couldn't answer that right now. Please try again in a moment.", error);
  }
};

export const askGlobal = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const { question } = req.body;

    // Fetch a broad window of ready meetings; retrieval narrows it down.
    const meetings = await Meeting.find({ $or: [{ userId: req.userId }, { sharedWith: req.userId }], status: 'ready' }).sort({ date: -1 }).limit(30);

    if (meetings.length === 0) {
      res.status(200).json({ answer: "You don't have any processed meetings yet. I need some context to answer questions!", citations: [] });
      return;
    }

    // Cross-meeting RAG: rank chunks from ALL meetings, not just the last 10 by date.
    const ranked = await rankChunksByQuery(
      meetings.map(m => ({ _id: m._id, title: m.title, date: m.date, chunks: m.chunks })),
      question,
      8
    );

    const contextBlocks = ranked.length
      ? ranked.map((r, i) => `[SOURCE ${i + 1}] (Meeting: "${r.meetingTitle}", ${new Date(r.date).toDateString()})\n${r.content}`).join('\n\n')
      : meetings.slice(0, 10).map(m => `[SOURCE] Meeting: "${m.title}" — ${m.summary}`).join('\n---\n');

    const prompt = `
      You are the user's personal cross-meeting "Knowledge Assistant".
      Answer by connecting dots across the sources below, which are drawn from many different meetings.
      Cite the specific sources you used. If the answer isn't in the sources, say so.

      SOURCES:
      ${contextBlocks}

      USER QUESTION: "${question}"

      Respond with a JSON object of this exact shape:
      {
        "answer": "your synthesized answer in markdown, referencing meetings by name where useful",
        "citations": [{ "quote": "verbatim supporting text", "sourceIndex": 1 }]
      }
      Include 0-4 of the most relevant citations.
    `;

    const response = await groq.chat.completions.create({
      model: MODELS.chat,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const parsed = safeJsonParse(response.choices[0]?.message?.content || '') || {};
    const citations = (parsed.citations || []).map((c: any) => {
      const src = ranked[(c.sourceIndex || 1) - 1];
      return src ? {
        quote: c.quote,
        timestamp: firstTimestamp(src.content),
        meetingId: src.meetingId,
        meetingTitle: src.meetingTitle,
      } : null;
    }).filter((c: any) => c && c.quote);

    res.status(200).json({ answer: parsed.answer || response.choices[0]?.message?.content, citations });
  } catch (error) {
    fail(res, 500, "The assistant couldn't answer that right now. Please try again in a moment.", error);
  }
};

export const translateMeeting = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { language } = req.body;
    
    const meeting = await Meeting.findOne({ _id: id, $or: [{ userId: req.userId }, { sharedWith: req.userId }] });
    if (!meeting) {
      res.status(404).json({ message: "That meeting is no longer available." });
      return;
    }

    const dataToTranslate = {
      summary: meeting.summary,
      decisions: meeting.decisions,
      transcript: meeting.transcript,
      tasks: meeting.tasks?.map(t => ({
        _id: t._id,
        title: t.title,
        description: t.description,
        owner: t.owner,
        priority: t.priority
      }))
    };

    const translated = await translateContent(dataToTranslate, language);
    res.status(200).json(translated);
  } catch (error) {
    fail(res, 500, "We couldn't translate this meeting. Please try again.", error);
  }
};

export const getAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const meetings = await Meeting.find({ $or: [{ userId: req.userId }, { sharedWith: req.userId }], status: 'ready' });
    
    const totalMeetings = meetings.length;
    const totalTasks = meetings.reduce((acc, m) => acc + (m.tasks?.length || 0), 0);
    const completedTasks = meetings.reduce((acc, m) => 
      acc + (m.tasks?.filter(t => t.status === 'completed').length || 0), 0);
    
    // Calculate total duration
    const totalDuration = meetings.reduce((acc, m) => acc + m.duration, 0);

    // Calculate common tags (topics)
    const tagCounts: { [key: string]: number } = {};
    meetings.forEach(m => {
      m.tags?.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    res.status(200).json({
      summary: {
        totalMeetings,
        totalTasks,
        completedTasks,
        completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
        totalHours: (totalDuration / 3600).toFixed(1)
      },
      topTags,
      activity: meetings.slice(0, 7).map(m => ({
        date: m.date,
        duration: m.duration,
        tasks: m.tasks?.length || 0
      }))
    });
  } catch (error) {
    fail(res, 500, "We couldn't load your stats right now. Pull to refresh to try again.", error);
  }
};

export const searchMeetings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const query = req.query.q as string;
    if (!query) {
      res.status(200).json([]);
      return;
    }

    const regex = new RegExp(query, 'i');
    const meetings = await Meeting.find({
      $or: [{ userId: req.userId }, { sharedWith: req.userId }],
      $and: [
        {
          $or: [
            { title: regex },
            { transcript: regex },
            { summary: regex },
            { tags: regex }
          ]
        }
      ]
    }).sort({ date: -1 });

    res.status(200).json(meetings);
  } catch (error) {
    fail(res, 500, "Search isn't working right now. Please try again in a moment.", error);
  }
};

export const getMeetings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const meetings = await Meeting.find({ $or: [{ userId: req.userId }, { sharedWith: req.userId }] })
      .select('-transcript -speakerNames')
      .sort({ date: -1 });
    res.status(200).json(meetings);
  } catch (error) {
    fail(res, 500, "We couldn't load your meetings. Pull to refresh to try again.", error);
  }
};

export const updateMeeting = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, notes, speakerNames, projectId } = req.body;
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (notes !== undefined) updateData.notes = notes;
    if (speakerNames !== undefined) updateData.speakerNames = speakerNames;
    if (projectId !== undefined) updateData.projectId = projectId;

    const meeting = await Meeting.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: updateData },
      { new: true }
    );
    if (!meeting) {
      res.status(404).json({ message: "That meeting is no longer available." });
      return;
    }

    // Sync to Global Speaker Profiles if names were updated
    if (speakerNames) {
      for (const [id, name] of Object.entries(speakerNames)) {
        if (typeof name === 'string' && name.trim()) {
          try {
            await SpeakerProfile.findOneAndUpdate(
              { userId: req.userId as any, name: name.trim() },
              { 
                $addToSet: { meetings: meeting._id as any },
                $set: { userId: req.userId as any, name: name.trim() }
              },
              { upsert: true, new: true }
            );
          } catch (e) {
            console.error('Error syncing speaker profile:', e);
          }
        }
      }
    }

    res.status(200).json(meeting);
  } catch (error) {
    fail(res, 500, "We couldn't save your changes. Please try again.", error);
  }
};

// Get a single meeting by ID
export const getMeetingById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const meeting = await Meeting.findOne({ _id: req.params.id, $or: [{ userId: req.userId }, { sharedWith: req.userId }] });
    if (!meeting) {
      res.status(404).json({ message: "That meeting is no longer available." });
      return;
    }
    res.status(200).json(meeting);
  } catch (error) {
    fail(res, 500, "We couldn't open that meeting. Please try again.", error);
  }
};

// Create a new meeting and trigger async processing
export const createMeeting = async (req: PremiumRequest, res: Response): Promise<void> => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const audioFile = files['audio']?.[0];
    const imageFile = files['image']?.[0];

    if (!audioFile) {
      res.status(400).json({ message: "No audio was attached to that recording." });
      return;
    }

    const { title, duration, autoGenerate, trimStart, trimEnd, bookmarks, mode, projectId } = req.body;

    // Premium-only options are resolved from the server-side entitlement, never from
    // the client. A free client that posts mode=Sales silently gets the Default mode.
    const effectiveMode = req.isPremium ? (mode || 'Default') : 'Default';
    const effectiveImagePath = req.isPremium ? imageFile?.path : undefined;

    const newMeeting = new Meeting({
      userId: req.userId,
      title: title || 'New Recording',
      duration: duration ? parseInt(duration) : 0,
      audioUrl: audioFile.path,
      status: autoGenerate === 'false' ? 'ready' : 'processing',
      tags: effectiveMode !== 'Default' ? [effectiveMode] : [],
      projectId: projectId || undefined
    });

    const savedMeeting = await newMeeting.save();

    // Trigger AI pipeline ONLY if requested
    if (autoGenerate !== 'false') {
      processAudioPipeline(
        savedMeeting._id.toString(),
        audioFile.path,
        trimStart ? parseFloat(trimStart) : 0,
        trimEnd ? parseFloat(trimEnd) : (duration ? parseFloat(duration) : 0),
        bookmarks ? JSON.parse(bookmarks) : [],
        effectiveMode,
        effectiveImagePath
      );
    }

    res.status(201).json({ message: 'Meeting created and processing started', meeting: savedMeeting });
  } catch (error) {
    fail(res, 500, "We couldn't save your recording. Please try again.", error);
  }
};

// Async processing function
const processAudioPipeline = async (meetingId: string, filePath: string, trimStart: number = 0, trimEnd: number = 0, bookmarks: any[] = [], mode: string = 'Default', imagePath?: string) => {
  try {
    console.log(`[Pipeline] Starting for meeting: ${meetingId} (Mode: ${mode}, Image: ${!!imagePath})`);
    
    // 1. Transcription + acoustic speaker diarization (#2)
    const { transcript, speakers, diarized } = await transcribeWithDiarization(filePath, trimStart, trimEnd);
    console.log(`[Pipeline] Transcribed (${diarized ? 'acoustic diarization' : 'heuristic'}), ${speakers.length} speakers detected`);

    // Update DB with transcript immediately
    await Meeting.findByIdAndUpdate(meetingId, { transcript, diarized });

    // 2-4. Extraction, embeddings, analytics, knowledge graph
    await finalizeMeetingIntelligence(meetingId, transcript, bookmarks, mode, imagePath);

    console.log(`[Pipeline] Completed successfully for meeting: ${meetingId}`);
  } catch (error) {
    console.error(`[Pipeline] Failed for meeting ${meetingId}:`, error);
    await Meeting.findByIdAndUpdate(meetingId, { status: 'error' });
  }
};

/**
 * Shared "intelligence" stage: takes a meeting that already has a transcript and
 * runs extraction + coach metrics + embeddings + knowledge-graph sync, then marks
 * it ready. Reused by both the batch upload pipeline and the live-mode finalizer (#3).
 */
export const finalizeMeetingIntelligence = async (
  meetingId: string,
  transcript: string,
  bookmarks: any[] = [],
  mode: string = 'Default',
  imagePath?: string
): Promise<void> => {
  const meeting = await Meeting.findById(meetingId);
  if (!meeting) throw new Error('Meeting not found for finalization');

  // Coach metrics from the diarized transcript.
  const coachMetrics = calculateCoachMetrics(transcript, meeting.duration || 0);

  // Known speakers help the AI attach real names consistently across meetings.
  const existingSpeakers = await SpeakerProfile.find({ userId: meeting.userId });
  const speakerList = existingSpeakers.map(s => s.name);

  // Extraction (template-aware).
  const extractedData = await extractMeetingData(transcript, bookmarks, mode, imagePath, speakerList);

  // Semantic chunking & embeddings (powers #7 search and #9 cited answers).
  const textChunks = chunkTranscript(transcript);
  const chunksWithEmbeddings = await Promise.all(textChunks.map(async (content, index) => {
    const embedding = await generateEmbeddings(content);
    return { content, embedding, index };
  }));

  const newTags = [...new Set([...(meeting.tags || []), ...(extractedData.tags || [])])];

  await Meeting.findByIdAndUpdate(meetingId, {
    summary: extractedData.summary,
    decisions: extractedData.decisions,
    tasks: extractedData.tasks.map(t => ({ ...t, status: 'pending' })),
    tags: newTags,
    analysis: { ...extractedData.analysis, ...coachMetrics },
    speakerNames: extractedData.speakerNames || {},
    followUp: extractedData.followUp,
    chunks: chunksWithEmbeddings,
    status: 'ready',
  });

  // Knowledge graph sync (powers #1 cross-meeting memory).
  for (const ent of extractedData.entities || []) {
    try {
      await KnowledgeEntity.findOneAndUpdate(
        { userId: meeting.userId as any, name: ent.name },
        {
          $set: { type: ent.type },
          $addToSet: {
            mentions: { meetingId: meeting._id as any, context: ent.context, date: meeting.date || new Date() },
          },
        },
        { upsert: true }
      );
    } catch (e) {
      console.error('Error syncing knowledge entity:', e);
    }
  }
};

// Update task status inside a meeting
export const updateTaskStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { meetingId, taskId } = req.params;
    const { status } = req.body;

    const meeting = await Meeting.findOneAndUpdate(
      { _id: meetingId, $or: [{ userId: req.userId }, { sharedWith: req.userId }], 'tasks._id': taskId },
      { $set: { 'tasks.$.status': status } },
      { new: true }
    );

    if (!meeting) {
      res.status(404).json({ message: "That task is no longer available." });
      return;
    }

    res.status(200).json({ message: 'Task updated', meeting });
  } catch (error) {
    fail(res, 500, "We couldn't update that task. Please try again.", error);
  }
};

// Remove a task from a meeting.
export const deleteTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { meetingId, taskId } = req.params;

    const meeting = await Meeting.findOneAndUpdate(
      { _id: meetingId, $or: [{ userId: req.userId }, { sharedWith: req.userId }] },
      { $pull: { tasks: { _id: taskId } } },
      { new: true }
    );

    if (!meeting) {
      res.status(404).json({ message: "That meeting is no longer available." });
      return;
    }

    res.status(200).json({ message: 'Task deleted', meeting });
  } catch (error) {
    fail(res, 500, "We couldn't delete that task. Please try again.", error);
  }
};

export const addTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, owner, dueDate, priority } = req.body;

    const meeting = await Meeting.findOneAndUpdate(
      { _id: id, $or: [{ userId: req.userId }, { sharedWith: req.userId }] },
      { 
        $push: { 
          tasks: { title, owner, dueDate, priority: priority || 'medium', status: 'pending' } 
        } 
      },
      { new: true }
    );

    if (!meeting) {
      res.status(404).json({ message: "That meeting is no longer available." });
      return;
    }

    res.status(201).json(meeting);
  } catch (error) {
    fail(res, 500, "We couldn't add that task. Please try again.", error);
  }
};

export const deleteMeeting = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const meeting = await Meeting.findOne({ _id: req.params.id, userId: req.userId });
    if (!meeting) {
      res.status(404).json({ message: "That meeting is no longer available." });
      return;
    }

    if (meeting.audioUrl) {
      const audioPath = path.join(process.cwd(), meeting.audioUrl);
      if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
    }
    
    await Meeting.deleteOne({ _id: req.params.id });

    res.status(200).json({ message: 'Meeting and associated files deleted successfully' });
  } catch (error) {
    fail(res, 500, "We couldn't delete that recording. Please try again.", error);
  }
};

export const shareMeeting = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { email } = req.body;

    const meeting = await Meeting.findOne({ _id: id, userId: req.userId });
    if (!meeting) {
      res.status(404).json({ message: "You can only do that with meetings you own." });
      return;
    }

    const userToShare = await User.findOne({ email });
    if (!userToShare) {
      res.status(404).json({ message: "No MeetActions account uses that email address." });
      return;
    }

    // Check if user ID is in sharedWith array
    if (meeting.sharedWith && meeting.sharedWith.some(uid => uid.toString() === userToShare._id.toString())) {
      res.status(400).json({ message: "That person already has access to this meeting." });
      return;
    }

    await Meeting.findByIdAndUpdate(id, { $push: { sharedWith: userToShare._id } });
    res.status(200).json({ message: `Meeting shared successfully with ${email}` });
  } catch (error) {
    fail(res, 500, "We couldn't share that meeting. Please try again.", error);
  }
};

export const unshareMeeting = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { userIdToUnshare } = req.body;

    const meeting = await Meeting.findOne({ _id: id, userId: req.userId });
    if (!meeting) {
      res.status(404).json({ message: "You can only do that with meetings you own." });
      return;
    }

    await Meeting.findByIdAndUpdate(id, { $pull: { sharedWith: userIdToUnshare } });
    res.status(200).json({ message: 'Access revoked successfully.' });
  } catch (error) {
    fail(res, 500, "We couldn't revoke access. Please try again.", error);
  }
};

export const getProactiveInsights = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const meetings = await Meeting.find({ userId: req.userId as any, status: 'ready' }).sort({ date: -1 });
    
    if (meetings.length === 0) {
      res.status(200).json({ tasks: [], lastMeeting: null });
      return;
    }

    // Extract all pending high/medium priority tasks across all meetings
    const allPendingTasks = meetings.flatMap(m => 
      (m.tasks || [])
        .filter(t => t.status !== 'completed' && (t.priority === 'high' || t.priority === 'medium'))
        .map(t => ({ 
          _id: t._id,
          title: t.title,
          priority: t.priority,
          meetingTitle: m.title, 
          meetingId: m._id 
        }))
    ).slice(0, 5);

    const lastMeeting = {
      title: meetings[0].title,
      summary: meetings[0].summary,
      id: meetings[0]._id
    };

    res.status(200).json({
      tasks: allPendingTasks,
      lastMeeting
    });
  } catch (error) {
    fail(res, 500, "We couldn't load your priorities right now. Pull to refresh to try again.", error);
  }
};

// #4 Send a formatted recap email to attendees (shared users + any extra emails).
export const sendRecap = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { emails } = req.body as { emails?: string[] };

    const meeting = await Meeting.findOne({ _id: id, $or: [{ userId: req.userId }, { sharedWith: req.userId }] });
    if (!meeting) {
      res.status(404).json({ message: "That meeting is no longer available." });
      return;
    }
    if (meeting.status !== 'ready') {
      res.status(400).json({ message: "This meeting is still being processed. Try again once it's ready." });
      return;
    }

    const sender = await User.findById(req.userId).select('name');

    // Recipients: explicit emails + emails of users the meeting is shared with.
    const sharedUsers = meeting.sharedWith?.length
      ? await User.find({ _id: { $in: meeting.sharedWith } }).select('email')
      : [];
    const recipients = Array.from(new Set([
      ...(emails || []),
      ...sharedUsers.map(u => (u as any).email),
    ].filter(Boolean).map((e: string) => e.trim().toLowerCase())));

    const result = await sendRecapEmail(recipients, {
      title: meeting.title,
      date: meeting.date,
      summary: meeting.summary,
      decisions: meeting.decisions,
      tasks: meeting.tasks?.map(t => ({ title: t.title, owner: t.owner, priority: t.priority })),
      senderName: (sender as any)?.name,
    });

    res.status(200).json({
      sent: result.sent,
      emailConfigured: isEmailConfigured(),
      recipients: result.recipients,
      preview: result.preview,
      message: result.sent
        ? `Recap sent to ${result.recipients.length} recipient(s).`
        : 'Email delivery is not configured on the server. A preview was generated instead.',
    });
  } catch (error) {
    fail(res, 500, "We couldn't send the recap email. Please check the addresses and try again.", error);
  }
};

// Re-run the AI pipeline for a meeting that errored or needs re-distillation.
// Reuses the saved transcript when present; otherwise re-transcribes from audio.
export const reprocessMeeting = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const meeting = await Meeting.findOne({ _id: id, userId: req.userId });
    if (!meeting) {
      res.status(404).json({ message: "That meeting is no longer available." });
      return;
    }

    await Meeting.findByIdAndUpdate(id, { status: 'processing' });
    res.status(200).json({ message: 'Reprocessing started', meetingId: id });

    // Run asynchronously (mirrors the upload pipeline UX).
    (async () => {
      try {
        const mode = meeting.tags?.[0] || 'Default';
        let transcript = meeting.transcript;

        if (!transcript || !transcript.trim()) {
          if (!meeting.audioUrl) throw new Error('No transcript or audio available to reprocess.');
          console.log(`[Reprocess] Re-transcribing meeting ${id}`);
          const result = await transcribeWithDiarization(meeting.audioUrl);
          transcript = result.transcript;
          await Meeting.findByIdAndUpdate(id, { transcript, diarized: result.diarized });
        }

        await finalizeMeetingIntelligence(String(id), transcript, [], mode);
        console.log(`[Reprocess] Completed for meeting ${id}`);
      } catch (e) {
        console.error(`[Reprocess] Failed for meeting ${id}:`, e);
        await Meeting.findByIdAndUpdate(id, { status: 'error' });
      }
    })();
  } catch (error) {
    fail(res, 500, "We couldn't reprocess that meeting. Please try again.", error);
  }
};

export const getMediaFile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { filename } = req.params;
    const filePath = path.join('uploads', filename as string);
    
    const meeting = await Meeting.findOne({ 
      audioUrl: filePath, 
      $or: [{ userId: req.userId }, { sharedWith: req.userId }] 
    });

    if (!meeting) {
      res.status(403).json({ message: "You don't have access to that recording." });
      return;
    }

    const absolutePath = path.join(process.cwd(), filePath);
    if (!fs.existsSync(absolutePath)) {
      res.status(404).json({ message: "That audio file is no longer available." });
      return;
    }

    res.sendFile(absolutePath);
  } catch (error) {
    fail(res, 500, "We couldn't load that audio file. It may no longer be available.", error);
  }
};
