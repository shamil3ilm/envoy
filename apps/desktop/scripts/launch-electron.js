#!/usr/bin/env node
// This script launches Electron with ELECTRON_RUN_AS_NODE unset
// This is needed because VS Code's terminal sets this variable

const { spawn } = require('child_process');
const path = require('path');

// Remove the problematic environment variable
delete process.env.ELECTRON_RUN_AS_NODE;

// Get the electron executable path
const electronPath = require('electron');

// Spawn electron with the current directory
const child = spawn(electronPath, ['.'], {
  stdio: 'inherit',
  cwd: path.join(__dirname, '..'),
  env: process.env
});

child.on('close', (code) => {
  process.exit(code);
});
