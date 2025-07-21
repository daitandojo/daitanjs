// data/src/jsonstore/jsonSchemaValidator.js
/**
 * @file JSON Schema validation utility for jsonStore.
 * @module @daitanjs/data/jsonstore/jsonSchemaValidator
 * @private
 *
 * @description
 * This utility provides a basic JSON Schema validator. It's a conceptual placeholder
 * as a full JSON Schema validator (like Ajv) is a significant dependency.
 * For robust schema validation, integrating a dedicated library is recommended.
 * This simple version checks for required properties and basic types.
 *
 * This is an internal helper and not part of the public API of @daitanjs/data.
 */
import { getLogger } from '@daitanjs/development';

const schemaLogger = getLogger('daitan-jsonstore-schema-validator');

/**
 * @typedef {Object} SimpleJsonSchema
 * @property {'object' | 'array' | 'string' | 'number' | 'boolean' | 'integer'} type - The JSON type.
 * @property {Object<string, SimpleJsonSchema>} [properties] - For 'object' type, schema for each property.
 * @property {string[]} [required] - For 'object' type, array of required property names.
 * @property {SimpleJsonSchema} [items] - For 'array' type, schema for array items.
 * @property {number} [minLength] - For 'string' type.
 * @property {number} [maxLength] - For 'string' type.
 * @property {RegExp | string} [pattern] - For 'string' type, a regex pattern.
 * @property {number} [minimum] - For 'number' or 'integer' type.
 * @property {number} [maximum] - For 'number' or 'integer' type.
 * @property {Array<any>} [enum] - For any type, an array of allowed values.
 */

/**
 * Validates data against a simplified JSON schema.
 * This is a basic validator and does not support all JSON Schema features.
 *
 * @param {any} data - The data to validate.
 * @param {SimpleJsonSchema} schema - The schema to validate against.
 * @param {string} [dataPath="root"] - Current path in data (for error reporting).
 * @returns {Array<{path: string, message: string, schema: SimpleJsonSchema, data: any}>}
 *          An array of validation error objects. Empty if valid.
 */
export function validateAgainstSimpleSchema(data, schema, dataPath = 'root') {
  const errors = [];
  if (!schema || typeof schema.type !== 'string') {
    errors.push({
      path: dataPath,
      message: 'Invalid schema: "type" property is missing or not a string.',
      schema,
      data,
    });
    return errors;
  }

  // Type checking
  const dataType = typeof data;
  let isValidType = false;
  switch (schema.type) {
    case 'object':
      isValidType =
        dataType === 'object' && data !== null && !Array.isArray(data);
      break;
    case 'array':
      isValidType = Array.isArray(data);
      break;
    case 'string':
      isValidType = dataType === 'string';
      break;
    case 'number':
      isValidType = dataType === 'number' && isFinite(data);
      break;
    case 'integer':
      isValidType = Number.isInteger(data);
      break;
    case 'boolean':
      isValidType = dataType === 'boolean';
      break;
    default:
      errors.push({
        path: dataPath,
        message: `Invalid schema: Unknown type "${schema.type}".`,
        schema,
        data,
      });
      return errors; // Unknown schema type is a schema error, not data error usually.
  }

  if (!isValidType && data !== undefined) {
    // Allow undefined if not required, required check is separate
    errors.push({
      path: dataPath,
      message: `Type mismatch: Expected type "${schema.type}", but got "${
        Array.isArray(data) ? 'array' : dataType
      }".`,
      schema: { type: schema.type },
      data,
    });
    return errors; // Stop further validation for this path if type is wrong
  }

  // Enum check (if data is not undefined and type matches, or if enum should apply to undefined too)
  if (schema.enum && Array.isArray(schema.enum)) {
    if (!schema.enum.includes(data)) {
      errors.push({
        path: dataPath,
        message: `Value "${data}" is not one of the allowed enum values: [${schema.enum.join(
          ', '
        )}].`,
        schema: { enum: schema.enum },
        data,
      });
    }
  }

  // Specific validations based on type
  if (schema.type === 'string') {
    if (schema.minLength !== undefined && data.length < schema.minLength) {
      errors.push({
        path: dataPath,
        message: `String is too short. Minimum length: ${schema.minLength}, actual: ${data.length}.`,
        schema: { minLength: schema.minLength },
        data,
      });
    }
    if (schema.maxLength !== undefined && data.length > schema.maxLength) {
      errors.push({
        path: dataPath,
        message: `String is too long. Maximum length: ${schema.maxLength}, actual: ${data.length}.`,
        schema: { maxLength: schema.maxLength },
        data,
      });
    }
    if (schema.pattern) {
      const regex =
        typeof schema.pattern === 'string'
          ? new RegExp(schema.pattern)
          : schema.pattern;
      if (!regex.test(data)) {
        errors.push({
          path: dataPath,
          message: `String does not match pattern: ${String(regex)}.`,
          schema: { pattern: String(regex) },
          data,
        });
      }
    }
  } else if (schema.type === 'number' || schema.type === 'integer') {
    if (schema.minimum !== undefined && data < schema.minimum) {
      errors.push({
        path: dataPath,
        message: `Number is too small. Minimum: ${schema.minimum}, actual: ${data}.`,
        schema: { minimum: schema.minimum },
        data,
      });
    }
    if (schema.maximum !== undefined && data > schema.maximum) {
      errors.push({
        path: dataPath,
        message: `Number is too large. Maximum: ${schema.maximum}, actual: ${data}.`,
        schema: { maximum: schema.maximum },
        data,
      });
    }
  } else if (schema.type === 'object' && schema.properties && data) {
    // data check ensures we don't try to iterate null/undefined
    // Required properties check
    if (schema.required && Array.isArray(schema.required)) {
      for (const requiredProp of schema.required) {
        if (
          !Object.prototype.hasOwnProperty.call(data, requiredProp) ||
          data[requiredProp] === undefined
        ) {
          errors.push({
            path: `${dataPath}.${requiredProp}`,
            message: `Missing required property: "${requiredProp}".`,
            schema: { required: schema.required },
            data: undefined, // data for this property is undefined
          });
        }
      }
    }
    // Validate properties
    for (const propName in schema.properties) {
      if (Object.prototype.hasOwnProperty.call(schema.properties, propName)) {
        // Only validate if property exists in data, or if it's required (checked above)
        if (Object.prototype.hasOwnProperty.call(data, propName)) {
          errors.push(
            ...validateAgainstSimpleSchema(
              data[propName],
              schema.properties[propName],
              `${dataPath}.${propName}`
            )
          );
        }
      }
    }
    // Check for additional properties if schema.additionalProperties === false (not implemented in this simple version)
  } else if (schema.type === 'array' && schema.items && data) {
    // data check
    // Validate array items
    for (let i = 0; i < data.length; i++) {
      errors.push(
        ...validateAgainstSimpleSchema(
          data[i],
          schema.items,
          `${dataPath}[${i}]`
        )
      );
    }
    // MinItems, maxItems, uniqueItems not implemented in this simple version
  }

  // Filter out any potential null/undefined entries if recursion didn't return array
  return errors.filter((e) => e && e.message);
}

/**
 * Formats validation errors into a user-friendly string.
 * @param {Array<{path: string, message: string}>} errors - Array of error objects from `validateAgainstSimpleSchema`.
 * @returns {string} A formatted string of error messages, or an empty string if no errors.
 */
export function formatSimpleSchemaErrors(errors) {
  if (!Array.isArray(errors) || errors.length === 0) {
    return '';
  }
  return errors
    .map((err) => `Error at '${err.path}': ${err.message}`)
    .join('\n');
}

// Example Usage (conceptual, would be in tests or consuming code):
// const mySchema = {
//   type: 'object',
//   properties: {
//     name: { type: 'string', minLength: 3 },
//     age: { type: 'integer', minimum: 0 },
//     email: { type: 'string', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
//     hobbies: { type: 'array', items: { type: 'string' } }
//   },
//   required: ['name', 'age']
// };
// const myData = { name: 'Al', age: 30, email: 'invalid-email', hobbies: ['coding', 123] };
// const validationErrors = validateAgainstSimpleSchema(myData, mySchema);
// if (validationErrors.length > 0) {
//   schemaLogger.error('Validation Failed:', { errors: validationErrors });
//   schemaLogger.error('Formatted Errors:\n' + formatSimpleSchemaErrors(validationErrors));
// } else {
//   schemaLogger.info('Validation Succeeded!');
// }
