import fs from 'fs';
import { transcribeAudio } from './transcription.service';

/**
 * Real acoustic speaker diarization (#2) via AssemblyAI.
 *
 * Gated on ASSEMBLYAI_API_KEY. When present, audio is transcribed with true
 * acoustic speaker separation (speaker_labels) and returned in the app's
 * canonical `[MM:SS] Speaker A: ...` format so the rest of the pipeline
 * (metrics, extraction) works unchanged.
 *
 * When the key is absent, we fall back to the existing Groq Whisper path, which
 * asks the model to *guess* speaker turns from text — functional, but not truly
 * acoustic. This makes the difference explicit rather than pretending.
 */

const AAI_BASE = 'https://api.assemblyai.com/v2';

export const isDiarizationConfigured = (): boolean => Boolean(process.env.ASSEMBLYAI_API_KEY);

const msToStamp = (ms: number): string => {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const uploadAudio = async (filePath: string, apiKey: string): Promise<string> => {
  const stream = fs.createReadStream(filePath);
  const res = await fetch(`${AAI_BASE}/upload`, {
    method: 'POST',
    headers: { authorization: apiKey },
    // Node streams are accepted as request bodies with duplex: 'half'
    body: stream as any,
    duplex: 'half',
  } as any);
  if (!res.ok) throw new Error(`AssemblyAI upload failed: ${res.status}`);
  const data: any = await res.json();
  return data.upload_url;
};

const requestTranscript = async (audioUrl: string, apiKey: string): Promise<string> => {
  const res = await fetch(`${AAI_BASE}/transcript`, {
    method: 'POST',
    headers: { authorization: apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({ audio_url: audioUrl, speaker_labels: true }),
  });
  if (!res.ok) throw new Error(`AssemblyAI transcript request failed: ${res.status}`);
  const data: any = await res.json();
  return data.id;
};

const pollTranscript = async (id: string, apiKey: string): Promise<any> => {
  // Poll up to ~5 minutes.
  for (let i = 0; i < 100; i++) {
    const res = await fetch(`${AAI_BASE}/transcript/${id}`, { headers: { authorization: apiKey } });
    const data: any = await res.json();
    if (data.status === 'completed') return data;
    if (data.status === 'error') throw new Error(`AssemblyAI error: ${data.error}`);
    await new Promise(r => setTimeout(r, 3000));
  }
  throw new Error('AssemblyAI transcription timed out');
};

export interface DiarizedResult {
  transcript: string;
  speakers: string[]; // e.g. ["Speaker A", "Speaker B"]
  diarized: boolean;  // true = real acoustic diarization
}

export const transcribeWithDiarization = async (
  filePath: string,
  trimStart = 0,
  trimEnd = 0
): Promise<DiarizedResult> => {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;

  if (!apiKey) {
    // Fallback: Groq Whisper (text-heuristic speaker labels).
    const transcript = await transcribeAudio(filePath, trimStart, trimEnd);
    const speakers = Array.from(new Set((transcript.match(/Speaker [A-Z]/g) || [])));
    return { transcript, speakers, diarized: false };
  }

  try {
    console.log('[Diarization] Using AssemblyAI acoustic diarization...');
    const uploadUrl = await uploadAudio(filePath, apiKey);
    const id = await requestTranscript(uploadUrl, apiKey);
    const result = await pollTranscript(id, apiKey);

    const utterances: any[] = result.utterances || [];
    const speakerSet = new Set<string>();
    const lines = utterances.map(u => {
      const label = `Speaker ${u.speaker}`; // AssemblyAI gives "A", "B", ...
      speakerSet.add(label);
      return `[${msToStamp(u.start)}] ${label}: ${u.text}`;
    });

    const transcript = lines.length ? lines.join('\n') : (result.text || '');
    return {
      transcript,
      speakers: Array.from(speakerSet),
      diarized: true,
    };
  } catch (error: any) {
    console.error('[Diarization] AssemblyAI failed, falling back to Groq:', error.message);
    const transcript = await transcribeAudio(filePath, trimStart, trimEnd);
    const speakers = Array.from(new Set((transcript.match(/Speaker [A-Z]/g) || [])));
    return { transcript, speakers, diarized: false };
  }
};
