import { construct } from '../intelligence/OpenAI';
import { generateIntelligenceByAPI } from '../intelligenceByAPI';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve('/home/mark/Repos/.env') });

export const translate = async ({ language, body }) => {
  // Helper function to handle different data types
  const translateData = async (data) => {
    if (typeof data === 'string') {
      const instruction = `Translate the following text into the language identified by ISO as ${language}:`;
      const prompt = data;
      const messages = construct({ instruction, prompt });
      const response = await generateIntelligenceByAPI({
        model: 'gpt-4o-mini',
        summary: 'Translation request',
        messages,
        temperature: 0.7,
        max_tokens: 512,
      });
      return response;
    } else if (Array.isArray(data)) {
      return Promise.all(data.map((item) => translateData(item)));
    } else if (typeof data === 'object') {
      return Object.keys(data).reduce(async (accP, key) => {
        const acc = await accP;
        const value = await translateData(data[key]);
        return { ...acc, [key]: value };
      }, Promise.resolve({}));
    } else {
      throw new Error('Unsupported data type');
    }
  };

  return translateData(body);
};
