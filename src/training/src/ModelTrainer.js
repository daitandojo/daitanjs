// training/src/ModelTrainer.js
/**
 * @file A high-level class for orchestrating the training of a TensorFlow.js model.
 * @module @daitanjs/training/ModelTrainer
 */
import * as tf from '@tensorflow/tfjs-node';
import { getLogger, isTensorFlowSupported } from '@daitanjs/development';
import { DaitanConfigurationError, DaitanOperationError } from '@daitanjs/error';

const trainerLogger = getLogger('daitan-model-trainer');

/**
 * @typedef {Object} TrainingHistory
 * @property {number[]} loss - The loss value at each epoch.
 * @property {number[]} acc - The accuracy value at each epoch (for classification).
 * @property {number[]} val_loss - The validation loss value at each epoch.
 * @property {number[]} val_acc - The validation accuracy value at each epoch.
 */

export class ModelTrainer {
  /**
   * @param {tf.Sequential | tf.LayersModel} model - A TensorFlow.js model to be trained.
   */
  constructor(model) {
    if (!isTensorFlowSupported()) {
      throw new DaitanConfigurationError(
        'TensorFlow.js is not supported on this system\'s CPU architecture. Model training cannot proceed.'
      );
    }
    if (!model || typeof model.fit !== 'function') {
      throw new DaitanConfigurationError('A valid TensorFlow.js model instance must be provided.');
    }
    this.model = model;
    this.logger = trainerLogger;
    this.logger.info('ModelTrainer initialized.');
    this.model.summary(); // Print the model summary to the console
  }

  /**
   * Prepares data for training by converting arrays of numbers into TensorFlow Tensors.
   * @param {object} params
   * @param {number[][]} params.features - The input features for the model.
   * @param {number[] | number[][]} params.labels - The corresponding labels.
   * @returns {{xs: tf.Tensor, ys: tf.Tensor}} The prepared tensors.
   */
  prepareData({ features, labels }) {
    this.logger.debug('Preparing data and converting to tensors...');
    return tf.tidy(() => {
      const xs = tf.tensor2d(features);
      const ys = Array.isArray(labels[0]) ? tf.tensor2d(labels) : tf.tensor1d(labels);
      this.logger.info(`Data prepared. Input shape: [${xs.shape}], Label shape: [${ys.shape}]`);
      return { xs, ys };
    });
  }

  /**
   * Trains the model on the provided data.
   * @param {object} params
   * @param {tf.Tensor} params.trainData - The training features tensor (xs).
   * @param {tf.Tensor} params.trainLabels - The training labels tensor (ys).
   * @param {object} [params.fitConfig={}] - Configuration for the model.fit() call. See TF.js docs.
   * @returns {Promise<TrainingHistory>} The training history object from TensorFlow.js.
   */
  async train({ trainData, trainLabels, fitConfig = {} }) {
    const {
      epochs = 10,
      batchSize = 32,
      validationSplit = 0.1,
      callbacks = [],
      ...rest
    } = fitConfig;

    this.logger.info(`Starting model training...`, { epochs, batchSize, validationSplit });

    // Add a default logging callback
    const loggingCallback = new tf.CustomCallback({
      onEpochEnd: (epoch, logs) => {
        this.logger.info(`Epoch ${epoch + 1}/${epochs} - Loss: ${logs.loss.toFixed(4)}, Accuracy: ${logs.acc?.toFixed(4)}, Val Loss: ${logs.val_loss?.toFixed(4)}, Val Acc: ${logs.val_acc?.toFixed(4)}`);
      },
    });

    try {
      const history = await this.model.fit(trainData, trainLabels, {
        epochs,
        batchSize,
        validationSplit,
        callbacks: [loggingCallback, ...callbacks],
        ...rest,
      });
      this.logger.info('Model training completed successfully.');
      return history.history;
    } catch (error) {
      this.logger.error(`Model training failed: ${error.message}`);
      throw new DaitanOperationError(`TensorFlow.js training failed: ${error.message}`, {}, error);
    }
  }

  /**
   * Evaluates the model on a test dataset.
   * @param {tf.Tensor} testData - The test features tensor.
   * @param {tf.Tensor} testLabels - The test labels tensor.
   * @returns {Promise<tf.Scalar | tf.Scalar[]>} The evaluation result (e.g., loss and accuracy).
   */
  async evaluate(testData, testLabels) {
    this.logger.info('Evaluating model performance on test data...');
    const result = this.model.evaluate(testData, testLabels);
    // The result can be a single scalar (loss) or an array of scalars [loss, metric]
    const resultData = Array.isArray(result) ? await Promise.all(result.map(s => s.data())) : [await result.data()];
    this.logger.info('Model evaluation complete.', { result: resultData });
    return result;
  }

  /**
   * Saves the trained model to a specified path.
   * @param {string} savePath - The path to save the model to (e.g., 'file://./my-model').
   * @returns {Promise<tf.io.SaveResult>}
   */
  async saveModel(savePath) {
    this.logger.info(`Saving model to: ${savePath}`);
    if (!savePath.startsWith('file://')) {
        this.logger.warn("The savePath does not start with 'file://'. Ensure the path is a valid TF.js IO handler.");
    }
    const saveResult = await this.model.save(savePath);
    this.logger.info('Model saved successfully.', { saveResult });
    return saveResult;
  }
}