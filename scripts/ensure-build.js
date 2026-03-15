#!/usr/bin/env node
/**
 * ensure-build.js
 *
 * Run as the `prepare` / `prepack` hook. Checks whether a production build
 * already exists (build/index.html). If it does, exits immediately so that
 * `npm install` on deployment platforms (Render, DigitalOcean, etc.) does not
 * trigger a redundant – and potentially environment-incompatible – rebuild.
 * If no build is present, runs `vite build` via a child process.
 */

'use strict';

const { existsSync } = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BUILD_MARKER = path.join(ROOT, 'build', 'index.html');

// On CI / deployment platforms the build is produced in a dedicated build step
// before `npm install --production` is run. Skip if the artefact is present.
if (existsSync(BUILD_MARKER)) {
  console.log('[ensure-build] Build artefact found – skipping vite build.');
  process.exit(0);
}

// No build found – produce one now (e.g., local `npm pack` or first-time setup)
console.log('[ensure-build] No build artefact found – running vite build...');
try {
  execSync('npx vite build', { cwd: ROOT, stdio: 'inherit' });
} catch (err) {
  console.error('[ensure-build] vite build failed:', err.message);
  process.exit(1);
}
