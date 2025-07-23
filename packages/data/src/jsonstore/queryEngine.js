// data/src/jsonstore/queryEngine.js
/**
 * @file Contains the core query matching logic for the file-based JSON store.
 * @module @daitanjs/data/jsonstore/queryEngine
 *
 * @description
 * This module provides the `matchesQuery` function, which is responsible for evaluating
 * if a given JavaScript object satisfies the conditions of a MongoDB-like query object.
 * It is a pure, self-contained utility with no dependencies on file systems, making it
 * easy to test and reuse. It supports common operators like `$eq`, `$gt`, `$in`, `$exists`, etc.
 */
import { getLogger } from '@daitanjs/development';

const queryEngineLogger = getLogger('daitan-jsonstore-query-engine');

/**
 * Checks if a JSON object matches a given query object using MongoDB-like operators.
 *
 * @public
 * @param {object} dataObject - The data object to check.
 * @param {object} queryMatcher - The query object.
 * @param {import('winston').Logger} [loggerInstance] - Optional logger.
 * @returns {boolean} True if `dataObject` matches all conditions in `queryMatcher`.
 */
export function matchesQuery(
  dataObject,
  queryMatcher,
  loggerInstance = queryEngineLogger
) {
  if (
    !dataObject ||
    typeof dataObject !== 'object' ||
    !queryMatcher ||
    typeof queryMatcher !== 'object'
  ) {
    return false;
  }

  for (const queryKey in queryMatcher) {
    if (Object.prototype.hasOwnProperty.call(queryMatcher, queryKey)) {
      const queryValue = queryMatcher[queryKey];
      const objectValue = dataObject[queryKey];

      if (
        typeof queryValue === 'object' &&
        queryValue !== null &&
        !Array.isArray(queryValue) &&
        Object.keys(queryValue).some((op) => op.startsWith('$'))
      ) {
        let operatorMatch = true;
        for (const operator in queryValue) {
          if (Object.prototype.hasOwnProperty.call(queryValue, operator)) {
            const operatorArg = queryValue[operator];

            let coercedObjectValue = objectValue;
            if (
              ['$gt', '$gte', '$lt', '$lte'].includes(operator) &&
              typeof operatorArg === 'number'
            ) {
              const numVal = parseFloat(objectValue);
              if (!isNaN(numVal)) {
                coercedObjectValue = numVal;
              }
            }

            switch (operator) {
              case '$eq':
                if (coercedObjectValue !== operatorArg) operatorMatch = false;
                break;
              case '$ne':
                if (coercedObjectValue === operatorArg) operatorMatch = false;
                break;
              case '$gt':
                if (!(coercedObjectValue > operatorArg)) operatorMatch = false;
                break;
              case '$gte':
                if (!(coercedObjectValue >= operatorArg)) operatorMatch = false;
                break;
              case '$lt':
                if (!(coercedObjectValue < operatorArg)) operatorMatch = false;
                break;
              case '$lte':
                if (!(coercedObjectValue <= operatorArg)) operatorMatch = false;
                break;
              case '$in':
                if (!Array.isArray(operatorArg)) {
                  operatorMatch = false;
                  break;
                }
                if (Array.isArray(coercedObjectValue)) {
                  operatorMatch = coercedObjectValue.some((item) =>
                    operatorArg.includes(item)
                  );
                } else {
                  operatorMatch = operatorArg.includes(coercedObjectValue);
                }
                break;
              case '$nin':
                if (
                  !Array.isArray(operatorArg) ||
                  operatorArg.includes(coercedObjectValue)
                )
                  operatorMatch = false;
                break;
              case '$exists':
                const objectHasKey = Object.prototype.hasOwnProperty.call(
                  dataObject,
                  queryKey
                );
                if (
                  (operatorArg === true && !objectHasKey) ||
                  (operatorArg === false && objectHasKey)
                )
                  operatorMatch = false;
                break;
              case '$regex':
                if (
                  typeof coercedObjectValue !== 'string' ||
                  typeof operatorArg !== 'string'
                ) {
                  operatorMatch = false;
                  break;
                }
                try {
                  if (!new RegExp(operatorArg).test(coercedObjectValue))
                    operatorMatch = false;
                } catch (e) {
                  loggerInstance.warn(
                    `Invalid regex "${operatorArg}" in query for key "${queryKey}".`,
                    { error: e.message }
                  );
                  operatorMatch = false;
                }
                break;
              case '$like':
                if (
                  typeof coercedObjectValue !== 'string' ||
                  typeof operatorArg !== 'string'
                ) {
                  operatorMatch = false;
                  break;
                }
                if (
                  !coercedObjectValue
                    .toLowerCase()
                    .includes(operatorArg.toLowerCase())
                )
                  operatorMatch = false;
                break;
              case '$all':
                if (
                  !Array.isArray(coercedObjectValue) ||
                  !Array.isArray(operatorArg) ||
                  !operatorArg.every((item) =>
                    coercedObjectValue.includes(item)
                  )
                ) {
                  operatorMatch = false;
                }
                break;
              case '$size':
                if (
                  !Array.isArray(coercedObjectValue) ||
                  typeof operatorArg !== 'number' ||
                  coercedObjectValue.length !== operatorArg
                ) {
                  operatorMatch = false;
                }
                break;
              default:
                loggerInstance.warn(
                  `Unsupported query operator "${operator}" for key "${queryKey}". Treating as no match.`
                );
                operatorMatch = false;
            }
            if (!operatorMatch) break;
          }
        }
        if (!operatorMatch) return false;
      } else {
        if (JSON.stringify(objectValue) !== JSON.stringify(queryValue))
          return false;
      }
    }
  }
  return true;
}
