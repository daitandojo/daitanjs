import { cosineSimilarity, getLogger, isTensorFlowSupported } from './utils.js';

const logger = getLogger('embedding-service');
const USE_TENSORFLOW = isTensorFlowSupported();

let tfModule = null;
const cache = new Map();

const loadTensorFlow = async () => {
  if (USE_TENSORFLOW && !tfModule) {
    try {
      tfModule = await import('@tensorflow/tfjs-node');
      logger.info('TensorFlow.js Node successfully loaded');
    } catch (error) {
      logger.error('TensorFlow.js Node could not be loaded:', error.message);
    }
  }
};

const generateEmbedding = async (target, config = {}) => {
  const model = config.model || 'text-embedding-ada-002';
  const headers = {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
  };

  const inputType = Array.isArray(target.inputs) ? 'batch' : 'single';
  const input = inputType === 'batch' ? target.inputs : [target.input];

  logger.info(`Creating ${inputType} embedding(s) for input(s)`);

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers,
      body: JSON.stringify({ input, model }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const responseData = await response.json();
    logger.info(`OpenAI API response: ${JSON.stringify(responseData)}`);

    if (responseData && responseData.data) {
      const embeddings = responseData.data.map((item) => item.embedding);
      return inputType === 'batch' ? embeddings : embeddings[0];
    } else {
      throw new Error('Invalid response structure from OpenAI API');
    }
  } catch (error) {
    logger.error(`Failed to generate embedding: ${error.message}`);
    throw new Error(`Failed to generate embedding: ${error.message}`);
  }
};

class EmbeddingCache {
  async getEmbedding(input, model) {
    const key = `${input}_${model}`;
    if (cache.has(key)) return cache.get(key);
    const embedding = await generateEmbedding({ input }, { model });
    cache.set(key, embedding);
    return embedding;
  }
}

class EmbeddingSearcher {
  constructor(collection) {
    this.collection = collection.filter(
      (doc) => Array.isArray(doc.embedding) && doc.embedding.length > 0,
    );
  }

  async loadTensorFlow() {
    await loadTensorFlow();
    if (USE_TENSORFLOW && tfModule) {
      logger.info('Creating embedding matrix...');
      this.embeddingMatrix = tfModule.tensor(
        this.collection.map((obj) => obj.embedding),
      );
      this.allEmbeddingsNorm = tfModule.norm(
        this.embeddingMatrix,
        'euclidean',
        -1,
      );
    }
  }

  search(embedding, threshold = 0.6, number = 10) {
    let similarities;

    if (USE_TENSORFLOW && tfModule) {
      const embeddingTensor = tfModule.tensor(embedding).expandDims(0);
      const dotProduct = tfModule.matMul(
        embeddingTensor,
        this.embeddingMatrix,
        false,
        true,
      );
      const embeddingNorm = tfModule.norm(embeddingTensor, 'euclidean');
      similarities = tfModule
        .div(dotProduct, tfModule.mul(embeddingNorm, this.allEmbeddingsNorm))
        .squeeze()
        .arraySync();
      embeddingTensor.dispose();
    } else {
      similarities = this.collection.map((doc) =>
        cosineSimilarity(doc.embedding, embedding),
      );
    }

    return this.collection
      .map((doc, index) => ({ ...doc, sim: similarities[index] }))
      .filter((doc) => doc.sim > threshold)
      .sort((a, b) => b.sim - a.sim)
      .slice(0, number);
  }

  dispose() {
    if (USE_TENSORFLOW && tfModule) {
      this.embeddingMatrix.dispose();
      this.allEmbeddingsNorm.dispose();
    }
  }
}

class CachedEmbeddingSearcher extends EmbeddingSearcher {
  constructor() {
    super([]);
    this.cachedData = null;
  }

  async loadData(fetchFunction, refresh = false, timeoutMs = 30000, pageSize = 100) {
    if (!refresh && this.cachedData) {
      logger.info('Data loaded from in-memory cache.');
      this.collection = this.cachedData;
      await this.loadTensorFlow();
      return this.cachedData;
    }

    logger.info('Loading data...');
    try {
      let allData = [];
      let page = 1;
      let hasMoreData = true;

      while (hasMoreData) {
        logger.info(`Fetching page ${page}...`);
        const pageData = await fetchFunction(page, pageSize);
        allData = allData.concat(pageData);
        hasMoreData = pageData.length === pageSize;
        page++;
      }

      this.cachedData = allData;
      this.collection = this.cachedData;
      await this.loadTensorFlow();

      return this.cachedData;
    } catch (error) {
      logger.error(`Error loading data: ${error.message}`);
      throw new Error(`Error loading data: ${error.message}`);
    }
  }
}

export {
  generateEmbedding,
  EmbeddingCache,
  EmbeddingSearcher,
  CachedEmbeddingSearcher,
};
