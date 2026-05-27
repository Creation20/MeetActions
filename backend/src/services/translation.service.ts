import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export const translateContent = async (data: any, targetLanguage: string) => {
  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-3.5-flash',
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            summary: { type: SchemaType.STRING },
            decisions: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
            transcript: { type: SchemaType.STRING },
            tasks: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  _id: { type: SchemaType.STRING },
                  title: { type: SchemaType.STRING },
                  description: { type: SchemaType.STRING },
                  owner: { type: SchemaType.STRING },
                  priority: { type: SchemaType.STRING }
                }
              }
            }
          }
        }
      }
    });

    const prompt = `Translate the following meeting content into ${targetLanguage}. Maintain the same structure and speaker labels in the transcript.
    
    Content:
    ${JSON.stringify(data)}
    `;

    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text());
  } catch (error) {
    console.error('Translation error:', error);
    throw new Error('Translation failed');
  }
};
