#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function fileExists(p) {
  try {
    fs.accessSync(p, fs.constants.F_OK);
    return true;
  } catch (_) {
    return false;
  }
}

function runBuild() {
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

  const result = spawnSync(npmCmd, ['run', 'build'], {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..'),
    env: process.env,
  });

  if (typeof result.status === 'number' && result.status !== 0) {
    process.exit(result.status);
  }

  if (result.error) {
    process.stderr.write(`Failed to run build: ${result.error.message}\n`);
    process.exit(1);
  }
}

const pkgRoot = path.resolve(__dirname, '..');
const buildIndex = path.join(pkgRoot, 'build', 'index.html');

const forceBuild = process.env.BIENSPERIENCE_FORCE_BUILD === 'true';
const skipBuild = process.env.BIENSPERIENCE_SKIP_BUILD === 'true';
const verbose = process.env.BIENSPERIENCE_VERBOSE === 'true';

if (skipBuild) {
  if (verbose) {
    process.stdout.write('[biensperience] Skipping build (BIENSPERIENCE_SKIP_BUILD=true)\n');
  }
  process.exit(0);
}

if (!forceBuild && fileExists(buildIndex)) {
  if (verbose) {
    process.stdout.write('[biensperience] Build output already present; skipping build.\n');
  }
  process.exit(0);
}

process.stdout.write('[biensperience] Build output missing; running build...\n');
runBuild();
