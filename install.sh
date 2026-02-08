#!/bin/bash

echo "========================================="
echo "SELFIES VSCode Extension - Installation"
echo "========================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

echo "Node.js version: $(node --version)"
echo ""

# Check if selfies-js exists
if [ ! -d "../selfies-js" ]; then
    echo "Error: selfies-js package not found in parent directory"
    echo "Please ensure selfies-js is installed at ../selfies-js"
    exit 1
fi

echo "✓ Found selfies-js package"
echo ""

# Install dependencies
echo "Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "Error: npm install failed"
    exit 1
fi

echo ""
echo "✓ Dependencies installed"
echo ""

# Run build script
echo "Building extension..."
node build.js

if [ $? -ne 0 ]; then
    echo "Error: Build failed"
    exit 1
fi

echo ""
echo "========================================="
echo "Installation complete!"
echo "========================================="
echo ""
echo "To test the extension:"
echo "  1. Open this folder in VS Code"
echo "  2. Press F5 to launch Extension Development Host"
echo "  3. Open example.selfies to test"
echo ""
echo "For more information, see SETUP.md"
echo ""
