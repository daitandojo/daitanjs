// intelligence/src/intelligence/tools/calculatorTool.js
import { getLogger } from '@daitanjs/development';
import { DaitanValidationError, DaitanOperationError } from '@daitanjs/error';
import { z } from 'zod'; // For input schema definition
import { createDaitanTool } from '../core/toolFactory.js'; // CORRECTED: Import from the new 'core' location

const calculatorLogger = getLogger('daitan-tool-calculator');
const TOOL_NAME = 'calculator';
const MAX_EXPRESSION_LENGTH = 150; // Increased slightly

// Define Zod schema for input validation
const CalculatorInputSchema = z
  .object({
    expression: z
      .string()
      .min(1, 'Expression cannot be empty.')
      .max(
        MAX_EXPRESSION_LENGTH,
        `Expression cannot exceed ${MAX_EXPRESSION_LENGTH} characters.`
      )
      .regex(
        /^[0-9+\-*/().\s^%]+$/,
        'Expression contains invalid characters. Only numbers, basic operators (+, -, *, /, %, ^), parentheses, and spaces are allowed.'
      )
      .refine((expr) => {
        try {
          // Basic safety: check for balanced parentheses
          let open = 0;
          for (const char of expr) {
            if (char === '(') open++;
            else if (char === ')') open--;
            if (open < 0) return false; // Unbalanced closing parenthesis
          }
          return open === 0; // Ensure all opened are closed
        } catch {
          return false;
        }
      }, 'Expression has unbalanced parentheses.')
      .refine((expr) => {
        // Avoid sequences like `**` if `^` is for power, or `++` if not intended for increment
        // This is a simple check; more complex validation might use a proper parser
        if (
          expr.includes('**') ||
          expr.includes('//') ||
          expr.includes('++') ||
          expr.includes('--')
        ) {
          // Disallow Python-style power or C-style increments if not supported by new Function()
          // If supporting `**` for exponentiation, remove it from this check
          return false;
        }
        return true;
      }, 'Expression contains disallowed operator sequences (e.g., **, //, ++, --). Use ^ for exponentiation if needed.'),
  })
  .strict(); // Ensure no extra properties are passed

/**
 * A tool for performing mathematical calculations.
 * Leverages Zod for input schema definition and validation.
 */
export const calculatorTool = createDaitanTool(
  TOOL_NAME,
  `Useful for performing mathematical calculations when you need an exact numerical answer.
Input must be an object with a single key "expression", which is a string representing a mathematical expression.
Example input: {"expression": "2 + 2 * (5-1)"} or {"expression": "100 / 4^2"}.
Supports basic arithmetic operators: +, -, *, /, %, and ^ (for exponentiation).
Parentheses can be used for grouping. Avoid overly complex or excessively long expressions.`,
  async (input) => {
    // LangChain DynamicTool func receives a string or an object
    const callId = Math.random().toString(36).substring(2, 9); // Simple call ID for logging
    const startTime = Date.now();
    let validatedInput;
    let expressionToEvaluate;

    calculatorLogger.info(`Tool "${TOOL_NAME}" execution: START`, {
      callId,
      rawInput: input,
    });

    try {
      // Handle if input is stringified JSON (common from LLMs) or direct object
      if (typeof input === 'string') {
        try {
          const parsedInput = JSON.parse(input);
          if (
            typeof parsedInput === 'object' &&
            parsedInput !== null &&
            'expression' in parsedInput
          ) {
            validatedInput = CalculatorInputSchema.parse(parsedInput);
          } else {
            // Assume the string itself is the expression if it's not a JSON object with 'expression' key
            validatedInput = CalculatorInputSchema.parse({ expression: input });
          }
        } catch (e) {
          // If JSON.parse fails, try to validate as if the string itself is the expression
          validatedInput = CalculatorInputSchema.parse({ expression: input });
        }
      } else if (
        typeof input === 'object' &&
        input !== null &&
        'expression' in input
      ) {
        validatedInput = CalculatorInputSchema.parse(input);
      } else if (
        typeof input === 'object' &&
        input !== null &&
        Object.keys(input).length === 1 &&
        typeof Object.values(input)[0] === 'string'
      ) {
        // Handle cases where LLM might send {"query": "2+2"} instead of {"expression": "2+2"}
        calculatorLogger.warn(
          `Received object with unexpected key, assuming value is the expression.`,
          { inputKeys: Object.keys(input) }
        );
        validatedInput = CalculatorInputSchema.parse({
          expression: Object.values(input)[0],
        });
      } else {
        throw new DaitanValidationError(
          'Input must be a string (expression or JSON stringified object with "expression" key) or an object with an "expression" key.',
          { inputType: typeof input, inputValue: input }
        );
      }
      expressionToEvaluate = validatedInput.expression;

      // Replace ^ with ** for JavaScript's exponentiation operator, if not already handled by Function constructor
      // Be cautious if the Function constructor environment is very restricted.
      const safeExpression = expressionToEvaluate.replace(/\^/g, '**');

      // Evaluate the expression using Function constructor for safety (sandboxed compared to eval)
      // Still, ensure input is heavily sanitized by Zod.
      const result = new Function(
        `"use strict"; return (${safeExpression});`
      )();

      if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
        calculatorLogger.warn(
          'Calculation did not result in a valid finite number.',
          { callId, expression: safeExpression, result }
        );
        throw new DaitanOperationError(
          'Calculation resulted in an invalid or non-finite number.',
          { expression: safeExpression, resultValue: result }
        );
      }

      const duration = Date.now() - startTime;
      const output = `Result: ${result}`;
      calculatorLogger.info(`Tool "${TOOL_NAME}" execution: SUCCESS.`, {
        callId,
        expression: safeExpression,
        output,
        durationMs: duration,
      });
      return output;
    } catch (error) {
      const duration = Date.now() - startTime;
      calculatorLogger.error(`Tool "${TOOL_NAME}" execution: FAILED.`, {
        callId,
        inputAttempted: expressionToEvaluate || input, // Log the expression if validation passed, else raw input
        errorMessage: error.message,
        errorName: error.name,
        durationMs: duration,
        // errorStack: error.stack // Potentially verbose
      });

      if (
        error instanceof DaitanValidationError ||
        error instanceof DaitanOperationError ||
        error.name === 'ZodError'
      ) {
        // DaitanValidationError is more specific than ZodError here, but ZodError is what schema.parse throws
        return `Error: Invalid input. ${
          error.errors
            ? error.errors.map((e) => e.message).join(', ')
            : error.message
        }`;
      }
      return `Error during calculation for expression "${
        expressionToEvaluate || input
      }": ${
        error.message
      }. Please ensure the expression is mathematically valid.`;
    }
  },
  CalculatorInputSchema
);
