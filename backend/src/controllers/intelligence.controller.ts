import { Response } from 'express';
import Groq from 'groq-sdk';
import { Meeting } from '../models/Meeting';
import { KnowledgeEntity } from '../models/KnowledgeEntity';
import { AuthRequest } from '../middleware/auth.middleware';
import { rankChunksByQuery, isRealEmbeddingConfigured } from '../services/ai.service';
import { EXTRACTION_TEMPLATES } from '../services/templates.service';
import { MODELS } from '../config/models';
import { fail } from '../utils/respond';

const DAY_MS = 1000 * 60 * 60 * 24;

const safeJsonParse = (text: string): any => {
  try { return JSON.parse(text); } catch {
    const m = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (m) { try { return JSON.parse(m[0]); } catch { /* noop */ } }
    return null;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// #8 Templates
// ─────────────────────────────────────────────────────────────────────────────
export const getTemplates = async (_req: AuthRequest, res: Response): Promise<void> => {
  res.status(200).json(
    EXTRACTION_TEMPLATES.map(({ id, label, icon, description }) => ({ id, label, icon, description }))
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// #7 Semantic search across every meeting
// ─────────────────────────────────────────────────────────────────────────────
export const semanticSearch = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const query = (req.query.q as string || '').trim();
    if (!query) {
      res.status(200).json({ results: [], semantic: isRealEmbeddingConfigured() });
      return;
    }

    const meetings = await Meeting.find({
      $or: [{ userId: req.userId }, { sharedWith: req.userId }],
      status: 'ready',
    }).select('title date summary chunks').sort({ date: -1 }).limit(100);

    const ranked = await rankChunksByQuery(
      meetings.map(m => ({ _id: m._id, title: m.title, date: m.date, chunks: m.chunks })),
      query,
      12
    );

    // De-dupe to the single best snippet per meeting for a cleaner result list.
    const seen = new Set<string>();
    const results = ranked
      .filter(r => r.score > 0.05)
      .filter(r => (seen.has(r.meetingId) ? false : (seen.add(r.meetingId), true)))
      .map(r => ({
        meetingId: r.meetingId,
        meetingTitle: r.meetingTitle,
        date: r.date,
        snippet: r.content.length > 320 ? r.content.slice(0, 320) + '…' : r.content,
        score: Math.round(r.score * 100),
      }));

    res.status(200).json({ results, semantic: isRealEmbeddingConfigured() });
  } catch (error) {
    fail(res, 500, "Smart search isn't working right now. Please try again in a moment.", error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// #1 Cross-meeting memory: entity list
// ─────────────────────────────────────────────────────────────────────────────
export const getEntities = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const entities = await KnowledgeEntity.find({ userId: req.userId as any });
    const payload = entities
      .map(e => ({
        name: e.name,
        type: e.type,
        mentionCount: e.mentions?.length || 0,
        lastMentioned: e.mentions?.length
          ? e.mentions.reduce((latest, m) => (m.date > latest ? m.date : latest), e.mentions[0].date)
          : (e as any).updatedAt,
      }))
      .sort((a, b) => b.mentionCount - a.mentionCount);
    res.status(200).json(payload);
  } catch (error) {
    fail(res, 500, "We couldn't load your meeting memory. Please try again.", error);
  }
};

// #1 Entity timeline — every mention across every meeting, chronologically
export const getEntityTimeline = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const name = decodeURIComponent(req.params.name as string);
    const entity = await KnowledgeEntity.findOne({ userId: req.userId as any, name });
    if (!entity) {
      res.status(404).json({ message: "We couldn't find that topic in your meeting memory." });
      return;
    }

    // Resolve meeting titles for each mention.
    const meetingIds = entity.mentions.map(m => m.meetingId) as any[];
    const meetings = await Meeting.find({ _id: { $in: meetingIds } }).select('title date');
    const titleById = new Map(meetings.map(m => [String(m._id), { title: m.title, date: m.date }]));

    const timeline = entity.mentions
      .map(m => ({
        meetingId: m.meetingId,
        meetingTitle: titleById.get(String(m.meetingId))?.title || 'Untitled',
        context: m.context,
        date: m.date,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    res.status(200).json({ name: entity.name, type: entity.type, timeline });
  } catch (error) {
    fail(res, 500, "We couldn't load that timeline. Please try again.", error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// #1 Commitment / broken-promise tracking
// Deterministic aging + an AI pass that flags commitments that look resolved
// or superseded by later meetings.
// ─────────────────────────────────────────────────────────────────────────────
export const getCommitments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const meetings = await Meeting.find({ userId: req.userId as any, status: 'ready' })
      .select('title date tasks summary decisions')
      .sort({ date: -1 });

    const now = Date.now();
    interface Commitment {
      taskId: any; title: string; owner: string; priority: string;
      meetingId: any; meetingTitle: string; meetingDate: Date;
      ageDays: number; overdue: boolean; dueDate?: Date; status: string;
    }

    const open: Commitment[] = [];
    for (const m of meetings) {
      for (const t of m.tasks || []) {
        if (t.status === 'completed') continue;
        const ageDays = Math.floor((now - new Date(m.date).getTime()) / DAY_MS);
        open.push({
          taskId: t._id,
          title: t.title,
          owner: t.owner || 'Unassigned',
          priority: t.priority,
          meetingId: m._id,
          meetingTitle: m.title,
          meetingDate: m.date,
          ageDays,
          overdue: t.dueDate ? new Date(t.dueDate).getTime() < now : false,
          dueDate: t.dueDate,
          status: t.status,
        });
      }
    }

    // Sort: overdue first, then oldest.
    open.sort((a, b) => Number(b.overdue) - Number(a.overdue) || b.ageDays - a.ageDays);

    // AI follow-through check on the most significant open commitments (bounded).
    let flagged: Record<string, { likelyResolved: boolean; note: string }> = {};
    const candidates = open.slice(0, 20);
    if (candidates.length && process.env.GROQ_API_KEY) {
      try {
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        // Recent context to detect follow-through: summaries + decisions of the last few meetings.
        const recentContext = meetings.slice(0, 8).map(m =>
          `Meeting "${m.title}" (${new Date(m.date).toDateString()}): ${m.summary || ''} Decisions: ${(m.decisions || []).join('; ')}`
        ).join('\n');

        const prompt = `You track whether commitments made in meetings were actually followed through.
Below are OPEN commitments and RECENT MEETING CONTEXT. For each commitment, decide if the recent context suggests it was already done, discussed as done, or superseded.

OPEN COMMITMENTS:
${candidates.map((c, i) => `${i}. [${c.owner}] ${c.title} (from "${c.meetingTitle}", ${c.ageDays} days ago)`).join('\n')}

RECENT MEETING CONTEXT:
${recentContext}

Respond with JSON: { "assessments": [{ "index": 0, "likelyResolved": true|false, "note": "short reason" }] }
Only include commitments where you have a real signal. Be conservative.`;

        const resp = await groq.chat.completions.create({
          model: MODELS.chat,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
        });
        const parsed = safeJsonParse(resp.choices[0]?.message?.content || '') || {};
        for (const a of parsed.assessments || []) {
          const c = candidates[a.index];
          if (c) flagged[String(c.taskId)] = { likelyResolved: !!a.likelyResolved, note: a.note || '' };
        }
      } catch (e) {
        console.error('Commitment AI check failed:', e);
      }
    }

    const enriched = open.map(c => ({
      ...c,
      likelyResolved: flagged[String(c.taskId)]?.likelyResolved || false,
      followUpNote: flagged[String(c.taskId)]?.note || '',
    }));

    const brokenPromises = enriched.filter(c => (c.overdue || c.ageDays >= 14) && !c.likelyResolved);

    res.status(200).json({
      commitments: enriched,
      brokenPromises,
      stats: {
        total: enriched.length,
        overdue: enriched.filter(c => c.overdue).length,
        stale: enriched.filter(c => c.ageDays >= 14).length,
      },
    });
  } catch (error) {
    fail(res, 500, "We couldn't load your open commitments. Please try again.", error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// #1 Decision-drift detection — find decisions that were later reversed/contradicted
// ─────────────────────────────────────────────────────────────────────────────
export const getDecisionDrift = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const meetings = await Meeting.find({ userId: req.userId as any, status: 'ready' })
      .select('title date decisions')
      .sort({ date: 1 })
      .limit(25);

    const withDecisions = meetings.filter(m => (m.decisions || []).length > 0);
    if (withDecisions.length < 2 || !process.env.GROQ_API_KEY) {
      res.status(200).json({ drifts: [], analyzed: withDecisions.length });
      return;
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const timeline = withDecisions.map(m =>
      `MEETING "${m.title}" (${new Date(m.date).toDateString()}):\n${(m.decisions || []).map(d => `- ${d}`).join('\n')}`
    ).join('\n\n');

    const prompt = `You analyze how decisions evolve across a series of meetings, in chronological order.
Identify cases where a later meeting REVERSED, CONTRADICTED, or MATERIALLY CHANGED a decision made in an earlier meeting.

DECISION TIMELINE:
${timeline}

Respond with JSON: { "drifts": [{ "topic": "short topic", "earlier": "the earlier decision", "earlierMeeting": "title", "later": "the newer decision", "laterMeeting": "title", "type": "reversal|change|contradiction" }] }
Only report genuine drift. If decisions are consistent, return an empty array.`;

    const resp = await groq.chat.completions.create({
      model: MODELS.chat,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });
    const parsed = safeJsonParse(resp.choices[0]?.message?.content || '') || {};
    res.status(200).json({ drifts: parsed.drifts || [], analyzed: withDecisions.length });
  } catch (error) {
    fail(res, 500, "We couldn't analyze how your decisions have changed. Please try again.", error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// #5 Pre-meeting briefing — given an upcoming meeting title, surface related history
// ─────────────────────────────────────────────────────────────────────────────
export const getBriefing = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const title = (req.query.title as string || '').trim();
    if (!title) {
      res.status(400).json({ message: "We need a meeting title to build a briefing." });
      return;
    }

    const meetings = await Meeting.find({ userId: req.userId as any, status: 'ready' })
      .select('title date summary decisions tasks chunks')
      .sort({ date: -1 })
      .limit(60);

    // Rank related past meetings by semantic similarity of the upcoming title.
    const ranked = await rankChunksByQuery(
      meetings.map(m => ({ _id: m._id, title: m.title, date: m.date, chunks: m.chunks })),
      title,
      10
    );
    const relatedIds = new Set(ranked.map(r => r.meetingId));

    // Also include obvious keyword title matches.
    const keyword = title.toLowerCase();
    for (const m of meetings) {
      if (m.title.toLowerCase().includes(keyword) || keyword.includes(m.title.toLowerCase())) {
        relatedIds.add(String(m._id));
      }
    }

    const related = meetings.filter(m => relatedIds.has(String(m._id))).slice(0, 5);

    if (related.length === 0) {
      res.status(200).json({ hasHistory: false, title, openItems: [], lastMeeting: null, talkingPoints: [] });
      return;
    }

    const openItems = related.flatMap(m =>
      (m.tasks || [])
        .filter(t => t.status !== 'completed')
        .map(t => ({ title: t.title, owner: t.owner, priority: t.priority, meetingTitle: m.title, meetingId: m._id }))
    ).slice(0, 12);

    const last = related[0];

    // AI talking points from the related history.
    let talkingPoints: string[] = [];
    if (process.env.GROQ_API_KEY) {
      try {
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        const ctx = related.map(m => `"${m.title}": ${m.summary || ''} | Decisions: ${(m.decisions || []).join('; ')}`).join('\n');
        const prompt = `You are prepping someone for an upcoming meeting titled "${title}".
Based on related past meetings below, list 3-5 concise talking points or things to follow up on.

RELATED HISTORY:
${ctx}

Respond with JSON: { "talkingPoints": ["...", "..."] }`;
        const resp = await groq.chat.completions.create({
          model: MODELS.chat,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
        });
        const parsed = safeJsonParse(resp.choices[0]?.message?.content || '') || {};
        talkingPoints = parsed.talkingPoints || [];
      } catch (e) {
        console.error('Briefing AI failed:', e);
      }
    }

    res.status(200).json({
      hasHistory: true,
      title,
      openItems,
      lastMeeting: { id: last._id, title: last.title, date: last.date, summary: last.summary },
      talkingPoints,
    });
  } catch (error) {
    fail(res, 500, "We couldn't prepare your briefing. Please try again.", error);
  }
};
