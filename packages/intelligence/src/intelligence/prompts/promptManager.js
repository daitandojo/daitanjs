// intelligence/src/intelligence/prompts/promptManager.js
/**
 * @file Manages registration, retrieval, and formatting of prompt templates.
 * @module @daitanjs/intelligence/prompts/promptManager
 *
 * @description
 * This module provides a `PromptManager`-like system (though not a class itself,
 * rather a set of functions operating on a shared registry) for handling various
 * prompt templates used with LLMs. It allows for:
 *
 * - **Registration**: Storing prompt templates by a unique name and version.
 *   Supports both LangChain `ChatPromptTemplate` (for chat models) and `PromptTemplate` (for string-based LLMs).
 * - **Versioning**: Managing multiple versions of the same prompt, with a 'latest' tag.
 * - **Retrieval**: Fetching specific prompt template instances or their metadata.
 * - **Formatting**: Using a registered template to format input values into a prompt
 *   suitable for an LLM (either a string or an array of LangChain `BaseMessage` objects).
 *
 * This system is designed to help organize prompts, facilitate A/B testing or versioning
 * of prompts, and provide a consistent way to generate prompts for LLM interactions.
 *
 * Key Functions:
 * - `registerPrompt`: Adds a new prompt template or version to the registry.
 * - `getPromptTemplate`: Retrieves a compiled LangChain prompt template instance.
 * - `getPromptMetadata`: Gets metadata about a registered prompt.
 * - `formatPrompt`: Formats a prompt template with given input values.
 * - `listPrompts`: Lists metadata for all registered prompts.
 * - `setLatestPromptVersion`: Marks a specific version of a prompt as 'latest'.
 * - `clearAllPrompts`: Clears the entire prompt registry.
 */
import {
  PromptTemplate,
  ChatPromptTemplate,
  MessagesPlaceholder,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
  AIMessagePromptTemplate,
  // BaseMessagePromptTemplate, // Base class, not directly instantiated usually
} from '@langchain/core/prompts';
import { getLogger } from '@daitanjs/development';
import { DaitanInvalidInputError, DaitanConfigurationError, DaitanNotFoundError } from '@daitanjs/error'; // For specific errors

const promptManagerLogger = getLogger('daitan-prompt-manager'); // Renamed from 'logger'

/**
 * In-memory registry for prompt templates.
 * Structure: `Map<string (promptName), Map<string (version | LATEST_VERSION_TAG), RegisteredPromptDetails>>`
 * @private
 * @type {Map<string, Map<string, RegisteredPromptDetails>>}
 */
const promptRegistry = new Map();

/**
 * Special tag to identify the latest version of a prompt.
 * @private
 * @constant {string}
 */
const LATEST_VERSION_TAG = 'latest';

/**
 * @typedef {Object} PromptPartDefinition
 * @property {'system' | 'human' | 'ai' | 'placeholder' | 'string_template'} roleOrType -
 *           For 'chat' prompts: 'system', 'human', 'ai', 'placeholder'.
 *           For 'string' prompts: 'string_template' (indicates `content` is the full template string).
 * @property {string} content - The template string itself, or the variable name if `roleOrType` is 'placeholder'.
 * @property {string} [name] - Optional: Name for a 'placeholder' part, used as `variableName` in `MessagesPlaceholder`.
 *                             If not provided for 'placeholder', `content` is used as `variableName`.
 */

/**
 * @typedef {Object} PromptRegistrationConfig
 * @property {string} name - A unique name for the prompt template (e.g., "summarize_text", "code_generation_expert").
 * @property {string} version - A version string for this specific prompt template (e.g., "1.0.0", "v2-experimental", "feature-x-branch").
 * @property {string} description - A human-readable description of the prompt's purpose and intended use.
 * @property {Array<PromptPartDefinition | string>} parts - An array defining the structure of the prompt.
 *           For 'chat' type: Array of `PromptPartDefinition` objects.
 *           For 'string' type: Array containing a single `PromptPartDefinition` with `roleOrType: 'string_template'`
 *           and its `content` as the template string, OR simply an array with one string element (the template itself).
 * @property {string[]} inputVariables - An array of variable names (strings) that this prompt template expects as input
 *           (e.g., `['user_query', 'document_context']`). These correspond to placeholders like `{user_query}` in template strings.
 * @property {'chat' | 'string'} [type='chat'] - The type of LangChain prompt template to create ('chat' or 'string').
 * @property {boolean} [setAsLatest=true] - If true, this version will be marked as the 'latest' version for this prompt name.
 * @property {object} [customMeta={}] - Any additional custom metadata to store with this prompt version (e.g., author, tags, performance_notes).
 */

/**
 * @typedef {PromptRegistrationConfig & { templateInstance: ChatPromptTemplate | PromptTemplate, registeredAt: Date }} RegisteredPromptDetails
 * Internal structure stored in the registry, includes the compiled LangChain template instance.
 */


/**
 * Registers a new prompt template or a new version of an existing prompt template.
 *
 * @public
 * @param {PromptRegistrationConfig} config - Configuration object for the prompt template.
 * @returns {RegisteredPromptDetails} The details of the registered prompt, including its LangChain template instance.
 * @throws {DaitanInvalidInputError} If the provided `config` or its properties are invalid (e.g., missing name, version, parts).
 * @throws {DaitanConfigurationError} If a prompt with the same name and version already exists, or if template instantiation fails.
 */
export const registerPrompt = ({
  name,
  version,
  description,
  parts,
  inputVariables,
  type = 'chat', // Default to 'chat' type
  setAsLatest = true,
  customMeta = {},
}) => {
  const callId = `regPrompt-${name}-v${version}`;
  promptManagerLogger.debug(`[${callId}] Registering prompt.`, { name, version, type });

  // --- Input Validation ---
  if (!name || typeof name !== 'string' || !name.trim()) throw new DaitanInvalidInputError('Prompt `name` must be a non-empty string.');
  if (!version || typeof version !== 'string' || !version.trim()) throw new DaitanInvalidInputError('Prompt `version` must be a non-empty string.');
  if (!description || typeof description !== 'string' || !description.trim()) throw new DaitanInvalidInputError('Prompt `description` must be a non-empty string.');
  if (!Array.isArray(parts) || parts.length === 0) throw new DaitanInvalidInputError('Prompt `parts` must be a non-empty array.');
  if (!Array.isArray(inputVariables)) throw new DaitanInvalidInputError('Prompt `inputVariables` must be an array (can be empty).');
  if (type !== 'chat' && type !== 'string') throw new DaitanInvalidInputError('Prompt `type` must be either "chat" or "string".');

  if (!promptRegistry.has(name)) {
    promptRegistry.set(name, new Map());
  }
  const versionsMap = promptRegistry.get(name);
  if (versionsMap.has(version)) {
    throw new DaitanConfigurationError(`Prompt "${name}" version "${version}" already exists in the registry. Use a different version string or name.`);
  }

  let templateInstance;
  try {
    if (type === 'chat') {
      const messageTemplates = parts.map((part, index) => {
        const partDef = (typeof part === 'string') ? { roleOrType: 'human', content: part } : part; // Treat raw string as human message
        if (!partDef || typeof partDef.roleOrType !== 'string' || typeof partDef.content !== 'string') {
          throw new DaitanInvalidInputError(`Invalid part definition at index ${index} for chat prompt "${name}" v${version}. Expected object with roleOrType and content, or a string.`);
        }
        switch (partDef.roleOrType) {
          case 'system': return SystemMessagePromptTemplate.fromTemplate(partDef.content);
          case 'human': return HumanMessagePromptTemplate.fromTemplate(partDef.content);
          case 'ai': return AIMessagePromptTemplate.fromTemplate(partDef.content);
          case 'placeholder':
            const placeholderName = partDef.name || partDef.content; // Use 'name' if provided, else 'content' as var name
            if (!placeholderName || !placeholderName.trim()) {
              promptManagerLogger.warn(`[${callId}] Placeholder at index ${index} for prompt "${name}" v${version} has no valid variableName (from name or content). Defaulting to "history".`);
              return new MessagesPlaceholder('history'); // Default placeholder variable name
            }
            return new MessagesPlaceholder(placeholderName.trim());
          default:
            throw new DaitanInvalidInputError(`Invalid roleOrType "${partDef.roleOrType}" in chat prompt part at index ${index} for "${name}" v${version}.`);
        }
      });
      templateInstance = ChatPromptTemplate.fromMessages(messageTemplates);
      // LangChain ChatPromptTemplate infers inputVariables from template strings.
      // We can validate if our provided inputVariables match the inferred ones if desired.
      // For now, we trust the user's `inputVariables` list for metadata purposes.
    } else { // type === 'string'
      if (parts.length !== 1) {
        throw new DaitanInvalidInputError(`String prompt "${name}" v${version} must consist of exactly one part (either a string template or a PromptPartDefinition with roleOrType 'string_template').`);
      }
      const partDef = (typeof parts[0] === 'string') ? { roleOrType: 'string_template', content: parts[0] } : parts[0];
      if (partDef.roleOrType !== 'string_template' || typeof partDef.content !== 'string') {
        throw new DaitanInvalidInputError(`Invalid part for string prompt "${name}" v${version}. Expected roleOrType 'string_template' with string content, or a direct string template.`);
      }
      templateInstance = PromptTemplate.fromTemplate(partDef.content);
      // PromptTemplate also infers inputVariables. Validate if needed.
      templateInstance.inputVariables = [...inputVariables]; // Explicitly set for consistency, though LC infers.
    }
  } catch (error) {
    const errorMsg = `Error creating LangChain template instance for prompt "${name}" v${version}: ${error.message}`;
    promptManagerLogger.error(`[${callId}] ${errorMsg}`, { parts, inputVariables, type, originalError: error });
    throw new DaitanConfigurationError(errorMsg, { name, version }, error);
  }

  const registeredPromptDetails = {
    name, version, description, parts, inputVariables,
    templateInstance, type,
    registeredAt: new Date(),
    customMeta,
  };

  versionsMap.set(version, registeredPromptDetails);
  if (setAsLatest) {
    versionsMap.set(LATEST_VERSION_TAG, version);
    promptManagerLogger.info(`Prompt "${name}" v${version} registered and set as 'latest'.`);
  } else {
    promptManagerLogger.info(`Prompt "${name}" v${version} registered.`);
  }

  return registeredPromptDetails;
};


/**
 * Retrieves a specific version of a registered LangChain prompt template instance.
 *
 * @public
 * @param {string} name - The unique name of the prompt template.
 * @param {string} [versionTag=LATEST_VERSION_TAG] - The version string (e.g., "1.0.0") or the tag 'latest'.
 * @returns {ChatPromptTemplate | PromptTemplate | undefined} The compiled LangChain prompt template instance,
 *          or `undefined` if the prompt name or version is not found.
 */
export const getPromptTemplate = (name, versionTag = LATEST_VERSION_TAG) => {
  const versionsMap = promptRegistry.get(name);
  if (!versionsMap) {
    promptManagerLogger.warn(`getPromptTemplate: No prompts found registered under name "${name}".`);
    return undefined;
  }

  let versionToRetrieve = versionTag;
  if (versionTag === LATEST_VERSION_TAG) {
    versionToRetrieve = versionsMap.get(LATEST_VERSION_TAG);
    if (!versionToRetrieve) {
      promptManagerLogger.warn(`getPromptTemplate: No 'latest' version explicitly set for prompt "${name}". Attempting to find most recently registered version.`);
      // Fallback: find the most recently registered version if 'latest' tag is missing
      let mostRecentPrompt = null;
      for (const [versionKey, promptDetail] of versionsMap.entries()) {
        if (versionKey !== LATEST_VERSION_TAG) { // Exclude the tag itself
          if (!mostRecentPrompt || promptDetail.registeredAt > mostRecentPrompt.registeredAt) {
            mostRecentPrompt = promptDetail;
          }
        }
      }
      if (mostRecentPrompt) {
        promptManagerLogger.info(`getPromptTemplate: Using most recently registered version "${mostRecentPrompt.version}" for prompt "${name}" as 'latest'.`);
        return mostRecentPrompt.templateInstance;
      } else {
        promptManagerLogger.error(`getPromptTemplate: No 'latest' tag and no other versions found for prompt "${name}".`);
        return undefined;
      }
    }
  }

  const promptDetails = versionsMap.get(versionToRetrieve);
  if (!promptDetails) {
    promptManagerLogger.warn(`getPromptTemplate: Prompt "${name}" version "${versionToRetrieve}" not found in registry.`);
    return undefined;
  }
  return promptDetails.templateInstance;
};

/**
 * Retrieves metadata for a specific prompt version, or metadata for all versions of a prompt if `versionTag` is omitted.
 * The returned metadata object(s) exclude the `templateInstance` itself.
 *
 * @public
 * @param {string} name - The name of the prompt template.
 * @param {string} [versionTag] - Optional: The version string or 'latest'. If not provided, returns an array of metadata for all registered versions of this prompt.
 * @returns {Omit<RegisteredPromptDetails, 'templateInstance'> | Array<Omit<RegisteredPromptDetails, 'templateInstance'>> | undefined}
 *          A single prompt metadata object, an array of metadata objects, or `undefined` if not found.
 */
export const getPromptMetadata = (name, versionTag) => {
  const versionsMap = promptRegistry.get(name);
  if (!versionsMap) {
    promptManagerLogger.debug(`getPromptMetadata: No prompts found for name "${name}".`);
    return undefined;
  }

  if (versionTag) {
    let versionToRetrieve = versionTag;
    if (versionTag === LATEST_VERSION_TAG) {
      versionToRetrieve = versionsMap.get(LATEST_VERSION_TAG);
      if (!versionToRetrieve) {
          promptManagerLogger.warn(`getPromptMetadata: No 'latest' version set for prompt "${name}" when requesting metadata for 'latest'.`);
          return undefined; // Or try fallback like in getPromptTemplate if desired behavior
      }
    }
    const promptDetails = versionsMap.get(versionToRetrieve);
    if (!promptDetails) {
      promptManagerLogger.warn(`getPromptMetadata: Prompt "${name}" version "${versionToRetrieve}" not found.`);
      return undefined;
    }
    const { templateInstance, ...metadata } = promptDetails; // Exclude templateInstance
    return metadata;
  } else {
    // Return metadata for all actual versions (excluding the 'latest' tag entry)
    return Array.from(versionsMap.values())
      .filter(pDetails => pDetails && typeof pDetails.version === 'string') // Ensure it's a real version entry
      .map(({ templateInstance, ...metadata }) => metadata);
  }
};

/**
 * Formats a registered prompt template with the given input values.
 * Also includes conceptual hooks for prompt evaluation logging (currently logs to debug).
 *
 * @public
 * @async
 * @param {string} name - The unique name of the prompt template.
 * @param {object} values - An object containing key-value pairs for all `inputVariables` defined in the prompt.
 * @param {string} [versionTag=LATEST_VERSION_TAG] - The version of the prompt to format (e.g., "1.0.0" or 'latest').
 * @param {object} [evaluationContext={}] - Optional context for prompt evaluation tracking (e.g., `{ runId: "...", userId: "..." }`).
 * @returns {Promise<string | import('@langchain/core/messages').BaseMessage[]>}
 *          The formatted prompt output: a string for `PromptTemplate`, or an array of `BaseMessage` objects for `ChatPromptTemplate`.
 * @throws {DaitanNotFoundError} If the specified prompt template or version is not found.
 * @throws {Error} If formatting fails (e.g., missing input variables for the template), propagated from LangChain.
 */
export const formatPrompt = async (name, values, versionTag = LATEST_VERSION_TAG, evaluationContext = {}) => {
  const callId = `formatPrompt-${name}-v${versionTag}`;
  const template = getPromptTemplate(name, versionTag);
  if (!template) {
    throw new DaitanNotFoundError(`Prompt template "${name}" (version/tag: "${versionTag}") not found in registry.`);
  }

  // Retrieve actual version string if 'latest' was used, for logging
  const versionsMap = promptRegistry.get(name);
  const actualVersion = (versionTag === LATEST_VERSION_TAG && versionsMap) ? versionsMap.get(LATEST_VERSION_TAG) : versionTag;
  const promptDetails = getPromptMetadata(name, actualVersion); // For logging

  // Conceptual Evaluation Hook: Log Prompt Usage
  const usageLogData = {
    promptName: name,
    promptVersion: promptDetails?.version || actualVersion, // Use resolved version if available
    timestamp: new Date().toISOString(),
    inputValuesKeys: Object.keys(values || {}), // Log keys of values, not sensitive values themselves by default
    evaluationContext,
  };
  promptManagerLogger.debug(`[${callId}] PromptFormatUsage (Conceptual Log):`, usageLogData);
  // In a real system: await logPromptUsageToEvaluationStore(usageLogData);

  try {
    // formatPromptValue is async for all LangChain BasePromptTemplate subclasses
    const promptValue = await template.formatPromptValue(values);
    let formattedOutput;

    if (template instanceof ChatPromptTemplate) {
      formattedOutput = promptValue.toChatMessages();
    } else if (template instanceof PromptTemplate) {
      formattedOutput = promptValue.toString();
    } else {
      // Should not happen if registerPrompt validates templateInstance creation correctly
      promptManagerLogger.error(`[${callId}] Unknown prompt template type encountered during formatting for "${name}" v${actualVersion}.`);
      throw new DaitanOperationError('Unknown prompt template type during formatting.');
    }

    promptManagerLogger.debug(`[${callId}] Prompt "${name}" v${actualVersion} formatted successfully.`, {
      outputType: typeof formattedOutput,
      // outputPreview: (typeof formattedOutput === 'string') ? truncateString(formattedOutput, 100) : `[${formattedOutput.length} messages]`
    });
    return formattedOutput;
  } catch (error) {
    promptManagerLogger.error(`[${callId}] Error formatting prompt "${name}" v${actualVersion}: ${error.message}`, { values, errorName: error.name });
    // Conceptual Evaluation Hook: Log Formatting Error
    // await logPromptFormattingError({ ...usageLogData, error: error.message, errorStack: error.stack });
    throw error; // Re-throw the LangChain formatting error
  }
};

/**
 * Lists metadata for all registered prompts and their versions.
 *
 * @public
 * @returns {Array<Omit<RegisteredPromptDetails, 'templateInstance'>>} An array of metadata objects for all prompt versions.
 */
export const listAllPrompts = () => { // Renamed from listPrompts for clarity
  const allPromptsMetadata = [];
  for (const [promptName, versionsMap] of promptRegistry.entries()) {
    for (const [versionKey, promptDetails] of versionsMap.entries()) {
      if (versionKey !== LATEST_VERSION_TAG && promptDetails && promptDetails.name) { // Filter out the 'latest' tag itself
        const { templateInstance, ...metadata } = promptDetails;
        allPromptsMetadata.push(metadata);
      }
    }
  }
  promptManagerLogger.debug(`listAllPrompts: Returning metadata for ${allPromptsMetadata.length} prompt versions.`);
  return allPromptsMetadata;
};

/**
 * Sets a specific registered version of a prompt as the 'latest' version for that prompt name.
 *
 * @public
 * @param {string} name - The name of the prompt template.
 * @param {string} version - The version string to set as 'latest'.
 * @throws {DaitanNotFoundError} If the prompt name or the specified version does not exist in the registry.
 */
export const setLatestPromptVersion = (name, version) => {
  const versionsMap = promptRegistry.get(name);
  if (!versionsMap) {
    throw new DaitanNotFoundError(`Prompt with name "${name}" not found in registry. Cannot set 'latest' version.`);
  }
  if (!versionsMap.has(version) || version === LATEST_VERSION_TAG) { // Version must be a real registered version
    throw new DaitanNotFoundError(`Prompt "${name}" version "${version}" not found or invalid. Register it first or provide a valid registered version string.`);
  }
  versionsMap.set(LATEST_VERSION_TAG, version);
  promptManagerLogger.info(`Prompt "${name}" version "${version}" is now marked as 'latest'.`);
};

/**
 * Clears all registered prompts and their versions from the in-memory registry.
 * Useful for testing or resetting state.
 *
 * @public
 */
export const clearAllPrompts = () => {
  const count = promptRegistry.size;
  promptRegistry.clear();
  promptManagerLogger.info(`All ${count} prompt names (and their versions) have been cleared from the registry.`);
};

// --- Conceptual Evaluation Utility Placeholders (from original) ---
// These would typically interact with an external evaluation/analytics system.
// For this library, they serve as conceptual hooks or examples.

// async function logPromptUsageToEvaluationStore(usageData) {
//   promptManagerLogger.debug("[EVAL_HOOK] Logged Prompt Usage:", usageData);
// }

// async function logPromptFormattingError(errorData) {
//   promptManagerLogger.error("[EVAL_HOOK] Logged Prompt Formatting Error:", errorData);
// }

// export async function getPromptEvaluationMetrics(promptName, promptVersion) {
//   promptManagerLogger.info(`[EVAL_HOOK] Conceptual: Fetching metrics for ${promptName} v${promptVersion}.`);
//   return {
//     message: "Evaluation metrics are conceptual in this library version.",
//     sampleMetrics: {
//       usageCount: Math.floor(Math.random() * 1000),
//       effectivenessScore: (Math.random() * 0.3 + 0.6).toFixed(2), // e.g. 0.60-0.90
//     }
//   };
// }