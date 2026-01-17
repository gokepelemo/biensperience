/**
 * AWS S3 Security Tests
 *
 * Tests path traversal prevention and security validation
 */

const path = require('path');
const fs = require('fs');
const { resolveAndValidateLocalUploadPath, secureReadFile, secureCreateReadStream } = require('../../uploads/aws-s3');

describe('AWS S3 Security Tests', () => {
  const UPLOADS_ROOT = path.resolve(__dirname, '../../uploads');

  beforeAll(() => {
    // Ensure uploads directory exists for tests
    if (!fs.existsSync(UPLOADS_ROOT)) {
      fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
    }
    if (!fs.existsSync(path.join(UPLOADS_ROOT, 'temp'))) {
      fs.mkdirSync(path.join(UPLOADS_ROOT, 'temp'), { recursive: true });
    }
  });

  describe('resolveAndValidateLocalUploadPath', () => {
    test('should reject null bytes in path', () => {
      expect(() => {
        resolveAndValidateLocalUploadPath('/uploads/temp/file\x00.txt');
      }).toThrow('Invalid file path: null bytes not allowed');
    });

    test('should reject control characters in path', () => {
      expect(() => {
        resolveAndValidateLocalUploadPath('/uploads/temp/file\x01.txt');
      }).toThrow('Invalid file path: control characters not allowed');
    });

    test('should reject non-absolute paths', () => {
      expect(() => {
        resolveAndValidateLocalUploadPath('../etc/passwd');
      }).toThrow('Invalid file path: must be absolute');
    });

    test('should reject paths outside allowed directories', () => {
      expect(() => {
        resolveAndValidateLocalUploadPath('/etc/passwd');
      }).toThrow('Invalid file path: access denied');
    });

    test('should reject paths with directory traversal', () => {
      expect(() => {
        resolveAndValidateLocalUploadPath(path.join(UPLOADS_ROOT, '..', 'etc', 'passwd'));
      }).toThrow('Invalid file path - file does not exist or is not accessible');
    });

    test('should accept valid paths within allowed directories', () => {
      const testFile = path.join(UPLOADS_ROOT, 'temp', 'test.txt');
      fs.writeFileSync(testFile, 'test content');

      try {
        const result = resolveAndValidateLocalUploadPath(testFile);
        expect(result).toBe(testFile);
      } finally {
        fs.unlinkSync(testFile);
      }
    });
  });

  describe('secureReadFile', () => {
    test('should reject invalid path format', async () => {
      await expect(secureReadFile('../etc/passwd')).rejects.toThrow('Invalid file path: path format not allowed');
    });

    test('should reject paths with control characters', async () => {
      await expect(secureReadFile('/uploads/temp/file\x01.txt')).rejects.toThrow('Invalid file path: path format not allowed');
    });

    test('should reject paths outside allowed directories', async () => {
      await expect(secureReadFile('/etc/passwd')).rejects.toThrow('Invalid file path: access denied');
    });
  });

  describe('secureCreateReadStream', () => {
    test('should reject invalid path format', () => {
      expect(() => {
        secureCreateReadStream('../etc/passwd');
      }).toThrow('Invalid file path: path format not allowed');
    });

    test('should reject paths with control characters', () => {
      expect(() => {
        secureCreateReadStream('/uploads/temp/file\x01.txt');
      }).toThrow('Invalid file path: path format not allowed');
    });

    test('should reject paths outside allowed directories', () => {
      expect(() => {
        secureCreateReadStream('/etc/passwd');
      }).toThrow('Invalid file path: access denied');
    });
  });
});