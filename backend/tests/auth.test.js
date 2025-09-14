/**
 * Authentication module tests
 */

const { registerWithEmail, forgotPassword } = require('../src/modules/auth/controller');
const { getAuth, getFirestore } = require('firebase-admin/auth');
const { sendEmail } = require('../src/lib/mail');
const { createAuditLog } = require('../src/modules/audit/service');

// Mock the Firebase services
jest.mock('firebase-admin/auth');
jest.mock('firebase-admin/firestore');
jest.mock('../src/lib/mail');
jest.mock('../src/modules/audit/service');

describe('Authentication Controller', () => {
  let mockReq, mockRes;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup mock request and response
    mockReq = global.testUtils.mockRequest();
    mockRes = global.testUtils.mockResponse();
  });

  describe('registerWithEmail', () => {
    it('should register a new user successfully', async () => {
      // Mock data
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        nickname: 'testuser',
      };

      mockReq.body = userData;

      // Mock Firebase responses
      const mockAuth = {
        getUserByEmail: jest.fn().mockRejectedValue(new Error('User not found')),
        createUser: jest.fn().mockResolvedValue({
          uid: 'test-uid-123',
          email: userData.email,
        }),
        generateEmailVerificationLink: jest.fn().mockResolvedValue(
          'https://example.com/verify?token=abc123'
        ),
      };

      const mockFirestore = {
        collection: jest.fn(() => ({
          where: jest.fn(() => ({
            limit: jest.fn(() => ({
              get: jest.fn().mockResolvedValue({ empty: true }),
            })),
          })),
          doc: jest.fn(() => ({
            set: jest.fn().mockResolvedValue(),
          })),
        })),
      };

      getAuth.mockReturnValue(mockAuth);
      getFirestore.mockReturnValue(mockFirestore);
      sendEmail.mockResolvedValue();
      createAuditLog.mockResolvedValue();

      // Execute function
      await registerWithEmail(mockReq, mockRes);

      // Assertions
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          ok: true,
          data: expect.objectContaining({
            userId: 'test-uid-123',
            email: userData.email,
            nickname: userData.nickname,
          }),
        })
      );

      // Verify Firebase calls
      expect(mockAuth.createUser).toHaveBeenCalledWith({
        email: userData.email,
        password: userData.password,
        emailVerified: false,
      });

      // Verify email was sent
      expect(sendEmail).toHaveBeenCalled();
    });

    it('should return error for duplicate email', async () => {
      const userData = {
        email: 'existing@example.com',
        password: 'password123',
        nickname: 'testuser',
      };

      mockReq.body = userData;

      // Mock existing user
      const mockAuth = {
        getUserByEmail: jest.fn().mockResolvedValue({
          uid: 'existing-uid',
          email: userData.email,
        }),
      };

      getAuth.mockReturnValue(mockAuth);

      // Execute function
      await registerWithEmail(mockReq, mockRes);

      // Assertions
      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          ok: false,
          error: expect.objectContaining({
            code: 'DUPLICATE_EMAIL',
          }),
        })
      );
    });

    it('should return error for duplicate nickname', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        nickname: 'existinguser',
      };

      mockReq.body = userData;

      // Mock user doesn't exist but nickname is taken
      const mockAuth = {
        getUserByEmail: jest.fn().mockRejectedValue(new Error('User not found')),
      };

      const mockFirestore = {
        collection: jest.fn(() => ({
          where: jest.fn(() => ({
            limit: jest.fn(() => ({
              get: jest.fn().mockResolvedValue({ empty: false }),
            })),
          })),
        })),
      };

      getAuth.mockReturnValue(mockAuth);
      getFirestore.mockReturnValue(mockFirestore);

      // Execute function
      await registerWithEmail(mockReq, mockRes);

      // Assertions
      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          ok: false,
          error: expect.objectContaining({
            code: 'DUPLICATE_NICKNAME',
          }),
        })
      );
    });
  });

  describe('forgotPassword', () => {
    it('should send password reset email successfully', async () => {
      const userData = {
        email: 'test@example.com',
      };

      mockReq.body = userData;

      // Mock existing user
      const mockAuth = {
        getUserByEmail: jest.fn().mockResolvedValue({
          uid: 'test-uid-123',
          email: userData.email,
        }),
        generatePasswordResetLink: jest.fn().mockResolvedValue(
          'https://example.com/reset?token=abc123'
        ),
      };

      const mockFirestore = {
        collection: jest.fn(() => ({
          doc: jest.fn(() => ({
            set: jest.fn().mockResolvedValue(),
          })),
        })),
      };

      getAuth.mockReturnValue(mockAuth);
      getFirestore.mockReturnValue(mockFirestore);
      sendEmail.mockResolvedValue();
      createAuditLog.mockResolvedValue();

      // Execute function
      await forgotPassword(mockReq, mockRes);

      // Assertions
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          ok: true,
          data: expect.objectContaining({
            message: expect.stringContaining('password reset link has been sent'),
          }),
        })
      );

      // Verify password reset link was generated
      expect(mockAuth.generatePasswordResetLink).toHaveBeenCalledWith(
        userData.email,
        expect.objectContaining({
          url: expect.stringContaining('reset-password'),
        })
      );

      // Verify email was sent
      expect(sendEmail).toHaveBeenCalled();
    });

    it('should handle non-existent email gracefully', async () => {
      const userData = {
        email: 'nonexistent@example.com',
      };

      mockReq.body = userData;

      // Mock user doesn't exist
      const mockAuth = {
        getUserByEmail: jest.fn().mockRejectedValue(new Error('User not found')),
      };

      getAuth.mockReturnValue(mockAuth);

      // Execute function
      await forgotPassword(mockReq, mockRes);

      // Assertions - should still return success to prevent email enumeration
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          ok: true,
          data: expect.objectContaining({
            message: expect.stringContaining('password reset link has been sent'),
          }),
        })
      );
    });
  });
});







