/**
 * Email Service Unit Tests
 *
 * Tests for email template generation and sending functionality
 */

const { sendInviteEmail } = require('../../utilities/email-service');

// Mock Resend
jest.mock('resend', () => {
  return {
    Resend: jest.fn().mockImplementation(() => ({
      emails: {
        send: jest.fn().mockResolvedValue({
          data: { id: 'mock-email-id-123' },
          error: null
        })
      }
    }))
  };
});

describe('Email Service - sendInviteEmail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should send invite email with all required fields', async () => {
    const options = {
      toEmail: 'test@example.com',
      inviterName: 'Admin User',
      inviteCode: 'ABC-DEF-GHI',
      inviteeName: 'Test User',
      customMessage: 'Welcome to our platform!',
      experiencesCount: 2,
      destinationsCount: 3
    };

    const result = await sendInviteEmail(options);

    expect(result).toBeDefined();
    expect(result.data.id).toBe('mock-email-id-123');
  });

  it('should handle optional fields gracefully', async () => {
    const options = {
      toEmail: 'test@example.com',
      inviterName: 'Admin User',
      inviteCode: 'ABC-DEF-GHI'
    };

    const result = await sendInviteEmail(options);
    expect(result).toBeDefined();
  });

  it('should include invite code in email', async () => {
    const Resend = require('resend').Resend;
    const mockSend = new Resend().emails.send;

    const options = {
      toEmail: 'test@example.com',
      inviterName: 'Admin',
      inviteCode: 'XYZ-123-ABC'
    };

    await sendInviteEmail(options);

    expect(mockSend).toHaveBeenCalled();
    const callArgs = mockSend.mock.calls[0][0];
    expect(callArgs.html).toContain('XYZ-123-ABC');
    expect(callArgs.to).toBe('test@example.com');
  });

  it('should generate signup URL with invite code', async () => {
    const Resend = require('resend').Resend;
    const mockSend = new Resend().emails.send;

    const options = {
      toEmail: 'test@example.com',
      inviterName: 'Admin',
      inviteCode: 'TEST-INV-123'
    };

    await sendInviteEmail(options);

    const callArgs = mockSend.mock.calls[0][0];
    expect(callArgs.html).toContain('signup?invite=TEST-INV-123');
  });

  it('should include custom message if provided', async () => {
    const Resend = require('resend').Resend;
    const mockSend = new Resend().emails.send;

    const options = {
      toEmail: 'test@example.com',
      inviterName: 'Admin',
      inviteCode: 'ABC-DEF-GHI',
      customMessage: 'Special invitation message'
    };

    await sendInviteEmail(options);

    const callArgs = mockSend.mock.calls[0][0];
    expect(callArgs.html).toContain('Special invitation message');
  });

  it('should include experience count if provided', async () => {
    const Resend = require('resend').Resend;
    const mockSend = new Resend().emails.send;

    const options = {
      toEmail: 'test@example.com',
      inviterName: 'Admin',
      inviteCode: 'ABC-DEF-GHI',
      experiencesCount: 5
    };

    await sendInviteEmail(options);

    const callArgs = mockSend.mock.calls[0][0];
    expect(callArgs.html).toContain('5');
    expect(callArgs.html).toMatch(/experience/i);
  });

  it('should handle plural forms correctly', async () => {
    const Resend = require('resend').Resend;
    const mockSend = new Resend().emails.send;

    // Test singular
    await sendInviteEmail({
      toEmail: 'test@example.com',
      inviterName: 'Admin',
      inviteCode: 'ABC-DEF-GHI',
      experiencesCount: 1,
      destinationsCount: 1
    });

    let callArgs = mockSend.mock.calls[0][0];
    expect(callArgs.html).toMatch(/1.*experience[^s]/i);

    // Test plural
    await sendInviteEmail({
      toEmail: 'test@example.com',
      inviterName: 'Admin',
      inviteCode: 'ABC-DEF-GHI',
      experiencesCount: 3,
      destinationsCount: 2
    });

    callArgs = mockSend.mock.calls[1][0];
    expect(callArgs.html).toMatch(/3.*experiences/i);
  });

  it('should use default frontend URL if not configured', async () => {
    const Resend = require('resend').Resend;
    const mockSend = new Resend().emails.send;

    const originalEnv = process.env.FRONTEND_URL;
    delete process.env.FRONTEND_URL;

    const options = {
      toEmail: 'test@example.com',
      inviterName: 'Admin',
      inviteCode: 'ABC-DEF-GHI'
    };

    await sendInviteEmail(options);

    const callArgs = mockSend.mock.calls[0][0];
    expect(callArgs.html).toContain('http://localhost:3000/signup?invite=ABC-DEF-GHI');

    process.env.FRONTEND_URL = originalEnv;
  });

  it('should throw error on email send failure', async () => {
    const Resend = require('resend').Resend;
    const mockInstance = new Resend();
    mockInstance.emails.send.mockResolvedValueOnce({
      data: null,
      error: { message: 'Email send failed' }
    });

    const options = {
      toEmail: 'invalid@example.com',
      inviterName: 'Admin',
      inviteCode: 'ABC-DEF-GHI'
    };

    await expect(sendInviteEmail(options)).rejects.toThrow('Email send failed');
  });

  it('should include both plain text and HTML versions', async () => {
    const Resend = require('resend').Resend;
    const mockSend = new Resend().emails.send;

    const options = {
      toEmail: 'test@example.com',
      inviterName: 'Admin',
      inviteCode: 'ABC-DEF-GHI'
    };

    await sendInviteEmail(options);

    const callArgs = mockSend.mock.calls[0][0];
    expect(callArgs.html).toBeDefined();
    expect(callArgs.text).toBeDefined();
    expect(typeof callArgs.html).toBe('string');
    expect(typeof callArgs.text).toBe('string');
  });

  it('should set correct email subject', async () => {
    const Resend = require('resend').Resend;
    const mockSend = new Resend().emails.send;

    const options = {
      toEmail: 'test@example.com',
      inviterName: 'John Doe',
      inviteCode: 'ABC-DEF-GHI'
    };

    await sendInviteEmail(options);

    const callArgs = mockSend.mock.calls[0][0];
    expect(callArgs.subject).toContain('John Doe');
    expect(callArgs.subject).toContain('Biensperience');
  });

  it('should personalize greeting with invitee name', async () => {
    const Resend = require('resend').Resend;
    const mockSend = new Resend().emails.send;

    const options = {
      toEmail: 'test@example.com',
      inviterName: 'Admin',
      inviteCode: 'ABC-DEF-GHI',
      inviteeName: 'Jane Smith'
    };

    await sendInviteEmail(options);

    const callArgs = mockSend.mock.calls[0][0];
    expect(callArgs.html).toContain('Jane Smith');
  });
});
