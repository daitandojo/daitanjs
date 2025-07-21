// intelligence/src/intelligence/rag/memoryVectorStoreAdapter.js
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { OpenAIEmbeddings } from '@langchain/openai'; // Default embeddings
import { getLogger } from '@daitanjs/development';
import { getConfigManager } from '@daitanjs/config';
import {
  DaitanConfigurationError,
  DaitanOperationError,
} from '@daitanjs/error';
import { Document as LangchainDocument } from '@langchain/core/documents'; // For type hints

const memoryAdapterLogger = getLogger('daitan-memory-vstore-adapter'); // Service-specific logger

/**
 * Adapter for LangChain's in-memory vector store.
 * @implements {import('./vectorStoreAdapterInterface.js').IVectorStoreAdapter}
 */
export class MemoryVectorStoreAdapter {
  /**
   * @param {Object} [config={}]
   * @param {import('@langchain/core/embeddings').Embeddings} [config.embeddings] - LangChain embeddings instance.
   * @param {LangchainDocument[]} [config.initialDocuments=[]] - Optional documents to initialize with.
   * @param {boolean} [config.verbose] - Verbose logging for this instance. Defaults from ConfigManager.
   * @throws {DaitanConfigurationError} If embeddings cannot be configured.
   */
  constructor({
    embeddings, // Renamed from embeddingsInstance
    initialDocuments = [],
    verbose,
  } = {}) {
    const configManager = getConfigManager(); // Lazy-load
    this.verbose =
      verbose !== undefined
        ? verbose
        : configManager.get('MEMORY_ADAPTER_VERBOSE', false) ||
          configManager.get('DEBUG_INTELLIGENCE', false);

    this.embeddings = embeddings || this._resolveDefaultEmbeddings();

    if (!this.embeddings) {
      const errMsg =
        'MemoryVectorStoreAdapter: Embeddings must be provided, or OpenAI default embeddings must be configurable (requires OPENAI_API_KEY via ConfigManager).';
      memoryAdapterLogger.error(errMsg);
      throw new DaitanConfigurationError(errMsg);
    }

    /** @type {MemoryVectorStore | null} */
    this.store = null; // Lazy initialized or initialized with initialDocuments

    if (this.verbose) {
      memoryAdapterLogger.info(
        `MemoryVectorStoreAdapter initialized. Verbose: ${this.verbose}. Embeddings: ${this.embeddings.constructor.name}`
      );
    }

    if (initialDocuments && initialDocuments.length > 0) {
      // Fire-and-forget initialization with documents.
      // Methods using `this.store` will await `_ensureStoreIsInitialized`.
      this._initializeWithDocuments(initialDocuments).catch((err) => {
        memoryAdapterLogger.error(
          `MemoryVectorStoreAdapter: Background initialization with documents failed: ${err.message}`
        );
        // Store might remain null, subsequent operations will attempt to re-initialize an empty store.
      });
    }
  }

  /**
   * Sets the verbosity for this adapter instance.
   * @param {boolean} isVerbose
   */
  setVerbose(isVerbose) {
    this.verbose = isVerbose;
    memoryAdapterLogger.info(
      `MemoryVectorStoreAdapter verbosity set to: ${this.verbose}`
    );
  }

  _resolveDefaultEmbeddings() {
    const configManager = getConfigManager(); // Lazy-load
    const apiKey = configManager.get('OPENAI_API_KEY'); // Changed from getApiKeyForProvider
    if (!apiKey) {
      memoryAdapterLogger.warn(
        'MemoryVectorStoreAdapter: OPENAI_API_KEY not found via ConfigManager for default OpenAIEmbeddings.'
      );
      return null;
    }
    try {
      const ragEmbeddingModel = configManager.get('RAG_EMBEDDING_MODEL_OPENAI'); // Allow override
      const embeddingsConfig = { apiKey };
      if (ragEmbeddingModel) {
        embeddingsConfig.modelName = ragEmbeddingModel;
      }
      if (this.verbose)
        memoryAdapterLogger.debug(
          `Using OpenAIEmbeddings with model: ${
            ragEmbeddingModel || 'default (text-embedding-ada-002 or similar)'
          }`
        );
      return new OpenAIEmbeddings(embeddingsConfig);
    } catch (e) {
      memoryAdapterLogger.error(
        `Failed to instantiate default OpenAIEmbeddings: ${e.message}`
      );
      return null;
    }
  }

  async _initializeWithDocuments(documents) {
    // This method is typically called from constructor, which is not async.
    // However, MemoryVectorStore.fromDocuments IS async.
    // This means the constructor can't truly "wait" for this.
    // Operations relying on store must call _ensureStoreIsInitialized.
    if (this.store) {
      if (this.verbose)
        memoryAdapterLogger.debug(
          'MemoryVectorStore already initialized, skipping re-initialization with documents.'
        );
      return;
    }
    try {
      if (this.verbose)
        memoryAdapterLogger.debug(
          `MemoryVectorStore: Initializing via fromDocuments with ${documents.length} documents.`
        );
      this.store = await MemoryVectorStore.fromDocuments(
        documents,
        this.embeddings
      );
      if (this.verbose)
        memoryAdapterLogger.debug(
          `MemoryVectorStore initialized successfully with ${documents.length} documents.`
        );
    } catch (error) {
      memoryAdapterLogger.error(
        `MemoryVectorStoreAdapter: Error during fromDocuments initialization: ${error.message}`,
        { error_stack: error.stack?.substring(0, 300) }
      );
      // Don't throw here as it's background init from constructor; store remains null.
      // throw new DaitanOperationError('Failed to initialize MemoryVectorStore with documents', {}, error);
    }
  }

  async _ensureStoreIsInitialized() {
    if (!this.store) {
      if (this.verbose)
        memoryAdapterLogger.debug(
          'MemoryVectorStoreAdapter: Store not yet initialized. Lazily creating empty store now.'
        );
      try {
        // If _initializeWithDocuments failed or wasn't called, create an empty store.
        // MemoryVectorStore constructor is synchronous.
        this.store = new MemoryVectorStore(this.embeddings);
        if (this.verbose)
          memoryAdapterLogger.debug(
            'MemoryVectorStoreAdapter: Empty store created successfully.'
          );
      } catch (error) {
        memoryAdapterLogger.error(
          `MemoryVectorStoreAdapter: Error creating empty MemoryVectorStore instance: ${error.message}`,
          { error_stack: error.stack?.substring(0, 300) }
        );
        throw new DaitanOperationError(
          'Failed to create empty MemoryVectorStore',
          {},
          error
        );
      }
    }
  }

  async addDocuments(documents, options = {}) {
    if (!Array.isArray(documents) || documents.length === 0) {
      if (this.verbose)
        memoryAdapterLogger.info(
          'MemoryAdapter: No documents provided to add.'
        );
      return;
    }
    await this._ensureStoreIsInitialized(); // Ensures `this.store` is not null
    if (this.verbose)
      memoryAdapterLogger.info(
        `MemoryAdapter: Adding ${documents.length} documents.`
      );

    try {
      await this.store.addDocuments(
        documents,
        options.ids ? { ids: options.ids } : undefined
      );
      if (this.verbose)
        memoryAdapterLogger.debug(
          `MemoryAdapter: Successfully added ${documents.length} documents.`
        );
    } catch (error) {
      memoryAdapterLogger.error(
        `MemoryAdapter: Error adding documents: ${error.message}`,
        {
          numDocs: documents.length,
          error_stack: error.stack?.substring(0, 300),
        }
      );
      throw new DaitanOperationError(
        'Failed to add documents to MemoryVectorStore',
        {},
        error
      );
    }
  }

  async similaritySearchWithScore(query, k, filter) {
    await this._ensureStoreIsInitialized();
    const logContext = {
      queryPreview: String(query).substring(0, 70) + '...',
      k,
    };

    if (this.verbose) {
      memoryAdapterLogger.debug('MemoryAdapter: Similarity search started.', {
        ...logContext,
        filter: filter
          ? typeof filter === 'function'
            ? 'Function filter'
            : filter
          : 'None',
      });
    }

    let adaptedFilter = filter;
    if (
      filter &&
      typeof filter === 'object' &&
      !Array.isArray(filter) &&
      typeof filter !== 'function'
    ) {
      // Convert simple metadata object filter to a function for MemoryVectorStore
      adaptedFilter = (doc) => {
        for (const key in filter) {
          if (!doc.metadata || doc.metadata[key] !== filter[key]) return false;
        }
        return true;
      };
      if (this.verbose)
        memoryAdapterLogger.debug(
          'MemoryAdapter: Adapted object metadata filter to function for similaritySearch.'
        );
    } else if (typeof filter !== 'function' && filter !== undefined) {
      memoryAdapterLogger.warn(
        'MemoryAdapter: Filter provided is not a metadata object or function. It will be ignored by MemoryVectorStore for similaritySearchWithScore.',
        { filterType: typeof filter }
      );
      adaptedFilter = undefined;
    }

    try {
      const results = await this.store.similaritySearchWithScore(
        query,
        k,
        adaptedFilter
      );
      if (this.verbose)
        memoryAdapterLogger.debug(
          `MemoryAdapter: Similarity search returned ${results.length} results.`
        );
      return results; // Results are [Document, number][]
    } catch (error) {
      memoryAdapterLogger.error(
        `MemoryAdapter: Similarity search error: ${error.message}`,
        { ...logContext, error_stack: error.stack?.substring(0, 300) }
      );
      throw new DaitanOperationError(
        'Similarity search failed in MemoryVectorStore',
        logContext,
        error
      );
    }
  }

  async collectionExists(collectionNameIgnored) {
    // For MemoryVectorStore, the "collection" is the store instance itself.
    // If the store is initialized (even if empty), it "exists".
    // `collectionNameIgnored` because MemoryVectorStore doesn't have named collections.
    await this._ensureStoreIsInitialized(); // Ensure store is attempted to be created
    if (this.verbose)
      memoryAdapterLogger.debug(
        `MemoryAdapter: "collectionExists" check - returning ${!!this.store}.`
      );
    return !!this.store;
  }

  async ensureCollection(collectionNameIgnored, options = {}) {
    // For MemoryVectorStore, this just means ensuring the store is initialized.
    await this._ensureStoreIsInitialized();
    if (this.verbose)
      memoryAdapterLogger.debug(
        'MemoryAdapter: "ensureCollection" called. Store is ready or will be created.'
      );
  }

  async deleteCollection(collectionNameIgnored) {
    if (this.verbose)
      memoryAdapterLogger.info(
        'MemoryAdapter: "Deleting collection" - re-initializing to an empty store.'
      );
    try {
      this.store = new MemoryVectorStore(this.embeddings); // Create a new, empty instance
      if (this.verbose)
        memoryAdapterLogger.debug(
          'MemoryAdapter: Store re-initialized (effectively cleared).'
        );
    } catch (error) {
      memoryAdapterLogger.error(
        `MemoryAdapter: Error re-initializing store during deleteCollection: ${error.message}`,
        { error_stack: error.stack?.substring(0, 300) }
      );
      throw new DaitanOperationError(
        'Failed to clear/re-initialize MemoryVectorStore',
        {},
        error
      );
    }
  }

  async getLangchainStore() {
    await this._ensureStoreIsInitialized();
    return this.store;
  }
}
