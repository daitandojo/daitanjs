// intelligence/src/intelligence/tools/ragTool.js
import { createDaitanTool } from '../core/toolFactory.js'; // CORRECTED: Import from the new 'core' location
import { z } from 'zod';
import { askWithRetrieval } from '../rag/retrieval.js';
import { DaitanNotFoundError } from '@daitanjs/error';

const RagToolInputSchema = z
  .string()
  .describe(
    "The user's question or the specific sub-query to research within the document."
  );

export const ragTool = createDaitanTool(
  'knowledge_base_tool',
  `Queries the internal knowledge base (a specific PDF document) to answer questions. 
This is the primary tool for finding information contained within the document.
The input is the direct question string to search for. 
The tool can perform two types of queries: a 'simple' query for direct questions, and an 'analytical' query for complex questions that require summarizing or analyzing data across the document. 
It can also optionally blend its findings with general knowledge.`,
  async (input) => {
    // The input is a string, which is always valid if it exists
    const query = input;

    const analyticalKeywords = [
      'how many',
      'count',
      'list all',
      'what are the',
      'categorize',
    ];
    const useAnalysisPrompt = analyticalKeywords.some((keyword) =>
      query.toLowerCase().includes(keyword)
    );

    const result = await askWithRetrieval(query, {
      useAnalysisPrompt: useAnalysisPrompt,
      topK: 7,
    });

    if (
      !result.text ||
      result.text.toLowerCase().includes("i don't have enough information")
    ) {
      return `The knowledge base did not contain a definitive answer for the query: "${query}". Try rephrasing or using a web search.`;
    }

    return `Result from knowledge base: ${result.text}`;
  },
  RagToolInputSchema
);
