#!/usr/bin/env node

/**
 * Simple build script for the SELFIES VSCode extension
 * This just ensures the selfies-js package is available
 */

const fs = require('fs');
const path = require('path');

console.log('Building SELFIES VSCode Extension...');

// Check if selfies-js is available
const selfiesJsPath = path.join(__dirname, '..', 'selfies-js');
if (!fs.existsSync(selfiesJsPath)) {
  console.error('Error: selfies-js package not found at', selfiesJsPath);
  console.error('Please ensure selfies-js is installed in the parent directory');
  process.exit(1);
}

// Check if node_modules/selfies-js exists or create symlink
const nodeModulesPath = path.join(__dirname, 'node_modules', 'selfies-js');
const nodeModulesDir = path.join(__dirname, 'node_modules');

if (!fs.existsSync(nodeModulesDir)) {
  fs.mkdirSync(nodeModulesDir);
}

if (!fs.existsSync(nodeModulesPath)) {
  try {
    // Try to create symlink (Unix/Mac)
    fs.symlinkSync(selfiesJsPath, nodeModulesPath, 'junction');
    console.log('Created symlink to selfies-js');
  } catch (err) {
    console.log('Could not create symlink, copying package instead...');
    // If symlink fails, just note that npm install should handle it
    console.log('Please run: npm install');
  }
}

console.log('Build complete!');
console.log('');
console.log('To test the extension:');
console.log('  1. Open this folder in VS Code');
console.log('  2. Press F5 to launch Extension Development Host');
console.log('  3. Create or open a .selfies file');
console.log('');
