// intelligence/src/intelligence/tools/tool-registries.js
/**
 * @file Defines tool registries and helper functions for retrieving tools.
 * @module @daitanjs/intelligence/tools/tool-registries
 *
 * @description This module is isolated to prevent circular dependencies. It imports
 * all tools to create registries and exports helper functions for accessing them.
 */
import { getLogger } from '@daitanjs/development';

// Import all tools to populate registries
import { calculatorTool } from './calculatorTool.js';
import { wikipediaSearchTool } from './wikipediaSearchTool.js';
import { cliTool } from './cliTool.js';
import { webSearchTool } from './webSearchTool.js';
import { userManagementTool } from './userManagementTool.js';
import { csvQueryTool } from './csvQueryTool.js';
import { createPaymentIntentTool } from './createPaymentIntentTool.js';
import { youtubeSearchTool } from './youtubeSearchTool.js';
import { processYoutubeAudioTool } from './processYoutubeAudioTool.js';
import { imageGenerationTool } from './imageGenerationTool.js';
import {
  searchGmailTool,
  readEmailContentTool,
  createGmailDraftTool,
} from './gmailTools.js';
import { calendarTool } from './calendarTool.js';
import {
  createGoogleDocTool,
  createGoogleSheetTool,
} from './googleDriveTools.js';
import { ragTool } from './ragTool.js';

const toolsRegistryLogger = getLogger('daitan-tools-registry');

const DEFAULT_TOOLS_REGISTRY = {
  calculator: calculatorTool,
  wikipedia_search: wikipediaSearchTool,
  command_line_interface: cliTool,
  web_search: webSearchTool,
  knowledge_base_tool: ragTool,
};

const DAITAN_PLATFORM_TOOLS_REGISTRY = {
  user_management: userManagementTool,
  csv_query_tool: csvQueryTool,
  create_payment_intent: createPaymentIntentTool,
  youtube_search: youtubeSearchTool,
  process_youtube_audio: processYoutubeAudioTool,
  generate_image: imageGenerationTool,
  search_gmail: searchGmailTool,
  read_email_content: readEmailContentTool,
  create_gmail_draft: createGmailDraftTool,
  google_calendar_tool: calendarTool,
  create_google_doc: createGoogleDocTool,
  create_google_sheet: createGoogleSheetTool,
};

function getToolsFromRegistry(toolNames, registry, registryName) {
  if (!Array.isArray(toolNames) || toolNames.length === 0) {
    return Object.values(registry);
  }
  const selectedTools = [];
  for (const name of toolNames) {
    if (registry[name]) {
      selectedTools.push(registry[name]);
    } else {
      toolsRegistryLogger.warn(
        `Tool "${name}" not found in ${registryName} registry.`
      );
    }
  }
  return selectedTools;
}

export const getDefaultTools = (toolNames) =>
  getToolsFromRegistry(toolNames, DEFAULT_TOOLS_REGISTRY, 'default');

export const getDaitanPlatformTools = (toolNames) =>
  getToolsFromRegistry(
    toolNames,
    DAITAN_PLATFORM_TOOLS_REGISTRY,
    'Daitan Platform'
  );
