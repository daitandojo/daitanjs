// intelligence/src/intelligence/rag/chromaVectorStoreAdapter.js
/**
 * @file Adapter for interacting with a ChromaDB vector store using LangChain.
 * @module @daitanjs/intelligence/rag/chromaVectorStoreAdapter
 */
import { Chroma } from '@langchain/community/vectorstores/chroma';
import { OpenAIEmbeddings } from '@langchain/openai';
import { getLogger } from '@daitanjs/development';
import { getConfigManager } from '@daitanjs/config';
import {
  DaitanConfigurationError,
  DaitanOperationError,
} from '@daitanjs/error';
import { getOrInitializeChromaClient } from './chromaClient.js';

const adapterLogger = getLogger('daitan-chroma-adapter');

/**
 * @implements {import('./vectorStoreAdapterInterface.js').IVectorStoreAdapter}
 */
export class ChromaVectorStoreAdapter {
  constructor({ collectionName, url, embeddings, verbose }) {
    if (!collectionName) {
      throw new DaitanConfigurationError(
        'ChromaVectorStoreAdapter: collectionName is required.'
      );
    }
    this.collectionName = collectionName;
    this.initialConfig = { url, embeddings, verbose };
    this.isInitialized = false;
    this.directClient = null;
    this.langchainStoreInstance = null;
  }

  /**
   * Initializes the adapter on its first use. This lazy initialization
   * prevents unnecessary connections and configuration lookups.
   * @private
   */
  async _lazyInitialize() {
    if (this.isInitialized) return;

    const configManager = getConfigManager();
    this.verbose =
      this.initialConfig.verbose ??
      configManager.get('CHROMA_ADAPTER_VERBOSE', false);
    this.url =
      this.initialConfig.url ||
      `http://${configManager.get(
        'CHROMA_HOST',
        'localhost'
      )}:${configManager.get('CHROMA_PORT', '8000')}`;
    this.embeddings =
      this.initialConfig.embeddings ||
      this._resolveDefaultEmbeddings(configManager);

    if (!this.embeddings) {
      throw new DaitanConfigurationError(
        'Embeddings must be provided or OpenAI default must be configurable (OPENAI_API_KEY is missing).'
      );
    }

    // Use the factory to get a pre-initialized and tested direct client
    this.directClient = await getOrInitializeChromaClient();

    // The LangChain Chroma class can now be instantiated. It will use the
    // same underlying connection pool as the directClient if configured correctly.
    this.langchainStoreInstance = new Chroma(this.embeddings, {
      collectionName: this.collectionName,
      url: this.url,
    });

    this.isInitialized = true;
    adapterLogger.info(
      `ChromaVectorStoreAdapter for "${this.collectionName}" has been initialized on first use.`
    );
  }

  /**
   * Creates a default OpenAI embeddings instance if none is provided.
   * @private
   */
  _resolveDefaultEmbeddings(configManager) {
    const apiKey = configManager.get('OPENAI_API_KEY');
    if (!apiKey) {
      adapterLogger.warn(
        'Cannot create default OpenAIEmbeddings: OPENAI_API_KEY is not configured.'
      );
      return null;
    }

    const ragEmbeddingModel = configManager.get(
      'RAG_EMBEDDING_MODEL_OPENAI',
      'text-embedding-3-small'
    );
    // LangChain's OpenAIEmbeddings constructor correctly uses 'model'
    return new OpenAIEmbeddings({
      apiKey,
      model: ragEmbeddingModel,
    });
  }

  async addDocuments(documents, options = {}) {
    await this._lazyInitialize();
    try {
      return await this.langchainStoreInstance.addDocuments(
        documents,
        options.ids ? { ids: options.ids } : undefined
      );
    } catch (error) {
      throw new DaitanOperationError(
        `Failed to add documents to collection "${this.collectionName}": ${error.message}`,
        { collectionName: this.collectionName },
        error
      );
    }
  }

  async similaritySearchWithScore(query, k = 4, filter) {
    await this._lazyInitialize();
    try {
      return await this.langchainStoreInstance.similaritySearchWithScore(
        query,
        k,
        filter
      );
    } catch (error) {
      throw new DaitanOperationError(
        `Failed to perform similarity search in collection "${this.collectionName}": ${error.message}`,
        { collectionName: this.collectionName, query, k },
        error
      );
    }
  }

  async collectionExists() {
    await this._lazyInitialize();
    try {
      // Use the direct client for administrative tasks like checking existence.
      await this.directClient.getCollection({ name: this.collectionName });
      return true;
    } catch (error) {
      const errorMessage = String(error.message).toLowerCase();
      // ChromaDB's error message for non-existent collections can vary slightly.
      if (
        errorMessage.includes('not found') ||
        errorMessage.includes('does not exist')
      ) {
        return false;
      }
      // Re-throw other errors (e.g., connection issues)
      throw new DaitanOperationError(
        `Failed to check for collection "${this.collectionName}": ${error.message}`,
        { host: this.url, collectionName: this.collectionName },
        error
      );
    }
  }

  async deleteCollection() {
    await this._lazyInitialize();
    try {
      await this.directClient.deleteCollection({ name: this.collectionName });
      // Reset the adapter state after successful deletion
      this.isInitialized = false;
      this.langchainStoreInstance = null;
      adapterLogger.info(
        `Collection "${this.collectionName}" deleted successfully.`
      );
    } catch (error) {
      const errorMessage = String(error.message).toLowerCase();
      if (
        !errorMessage.includes('not found') &&
        !errorMessage.includes('does not exist')
      ) {
        throw new DaitanOperationError(
          `Failed to delete Chroma collection "${this.collectionName}": ${error.message}`,
          { collectionName: this.collectionName },
          error
        );
      }
      // If collection doesn't exist, it's a success from the user's perspective.
      adapterLogger.info(
        `Collection "${this.collectionName}" was already deleted or doesn't exist.`
      );
    }
  }

  async getCollectionInfo() {
    await this._lazyInitialize();
    try {
      const collection = await this.directClient.getCollection({
        name: this.collectionName,
      });
      const count = await collection.count();
      return {
        name: collection.name,
        id: collection.id,
        count,
        metadata: collection.metadata,
      };
    } catch (error) {
      throw new DaitanOperationError(
        `Failed to get collection info for "${this.collectionName}": ${error.message}`,
        { collectionName: this.collectionName },
        error
      );
    }
  }

  async clearCollection() {
    await this._lazyInitialize();
    try {
      const collection = await this.directClient.getCollection({
        name: this.collectionName,
      });
      // Get all IDs from the collection to delete them.
      const result = await collection.get();
      if (result.ids && result.ids.length > 0) {
        await collection.delete({ ids: result.ids });
        adapterLogger.info(
          `Cleared ${result.ids.length} documents from collection "${this.collectionName}".`
        );
      } else {
        adapterLogger.info(
          `Collection "${this.collectionName}" is already empty.`
        );
      }
    } catch (error) {
      throw new DaitanOperationError(
        `Failed to clear collection "${this.collectionName}": ${error.message}`,
        { collectionName: this.collectionName },
        error
      );
    }
  }

  async getLangchainStore() {
    await this._lazyInitialize();
    return this.langchainStoreInstance;
  }
}
