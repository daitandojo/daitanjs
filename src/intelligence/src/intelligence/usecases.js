import { generateIntelligence } from './generate.js';
import { construct } from './promptConstruction.js';

const checkIntelligence = async () => {
  const instruction = `
    Give me an optimistic wise quote from a Christian scientist.
    Respond in the following format: { "quote": "<string>", "author": "<string>" }`;
  return answerQuestion({ instruction });
};

export async function fuzzyCompare(
  arrayOfStrings,
  targetString,
  specificInstruction
) {
  const concatenatedStrings = arrayOfStrings.join('. ');

  if (!specificInstruction) {
    specificInstruction = `
      You are an experienced event and topic analyst.
    `;
  }

  const messages = [
    {
      role: 'system',
      content: `${specificInstruction} 
      Compare the following string to the given list
      and determine if the new string is already sufficiently covered.
      Provide a JSON response containing the likelihood the new string is already covered 
      (0 for none, 100 for very likely), and return the closest matching string.
      Format of your response:
      { "likelihood": <number>, "alreadyIn": <string> }`,
    },
    {
      role: 'user',
      content: `New string: "${targetString}". List of strings: "${concatenatedStrings}".`,
    },
  ];

  try {
    const response = await generateIntelligence({
      model: 'gpt-4o-mini',
      messages,
      summary: 'Fuzzy comparison of strings',
      max_tokens: 500,
    });

    return response;
  } catch (error) {
    console.error('Error during fuzzy comparison:', error);
    return { error: 'Failed to perform fuzzy comparison' };
  }
}

const generateStory = async ({
  genre,
  setting,
  mainCharacter,
  wordCount = 500,
}) => {
  const instruction = `
    You are a creative writer skilled in various genres.
    Write a ${wordCount}-word story in the ${genre} genre, set in ${setting}, with the following main character: ${mainCharacter}`;

  return answerQuestion({ instruction });
};

const answerQuestion = async ({ instruction }) => {
  if (
    !instruction ||
    typeof instruction !== 'string' ||
    instruction.trim() === ''
  ) {
    throw new Error(
      'Invalid instruction provided. Please provide a non-empty string.'
    );
  }

  instruction += `\n\nRespond exclusively in a JSON format.`;

  const messages = construct({ instruction });

  try {
    const response = await generateIntelligence({ messages });
    if (Object.keys(response).length === 0) {
      throw new Error('Failed to generate a valid response.');
    }
    return response;
  } catch (error) {
    console.error('Error generating answer:', error);
    return { error: 'Failed to generate an answer.' };
  }
};

const summarizeText = async ({ text, maxLength = 100 }) => {
  const instruction =
    'You are a skilled summarizer. Provide a concise summary of the given text.';
  const prompt = `Summarize the following text in ${maxLength} words or less:\n\n${text}`;
  const messages = construct({ instruction, prompt });
  return generateIntelligence({ messages, max_tokens: maxLength * 2 });
};

const analyzeSentiment = async ({ text }) => {
  const instruction =
    'You are a sentiment analysis expert. Analyze the sentiment of the given text and provide a detailed breakdown.';
  const prompt = `Analyze the sentiment of the following text:\n\n${text}\n\nProvide a breakdown including overall sentiment (positive, negative, or neutral), confidence level, and key sentiment indicators.`;
  const messages = construct({ instruction, prompt });
  const response = await generateIntelligence({ messages });
  return JSON.parse(response);
};

const intelligenceFunction = async ({ instruction }) => {
  const prompt = `
    Answer this prompt: ${instruction} in the following
    format: {"answer": <string>}  
  `;
  const messages = construct({ prompt });
  const response = await generateIntelligence({ messages });
  return response.answer;
};

export {
  intelligenceFunction,
  analyzeSentiment,
  checkIntelligence,
  generateStory,
  answerQuestion,
  summarizeText,
};
