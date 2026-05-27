import fs from 'fs';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini using the same key as extraction
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export const transcribeAudio = async (filePath: string, trimStart: number = 0, trimEnd: number = 0): Promise<string> => {
  try {
    console.log(`Starting Gemini transcription for: ${filePath} (${trimStart}s - ${trimEnd}s)`);
    
    // Convert local file to base64 inline data for Gemini
    const fileBytes = fs.readFileSync(filePath);
    const base64Data = fileBytes.toString('base64');
    
    // Determine mime type (fallback to audio/mp4 for m4a)
    let mimeType = 'audio/mp4';
    if (filePath.endsWith('.wav')) mimeType = 'audio/wav';
    else if (filePath.endsWith('.mp3')) mimeType = 'audio/mp3';

    const audioPart = {
      inlineData: {
        data: base64Data,
        mimeType: mimeType,
      },
    };

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    let prompt = "Please transcribe the following audio recording accurately with speaker diarization. Label each speaker clearly (e.g., 'Speaker A:', 'Speaker B:'). Do not include any commentary, just the labeled transcription itself.";
    
    if (trimStart > 0 || trimEnd > 0) {
      prompt += ` Only transcribe and label the portion from ${trimStart} seconds to ${trimEnd} seconds. Ignore any audio outside this range.`;
    }

    console.log('Sending audio to Gemini 2.5 Flash...');
    const result = await model.generateContent([prompt, audioPart]);
    const transcription = result.response.text();
    
    console.log('Gemini Transcription successful');
    return transcription;
  } catch (error: any) {
    console.error('Error during Gemini transcription:', error?.message || error);
    
    // Fallback in case Gemini hits a rate limit
    if (error?.message?.includes('quota') || error?.status === 429) {
      console.log('⚠️ Gemini Quota Exceeded. Using MOCK transcription.');
      return "This is a mock transcription because the API quota was exceeded. During the meeting, we discussed the new UI design, specifically focusing on the login and signup flows. We decided to implement Google Auth and ensure the password fields have a toggle visibility icon. Action item for William: finalize the settings page UI by tomorrow. Action item for Sarah: test the new recording features on a physical device. Priority is high.";
    }
    
    throw new Error('Transcription failed');
  }
};
