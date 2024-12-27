import { instJSON } from './instructions.js';

const headers = {
  Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
  'Content-Type': 'application/json',
};

const sanitizeString = (str) => {
  return str
    .replace(/[\r\n]+/g, ' ')  // Replace line feeds with a space
    // .replace(/[^\x20-\x7E]/g, '')  // Remove non-printable ASCII characters
    // .replace(/[\u200B-\u200D\uFEFF]/g, '')  // Remove invisible Unicode characters
    .replace(/\s+/g, ' ')  // Replace multiple spaces with a single space
    .trim();  // Trim leading and trailing whitespace
};

/**
 * Constructs a message array for the AI conversation.
 * @param {Object} options - Options for constructing the message array.
 * @param {string} options.instruction - System instruction for the AI.
 * @param {string} options.prompt - User prompt or question.
 * @param {Array} [options.shotsInput] - Array of previous user inputs.
 * @param {Array} [options.shotsOutput] - Array of previous AI outputs.
 * @returns {Array} Constructed and cleaned message array.
 */
const construct = ({ 
  instruction, 
  shotsInput = [], 
  shotsOutput = [], 
  prompt = ""
}) => {

  let sanitizedInstruction, sanitizedPrompt, message;

  try {
    // Sanitize the instruction
    sanitizedInstruction = sanitizeString((instruction || 'Default instruction') + instJSON);
  } catch (error) {
    console.error('Error sanitizing instruction:', error.message, error.stack);
    throw new Error('Instruction sanitization failed');
  }

  try {
    // Sanitize the prompt
    sanitizedPrompt = sanitizeString(prompt);
  } catch (error) {
    console.error('Error sanitizing prompt:', error.message, error.stack);
    throw new Error('Prompt sanitization failed');
  }

  try {
    // Construct the message array
    message = [
      { role: 'system', content: sanitizedInstruction },
      ...(shotsInput?.flatMap((input, index) => [
        { role: 'user', content: sanitizeString(JSON.stringify(input)) },
        { role: 'assistant', content: sanitizeString(JSON.stringify(shotsOutput[index])) },
      ]) || []),
    ];

    if (sanitizedPrompt) message.push({ role: 'user', content: sanitizedPrompt });

  } catch (error) {
    console.error('Error constructing messages:', error.message, error.stack);
    throw new Error('Message construction failed');
  }

  return message;
};

const constructFurther = ({ 
  messages, 
  previousResponse,
  nextInstruction }) => [
  ...messages,
  { role: "assistant", 
    content: sanitizeString(JSON.stringify(previousResponse)) },
  { role: "user", 
    content: sanitizeString(nextInstruction) },
];

export {
  construct,
  constructFurther 
}