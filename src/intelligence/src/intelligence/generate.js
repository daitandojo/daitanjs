import { query } from '@daitanjs/apiqueries';
import { isValidJSON } from '@daitanjs/validation';
import { cleanJSONString } from '@daitanjs/manipulation';
import { construct } from './promptConstruction.js';

const headers = {
  Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
  'Content-Type': 'application/json',
};

const generateIntelligence = async ({
  messages = [],
  model = process.env.OPENAI_DEFAULT_MODEL || 'gpt-4o-mini',
  summary = 'Call to OpenAI for analysis',
  temperature = 1,
  max_tokens = 600,
  responseFormat = 'json',
}) => {
  console.log(`Elaborating query '${summary}'`);

  if (!process.env.OPENAI_API_KEY) {
    console.error('Error: No OpenAI API key provided.');
    return { error: 'No API key provided' };
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
  };

  const data = { model, messages, temperature, max_tokens };
  const maxRetries = 3;

  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log(`Attempt ${i + 1} to call OpenAI API...`);

      const response = await query({
        url: 'https://api.openai.com/v1/chat/completions',
        data,
        headers,
        timeout: 60000,
      });

      if (!response || !response.choices) {
        throw new Error('Malformed response received from OpenAI API.');
      }

      const content = response.choices[0].message.content;

      if (responseFormat !== 'json') {
        return content; // Return raw content if not expecting JSON.
      }

      // Clean and validate the JSON response
      const cleanJSON = cleanJSONString(content);
      const { isValid, json, error } = isValidJSON(cleanJSON);

      if (isValid) {
        return json; // Return valid JSON response
      }

      console.warn(`Invalid JSON (Attempt ${i + 1}), retrying:`, error);
      console.warn('Response received:');
      console.warn(cleanJSON);
    } catch (error) {
      if (error.response) {
        // HTTP error responses
        const { status, data } = error.response;
        switch (status) {
          case 400:
            console.error(
              `Error 400 (Bad Request) during API call (Attempt ${i + 1}):`,
              data.error.message
            );
            return { error: 'Bad request - Invalid data provided.' };
          case 401:
            console.error(
              `Error 401 (Unauthorized) during API call (Attempt ${i + 1}):`,
              data.error.message
            );
            return {
              error:
                'Unauthorized - Invalid API key or insufficient permissions.',
            };
          case 403:
            console.error(
              `Error 403 (Forbidden) during API call (Attempt ${i + 1}):`,
              data.error.message
            );
            return {
              error: 'Forbidden - You do not have access to this resource.',
            };
          case 404:
            console.error(
              `Error 404 (Not Found) during API call (Attempt ${i + 1}):`,
              data.error.message
            );
            return {
              error: 'Not Found - The requested resource could not be found.',
            };
          case 429:
            console.warn(
              `Error 429 (Too Many Requests) during API call (Attempt ${
                i + 1
              }):`,
              data.error.message
            );
            console.warn('Retrying after hitting rate limit...');
            break; // Retry after rate limiting
          case 500:
            console.error(
              `Error 500 (Internal Server Error) during API call (Attempt ${
                i + 1
              }):`,
              data.error.message
            );
            break; // Retry if server error
          default:
            console.error(
              `Error ${status} during API call (Attempt ${i + 1}):`,
              data.error.message
            );
            return {
              error: `Unexpected error occurred: ${data.error.message}`,
            };
        }
      } else if (error.request) {
        // Request was made, but no response was received
        console.error(
          `No response received from OpenAI API (Attempt ${i + 1}):`,
          error.message
        );
      } else {
        // Something happened in setting up the request
        console.error(
          `Error setting up API call (Attempt ${i + 1}):`,
          error.message
        );
        return { error: `Setup error: ${error.message}` };
      }
    }
  }

  // Return failure message after all retry attempts
  return { error: 'Failed to retrieve a valid response after 3 attempts' };
};

/**
 * Checks if the OpenAI connection is working by generating a positive quote
 * from a Christian scientist.
 * @returns {Promise<Object>} The API response with the quote.
 */
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

/**
 * Generates a creative story based on given prompts.
 * @param {Object} options - Options for story generation.
 * @param {string} options.genre - The genre of the story.
 * @param {string} options.setting - The setting of the story.
 * @param {string} options.mainCharacter - Description of the main character.
 * @param {number} [options.wordCount=500] - Desired word count for the story.
 * @returns {Promise<string>} The generated story.
 */
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

/**
 * Answers a given question or follows an instruction.
 * @param {string} options.instruction - The question to answer.
 * @returns {Promise<object>} The generated answer.
 */
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

  // Adding specific response format expectation for better parsing.
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

/**
 * Summarizes a given text using the AI.
 * @param {string} text - The text to summarize.
 * @param {number} [maxLength=100] - Maximum length of the summary in words.
 * @returns {Promise<string>} The generated summary.
 */
const summarizeText = async ({ text, maxLength = 100 }) => {
  const instruction =
    'You are a skilled summarizer. Provide a concise summary of the given text.';
  const prompt = `Summarize the following text in ${maxLength} words or less:\n\n${text}`;
  const messages = construct({ instruction, prompt });
  return generateIntelligence({ messages, max_tokens: maxLength * 2 });
};

/**
 * Analyzes the sentiment of a given text.
 * @param {string} text - The text to analyze.
 * @returns {Promise<Object>} An object containing sentiment analysis results.
 */
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
  generateIntelligence,
  intelligenceFunction,
  analyzeSentiment,
  checkIntelligence,
  generateStory,
  answerQuestion,
  summarizeText,
};
