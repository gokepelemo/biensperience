const fs = require('fs');
const path = require('path');
const os = require('os');
const { cleanOrphanedTempFiles, DEFAULT_MAX_AGE_MS } = require('../../utilities/temp-cleanup');

describe('temp-cleanup utility', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'bien-temp-test-'));
  });

  afterEach(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  it('should return { removed: 0, errors: 0 } when dir does not exist', async () => {
    const result = await cleanOrphanedTempFiles({ tempDir: '/tmp/nonexistent-bien-test-dir' });
    expect(result).toEqual({ removed: 0, errors: 0 });
  });

  it('should return { removed: 0, errors: 0 } for an empty directory', async () => {
    const result = await cleanOrphanedTempFiles({ tempDir });
    expect(result).toEqual({ removed: 0, errors: 0 });
  });

  it('should NOT remove files younger than maxAgeMs', async () => {
    const filePath = path.join(tempDir, 'recent-file.pdf');
    await fs.promises.writeFile(filePath, 'data');

    const result = await cleanOrphanedTempFiles({ tempDir, maxAgeMs: DEFAULT_MAX_AGE_MS });
    expect(result.removed).toBe(0);
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('should remove files older than maxAgeMs', async () => {
    const filePath = path.join(tempDir, 'old-file.pdf');
    await fs.promises.writeFile(filePath, 'data');

    // Back-date the file to 2 hours ago
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await fs.promises.utimes(filePath, twoHoursAgo, twoHoursAgo);

    const result = await cleanOrphanedTempFiles({ tempDir, maxAgeMs: DEFAULT_MAX_AGE_MS });
    expect(result.removed).toBe(1);
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it('should respect a custom maxAgeMs', async () => {
    const filePath = path.join(tempDir, 'semi-old.pdf');
    await fs.promises.writeFile(filePath, 'data');

    // Make file 5 seconds old
    const fiveSecsAgo = new Date(Date.now() - 5000);
    await fs.promises.utimes(filePath, fiveSecsAgo, fiveSecsAgo);

    // With a 10-second threshold, file should survive
    let result = await cleanOrphanedTempFiles({ tempDir, maxAgeMs: 10000 });
    expect(result.removed).toBe(0);

    // With a 1-second threshold, file should be removed
    result = await cleanOrphanedTempFiles({ tempDir, maxAgeMs: 1000 });
    expect(result.removed).toBe(1);
  });

  it('should skip hidden files (.gitkeep)', async () => {
    const gitkeep = path.join(tempDir, '.gitkeep');
    await fs.promises.writeFile(gitkeep, '');

    // Back-date to ensure it would be eligible for removal
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await fs.promises.utimes(gitkeep, old, old);

    const result = await cleanOrphanedTempFiles({ tempDir, maxAgeMs: DEFAULT_MAX_AGE_MS });
    expect(result.removed).toBe(0);
    expect(fs.existsSync(gitkeep)).toBe(true);
  });

  it('should skip subdirectories', async () => {
    const subDir = path.join(tempDir, 'some-dir');
    await fs.promises.mkdir(subDir);

    // Back-date the directory
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await fs.promises.utimes(subDir, old, old);

    const result = await cleanOrphanedTempFiles({ tempDir, maxAgeMs: DEFAULT_MAX_AGE_MS });
    expect(result.removed).toBe(0);
    expect(fs.existsSync(subDir)).toBe(true);
  });

  it('should remove multiple old files and keep recent ones', async () => {
    const old1 = path.join(tempDir, '1-old-receipt.pdf');
    const old2 = path.join(tempDir, '2-old-doc.png');
    const recent = path.join(tempDir, '3-recent.txt');

    await fs.promises.writeFile(old1, 'a');
    await fs.promises.writeFile(old2, 'b');
    await fs.promises.writeFile(recent, 'c');

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await fs.promises.utimes(old1, twoHoursAgo, twoHoursAgo);
    await fs.promises.utimes(old2, twoHoursAgo, twoHoursAgo);

    const result = await cleanOrphanedTempFiles({ tempDir, maxAgeMs: DEFAULT_MAX_AGE_MS });
    expect(result.removed).toBe(2);
    expect(result.errors).toBe(0);
    expect(fs.existsSync(old1)).toBe(false);
    expect(fs.existsSync(old2)).toBe(false);
    expect(fs.existsSync(recent)).toBe(true);
  });

  it('should count errors when unlink fails', async () => {
    const filePath = path.join(tempDir, 'locked-file.pdf');
    await fs.promises.writeFile(filePath, 'data');

    const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await fs.promises.utimes(filePath, old, old);

    // Make the directory read-only so unlink fails
    await fs.promises.chmod(tempDir, 0o555);

    const result = await cleanOrphanedTempFiles({ tempDir, maxAgeMs: DEFAULT_MAX_AGE_MS });
    expect(result.errors).toBe(1);
    expect(result.removed).toBe(0);

    // Restore permissions for afterEach cleanup
    await fs.promises.chmod(tempDir, 0o755);
  });
});
