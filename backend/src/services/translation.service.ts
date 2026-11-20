import Groq from 'groq-sdk';
import { MODELS } from '../config/models';

export const translateContent = async (data: any, targetLanguage: string): Promise<any> => {
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const prompt = `
      Translate the following JSON data into ${targetLanguage}.
      Maintain the same JSON structure. ONLY translate the values.
      
      DATA:
      ${JSON.stringify(data)}
    `;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: MODELS.fast,
      response_format: { type: 'json_object' }
    });

    const content = chatCompletion.choices[0]?.message?.content;
    return JSON.parse(content || '{}');
  } catch (error) {
    console.error('Groq Translation failed:', error);
    throw error;
  }
};
