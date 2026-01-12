#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function getPackageInfo() {
  try {
    // Available when running from an installed package as well.
    // eslint-disable-next-line global-require
    const pkg = require(path.resolve(__dirname, '..', 'package.json'));
    return { name: pkg.name || 'biensperience', version: pkg.version || '' };
  } catch (_) {
    return { name: 'biensperience', version: '' };
  }
}

function printHelp() {
  const { name, version } = getPackageInfo();

  process.stdout.write(`${name}${version ? ` v${version}` : ''}

Run Biensperience as a self-hosted app.

Usage:
  biensperience init              Create a .env from .env.example (if missing)
  biensperience start             Start the Biensperience server
  biensperience --version         Print version
  biensperience help              Show this help

Quick start:
  npx biensperience init
  npx biensperience start

Notes:
  - Run from your project directory (where your .env lives)
  - Set PORT, NODE_ENV, DATABASE_URL, AWS_* / S3_* as environment variables or in .env
`);
}

function initEnv() {
  const cwd = process.cwd();
  const targetEnvPath = path.join(cwd, '.env');
  const pkgRoot = path.resolve(__dirname, '..');
  const exampleEnvPath = path.join(pkgRoot, '.env.example');

  if (fs.existsSync(targetEnvPath)) {
    process.stdout.write('Found existing .env in current directory; nothing to do.\n');
    return;
  }

  if (!fs.existsSync(exampleEnvPath)) {
    process.stderr.write('Missing .env.example inside the package.\n');
    process.exitCode = 1;
    return;
  }

  fs.copyFileSync(exampleEnvPath, targetEnvPath);
  process.stdout.write('Created .env from .env.example in the current directory.\n');
  process.stdout.write('Next: edit .env with your DATABASE_URL, SECRET, and any AWS/S3 settings, then run: npx biensperience start\n');
}

function startServer(args) {
  const cwd = process.cwd();
  const pkgRoot = path.resolve(__dirname, '..');
  const serverPath = path.join(pkgRoot, 'server.js');
  const envPath = path.join(cwd, '.env');

  if (!fs.existsSync(serverPath)) {
    process.stderr.write('Cannot find server entrypoint (server.js) in the package.\n');
    process.exit(1);
  }

  if (!fs.existsSync(envPath)) {
    process.stdout.write('No .env found in the current directory.\n');
    process.stdout.write('Run: npx biensperience init  (then edit .env)\n\n');
  }

  const child = spawn(process.execPath, [serverPath, ...args], {
    cwd,
    env: process.env,
    stdio: 'inherit'
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}

const argv = process.argv.slice(2);
const command = (argv[0] || 'help').toLowerCase();

if (command === '--version' || command === '-v' || command === 'version') {
  const { name, version } = getPackageInfo();
  process.stdout.write(`${name}${version ? ` v${version}` : ''}\n`);
  process.exit(0);
}

switch (command) {
  case 'help':
  case '--help':
  case '-h':
    printHelp();
    break;
  case 'init':
    initEnv();
    break;
  case 'start':
    startServer(argv.slice(1));
    break;
  default:
    process.stderr.write(`Unknown command: ${command}\n\n`);
    printHelp();
    process.exitCode = 1;
}
