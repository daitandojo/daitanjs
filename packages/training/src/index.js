// training/src/index.js
/**
 * @file Main entry point for the @daitanjs/training package.
 * @module @daitanjs/training
 *
 * @description
 * This package provides high-level utilities and classes for training machine learning
 * models, primarily using TensorFlow.js. It aims to simplify the process of preparing
 * data, defining models, running training loops, and saving the results.
 */
import { getLogger } from '@daitanjs/development';

const trainingIndexLogger = getLogger('daitan-training-index');

trainingIndexLogger.debug(
  'Exporting DaitanJS Training module functionalities...'
);

// Export the main ModelTrainer class
export { ModelTrainer } from './ModelTrainer.js';

// As this package evolves, we could add more exports:
// export * from './data-preprocessing.js'; // For data normalization, tokenization, etc.
// export * from './model-definitions.js'; // For pre-defined model architectures

trainingIndexLogger.info('DaitanJS Training module exports ready.');
