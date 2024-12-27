export const safeExecute = async (operation, errorHandler = null) => {
  try {
    return await operation();
  } catch (error) {
    if (errorHandler) {
      errorHandler(error);
    } else {
      console.error("Error during safe execution:", error.message);
    }
    return null;
  }
};

export const retryOperation = async (operation, args, maxRetries = 3, operationName) => {
  let attempt = 0;
  let lastError = null;

  while (attempt < maxRetries) {
    try {
      console.log(`Attempt ${attempt + 1} for ${operationName}`);
      const result = await operation(args);
      if (result.status === 'success') {
        console.log(`${operationName} succeeded on attempt ${attempt + 1}`);
        return result;
      } else {
        throw new Error(result.message || 'Unknown error');
      }
    } catch (error) {
      lastError = error;
      console.log(`Error on attempt ${attempt + 1} for ${operationName}: ${error.message}`, {
        url: args.url,
      });
      attempt++;
    }
  }

  throw new Error(
    `All ${maxRetries} retries failed for ${operationName}. Last error: ${lastError?.message}`
  );
};

export async function retryWithLimit(operation, maxRetries, logger) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await safeExecute(operation, (error) =>
      logger?.warn(`Operation failed (attempt ${attempt}/${maxRetries})`, { error })
    );
    if (result) return result;
  }
  logger?.error('Maximum number of retries reached');
  return null;
}

// batchProcessor.js
export async function processInBatches(items, batchSize, processBatch) {
  const results = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResult = await processBatch(batch);
    if (batchResult) {
      results.push(...batchResult);
    }
  }

  return results;
}