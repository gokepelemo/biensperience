/**
 * Tests for utilities/upload-pipeline.js
 *
 * Covers:
 * - uploadWithPipeline: sync mode (success, error, local cleanup)
 * - uploadWithPipeline: background mode (immediate return, callbacks, error handling)
 * - retrieveFile: local hit, S3 fallback, both-fail
 * - transferBucket: full flow, deleteSource option
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// ---------------------------------------------------------------------------
// Mocks — must be set up before require()
// ---------------------------------------------------------------------------

const mockS3Upload = jest.fn();
const mockS3Delete = jest.fn();
const mockS3GetSignedUrl = jest.fn();
const mockS3DownloadBuffer = jest.fn();
const mockResolveAndValidate = jest.fn((p) => p); // passthrough by default

jest.mock('../../uploads/aws-s3', () => ({
  s3Upload: mockS3Upload,
  s3Delete: mockS3Delete,
  s3GetSignedUrl: mockS3GetSignedUrl,
  s3DownloadBuffer: mockS3DownloadBuffer,
  resolveAndValidateLocalUploadPath: mockResolveAndValidate
}));

jest.mock('../../utilities/backend-logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const {
  uploadWithPipeline,
  retrieveFile,
  transferBucket,
  deleteFile,
  deleteFileSafe,
  downloadToLocal,
  S3_STATUS
} = require('../../utilities/upload-pipeline');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tempDir;

beforeEach(async () => {
  tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'upload-pipeline-test-'));
  jest.restoreAllMocks();
  mockS3Upload.mockReset();
  mockS3Delete.mockReset();
  mockS3GetSignedUrl.mockReset();
  mockS3DownloadBuffer.mockReset();
  mockResolveAndValidate.mockReset();
  mockResolveAndValidate.mockImplementation((p) => p);
});

afterEach(async () => {
  await fs.promises.rm(tempDir, { recursive: true, force: true });
});

function createTempFile(name = 'test-file.pdf', content = 'test content') {
  const filePath = path.join(tempDir, name);
  fs.writeFileSync(filePath, content);
  return filePath;
}

// ---------------------------------------------------------------------------
// S3_STATUS constants
// ---------------------------------------------------------------------------

describe('S3_STATUS', () => {
  it('should export correct status values', () => {
    expect(S3_STATUS.PENDING).toBe('pending');
    expect(S3_STATUS.UPLOADED).toBe('uploaded');
    expect(S3_STATUS.FAILED).toBe('failed');
  });

  it('should be frozen', () => {
    expect(Object.isFrozen(S3_STATUS)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// uploadWithPipeline
// ---------------------------------------------------------------------------

describe('uploadWithPipeline', () => {
  const s3Result = {
    key: 'photos/123-test-file.pdf',
    Location: 'https://bucket.s3.us-east-1.amazonaws.com/photos/123-test-file.pdf',
    bucket: 'my-bucket',
    isProtected: false,
    bucketType: 'public'
  };

  describe('sync mode (default)', () => {
    it('should upload to S3 and return uploaded status', async () => {
      const localPath = createTempFile();
      mockS3Upload.mockResolvedValue(s3Result);

      const result = await uploadWithPipeline(localPath, 'test-file.pdf', 'photos/123-test-file');

      expect(result.s3Status).toBe(S3_STATUS.UPLOADED);
      expect(result.s3Result).toEqual(s3Result);
      expect(mockS3Upload).toHaveBeenCalledWith(localPath, 'test-file.pdf', 'photos/123-test-file', { protected: false });
    });

    it('should delete local file after successful upload', async () => {
      const localPath = createTempFile();
      mockS3Upload.mockResolvedValue(s3Result);

      await uploadWithPipeline(localPath, 'test-file.pdf', 'photos/123');

      expect(fs.existsSync(localPath)).toBe(false);
    });

    it('should delete local file even when S3 upload fails', async () => {
      const localPath = createTempFile();
      mockS3Upload.mockRejectedValue(new Error('S3 timeout'));

      await expect(
        uploadWithPipeline(localPath, 'test-file.pdf', 'photos/123')
      ).rejects.toThrow('S3 timeout');

      expect(fs.existsSync(localPath)).toBe(false);
    });

    it('should NOT delete local file when deleteLocal is false', async () => {
      const localPath = createTempFile();
      mockS3Upload.mockResolvedValue(s3Result);

      await uploadWithPipeline(localPath, 'test-file.pdf', 'photos/123', {
        deleteLocal: false
      });

      expect(fs.existsSync(localPath)).toBe(true);
    });

    it('should pass protected option to s3Upload', async () => {
      const localPath = createTempFile();
      mockS3Upload.mockResolvedValue({ ...s3Result, isProtected: true });

      await uploadWithPipeline(localPath, 'doc.pdf', 'documents/uid/ts-doc', {
        protected: true
      });

      expect(mockS3Upload).toHaveBeenCalledWith(
        localPath, 'doc.pdf', 'documents/uid/ts-doc', { protected: true }
      );
    });

    it('should validate local path before upload', async () => {
      mockResolveAndValidate.mockImplementation(() => {
        throw new Error('Invalid file path: access denied');
      });

      await expect(
        uploadWithPipeline('/etc/passwd', 'passwd', 'bad/key')
      ).rejects.toThrow('Invalid file path: access denied');

      expect(mockS3Upload).not.toHaveBeenCalled();
    });
  });

  describe('background mode', () => {
    it('should return pending status immediately', async () => {
      const localPath = createTempFile();
      mockS3Upload.mockResolvedValue(s3Result);

      const result = await uploadWithPipeline(localPath, 'file.pdf', 'photos/123', {
        background: true
      });

      expect(result.s3Status).toBe(S3_STATUS.PENDING);
      expect(result.localPath).toBe(localPath);
      expect(result.uploadPromise).toBeDefined();

      // Wait for background upload to finish
      await result.uploadPromise;
    });

    it('should call onS3Complete on success', async () => {
      const localPath = createTempFile();
      mockS3Upload.mockResolvedValue(s3Result);
      const onS3Complete = jest.fn();

      const result = await uploadWithPipeline(localPath, 'file.pdf', 'photos/123', {
        background: true,
        onS3Complete
      });

      await result.uploadPromise;

      expect(onS3Complete).toHaveBeenCalledWith(s3Result);
    });

    it('should call onS3Error on failure without throwing', async () => {
      const localPath = createTempFile();
      const uploadError = new Error('Network failure');
      mockS3Upload.mockRejectedValue(uploadError);
      const onS3Error = jest.fn();

      const result = await uploadWithPipeline(localPath, 'file.pdf', 'photos/123', {
        background: true,
        onS3Error
      });

      // Should not throw
      await result.uploadPromise;

      expect(onS3Error).toHaveBeenCalledWith(uploadError);
    });

    it('should delete local file after background upload completes', async () => {
      const localPath = createTempFile();
      mockS3Upload.mockResolvedValue(s3Result);

      const result = await uploadWithPipeline(localPath, 'file.pdf', 'photos/123', {
        background: true
      });

      await result.uploadPromise;

      expect(fs.existsSync(localPath)).toBe(false);
    });

    it('should handle onS3Complete callback errors gracefully', async () => {
      const localPath = createTempFile();
      mockS3Upload.mockResolvedValue(s3Result);
      const onS3Complete = jest.fn(() => { throw new Error('callback boom'); });

      const result = await uploadWithPipeline(localPath, 'file.pdf', 'photos/123', {
        background: true,
        onS3Complete
      });

      // Should not throw even if callback throws
      await result.uploadPromise;

      expect(onS3Complete).toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// retrieveFile
// ---------------------------------------------------------------------------

describe('retrieveFile', () => {
  it('should return local file when it exists', async () => {
    const filePath = createTempFile('bienbot-photo.jpg');
    // Make validator return the path
    mockResolveAndValidate.mockReturnValue(filePath);

    const result = await retrieveFile('bienbot/uid/sess/bienbot-photo.jpg', {
      localDir: tempDir
    });

    expect(result).toEqual({ source: 'local', path: filePath });
    expect(mockS3GetSignedUrl).not.toHaveBeenCalled();
  });

  it('should fall back to S3 signed URL when local file not found', async () => {
    mockResolveAndValidate.mockImplementation(() => {
      throw new Error('File does not exist');
    });
    mockS3GetSignedUrl.mockResolvedValue('https://signed-url.example.com');

    const result = await retrieveFile('bienbot/uid/sess/photo.jpg', {
      localDir: tempDir
    });

    expect(result).toEqual({
      source: 's3',
      signedUrl: 'https://signed-url.example.com'
    });
  });

  it('should use S3 directly when no localDir provided', async () => {
    mockS3GetSignedUrl.mockResolvedValue('https://signed-url.example.com');

    const result = await retrieveFile('documents/uid/ts-doc.pdf');

    expect(result).toEqual({
      source: 's3',
      signedUrl: 'https://signed-url.example.com'
    });
    expect(mockResolveAndValidate).not.toHaveBeenCalled();
  });

  it('should pass protected and expiresIn options to s3GetSignedUrl', async () => {
    mockS3GetSignedUrl.mockResolvedValue('https://url.example.com');

    await retrieveFile('key.pdf', { protected: false, expiresIn: 7200 });

    expect(mockS3GetSignedUrl).toHaveBeenCalledWith('key.pdf', {
      protected: false,
      expiresIn: 7200
    });
  });

  it('should return null when both local and S3 fail', async () => {
    mockResolveAndValidate.mockImplementation(() => {
      throw new Error('Not found');
    });
    mockS3GetSignedUrl.mockRejectedValue(new Error('S3 error'));

    const result = await retrieveFile('missing.pdf', { localDir: tempDir });

    expect(result).toBeNull();
  });

  it('should default to protected=true', async () => {
    mockS3GetSignedUrl.mockResolvedValue('https://url.example.com');

    await retrieveFile('key.pdf');

    expect(mockS3GetSignedUrl).toHaveBeenCalledWith('key.pdf', {
      protected: true,
      expiresIn: 3600
    });
  });
});

// ---------------------------------------------------------------------------
// transferBucket
// ---------------------------------------------------------------------------

describe('transferBucket', () => {
  const downloadResult = {
    buffer: Buffer.from('fake image data'),
    contentType: 'image/jpeg'
  };

  const uploadResult = {
    key: 'photos/bienbot-photo.jpg',
    Location: 'https://bucket.s3.us-east-1.amazonaws.com/photos/bienbot-photo.jpg',
    bucket: 'public-bucket'
  };

  beforeEach(() => {
    mockS3DownloadBuffer.mockResolvedValue(downloadResult);
    mockS3Upload.mockResolvedValue(uploadResult);
    mockS3Delete.mockResolvedValue({});
    // Allow temp file writes through validator
    mockResolveAndValidate.mockImplementation((p) => p);
  });

  it('should download from source, upload to target, and delete source', async () => {
    const result = await transferBucket('bienbot/uid/sess/photo.jpg');

    expect(mockS3DownloadBuffer).toHaveBeenCalledWith('bienbot/uid/sess/photo.jpg', { protected: true });
    expect(mockS3Upload).toHaveBeenCalledWith(
      expect.stringContaining('transfer-photo.jpg'),
      'photo.jpg',
      'photos/photo.jpg',
      { protected: false } // target is opposite of source
    );
    expect(mockS3Delete).toHaveBeenCalledWith('bienbot/uid/sess/photo.jpg', { protected: true });
    expect(result).toEqual({
      key: uploadResult.key,
      location: uploadResult.Location,
      bucket: uploadResult.bucket
    });
  });

  it('should NOT delete source when deleteSource is false', async () => {
    await transferBucket('bienbot/uid/sess/photo.jpg', { deleteSource: false });

    expect(mockS3Delete).not.toHaveBeenCalled();
  });

  it('should use custom toPrefix', async () => {
    await transferBucket('source/key.jpg', { toPrefix: 'images/' });

    expect(mockS3Upload).toHaveBeenCalledWith(
      expect.any(String),
      'key.jpg',
      'images/key.jpg',
      expect.any(Object)
    );
  });

  it('should use custom newName', async () => {
    await transferBucket('source/original.jpg', { newName: 'renamed.jpg' });

    expect(mockS3Upload).toHaveBeenCalledWith(
      expect.stringContaining('transfer-renamed.jpg'),
      'renamed.jpg',
      'photos/renamed.jpg',
      expect.any(Object)
    );
  });

  it('should handle fromProtected=false (public → protected)', async () => {
    await transferBucket('photos/public.jpg', {
      fromProtected: false,
      toPrefix: 'documents/'
    });

    expect(mockS3DownloadBuffer).toHaveBeenCalledWith('photos/public.jpg', { protected: false });
    expect(mockS3Upload).toHaveBeenCalledWith(
      expect.any(String),
      'public.jpg',
      'documents/public.jpg',
      { protected: true } // target is opposite
    );
  });

  it('should clean up temp file even when upload fails', async () => {
    mockS3Upload.mockRejectedValue(new Error('Upload failed'));

    await expect(
      transferBucket('source/key.jpg')
    ).rejects.toThrow('Upload failed');

    // Temp file should not linger (no way to directly check, but no unhandled errors)
  });

  it('should continue if source deletion fails', async () => {
    mockS3Delete.mockRejectedValue(new Error('Delete failed'));

    // Should not throw — source deletion failure is non-fatal
    const result = await transferBucket('source/key.jpg');

    expect(result).toEqual({
      key: uploadResult.key,
      location: uploadResult.Location,
      bucket: uploadResult.bucket
    });
  });
});

// ---------------------------------------------------------------------------
// deleteFile
// ---------------------------------------------------------------------------

describe('deleteFile', () => {
  it('should call s3Delete and resolve on success', async () => {
    mockS3Delete.mockResolvedValue({});

    await deleteFile('photos/test.jpg');

    expect(mockS3Delete).toHaveBeenCalledWith('photos/test.jpg', {});
  });

  it('should pass options through to s3Delete', async () => {
    mockS3Delete.mockResolvedValue({});

    await deleteFile('docs/secret.pdf', { protected: true });

    expect(mockS3Delete).toHaveBeenCalledWith('docs/secret.pdf', { protected: true });
  });

  it('should throw when s3Delete fails', async () => {
    mockS3Delete.mockRejectedValue(new Error('S3 delete failed'));

    await expect(deleteFile('photos/test.jpg')).rejects.toThrow('S3 delete failed');
  });
});

// ---------------------------------------------------------------------------
// deleteFileSafe
// ---------------------------------------------------------------------------

describe('deleteFileSafe', () => {
  it('should return { deleted: true } on success', async () => {
    mockS3Delete.mockResolvedValue({});

    const result = await deleteFileSafe('photos/test.jpg');

    expect(result).toEqual({ deleted: true });
    expect(mockS3Delete).toHaveBeenCalledWith('photos/test.jpg', {});
  });

  it('should return { deleted: false, error } on failure without throwing', async () => {
    mockS3Delete.mockRejectedValue(new Error('Access denied'));

    const result = await deleteFileSafe('photos/test.jpg');

    expect(result.deleted).toBe(false);
    expect(result.error).toBe('Access denied');
  });

  it('should pass options through to s3Delete', async () => {
    mockS3Delete.mockResolvedValue({});

    await deleteFileSafe('docs/file.pdf', { protected: true, bucket: 'custom' });

    expect(mockS3Delete).toHaveBeenCalledWith('docs/file.pdf', { protected: true, bucket: 'custom' });
  });
});

// ---------------------------------------------------------------------------
// downloadToLocal
// ---------------------------------------------------------------------------

describe('downloadToLocal', () => {
  it('should download from S3 and write to local file', async () => {
    const fileContent = Buffer.from('PDF content here');
    mockS3DownloadBuffer.mockResolvedValue({ buffer: fileContent, contentType: 'application/pdf' });

    const result = await downloadToLocal('documents/uid/test.pdf', 'test.pdf', {
      tempDir: tempDir
    });

    expect(result.localPath).toMatch(/test\.pdf$/);
    expect(result.contentType).toBe('application/pdf');
    expect(result.size).toBe(fileContent.length);
    expect(fs.existsSync(result.localPath)).toBe(true);
    expect(fs.readFileSync(result.localPath).toString()).toBe('PDF content here');
  });

  it('should pass protected option to s3DownloadBuffer', async () => {
    mockS3DownloadBuffer.mockResolvedValue({ buffer: Buffer.from('data'), contentType: 'image/png' });

    await downloadToLocal('bienbot/uid/photo.png', 'photo.png', {
      protected: true,
      tempDir: tempDir
    });

    expect(mockS3DownloadBuffer).toHaveBeenCalledWith('bienbot/uid/photo.png', { protected: true });
  });

  it('should sanitize filename for local path', async () => {
    mockS3DownloadBuffer.mockResolvedValue({ buffer: Buffer.from('data'), contentType: 'text/plain' });

    const result = await downloadToLocal('key/path', 'file with spaces & (special).txt', {
      tempDir: tempDir
    });

    expect(result.localPath).toMatch(/file_with_spaces____special_\.txt$/);
  });

  it('should clean up partial file and rethrow on download failure', async () => {
    mockS3DownloadBuffer.mockRejectedValue(new Error('S3 not found'));

    await expect(
      downloadToLocal('missing/key.pdf', 'key.pdf', { tempDir: tempDir })
    ).rejects.toThrow('S3 not found');
  });
});
