import Groq from 'groq-sdk';
import fs from 'fs';
import { MODELS } from '../config/models';

export const transcribeAudio = async (filePath: string, trimStart: number = 0, trimEnd: number = 0): Promise<string> => {
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    console.log(`Starting Groq transcription for: ${filePath}`);
    
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: MODELS.transcription,
      prompt: "Transcribe accurately with speaker diarization. Label each speaker clearly with [MM:SS] timestamps (e.g., '[00:05] Speaker A: Hello').",
      response_format: 'text',
    });

    console.log('Groq Transcription successful');
    return transcription as unknown as string;
  } catch (error: any) {
    console.error('❌ GROQ TRANSCRIPTION ERROR:', error.message);
    
    if (error?.status === 429) {
      return "[00:00] Speaker A: Groq rate limit exceeded. This is a mock transcript.";
    }
    
    throw new Error('Transcription failed');
  }
};
