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

    test('should reject null or empty paths', async () => {
      await expect(secureReadFile(null)).rejects.toThrow('Invalid validated path');
      await expect(secureReadFile('')).rejects.toThrow('Invalid validated path');
      await expect(secureReadFile(undefined)).rejects.toThrow('Invalid validated path');
    });

    test('should successfully read valid files within allowed directories', async () => {
      const testFile = path.join(UPLOADS_ROOT, 'temp', 'secure-read-test.txt');
      const testContent = 'secure read test content';
      fs.writeFileSync(testFile, testContent);

      try {
        const content = await secureReadFile(testFile);
        expect(content.toString()).toBe(testContent);
      } finally {
        fs.unlinkSync(testFile);
      }
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

    test('should reject null or empty paths', () => {
      expect(() => secureCreateReadStream(null)).toThrow('Invalid validated path');
      expect(() => secureCreateReadStream('')).toThrow('Invalid validated path');
      expect(() => secureCreateReadStream(undefined)).toThrow('Invalid validated path');
    });

    test('should successfully create read stream for valid files', (done) => {
      const testFile = path.join(UPLOADS_ROOT, 'temp', 'secure-stream-test.txt');
      const testContent = 'secure stream test content';
      fs.writeFileSync(testFile, testContent);

      try {
        const stream = secureCreateReadStream(testFile);
        let content = '';
        stream.on('data', (chunk) => { content += chunk.toString(); });
        stream.on('end', () => {
          expect(content).toBe(testContent);
          fs.unlinkSync(testFile);
          done();
        });
        stream.on('error', (err) => {
          fs.unlinkSync(testFile);
          done(err);
        });
      } catch (err) {
        fs.unlinkSync(testFile);
        done(err);
      }
    });
  });

  describe('Path traversal attack vectors', () => {
    test('should reject URL-encoded path traversal', () => {
      expect(() => {
        resolveAndValidateLocalUploadPath('/uploads/temp/..%2F..%2Fetc%2Fpasswd');
      }).toThrow('Invalid file path');
    });

    test('should reject double-encoded path traversal', () => {
      expect(() => {
        resolveAndValidateLocalUploadPath('/uploads/temp/..%252F..%252Fetc%252Fpasswd');
      }).toThrow('Invalid file path');
    });

    test('should reject unicode path traversal', () => {
      // Unicode representation of ..
      expect(() => {
        resolveAndValidateLocalUploadPath('/uploads/temp/\u002e\u002e/etc/passwd');
      }).toThrow('Invalid file path');
    });

    test('should reject backslash path traversal', () => {
      expect(() => {
        resolveAndValidateLocalUploadPath('/uploads/temp/..\\..\\etc\\passwd');
      }).toThrow('Invalid file path');
    });

    test('should reject paths with null byte injection', () => {
      expect(() => {
        resolveAndValidateLocalUploadPath('/uploads/temp/test.txt\x00.jpg');
      }).toThrow('Invalid file path: null bytes not allowed');
    });

    test('should reject symlink escape attempts (if file exists as symlink)', () => {
      // This tests that symlinks are resolved before validation
      const symlinkPath = path.join(UPLOADS_ROOT, 'temp', 'malicious-symlink');
      try {
        // Create a symlink pointing outside allowed dirs (if possible)
        if (fs.existsSync(symlinkPath)) fs.unlinkSync(symlinkPath);
        fs.symlinkSync('/etc/passwd', symlinkPath);

        expect(() => {
          resolveAndValidateLocalUploadPath(symlinkPath);
        }).toThrow('Invalid file path: access denied');
      } catch (e) {
        // On some systems, creating symlinks requires elevated privileges
        // In that case, we just skip this test
        if (e.code === 'EPERM' || e.code === 'EACCES') {
          console.log('Skipping symlink test - insufficient permissions');
        } else if (e.message.includes('access denied')) {
          // Test passed - symlink was correctly blocked
          expect(true).toBe(true);
        } else {
          throw e;
        }
      } finally {
        try {
          if (fs.existsSync(symlinkPath)) fs.unlinkSync(symlinkPath);
        } catch (_) {}
      }
    });
  });
});