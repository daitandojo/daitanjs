// src/cli/src/commands/config_init_queue_security.test.js
import { Command } from 'commander';
import { registerConfigCommands } from './config.js';
import { registerInitCommands } from './init.js';
import { registerQueueCommands } from './queue.js';
import { registerSecurityCommands } from './security.js';

// --- Mock Service Imports ---
import * as config from '@daitanjs/config';
import * as security from '@daitanjs/security';
import * as queues from '@daitanjs/queues';
import * as intelligence from '@daitanjs/intelligence'; // Needed for init command

// --- Mock External Library Imports ---
import inquirer from 'inquirer';
import express from 'express';
import { createBullBoard } from '@bull-board/api';
import { ExpressAdapter } from '@bull-board/express';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter.js';
import fs from 'fs/promises';

// --- Mocking Setup ---
jest.mock('@daitanjs/config');
jest.mock('@daitanjs/security');
jest.mock('@daitanjs/queues');
jest.mock('@daitanjs/intelligence');

jest.mock('inquirer');
jest.mock('express');
jest.mock('@bull-board/api');
jest.mock('@bull-board/express');
jest.mock('@bull-board/api/bullMQAdapter.js');
jest.mock('fs/promises');

jest.mock('@daitanjs/development', () => ({
  getLogger: () => ({ error: jest.fn(), info: jest.fn(), debug: jest.fn() }),
  getRequiredEnvVariable: jest.fn((key) => {
    if (key === 'JWT_SECRET') return 'DUMMY_JWT_SECRET';
    return 'mock-value';
  }),
  loadEnvironmentFiles: jest.fn(),
}));

global.console = { ...global.console, log: jest.fn(), error: jest.fn() };

describe('@daitanjs/cli Assorted Commands', () => {
  let program;

  beforeEach(() => {
    program = new Command();
    registerConfigCommands(program);
    registerInitCommands(program);
    registerQueueCommands(program);
    registerSecurityCommands(program);
    jest.clearAllMocks();
  });

  describe('config command', () => {
    it('should get and display the configuration from ConfigManager', async () => {
      config.getConfigManager.mockReturnValue({
        configStore: {
          NODE_ENV: 'development',
          OPENAI_API_KEY: 'sk-1234567890',
        },
      });
      await program.parseAsync(['node', 'daitan', 'config']);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('OPENAI_API_KEY')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('********7890')
      );
    });
  });

  describe('init command', () => {
    it('should scaffold a new project', async () => {
      fs.mkdir.mockResolvedValue();
      fs.writeFile.mockResolvedValue();
      inquirer.prompt.mockResolvedValue({ createPackageJson: true });
      await program.parseAsync(['node', 'daitan', 'init', 'my-new-app']);
      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('my-new-app'),
        { recursive: true }
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.env'),
        expect.any(String),
        'utf-8'
      );
    });
  });

  describe('queue dashboard command', () => {
    it('should set up an express server and Bull Board', async () => {
      const mockApp = { use: jest.fn(), listen: jest.fn((port, cb) => cb()) };
      const mockExpressAdapter = {
        setBasePath: jest.fn(),
        getRouter: jest.fn(() => 'mock-router'),
      };
      express.mockReturnValue(mockApp);
      ExpressAdapter.mockReturnValue(mockExpressAdapter);
      queues.createQueue.mockReturnValue('mock-queue-instance');
      await program.parseAsync([
        'node',
        'daitan',
        'queue',
        'dashboard',
        '--port',
        '5000',
      ]);
      expect(express).toHaveBeenCalled();
      expect(createBullBoard).toHaveBeenCalled();
      expect(mockApp.listen).toHaveBeenCalledWith(5000, expect.any(Function));
    });
  });

  describe('security generate-token command', () => {
    it('should call generateJWT with the correct parameters', async () => {
      security.generateJWT.mockReturnValue('generated.jwt.token');
      const payload = '{"userId":123,"role":"admin"}';

      await program.parseAsync([
        'node',
        'daitan',
        'security',
        'generate-token',
        '--payload',
        payload,
        '--expires-in',
        '2h',
      ]);

      expect(security.generateJWT).toHaveBeenCalledWith({
        payload: { userId: 123, role: 'admin' },
        secretOrPrivateKey: 'DUMMY_JWT_SECRET',
        options: { expiresIn: '2h' },
      });
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('generated.jwt.token')
      );
    });

    it('should handle JSON parsing errors for the payload gracefully', async () => {
      const invalidPayload = '{"userId":123,"role" "admin"}';
      await program.parseAsync([
        'node',
        'daitan',
        'security',
        'generate-token',
        '--payload',
        invalidPayload,
      ]);
      expect(security.generateJWT).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Invalid JSON format for payload')
      );
    });
  });
});
