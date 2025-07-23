// intelligence/src/intelligence/tools/csvQueryTool.js
/**
 * @file A DaitanJS tool for querying local CSV files using a SQL-like interface.
 * @module @daitanjs/intelligence/tools/csvQueryTool
 *
 * @description
 * This module exports a LangChain-compatible tool that allows an AI agent to
 * execute simplified SQL queries against a directory of CSV files, where each
 * file is treated as a table. It wraps the `CSVSQL` class from the `@daitanjs/data` package.
 */

import { createDaitanTool } from '../core/toolFactory.js'; // CORRECTED: Import from the new 'core' location
import { z } from 'zod';
import { CSVSQL } from '@daitanjs/data';

const CsvQueryInputSchema = z
  .object({
    query: z
      .string()
      .min(10, 'Query string seems too short.')
      .max(500, 'Query string is too long.'),
    directoryPath: z
      .string()
      .optional()
      .describe(
        'Optional: A specific server directory path containing the CSV files to query.'
      ),
  })
  .strict();

export const csvQueryTool = createDaitanTool(
  'csv_query_tool',
  `Executes a simplified SQL-like query on a collection of local CSV files.
Each CSV file in the target directory is treated as a table (the table name is the filename without .csv).
The input must be an object with a "query" key containing the SQL-like query string.
Example: {"query": "SELECT name, age FROM people WHERE city = 'New York'"}
The tool supports SELECT, INSERT, and DELETE operations on the CSV files. This is useful for analyzing data or retrieving structured information that has been saved locally.`,
  async (input) => {
    const validatedInput = CsvQueryInputSchema.parse(input);

    const csvSql = new CSVSQL(validatedInput.directoryPath, { verbose: true });
    await csvSql.initialize();

    const queryResult = await csvSql.query(validatedInput.query);

    if (Array.isArray(queryResult)) {
      if (queryResult.length === 0) {
        return 'Query executed successfully and returned no results.';
      }
      const summary = `Query returned ${queryResult.length} rows.`;
      const resultsToShow = queryResult.slice(0, 20);
      const resultString = JSON.stringify(resultsToShow, null, 2);

      return `${summary}\n\nFirst ${resultsToShow.length} rows:\n${resultString}`;
    } else if (typeof queryResult === 'object' && queryResult !== null) {
      return `Action query executed successfully. Result: ${JSON.stringify(
        queryResult
      )}`;
    }

    return 'Query executed, but the result format was unexpected. Please check the query syntax.';
  },
  CsvQueryInputSchema
);
