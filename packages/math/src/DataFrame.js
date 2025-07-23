// math/src/DataFrame.js
/**
 * @file Extends the Danfo.js DataFrame with DaitanJS-specific utilities.
 * @module @daitanjs/math/DataFrame
 */
import {
  DataFrame as DanfoDataFrame,
  Series as DanfoSeries,
} from 'danfojs-node';
import * as tf from '@tensorflow/tfjs-node';
import { getLogger, isTensorFlowSupported } from '@daitanjs/development';
import {
  DaitanConfigurationError,
  DaitanInvalidInputError,
  DaitanOperationError,
} from '@daitanjs/error';

const logger = getLogger('daitan-dataframe');

/**
 * A DaitanJS DataFrame, extending the capabilities of Danfo.js DataFrame
 * with integrated logging and machine learning data preparation methods.
 * @extends DanfoDataFrame
 */
export class DataFrame extends DanfoDataFrame {
  /**
   * Constructs a DaitanJS DataFrame.
   * @param {any} data - Data to create the DataFrame from (e.g., array of objects, 2D array).
   * @param {object} [options] - Options passed to the Danfo.js DataFrame constructor.
   */
  constructor(data, options) {
    if (!isTensorFlowSupported()) {
      throw new DaitanConfigurationError(
        "TensorFlow.js is not supported on this system's CPU architecture. DataFrame cannot be created."
      );
    }
    super(data, options);
    logger.info(
      `DaitanJS DataFrame created. Shape: [${this.shape[0]}, ${this.shape[1]}]`
    );
  }

  /**
   * A DaitanJS-specific method to pretty-print the DataFrame to the console.
   * @param {number} [rows=10] - The number of rows to display.
   */
  log(rows = 10) {
    logger.info(`DataFrame Preview (first ${rows} rows):`);
    this.head(rows).print();
  }

  /**
   * One-hot encodes a specified column, adding new columns to the DataFrame.
   * @param {string} columnName - The name of the categorical column to encode.
   * @returns {DataFrame} The DataFrame with the new one-hot encoded columns (for chaining).
   */
  oneHotEncode(columnName) {
    if (!this.columns.includes(columnName)) {
      throw new DaitanInvalidInputError(
        `Column "${columnName}" not found in DataFrame for one-hot encoding.`
      );
    }
    logger.debug(`Performing one-hot encoding on column: "${columnName}"`);
    const oneHot = this.getDummies({ columns: [columnName] });
    // `getDummies` returns a new DataFrame. We need to merge it back.
    // Danfo's `concat` can join dataframes.
    const originalWithoutColumn = this.drop({ columns: [columnName] });
    const newDfData = DanfoDataFrame.concat({
      dfList: [originalWithoutColumn, oneHot],
      axis: 1,
    });
    // To update the current instance, we must re-assign its internal properties
    this.$data = newDfData.$data;
    this.$index = newDfData.$index;
    this.$columns = newDfData.$columns;
    this.$dtypes = newDfData.$dtypes;

    logger.info(
      `Column "${columnName}" one-hot encoded. New columns: ${oneHot.columns.join(
        ', '
      )}`
    );
    return this;
  }

  /**
   * Normalizes a numerical column to a 0-1 range (Min-Max scaling).
   * @param {string} columnName - The name of the numerical column to normalize.
   * @returns {DataFrame} The DataFrame with the normalized column (for chaining).
   */
  normalize(columnName) {
    if (!this.columns.includes(columnName)) {
      throw new DaitanInvalidInputError(
        `Column "${columnName}" not found in DataFrame for normalization.`
      );
    }
    logger.debug(`Normalizing column: "${columnName}"`);
    const scaler = new danfo.MinMaxScaler();
    scaler.fit(this[columnName]);
    const scaledColumn = scaler.transform(this[columnName]);
    this.addColumn(columnName, scaledColumn, { inplace: true }); // Overwrite the original column
    logger.info(`Column "${columnName}" normalized using Min-Max scaling.`);
    return this;
  }

  /**
   * Converts the DataFrame into TensorFlow.js Tensors suitable for model training.
   * @param {object} options
   * @param {string} options.labelColumn - The name of the column to be used as the label (y).
   * @returns {{xs: tf.Tensor2D, ys: tf.Tensor}} An object containing feature (xs) and label (ys) tensors.
   */
  toTensors({ labelColumn }) {
    if (!this.columns.includes(labelColumn)) {
      throw new DaitanInvalidInputError(
        `Label column "${labelColumn}" not found in DataFrame.`
      );
    }
    logger.info(
      `Converting DataFrame to Tensors. Label column: "${labelColumn}"`
    );

    return tf.tidy(() => {
      const labels = this[labelColumn].tensor;
      const features = this.drop({ columns: [labelColumn] }).tensor;

      if (features.shape[1] === 0) {
        throw new DaitanOperationError(
          'No feature columns remaining after dropping the label column.'
        );
      }

      logger.debug(
        `Tensor conversion complete. Features shape: [${features.shape}], Labels shape: [${labels.shape}]`
      );
      return { xs: features, ys: labels };
    });
  }
}

// Re-export the Series class for type consistency and advanced use.
export const Series = DanfoSeries;
