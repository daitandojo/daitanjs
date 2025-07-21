// intelligence/src/intelligence/rag/embed.js
/**
 * @file Provides the high-level loadAndEmbedFile function for the RAG system.
 * @module @daitanjs/intelligence/rag/embed
 */
import { getLogger } from '@daitanjs/development';
import { getConfigManager } from '@daitanjs/config';
import { loadDocumentsFromFile } from './documentLoader.js';
import { embedChunks } from './vectorStoreFactory.js';
import { autoTagDocument } from '../metadata/index.js';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { DaitanInvalidInputError, DaitanOperationError } from '@daitanjs/error';
import { generateIntelligence } from '../core/llmOrchestrator.js';

const embedLogger = getLogger('daitan-rag-embed');

/**
 * Generates multiple query representations for a single text chunk to improve retrieval.
 * @private
 */
async function generateMultiVectorRepresentations(chunkText, verbose) {
  if (!chunkText || chunkText.trim().length < 50) { // Avoid processing tiny chunks
    return { summary: null, hypothetical_questions: [] };
  }

  try {
    const { response, usage } = await generateIntelligence({
      prompt: {
        system: {
          persona:
            'You are an expert at distilling information for retrieval systems.',
          task: 'For the given text, create a very concise one-sentence summary and generate 2-3 diverse, high-quality hypothetical questions that this text would be the perfect answer for. The questions should cover different aspects of the text.',
          outputFormat:
            'You MUST respond with a single JSON object with keys: "summary" (string) and "hypothetical_questions" (array of strings).',
        },
        user: `TEXT TO ANALYZE:\n"""\n${chunkText}\n"""`,
      },
      config: {
        response: { format: 'json' },
        llm: { target: 'FAST_TASKER', temperature: 0.2, maxTokens: 600 },
        verbose,
        trackUsage: true,
      },
      metadata: { summary: 'Multi-vector representation generation' },
    });
    // Log usage if needed
    if (verbose && usage) {
      embedLogger.debug('Multi-vector LLM usage:', usage);
    }
    return {
      summary: response?.summary || null,
      hypothetical_questions: response?.hypothetical_questions || [],
    };
  } catch (error) {
    embedLogger.warn(
      `Could not generate multi-vector representations for chunk: ${error.message}`
    );
    return { summary: null, hypothetical_questions: [] };
  }
}

export const loadAndEmbedFile = async ({
  filePath,
  customMetadata = {},
  options = {},
}) => {
  const configManager = getConfigManager();
  const {
    chunkSize = 1000,
    chunkOverlap = 200,
    generateAiMetadata = true,
    useMultiVector = false,
    localVerbose,
    embedOptions = {},
  } = options;
  const collectionName =
    options.collectionName || configManager.get('RAG_DEFAULT_COLLECTION_NAME');
  const effectiveVerbose =
    localVerbose ??
    (configManager.get('RAG_EMBED_VERBOSE', false) ||
    configManager.get('DEBUG_INTELLIGENCE', false));

  if (!filePath || typeof filePath !== 'string' || !filePath.trim()) {
    throw new DaitanInvalidInputError('A valid filePath string is required.');
  }

  embedLogger.info(`Starting loadAndEmbedFile for: "${filePath}"`, {
    useMultiVector,
    collectionName,
  });

  const docs = await loadDocumentsFromFile(filePath, {
    localVerbose: effectiveVerbose,
  });
  if (!docs || docs.length === 0) {
    embedLogger.warn(`No documents were loaded from "${filePath}". Aborting.`);
    return {
      success: false,
      message: `No documents loaded from file: ${filePath}`,
    };
  }

  let aiMetadata = {};
  if (generateAiMetadata) {
    embedLogger.info(`Generating AI metadata for "${filePath}"...`);
    const rawTextForMetadata = docs.map((doc) => doc.pageContent).join('\n\n');
    if (rawTextForMetadata) {
      const { metadata, llmUsage } = await autoTagDocument(rawTextForMetadata, {
        config: { verbose: effectiveVerbose, trackUsage: true },
      });
      aiMetadata = metadata;
      if (effectiveVerbose && llmUsage) {
        embedLogger.debug('AI metadata generation usage:', llmUsage);
      }
    }
  }

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap,
  });
  const chunks = await splitter.splitDocuments(docs);
  embedLogger.info(
    `Split file "${filePath}" into ${chunks.length} initial chunks.`
  );

  let finalDocsToEmbed = [];
  if (useMultiVector) {
    embedLogger.info(
      `Generating multi-vector representations for ${chunks.length} chunks...`
    );
    // Use Promise.all for concurrency
    const representationPromises = chunks.map(async (chunk, index) => {
      // Add the raw chunk itself
      chunk.metadata = { ...chunk.metadata, chunk_type: 'raw', original_chunk_index: index };
      
      const representations = await generateMultiVectorRepresentations(
        chunk.pageContent,
        effectiveVerbose
      );

      const generatedDocs = [];
      // Add summary chunk
      if (representations.summary) {
        generatedDocs.push({
          pageContent: representations.summary,
          metadata: { ...chunk.metadata, chunk_type: 'summary' },
        });
      }
      // Add hypothetical question chunks
      if (representations.hypothetical_questions.length > 0) {
        representations.hypothetical_questions.forEach((question) => {
          generatedDocs.push({
            pageContent: question,
            metadata: { ...chunk.metadata, chunk_type: 'hypothetical_question' },
          });
        });
      }
      return [chunk, ...generatedDocs];
    });

    const nestedResults = await Promise.all(representationPromises);
    finalDocsToEmbed = nestedResults.flat();
    
    embedLogger.info(
      `Finished generating representations. Total items to embed: ${finalDocsToEmbed.length}`
    );
  } else {
    finalDocsToEmbed = chunks;
  }

  // Add combined metadata to all chunks
  finalDocsToEmbed.forEach((chunk) => {
    chunk.metadata = { ...chunk.metadata, ...customMetadata, ...aiMetadata };
  });
  
  if (finalDocsToEmbed.length === 0) {
      throw new DaitanOperationError('No document chunks were produced for embedding.', {filePath});
  }

  await embedChunks(finalDocsToEmbed, {
    collectionName,
    localVerbose: effectiveVerbose,
    ...embedOptions,
  });
  embedLogger.info(
    `Successfully processed and embedded ${finalDocsToEmbed.length} items from "${filePath}" into "${collectionName}".`
  );

  return {
    success: true,
    message: `Successfully embedded ${finalDocsToEmbed.length} items.`,
    initialChunks: chunks.length,
    totalEmbeddings: finalDocsToEmbed.length,
    collectionName,
  };
};