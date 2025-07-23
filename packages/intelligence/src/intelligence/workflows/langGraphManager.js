// intelligence/src/intelligence/workflows/langGraphManager.js
import { StateGraph, END } from '@langchain/langgraph';
import { BaseMessage } from '@langchain/core/messages'; // For type hints if needed in state
import { getLogger } from '@daitanjs/development';
import { getConfigManager } from '@daitanjs/config';
import {
  DaitanConfigurationError,
  DaitanOperationError,
} from '@daitanjs/error';

// Checkpointer imports are dynamically handled or assumed available if specific types are used.
// Example:
// import { SqliteSaver } from '@langchain/langgraph/checkpoint/sqlite';
// import { RedisSaver } from '@langchain/redis';
// import { PostgresSaver } from '@langchain/langgraph/checkpoint/postgres';

const langGraphManagerLogger = getLogger('daitan-langgraph-manager');

/**
 * @typedef {import('@langchain/core/callbacks/manager').Callbacks} Callbacks
 * @typedef {{ configurable?: Record<string, any>, callbacks?: Callbacks, recursionLimit?: number, [key: string]: any }} LangGraphRuntimeConfig
 * @typedef {import('@langchain/langgraph/checkpoint/base').BaseCheckpointSaver} BaseCheckpointSaver
 */

/**
 * @template TState - The type of the graph's state object.
 * @typedef {Object} DaitanLangGraphNode
 * @property {string} name - Unique name of the node.
 * @property {(state: TState, config?: LangGraphRuntimeConfig) => Promise<Partial<TState> | typeof END | string | void | { [key:string]: any }>} action -
 *           The async function to execute for this node.
 *           It receives the current state and runtime config.
 *           It can return:
 *           - A partial state object to update the graph's state.
 *           - `END` to terminate this path of the graph.
 *           - A string value, typically used by conditional edges for routing.
 *           - `void` or `undefined` if the node only has side effects and doesn't update state directly.
 *           - An object with arbitrary keys that will be merged into the state (common pattern).
 */

/**
 * @template TState - The type of the graph's state object.
 * @typedef {Object} DaitanLangGraphConditionalEdge
 * @property {string} sourceNode - Name of the source node from which this conditional edge originates.
 * @property {(state: TState) => string | Promise<string>} condition - An async function that receives the current state
 *           and must return a string. This string is then used as a key in the `pathMap`.
 * @property {Record<string, string | typeof END>} pathMap - An object mapping the string results from the `condition`
 *           function to the name of the next node or to `END`.
 */

/**
 * @typedef {Object} DaitanLangGraphEdge
 * @property {string} sourceNode - Name of the source node.
 * @property {string | typeof END} targetNode - Name of the target node, or `END` to terminate the path.
 */

export class DaitanLangGraph {
  /**
   * @param {Object} stateSchema - An object defining the shape and update mechanism for the graph's state channels.
   *                               This schema is passed directly to LangGraph's `StateGraph`.
   *                               Example: `{ messages: { value: (x, y) => x.concat(y), default: () => [] } }`
   * @param {object} [options={}]
   * @param {import('winston').Logger} [options.loggerInstance] - Optional logger.
   */
  constructor(stateSchema, options = {}) {
    this.logger = options.loggerInstance || langGraphManagerLogger;

    if (
      !stateSchema ||
      typeof stateSchema !== 'object' ||
      Object.keys(stateSchema).length === 0
    ) {
      this.logger.error(
        'stateSchema must be a non-empty object defining the graph state structure.'
      );
      throw new DaitanConfigurationError(
        'stateSchema is required for DaitanLangGraph.'
      );
    }
    // LangGraph StateGraph will validate the schema structure.
    this.graph = new StateGraph({ channels: stateSchema });
    this.nodes = new Map();
    this.compiledGraph = null;
    /** @type {BaseCheckpointSaver | null} */
    this.checkpointer = null;

    this.logger.info('DaitanLangGraph initialized.');
    this.logger.debug('State schema channels:', Object.keys(stateSchema));
  }

  /**
   * Adds a node to the graph.
   * @template TState
   * @param {DaitanLangGraphNode<TState>} nodeConfig - Configuration for the node.
   * @returns {this}
   */
  addNode(nodeConfig) {
    if (
      !nodeConfig ||
      !nodeConfig.name ||
      typeof nodeConfig.action !== 'function'
    ) {
      throw new DaitanConfigurationError(
        'Invalid node configuration: name and action function are required.',
        { name: nodeConfig?.name }
      );
    }
    if (this.nodes.has(nodeConfig.name)) {
      throw new DaitanConfigurationError(
        `Node with name "${nodeConfig.name}" already exists.`
      );
    }

    const wrappedAction = async (state, config) => {
      const nodeStartTime = Date.now();
      this.logger.debug(`Graph Node EXECUTING: "${nodeConfig.name}"`, {
        threadId: config?.configurable?.thread_id,
        stateKeys: Object.keys(state),
      });
      try {
        const output = await nodeConfig.action(state, config);
        const duration = Date.now() - nodeStartTime;
        this.logger.debug(`Graph Node COMPLETED: "${nodeConfig.name}"`, {
          threadId: config?.configurable?.thread_id,
          outputPreview:
            typeof output === 'string' || output === END
              ? output
              : output
              ? Object.keys(output)
              : 'void',
          durationMs: duration,
        });
        return output;
      } catch (error) {
        const duration = Date.now() - nodeStartTime;
        this.logger.error(
          `Graph Node ERROR in "${nodeConfig.name}": ${error.message}`,
          {
            threadId: config?.configurable?.thread_id,
            stateKeys: Object.keys(state),
            // stack: error.stack, // Log full stack for dev/debug
            durationMs: duration,
          },
          error
        ); // Pass full error object to logger
        // Propagate error to be handled by LangGraph or runtime
        throw new DaitanOperationError(
          `Error in graph node "${nodeConfig.name}": ${error.message}`,
          { nodeName: nodeConfig.name },
          error
        );
      }
    };

    this.graph.addNode(nodeConfig.name, wrappedAction);
    this.nodes.set(nodeConfig.name, nodeConfig);
    this.logger.debug(`Node "${nodeConfig.name}" added to graph definition.`);
    return this;
  }

  setEntryPoint(nodeName) {
    if (!this.nodes.has(nodeName)) {
      throw new DaitanConfigurationError(
        `Entry point node "${nodeName}" not found in added nodes.`
      );
    }
    this.graph.setEntryPoint(nodeName);
    this.logger.debug(`Graph entry point set to "${nodeName}".`);
    return this;
  }

  setFinishPoint(nodeName) {
    if (!this.nodes.has(nodeName)) {
      throw new DaitanConfigurationError(
        `Finish point node "${nodeName}" not found in added nodes.`
      );
    }
    this.graph.addEdge(nodeName, END); // LangGraph's END sentinel
    this.logger.debug(
      `Node "${nodeName}" designated as a finish point (edge to END added).`
    );
    return this;
  }

  /**
   * Adds a conditional edge to the graph.
   * @template TState
   * @param {DaitanLangGraphConditionalEdge<TState>} edgeConfig - Configuration for the conditional edge.
   * @returns {this}
   */
  addConditionalEdge(edgeConfig) {
    const { sourceNode, condition, pathMap } = edgeConfig;
    if (
      !sourceNode ||
      typeof condition !== 'function' ||
      typeof pathMap !== 'object' ||
      Object.keys(pathMap).length === 0
    ) {
      throw new DaitanConfigurationError(
        'Invalid conditional edge: sourceNode, condition function, and a non-empty pathMap object are required.',
        { sourceNode }
      );
    }
    if (!this.nodes.has(sourceNode)) {
      throw new DaitanConfigurationError(
        `Source node "${sourceNode}" for conditional edge not found.`
      );
    }
    Object.entries(pathMap).forEach(([pathKey, targetNodeName]) => {
      if (targetNodeName !== END && !this.nodes.has(targetNodeName)) {
        throw new DaitanConfigurationError(
          `Target node "${targetNodeName}" in pathMap (key: "${pathKey}") from "${sourceNode}" not found.`
        );
      }
    });

    const wrappedCondition = async (state, config) => {
      // LangGraph passes config to conditional edges too
      this.logger.debug(
        `Graph Edge CONDITION EVALUATING: from "${sourceNode}"`,
        {
          threadId: config?.configurable?.thread_id,
          stateKeys: Object.keys(state),
        }
      );
      try {
        const routeKey = await condition(state); // User's condition function
        if (
          typeof routeKey !== 'string' ||
          !Object.prototype.hasOwnProperty.call(pathMap, routeKey)
        ) {
          this.logger.error(
            `Conditional edge from "${sourceNode}" resolved to unknown route key: "${routeKey}". Valid keys: ${Object.keys(
              pathMap
            ).join(', ')}.`
          );
          throw new DaitanOperationError(
            `Conditional logic from node "${sourceNode}" returned unmappable route: "${routeKey}".`
          );
        }
        this.logger.debug(
          `Graph Edge ROUTE from "${sourceNode}" determined: "${routeKey}" -> "${
            pathMap[routeKey] || 'END'
          }"`,
          { threadId: config?.configurable?.thread_id }
        );
        return routeKey;
      } catch (error) {
        this.logger.error(
          `Error in conditional edge logic from "${sourceNode}": ${error.message}`,
          { threadId: config?.configurable?.thread_id },
          error
        );
        throw new DaitanOperationError(
          `Error in conditional edge from "${sourceNode}": ${error.message}`,
          { sourceNode },
          error
        );
      }
    };

    this.graph.addConditionalEdges(sourceNode, wrappedCondition, pathMap);
    this.logger.debug(
      `Conditional edge added from "${sourceNode}". PathMap keys: ${Object.keys(
        pathMap
      ).join(', ')}`
    );
    return this;
  }

  /**
   * Adds a direct edge from a source node to a target node or to END.
   * @param {DaitanLangGraphEdge} edgeConfig - Configuration for the edge.
   * @returns {this}
   */
  addEdge(edgeConfig) {
    const { sourceNode, targetNode } = edgeConfig;
    if (!sourceNode || !targetNode) {
      throw new DaitanConfigurationError(
        'Invalid edge: sourceNode and targetNode are required.'
      );
    }
    if (!this.nodes.has(sourceNode)) {
      throw new DaitanConfigurationError(
        `Source node "${sourceNode}" for edge not found.`
      );
    }
    if (targetNode !== END && !this.nodes.has(targetNode)) {
      throw new DaitanConfigurationError(
        `Target node "${targetNode}" for edge not found.`
      );
    }
    this.graph.addEdge(sourceNode, targetNode);
    this.logger.debug(
      `Edge added from "${sourceNode}" to "${
        targetNode === END ? 'END' : targetNode
      }".`
    );
    return this;
  }

  /**
   * Configures a checkpointer for graph state persistence.
   * @param {'memory' | BaseCheckpointSaver | { type: 'sqlite', dbPath?: string } | { type: 'redis', client: any, config?: Object } | { type: 'postgres', dbConnection: any, config?: Object } | null} checkpointerConfig
   *        - `'memory'`: Uses an in-memory SqliteSaver (requires `sqlite3` to be installed).
   *        - `BaseCheckpointSaver instance`: A pre-configured LangChain checkpointer.
   *        - `Object with type`: Specifies type of checkpointer:
   *          - `sqlite`: `dbPath` (e.g., './daitan_graph.sqlite' or ':memory:'). Requires `sqlite3`.
   *          - `redis`: `client` (ioredis instance), `config` (RedisSaver options). Requires `@langchain/redis` & `ioredis`.
   *          - `postgres`: `dbConnection` (pg Pool/Client), `config` (PostgresSaver options). Requires `@langchain/langgraph/checkpoint/postgres` & `pg`.
   *        - `null`: Explicitly disables persistence.
   * @returns {Promise<this>}
   */
  async withPersistence(checkpointerConfig) {
    if (checkpointerConfig === null) {
      this.checkpointer = null;
      this.logger.info(
        'Graph persistence explicitly disabled (checkpointer set to null).'
      );
      return this;
    }
    if (!checkpointerConfig) {
      // undefined or empty object
      this.logger.info(
        'No checkpointer configuration provided; graph will not have persistence unless set later.'
      );
      this.checkpointer = null;
      return this;
    }

    let checkpointerInstance = null;

    if (
      typeof checkpointerConfig === 'object' &&
      checkpointerConfig.get &&
      checkpointerConfig.put
    ) {
      // Duck-typing for BaseCheckpointSaver
      checkpointerInstance = checkpointerConfig;
      this.logger.info('Using pre-configured external checkpointer instance.');
    } else if (
      checkpointerConfig === 'memory' ||
      (typeof checkpointerConfig === 'object' &&
        checkpointerConfig.type === 'sqlite')
    ) {
      try {
        const { SqliteSaver } = await import(
          '@langchain/langgraph/checkpoint/sqlite'
        );
        const dbPath =
          typeof checkpointerConfig === 'object' && checkpointerConfig.dbPath
            ? checkpointerConfig.dbPath
            : ':memory:';
        checkpointerInstance = SqliteSaver.fromConnString(dbPath);
        this.logger.info(
          `Configured SqliteSaver checkpointer (path: "${dbPath}"). Ensure 'sqlite3' is installed.`
        );
      } catch (err) {
        this.logger.error(
          `Failed to initialize SqliteSaver. Ensure @langchain/langgraph and sqlite3 are installed. Error: ${err.message}`,
          err
        );
        throw new DaitanConfigurationError(
          `Failed to set up SqliteSaver: ${err.message}`,
          { type: 'sqlite' },
          err
        );
      }
    } else if (
      typeof checkpointerConfig === 'object' &&
      checkpointerConfig.type === 'redis'
    ) {
      try {
        const { RedisSaver } = await import('@langchain/redis');
        if (!checkpointerConfig.client)
          throw new Error(
            'Redis client instance (`client`) is required for RedisSaver.'
          );
        checkpointerInstance = new RedisSaver({
          client: checkpointerConfig.client,
          ...(checkpointerConfig.config || {}),
        });
        this.logger.info(
          "Configured RedisSaver checkpointer. Ensure '@langchain/redis' and 'ioredis' are installed."
        );
      } catch (err) {
        this.logger.error(
          `Failed to initialize RedisSaver. Ensure @langchain/redis and ioredis are installed, and a valid client is provided. Error: ${err.message}`,
          err
        );
        throw new DaitanConfigurationError(
          `Failed to set up RedisSaver: ${err.message}`,
          { type: 'redis' },
          err
        );
      }
    } else if (
      typeof checkpointerConfig === 'object' &&
      checkpointerConfig.type === 'postgres'
    ) {
      try {
        const { PostgresSaver } = await import(
          '@langchain/langgraph/checkpoint/postgres'
        );
        if (!checkpointerConfig.dbConnection)
          throw new Error(
            'PostgreSQL connection (`dbConnection` as pg.Pool or pg.Client) is required for PostgresSaver.'
          );
        checkpointerInstance = new PostgresSaver({
          dbConnection: checkpointerConfig.dbConnection,
          ...(checkpointerConfig.config || {}),
        });
        this.logger.info(
          "Configured PostgresSaver checkpointer. Ensure '@langchain/langgraph/checkpoint/postgres' and 'pg' are installed."
        );
      } catch (err) {
        this.logger.error(
          `Failed to initialize PostgresSaver. Ensure a pg Pool/Client is provided and 'pg' package is installed. Error: ${err.message}`,
          err
        );
        throw new DaitanConfigurationError(
          `Failed to set up PostgresSaver: ${err.message}`,
          { type: 'postgres' },
          err
        );
      }
    } else {
      this.logger.error(
        'Invalid or unsupported checkpointer configuration provided.',
        { checkpointerConfig }
      );
      throw new DaitanConfigurationError('Invalid checkpointer configuration.');
    }

    this.checkpointer = checkpointerInstance;
    return this;
  }

  compile(compileOptions = {}) {
    const configManager = getConfigManager(); // Lazy-load
    const { debug: compileDebug, interruptions } = compileOptions;
    const effectiveDebug =
      compileDebug !== undefined
        ? compileDebug
        : configManager.get('DEBUG_LANGGRAPH_COMPILE', false);

    const compileArgs = {};
    if (this.checkpointer) {
      compileArgs.checkpointer = this.checkpointer;
      this.logger.info('Compiling graph with persistence enabled.');
    } else {
      this.logger.warn(
        'Compiling graph without a checkpointer. State will not persist across runs for the same thread_id.'
      );
    }

    if (
      interruptions &&
      Array.isArray(interruptions) &&
      interruptions.length > 0
    ) {
      const interruptBefore = [];
      const interruptAfter = [];
      interruptions.forEach((intr) => {
        if (typeof intr === 'string') interruptBefore.push(intr);
        // Default to interruptBefore if just a string
        else if (typeof intr === 'object' && intr.before)
          interruptBefore.push(intr.before);
        else if (typeof intr === 'object' && intr.after)
          interruptAfter.push(intr.after);
      });
      if (interruptBefore.length > 0)
        compileArgs.interruptBefore = interruptBefore;
      if (interruptAfter.length > 0)
        compileArgs.interruptAfter = interruptAfter;
      if (interruptBefore.length > 0 || interruptAfter.length > 0) {
        this.logger.info('Graph compilation will include interruptions:', {
          before: interruptBefore,
          after: interruptAfter,
        });
      }
    }
    // LangSmith tracing for compiled graphs is typically enabled via environment variables (LANGCHAIN_TRACING_V2, etc.)
    // or by wrapping the invoke/stream calls with `traceable` from `langsmith/traceable`.

    try {
      this.compiledGraph = this.graph.compile(compileArgs);
      this.logger.info('DaitanLangGraph compiled successfully.');
      if (effectiveDebug) {
        this.logger.debug('Graph compilation arguments used:', compileArgs);
        this.logger.debug(
          'Nodes defined in graph:',
          Array.from(this.nodes.keys())
        );
        // For more detailed graph structure, one might inspect this.graph.nodes, this.graph.edges, etc.
        // but the compiled graph itself is opaque. `getGraph().printMermaid()` is useful on the StateGraph instance.
      }
    } catch (compileError) {
      this.logger.error(
        'DaitanLangGraph compilation FAILED.',
        {
          error: compileError.message,
          // stack: compileError.stack, // Log full stack for dev/debug
          compileArgs,
        },
        compileError
      );
      throw new DaitanOperationError(
        `Graph compilation failed: ${compileError.message}`,
        { compileArgs },
        compileError
      );
    }
    return this.compiledGraph;
  }

  getCompiledGraph() {
    if (!this.compiledGraph) {
      this.logger.error(
        'Graph has not been compiled yet. Call .compile() method first.'
      );
      throw new DaitanOperationError(
        'Graph not compiled. Call .compile() first.'
      );
    }
    return this.compiledGraph;
  }

  /**
   * Prints a Mermaid diagram representation of the defined graph structure (before compilation).
   * Useful for visualizing the graph.
   * @returns {string} Mermaid diagram string.
   */
  getMermaidDiagram() {
    if (this.graph && typeof this.graph.getGraph === 'function') {
      // getGraph().printMermaid() is a method on the underlying Graph representation
      // It might require access to the internal graph structure of StateGraph or a similar utility.
      // LangGraph's StateGraph itself has a .drawMermaid() method.
      try {
        return this.graph.drawMermaid();
      } catch (e) {
        this.logger.warn(
          `Could not generate Mermaid diagram: ${e.message}. This feature might depend on specific LangGraph version capabilities.`
        );
        return 'Error generating Mermaid diagram.';
      }
    }
    this.logger.warn(
      'Graph instance not available or getGraph method missing for Mermaid diagram generation.'
    );
    return 'Mermaid diagram not available.';
  }
}

/**
 * Helper function to create a basic state schema suitable for many chat agent graphs.
 * Includes channels for 'messages' (accumulates), 'input' (takes last), and 'errors' (accumulates).
 * @returns {Object} A state schema object for `DaitanLangGraph` or `StateGraph`.
 */
export const createChatAgentState = () => ({
  messages: {
    value: (x, y) => (x || []).concat(y || []), // Append new messages
    default: () => [], // Default to an empty array
  },
  input: {
    // To store the latest user input or intermediate inputs
    value: (x, y) => y, // Always take the last written value
    default: () => null,
  },
  errors: {
    // For nodes to report non-fatal errors or warnings
    value: (x, y) => {
      const currentErrors = x || [];
      if (Array.isArray(y))
        return currentErrors.concat(y.map((e) => String(e)));
      if (y) return [...currentErrors, String(y)];
      return currentErrors;
    },
    default: () => [],
  },
  // Example of other common state fields for agents:
  // agent_scratchpad: {
  //   value: (x, y) => typeof y === 'string' ? (x || "") + "\n" + y : x, // Append strings, good for thoughts
  //   default: () => "",
  // },
  // current_tool_calls: {
  //    value: (x,y) => y, // Stores tool calls from LLM for the tool execution node
  //    default: () => [],
  // }
});
