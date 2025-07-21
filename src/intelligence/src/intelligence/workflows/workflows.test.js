// intelligence/src/intelligence/workflows/workflows.test.js
/**
 * @file Integration tests for high-level agentic workflows.
 * @module @daitanjs/intelligence/workflows/workflows.test
 */
import { END } from '@langchain/langgraph';
import { DaitanLangGraph, createChatAgentState } from './langGraphManager.js';
import { createPlanAndExecuteAgentGraph } from './planAndExecuteAgentGraph.js';
import { createGraphRunner } from './graphRunner.js';
import { LLMService } from '../../services/llmService.js';
import { HumanMessage } from '@langchain/core/messages';
import { DynamicTool } from '@langchain/core/tools';
import { DaitanInvalidInputError } from '@daitanjs/error';

// --- Mocking Setup ---
jest.mock('../../services/llmService.js');
jest.mock('@daitanjs/development', () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));
jest.mock('@daitanjs/config', () => ({
  getConfigManager: jest.fn(() => ({
    get: jest.fn().mockReturnValue(false),
  })),
}));

describe('Agentic Workflows (LangGraph)', () => {
  let llmService;
  let mockTool;

  beforeEach(() => {
    jest.clearAllMocks();

    llmService = new LLMService();
    // Mock the primary LLM interaction method used by all graph nodes.
    llmService.generate = jest.fn();

    mockTool = new DynamicTool({
      name: 'test_tool',
      description: 'A mock tool for testing.',
      func: async (input) => `Result for tool input: ${JSON.stringify(input)}`,
    });
  });

  describe('DaitanLangGraph Manager', () => {
    it('should correctly add nodes, edges, and call compile', () => {
      const stateSchema = createChatAgentState();
      const graph = new DaitanLangGraph(stateSchema);

      // We mock the underlying LangGraph instance to isolate our wrapper's logic.
      const mockLangGraphInstance = {
        addNode: jest.fn(),
        setEntryPoint: jest.fn(),
        addEdge: jest.fn(),
        addConditionalEdges: jest.fn(),
        compile: jest.fn().mockReturnValue({ invoke: () => {} }),
        drawMermaid: jest.fn(),
      };
      graph.graph = mockLangGraphInstance;

      graph
        .addNode({ name: 'start', action: async (s) => s })
        .addNode({ name: 'end', action: async (s) => s })
        .setEntryPoint('start')
        .addEdge({ sourceNode: 'start', targetNode: 'end' })
        .setFinishPoint('end')
        .compile();

      expect(mockLangGraphInstance.addNode).toHaveBeenCalledTimes(2);
      expect(mockLangGraphInstance.setEntryPoint).toHaveBeenCalledWith('start');
      expect(mockLangGraphInstance.addEdge).toHaveBeenCalledWith(
        'start',
        'end'
      );
      expect(mockLangGraphInstance.addEdge).toHaveBeenCalledWith('end', END);
      expect(mockLangGraphInstance.compile).toHaveBeenCalledTimes(1);
    });

    it('should throw an error if adding a node with a duplicate name', () => {
      const graph = new DaitanLangGraph(createChatAgentState());
      graph.addNode({ name: 'duplicate_node', action: async () => {} });
      expect(() =>
        graph.addNode({ name: 'duplicate_node', action: async () => {} })
      ).toThrow('Node with name "duplicate_node" already exists.');
    });
  });

  describe('Plan-and-Execute Agent Graph', () => {
    it('should create a compilable graph instance', async () => {
      const compiledGraph = await createPlanAndExecuteAgentGraph(llmService, [
        mockTool,
      ]);
      expect(compiledGraph).toBeDefined();
      expect(typeof compiledGraph.invoke).toBe('function');
      expect(typeof compiledGraph.stream).toBe('function');
    });

    it('should run a simple plan-execute-synthesize flow successfully', async () => {
      const mockPlan = [
        {
          step: 1,
          task: 'Use the test tool with specific input',
          toolToUse: 'test_tool',
          toolInput: { data: 'test data' },
        },
      ];
      const finalAnswerText =
        'The final answer is: Result for tool input: {"data":"test data"}';

      // Mock the LLMService responses for each node
      llmService.generate
        .mockResolvedValueOnce({ response: mockPlan, usage: {} }) // 1. Planner
        .mockResolvedValueOnce({ response: finalAnswerText, usage: {} }); // 2. Synthesizer

      const compiledGraph = await createPlanAndExecuteAgentGraph(llmService, [
        mockTool,
      ]);
      const graphRunner = createGraphRunner(compiledGraph);

      const initialState = {
        originalQuery: 'Run a test',
        inputMessage: new HumanMessage('Run a test'),
        llmServiceInstance: llmService,
        toolsMap: { [mockTool.name]: mockTool },
        verbose: false,
      };

      const finalState = await graphRunner(initialState);

      // Verify planner was called correctly
      expect(llmService.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({ response: { format: 'json' } }),
        })
      );

      // Verify executor worked by checking the updated plan state
      expect(finalState.plan[0].status).toBe('completed');
      expect(finalState.plan[0].result).toContain('{"data":"test data"}');

      // Verify synthesizer was called correctly
      expect(llmService.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.objectContaining({
            user: expect.stringContaining('PLAN EXECUTION SUMMARY'),
          }),
        })
      );

      // Verify the final output
      expect(finalState.finalAnswer).toBe(finalAnswerText);
      expect(llmService.generate).toHaveBeenCalledTimes(2);
    });

    it('should handle a planning failure gracefully', async () => {
      // Mock the planner to return an invalid plan
      llmService.generate.mockResolvedValueOnce({
        response: { not_a_plan: 'invalid' },
        usage: {},
      });

      const compiledGraph = await createPlanAndExecuteAgentGraph(llmService, [
        mockTool,
      ]);
      const graphRunner = createGraphRunner(compiledGraph);

      const initialState = {
        originalQuery: 'This will fail planning',
        llmServiceInstance: llmService,
        toolsMap: { [mockTool.name]: mockTool },
      };

      const finalState = await graphRunner(initialState);

      expect(finalState.finalAnswer).toContain('Execution failed');
      expect(finalState.currentPipelineError).toContain(
        'Planner failed to generate a valid plan'
      );
      expect(llmService.generate).toHaveBeenCalledTimes(1);
    });
  });
});
