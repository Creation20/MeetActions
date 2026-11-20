import Groq from 'groq-sdk';

/**
 * Embedding generation.
 * Strategy (in order of preference):
 *   1. OpenAI text-embedding-3-small  (if OPENAI_API_KEY is present) — real, high quality
 *   2. Groq nomic-embed-text          (if the SDK exposes embeddings)
 *   3. Deterministic hashing fallback — keeps semantic search *functional* offline
 *
 * The deterministic fallback is NOT semantically meaningful, but it guarantees that
 * cosine comparisons are stable and that the pipeline never crashes when no embedding
 * provider is configured. Real relevance requires an embedding key.
 */

const EMBED_DIM = 256;

export const isRealEmbeddingConfigured = (): boolean => {
  return Boolean(process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY);
};

const openAIEmbedding = async (text: string): Promise<number[] | null> => {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.slice(0, 8000),
      }),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    return data?.data?.[0]?.embedding ?? null;
  } catch {
    return null;
  }
};

const groqEmbedding = async (text: string): Promise<number[] | null> => {
  if (!process.env.GROQ_API_KEY) return null;
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const response = await (groq as any).embeddings.create({
      model: 'nomic-embed-text-v1.5',
      input: text.slice(0, 8000),
    });
    return response?.data?.[0]?.embedding ?? null;
  } catch {
    return null;
  }
};

// Deterministic bag-of-words hashing into a fixed-dim vector. Cheap, stable, offline.
const hashingEmbedding = (text: string): number[] => {
  const vec = new Array(EMBED_DIM).fill(0);
  const tokens = text.toLowerCase().match(/[a-z0-9]+/g) || [];
  for (const tok of tokens) {
    let h = 0;
    for (let i = 0; i < tok.length; i++) h = (h * 31 + tok.charCodeAt(i)) | 0;
    const idx = Math.abs(h) % EMBED_DIM;
    vec[idx] += 1;
  }
  const norm = Math.sqrt(vec.reduce((a, b) => a + b * b, 0)) || 1;
  return vec.map((v) => v / norm);
};

export const generateEmbeddings = async (text: string): Promise<number[]> => {
  if (!text || !text.trim()) return [];
  const real = (await openAIEmbedding(text)) || (await groqEmbedding(text));
  if (real && real.length) return real;
  return hashingEmbedding(text);
};

export const cosineSimilarity = (a: number[], b: number[]): number => {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
};

export const chunkTranscript = (transcript: string, chunkSize: number = 1000, overlap: number = 200): string[] => {
  const chunks: string[] = [];
  let currentPos = 0;

  if (transcript.length <= chunkSize) {
    return [transcript];
  }

  while (currentPos < transcript.length) {
    const end = Math.min(currentPos + chunkSize, transcript.length);
    chunks.push(transcript.substring(currentPos, end));
    currentPos += (chunkSize - overlap);

    if (end === transcript.length) break;
  }

  return chunks;
};

export interface RankedChunk {
  meetingId: string;
  meetingTitle: string;
  date: Date;
  content: string;
  score: number;
}

interface ChunkedMeeting {
  _id: any;
  title: string;
  date: Date;
  chunks?: { content: string; embedding: number[]; index: number }[];
}

/**
 * Rank stored transcript chunks across a set of meetings against a query embedding.
 * Returns the top-K most relevant snippets with their source meeting.
 */
export const rankChunksByQuery = async (
  meetings: ChunkedMeeting[],
  query: string,
  topK: number = 6
): Promise<RankedChunk[]> => {
  const queryEmbedding = await generateEmbeddings(query);
  const scored: RankedChunk[] = [];

  for (const m of meetings) {
    for (const chunk of m.chunks || []) {
      if (!chunk.embedding?.length) continue;
      const score = cosineSimilarity(queryEmbedding, chunk.embedding);
      scored.push({
        meetingId: String(m._id),
        meetingTitle: m.title,
        date: m.date,
        content: chunk.content,
        score,
      });
    }
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, topK);
};
