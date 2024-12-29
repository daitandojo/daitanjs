import { query } from '@daitanjs/apiqueries';
import { isValidJSON } from '@daitanjs/validation';
import { cleanJSONString } from '@daitanjs/manipulation';

const getOpenAIKey = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OpenAI API key. Ensure OPENAI_API_KEY is set.");
  }
  return apiKey;
};

const constructHeaders = (apiKey) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${apiKey}`,
});

const callOpenAI = async ({ url, data, headers, verbose }) => {
  if (verbose) console.log("Making API request...");
  return await query({ url, data, headers, timeout: 60000, verbose });
};

const generateIntelligence = async (options) => {
  const {
    messages = [],
    model = process.env.OPENAI_DEFAULT_MODEL || "gpt-4o-mini",
    summary = "Call to OpenAI for analysis",
    temperature = 1,
    max_tokens = 600,
    responseFormat = "json",
    verbose = false,
    apiKey = getOpenAIKey(),
  } = options;

  if (verbose) console.log(`Elaborating query '${summary}'`);

  const headers = constructHeaders(apiKey);
  const data = { model, messages, temperature, max_tokens };

  for (let i = 0; i < 3; i++) {
    try {
      const response = await callOpenAI({
        url: "https://api.openai.com/v1/chat/completions",
        data,
        headers,
        verbose,
      });

      if (!response || !response.choices) {
        throw new Error("Malformed response received from OpenAI API.");
      }

      const content = response.choices[0].message.content;
      if (responseFormat !== "json") return content;

      const cleanJSON = cleanJSONString(content);
      const { isValid, json } = isValidJSON(cleanJSON);
      if (isValid) return json;

      console.warn("Invalid JSON received. Retrying...");
    } catch (error) {
      handleAPIError(error, i + 1);
    }
  }

  return { error: "Failed to retrieve a valid response after retries." };
};

export {
  generateIntelligence,
};
