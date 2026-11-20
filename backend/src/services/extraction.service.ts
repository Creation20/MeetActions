import Groq from 'groq-sdk';
import fs from 'fs';
import { getTemplate } from './templates.service';
import { MODELS } from '../config/models';

interface ExtractionResult {
  summary: string;
  decisions: string[];
  tasks: Array<{
    title: string;
    description: string;
    owner: string;
    priority: 'low' | 'medium' | 'high';
  }>;
  tags: string[];
  analysis: {
    sentiment: 'positive' | 'neutral' | 'negative';
    tone: string;
    conflictDetected: boolean;
  };
  speakerNames?: { [key: string]: string };
  entities?: Array<{
    name: string;
    type: 'person' | 'project' | 'company' | 'concept';
    context: string;
  }>;
  followUp?: {
    title: string;
    suggestedDate?: string;
  };
}

export const extractMeetingData = async (
  transcript: string, 
  bookmarks: any[] = [], 
  mode: string = 'Default', 
  imagePath?: string,
  existingSpeakers: string[] = []
): Promise<ExtractionResult> => {
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const template = getTemplate(mode);
    console.log(`Starting Groq extraction with ${bookmarks.length} bookmarks, template "${template.label}" (${template.id}), and ${existingSpeakers.length} known speakers...`);

    const prompt = `
      Analyze the provided meeting transcript and extract structured information.

      INSTRUCTIONS:
      1. LANGUAGE: Use professional, friendly, and accessible English.
      2. SUMMARY: Write a concise yet comprehensive narrative summary.
      3. DECISIONS: Clearly list every specific agreement or conclusion reached.
      4. TASKS: Ensure every action item is clear, starts with a strong verb, and has a realistic owner and priority.
      5. TAGS: Use short, relevant hashtags.
      6. ANALYSIS: Be honest about the meeting tone and any conflicts.
      7. SPEAKER IDENTIFICATION: Identify real names for "Speaker A", "Speaker B", etc.
         ${existingSpeakers.length > 0 ? `KNOWN SPEAKERS: ${existingSpeakers.join(', ')}.` : ''}
      8. ENTITIES: Extract key people, projects, companies, or concepts.

      ${bookmarks.length > 0 ? `KEY MOMENTS: ${bookmarks.map(b => `- ${b.time}s: ${b.type}`).join('\n')}` : ''}

      TEMPLATE: ${template.label}
      TEMPLATE-SPECIFIC GUIDANCE:
      ${template.instructions}

      TRANSCRIPT:
      """
      ${transcript}
      """

      OUTPUT FORMAT:
      Respond with a SINGLE valid, minified JSON object and NOTHING else — no prose, no markdown.
      Every key MUST be a JSON string followed by a colon (":"), never "=". Use double quotes everywhere.
      Schema:
      {
        "summary": "string",
        "decisions": ["string"],
        "tasks": [{"title": "string", "description": "string", "owner": "string", "priority": "low|medium|high"}],
        "tags": ["string"],
        "analysis": {"sentiment": "positive|neutral|negative", "tone": "string", "conflictDetected": boolean},
        "speakerNames": {"Speaker A": "Name"},
        "entities": [{"name": "string", "type": "person|project|company|concept", "context": "string"}],
        "followUp": {"title": "string", "suggestedDate": "ISO-DATE-STRING"}
      }
    `;

    const parsed = await runExtractionWithRetries(groq, prompt);
    if (parsed) {
      console.log('Groq Extraction successful');
      return normalizeExtraction(parsed);
    }

    // Last resort: never lose the meeting. Return a minimal, valid result so the
    // pipeline still marks it "ready" with the transcript intact.
    console.warn('⚠️ Extraction could not produce valid JSON after retries — using safe fallback.');
    return safeFallback(transcript);
  } catch (error: any) {
    console.error('❌ GROQ EXTRACTION ERROR:', error?.message || error);
    return safeFallback(transcript);
  }
};

// ── Robust JSON extraction: retry + salvage the model's failed_generation ──────
const runExtractionWithRetries = async (groq: Groq, prompt: string, maxAttempts = 3): Promise<any | null> => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: MODELS.chat,
        response_format: { type: 'json_object' },
        temperature: 0.2, // lower temp = far fewer malformed-JSON failures
      });
      const text = completion.choices[0]?.message?.content;
      if (text) {
        const parsed = looseJsonParse(text);
        if (parsed) return parsed;
      }
    } catch (error: any) {
      // Groq returns the malformed output in error.error.failed_generation — try to salvage it.
      const failed =
        error?.error?.error?.failed_generation ??
        error?.error?.failed_generation ??
        error?.failed_generation;
      if (failed) {
        const salvaged = looseJsonParse(failed);
        if (salvaged) {
          console.log(`Recovered extraction from failed_generation on attempt ${attempt}`);
          return salvaged;
        }
        // Ask the model to repair its own broken JSON.
        const repaired = await repairJson(groq, failed);
        if (repaired) {
          console.log(`Repaired extraction JSON on attempt ${attempt}`);
          return repaired;
        }
      }
      console.warn(`Extraction attempt ${attempt}/${maxAttempts} failed: ${error?.message || 'unknown'}`);
    }
  }
  return null;
};

// Ask the model to turn broken JSON into valid JSON.
const repairJson = async (groq: Groq, broken: string): Promise<any | null> => {
  try {
    const completion = await groq.chat.completions.create({
      messages: [{
        role: 'user',
        content: `The text below is meant to be a single JSON object but is malformed (e.g. "key=" instead of "key:", or arrays wrapped in quotes). Fix it and return ONLY the corrected, valid, minified JSON — no commentary.\n\n${broken}`,
      }],
      model: MODELS.chat,
      response_format: { type: 'json_object' },
      temperature: 0,
    });
    const text = completion.choices[0]?.message?.content;
    return text ? looseJsonParse(text) : null;
  } catch {
    return null;
  }
};

// Tolerant JSON parse: direct parse, then a few common structural repairs.
const looseJsonParse = (text: string): any | null => {
  const tryParse = (s: string) => { try { return JSON.parse(s); } catch { return null; } };

  let direct = tryParse(text);
  if (direct) return direct;

  // Isolate the outermost {...} block.
  const match = text.match(/\{[\s\S]*\}/);
  let candidate = match ? match[0] : text;

  const repaired = candidate
    .replace(/"(\w+)"\s*=\s*/g, '"$1":')   // "tasks"=[ → "tasks":[
    .replace(/(\w+)\s*=\s*\[/g, '"$1":[')  // tasks=[   → "tasks":[
    .replace(/,\s*([}\]])/g, '$1');        // trailing commas

  return tryParse(repaired) ?? tryParse(candidate);
};

// Coerce loosely-typed model output into our expected shape.
const normalizeExtraction = (d: any): ExtractionResult => {
  const arr = (v: any) => (Array.isArray(v) ? v : []);
  return {
    summary: typeof d.summary === 'string' ? d.summary : '',
    decisions: arr(d.decisions).filter((x: any) => typeof x === 'string'),
    tasks: arr(d.tasks).map((t: any) => ({
      title: String(t?.title ?? 'Untitled task'),
      description: String(t?.description ?? ''),
      owner: String(t?.owner ?? ''),
      priority: ['low', 'medium', 'high'].includes(t?.priority) ? t.priority : 'medium',
    })),
    tags: arr(d.tags).filter((x: any) => typeof x === 'string'),
    analysis: {
      sentiment: ['positive', 'neutral', 'negative'].includes(d?.analysis?.sentiment) ? d.analysis.sentiment : 'neutral',
      tone: String(d?.analysis?.tone ?? 'neutral'),
      conflictDetected: Boolean(d?.analysis?.conflictDetected),
    },
    speakerNames: d?.speakerNames && typeof d.speakerNames === 'object' ? d.speakerNames : {},
    entities: arr(d.entities).filter((e: any) => e && typeof e.name === 'string'),
    followUp: d?.followUp && typeof d.followUp === 'object' ? d.followUp : undefined,
  };
};

// Minimal valid result so a meeting is never lost to a transient AI hiccup.
const safeFallback = (transcript: string): ExtractionResult => ({
  summary: transcript
    ? 'Automatic summarization was unavailable for this session, but the full transcript has been saved. Open the Assistant to ask questions about it.'
    : 'No speech was detected in this recording.',
  decisions: [],
  tasks: [],
  tags: [],
  analysis: { sentiment: 'neutral', tone: 'neutral', conflictDetected: false },
  speakerNames: {},
  entities: [],
  followUp: undefined,
});
