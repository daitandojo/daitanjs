// intelligence/src/intelligence/tools/cliTool.js
import { getLogger } from '@daitanjs/development';
import { DaitanValidationError, DaitanOperationError } from '@daitanjs/error';
import { exec } from 'child_process';
import util from 'util';
import { z } from 'zod';
import { createDaitanTool } from '../core/toolFactory.js'; // CORRECTED: Import from the new 'core' location

const cliLogger = getLogger('daitan-tool-cli');
const execPromise = util.promisify(exec);
const TOOL_NAME = 'command_line_interface';

const IS_WINDOWS = process.platform === 'win32';
const COMMAND_TIMEOUT_MS = 5000; // Default timeout for commands

// --- Command Whitelist and Validation Configuration ---
/**
 * @typedef {Object} AllowedCommandConfig
 * @property {string} command - The base command (e.g., 'ls', 'pwd').
 * @property {RegExp | null} allowedArgsRegex - Regex to validate arguments. Null means no args allowed.
 * @property {string} description - Description of what the command does (for tool's main description).
 * @property {boolean} [isSafeReadOnly=true] - Flag indicating if the command is generally read-only.
 */
const ALLOWED_COMMANDS_CONFIG = [
  {
    command: 'ls',
    allowedArgsRegex: /^(?:\s+(-[a-zA-Z]{1,10}))*(?:\s+[\w./~-]+)?$/,
    description: 'List directory contents. Args like -l, -a, path are common.',
    isSafeReadOnly: true,
  },
  {
    command: 'pwd',
    allowedArgsRegex: null,
    description: 'Print working directory name. No arguments accepted.',
    isSafeReadOnly: true,
  },
  {
    command: 'date',
    allowedArgsRegex: /^(?:\s*\+?[\w%:\s-]+)?$/,
    description:
      'Print the current date and time. Can take format string starting with +.',
    isSafeReadOnly: true,
  },
  {
    command: 'echo',
    allowedArgsRegex: /^[\s\S]*$/,
    description: 'Display a line of text. Input string will be echoed.',
    isSafeReadOnly: true,
  }, // More permissive but still subject to overall input sanitization
  {
    command: 'whoami',
    allowedArgsRegex: null,
    description: 'Print effective user ID. No arguments accepted.',
    isSafeReadOnly: true,
  },
  {
    command: 'uptime',
    allowedArgsRegex: null,
    description:
      'Show how long the system has been running. No arguments accepted.',
    isSafeReadOnly: true,
  },
  {
    command: 'df',
    allowedArgsRegex: /^(?:\s+(-[a-zA-Z]{1,10}))*(?:\s+[\w./~-]+)*$/,
    description:
      'Report file system disk space usage. Args like -h, path are common.',
    isSafeReadOnly: true,
  },
  {
    command: 'free',
    allowedArgsRegex: /^(?:\s+(-[a-zA-Z]{1,5}))*$/,
    description:
      'Display amount of free and used memory. Args like -m, -g are common.',
    isSafeReadOnly: true,
  },
  {
    command: 'uname',
    allowedArgsRegex: /^(?:\s+(-[a-zA-Z]{1,5}))*$/,
    description: 'Print system information. Args like -a, -s, -r are common.',
    isSafeReadOnly: true,
  },
  // Add other safe, read-only commands as needed. Be extremely cautious.
];

// Characters/sequences generally unsafe in shell commands if not properly handled/escaped.
// This validation is a first line of defense. Proper command construction is also key.
const FORBIDDEN_CHARS_REGEX = /[&|;<>$`(){}'"!#\\]/; // Stricter: removed ' and " as they might be needed for args, but rely on arg validation. Re-added for safety.
const FORBIDDEN_SEQUENCES_REGEX = /\.\.|\/\//; // Path traversal and protocol-like sequences

// Zod schema for the input object
const CliInputSchema = z
  .object({
    command: z
      .string()
      .min(1, 'Command cannot be empty.')
      .max(256, 'Full command string is too long.') // Limit overall length
      .refine((cmdStr) => !FORBIDDEN_CHARS_REGEX.test(cmdStr), {
        message:
          'Command string contains forbidden characters (e.g., &, |, ;, <, >, $, `, (, ), {, }, \\, \', ", !).',
      })
      .refine((cmdStr) => !FORBIDDEN_SEQUENCES_REGEX.test(cmdStr), {
        message: 'Command string contains forbidden sequences (e.g., .., //).',
      }),
  })
  .strict();

const validateAndParseCommand = (fullCommandString) => {
  // Schema validation handles forbidden chars/sequences broadly.
  // This function now focuses on whitelisting and arg validation.
  const parts = fullCommandString.trim().split(/\s+/);
  const baseCommand = parts[0];
  const argsString = parts.slice(1).join(' ');

  const commandConfig = ALLOWED_COMMANDS_CONFIG.find(
    (c) => c.command === baseCommand
  );

  if (!commandConfig) {
    return {
      isValid: false,
      error: `Command "${baseCommand}" is not in the allowed list.`,
    };
  }

  if (commandConfig.allowedArgsRegex === null) {
    // Explicitly null means no arguments allowed
    if (argsString.trim() !== '') {
      return {
        isValid: false,
        error: `Command "${baseCommand}" does not accept any arguments. Received: "${argsString}"`,
      };
    }
  } else if (commandConfig.allowedArgsRegex) {
    // If a regex is provided for args
    if (!commandConfig.allowedArgsRegex.test(argsString)) {
      return {
        isValid: false,
        error: `Arguments "${argsString}" for command "${baseCommand}" are not allowed or incorrectly formatted.`,
      };
    }
  }
  // If allowedArgsRegex is undefined, it means any args are fine (already passed basic char validation by Zod) - useful for 'echo'.

  if (!commandConfig.isSafeReadOnly) {
    cliLogger.warn(
      `Executing command "${baseCommand}" which is not marked as safe read-only. Ensure this is intended and secured.`,
      { fullCommandString }
    );
  }

  return { isValid: true, commandConfig, baseCommand, args: argsString };
};

export const cliTool = createDaitanTool(
  TOOL_NAME,
  `Executes a strictly whitelisted and validated shell command and returns its standard output and standard error.
Input must be an object with a single key "command", which is a string representing the full command to execute (e.g., {"command": "ls -la /tmp"}).
Only a pre-defined set of safe, primarily read-only commands are allowed.
Forbidden characters (like '&', '|', ';', '$') and sequences (like '..') in the command string are NOT allowed.
Allowed commands include: ${ALLOWED_COMMANDS_CONFIG.map(
    (c) => `${c.command} (${c.description.substring(0, 30)}...)`
  ).join(', ')}.
Consult the full descriptions of allowed commands if unsure about arguments. Misuse can be a security risk.`,
  async (input) => {
    const callId = Math.random().toString(36).substring(2, 9);
    const startTime = Date.now();
    let commandStringInput;
    let logContext = { toolName: TOOL_NAME, callId };

    cliLogger.info(`Tool "${TOOL_NAME}" execution: START`, {
      callId,
      rawInput: input,
    });

    try {
      if (typeof input === 'string') {
        try {
          const parsed = JSON.parse(input);
          if (
            typeof parsed === 'object' &&
            parsed !== null &&
            typeof parsed.command === 'string'
          ) {
            commandStringInput = parsed.command;
          } else {
            // Assume the string itself is the command
            commandStringInput = input;
          }
        } catch (e) {
          // If JSON.parse fails, assume the string itself is the command
          commandStringInput = input;
        }
      } else if (
        typeof input === 'object' &&
        input !== null &&
        typeof input.command === 'string'
      ) {
        commandStringInput = input.command;
      } else {
        throw new DaitanValidationError(
          'Input must be a string (the command or JSON stringified object with "command" key) or an object with a "command" key.',
          { inputType: typeof input }
        );
      }

      logContext.commandAttempted = String(commandStringInput).substring(
        0,
        200
      );
      CliInputSchema.parse({ command: commandStringInput }); // Validate against Zod schema first

      const validationResult = validateAndParseCommand(commandStringInput);
      if (!validationResult.isValid) {
        throw new DaitanValidationError(validationResult.error, {
          commandString: commandStringInput,
        });
      }

      const { baseCommand, args } = validationResult;
      const fullCommandToExecute = args
        ? `${baseCommand} ${args}`
        : baseCommand;
      logContext.commandExecuted = fullCommandToExecute;

      cliLogger.info(
        `Attempting to execute validated command: "${fullCommandToExecute}"`,
        { callId }
      );

      const executionOptions = {
        timeout: COMMAND_TIMEOUT_MS,
        shell: IS_WINDOWS ? 'cmd.exe' : '/bin/sh', // Or a more restricted shell if possible
        windowsHide: true,
        // Consider cwd if needed, but be very careful with allowing LLM to specify CWD.
      };

      const { stdout, stderr } = await execPromise(
        fullCommandToExecute,
        executionOptions
      );
      const duration = Date.now() - startTime;

      let output = '';
      if (stdout && stdout.trim()) output += `Stdout:\n${stdout.trim()}\n`;
      if (stderr && stderr.trim()) output += `Stderr:\n${stderr.trim()}\n`; // Include stderr as it can be informative

      const finalOutput =
        output.trim() ||
        '(Command executed successfully with no output to stdout or stderr)';
      cliLogger.info(`Tool "${TOOL_NAME}" execution: SUCCESS.`, {
        ...logContext,
        outputPreview: finalOutput.substring(0, 100),
        durationMs: duration,
      });
      return finalOutput;
    } catch (error) {
      const duration = Date.now() - startTime;
      logContext.durationMs = duration;
      logContext.errorMessage = error.message;
      logContext.errorName = error.name;

      if (error instanceof DaitanValidationError || error.name === 'ZodError') {
        cliLogger.warn(
          `Tool "${TOOL_NAME}" execution: FAILED (Validation).`,
          logContext
        );
        return `Error: Command validation failed. ${
          error.errors
            ? error.errors.map((e) => e.message).join(', ')
            : error.message
        }`;
      }

      // Runtime error from execPromise
      logContext.errorCode = error.code; // exit code
      logContext.errorSignal = error.signal;
      logContext.errorStderr = error.stderr?.trim() || null;
      logContext.errorStdout = error.stdout?.trim() || null; // stdout might exist even on error

      cliLogger.error(
        `Tool "${TOOL_NAME}" execution: FAILED (Runtime).`,
        logContext
      );

      let userMessage = `Error executing command "${
        logContext.commandExecuted || commandStringInput
      }": ${error.message}.`;
      if (error.killed)
        userMessage = `Error: Command timed out after ${
          COMMAND_TIMEOUT_MS / 1000
        }s or was killed.`;
      else if (error.code) userMessage += ` Exit code: ${error.code}.`;
      if (error.stderr) userMessage += ` Stderr: ${error.stderr.trim()}`;

      // Return a DaitanOperationError or just the string for LangChain
      return userMessage;
    }
  },
  CliInputSchema
);
