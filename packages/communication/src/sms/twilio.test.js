// src/communication/src/sms/twilio.test.js
import twilio from 'twilio';
import {
  sendSMS,
  sendWhatsapp,
  createMessageTemplate,
  composeMessageFromTemplate,
} from './twilio.js';
import { getConfigManager } from '@daitanjs/config';
import {
  DaitanInvalidInputError,
  DaitanApiError,
  DaitanConfigurationError,
} from '@daitanjs/error';

// --- Mocking Setup ---
const mockCreate = jest.fn();
jest.mock('twilio', () => {
  return jest.fn().mockImplementation(() => {
    return {
      messages: {
        create: mockCreate,
      },
    };
  });
});

jest.mock('@daitanjs/development', () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

jest.mock('@daitanjs/config');
const { getConfigManager: getConfigManagerMock } =
  jest.requireMock('@daitanjs/config');

// Default mock implementation for getConfigManager
getConfigManagerMock.mockReturnValue({
  get: jest.fn((key) => {
    const config = {
      TWILIO_ACCOUNTSID: 'AC_dummy_sid',
      TWILIO_AUTHTOKEN: 'dummy_auth_token',
      TWILIO_SENDER: '+15551112222',
      TWILIO_WHATSAPP_SENDER: 'whatsapp:+15553334444',
    };
    return config[key];
  }),
});

describe('@daitanjs/communication/sms/twilio', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreate.mockResolvedValue({ sid: 'SM_dummy_message_sid' });
  });

  describe('sendSMS', () => {
    it('should send an SMS with the correct parameters', async () => {
      const recipient = '+15558889999';
      const messageBody = 'Hello from DaitanJS!';

      // Use the new single-parameter object API
      const sid = await sendSMS({ recipient, messageBody });

      expect(twilio).toHaveBeenCalledWith('AC_dummy_sid', 'dummy_auth_token');
      expect(mockCreate).toHaveBeenCalledWith({
        to: recipient,
        from: '+15551112222',
        body: messageBody,
      });
      expect(sid).toBe('SM_dummy_message_sid');
    });

    it('should throw DaitanInvalidInputError for invalid recipient or message', async () => {
      await expect(
        sendSMS({ recipient: 'not-a-number', messageBody: 'test' })
      ).rejects.toThrow(DaitanInvalidInputError);
      await expect(
        sendSMS({ recipient: '+15551112222', messageBody: ' ' })
      ).rejects.toThrow(DaitanInvalidInputError);
    });

    it('should throw DaitanConfigurationError if Twilio credentials are not set', async () => {
      // Override the mock to simulate no config
      getConfigManagerMock().get.mockReturnValue(undefined);
      await expect(
        sendSMS({ recipient: '+15551112222', messageBody: 'test' })
      ).rejects.toThrow(DaitanConfigurationError);
    });

    it('should wrap a Twilio API error in a DaitanApiError', async () => {
      const twilioError = new Error('Invalid parameter: To');
      twilioError.code = 21211;
      twilioError.status = 400;
      mockCreate.mockRejectedValue(twilioError);

      await expect(
        sendSMS({ recipient: '+15551112222', messageBody: 'test' })
      ).rejects.toThrow(DaitanApiError);
      try {
        await sendSMS({ recipient: '+15551112222', messageBody: 'test' });
      } catch (e) {
        expect(e.httpStatusCode).toBe(400);
        expect(e.message).toContain('Invalid parameter: To');
        expect(e.details.apiErrorCode).toBe(21211);
      }
    });
  });

  describe('sendWhatsapp', () => {
    it('should send a WhatsApp message with the correct parameters', async () => {
      const recipient = '+15558889999';
      const messageBody = 'WhatsApp hello!';

      await sendWhatsapp({ recipient, messageBody });

      expect(mockCreate).toHaveBeenCalledWith({
        to: `whatsapp:${recipient}`,
        from: 'whatsapp:+15553334444',
        body: messageBody,
      });
    });

    it('should use a custom WhatsApp sender if provided', async () => {
      const customSender = 'whatsapp:+15557778888';
      await sendWhatsapp({
        recipient: '+123456789',
        messageBody: 'test',
        from: customSender,
      });
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          from: customSender,
        })
      );
    });
  });

  describe('Templating', () => {
    it('createMessageTemplate should return a function', () => {
      const template = createMessageTemplate('Hello {{name}}!');
      expect(typeof template).toBe('function');
    });

    it('composeMessageFromTemplate should correctly replace placeholders', () => {
      const template = createMessageTemplate(
        'Your code is {{code}}. It expires in {{minutes}} minutes.'
      );
      const message = composeMessageFromTemplate(template, {
        code: '123456',
        minutes: 5,
      });
      expect(message).toBe('Your code is 123456. It expires in 5 minutes.');
    });

    it('composeMessageFromTemplate should handle missing placeholders gracefully', () => {
      const template = createMessageTemplate(
        'Hello {{name}}. Welcome, {{name}}!'
      );
      const message = composeMessageFromTemplate(template, { user: 'Alice' });
      expect(message).toBe('Hello {{name}}. Welcome, {{name}}!');
    });
  });
});
