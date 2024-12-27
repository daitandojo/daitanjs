import { PCA } from 'ml-pca';
import { kmeans } from 'ml-kmeans';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve('/home/mark/Repos/.env') });

const averageEmbeddings = (embeddings) => {
  if (embeddings.length === 0) return [];
  const sum = embeddings.reduce(
    (acc, curr) => acc.map((val, i) => val + curr[i]),
    new Array(embeddings[0].length).fill(0)
  );
  return sum.map(val => val / embeddings.length);
};

const interpolateEmbeddings = (embedding1, embedding2, alpha = 0.5) => {
  if (embedding1.length !== embedding2.length) throw new Error("Embeddings must be of the same length.");
  return embedding1.map((val, i) => val * (1 - alpha) + embedding2[i] * alpha);
};

const visualizeEmbeddings = (embeddings, dimensions = 2) => {
  const pca = new PCA(embeddings);
  return pca.predict(embeddings, { nComponents: dimensions });
};

const clusterEmbeddings = (embeddings, k = 5) => {
  const options = { maxIterations: 100 };
  return kmeans(embeddings, k, options);
};

export {
  averageEmbeddings,
  interpolateEmbeddings,
  visualizeEmbeddings,
  clusterEmbeddings
};
