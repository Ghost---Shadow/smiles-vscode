#!/bin/bash

echo "========================================="
echo "Installing SELFIES Extension to VSCode"
echo "========================================="
echo ""

# Install dependencies
echo "Step 1: Installing dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "Error: npm install failed"
    exit 1
fi
echo "✓ Dependencies installed"
echo ""

# Check if vsce is installed
if ! command -v vsce &> /dev/null; then
    echo "Step 2: Installing vsce (packaging tool)..."
    npm install -g @vscode/vsce
    if [ $? -ne 0 ]; then
        echo "Error: Could not install vsce"
        echo "Try running: sudo npm install -g @vscode/vsce"
        exit 1
    fi
    echo "✓ vsce installed"
else
    echo "Step 2: vsce already installed"
fi
echo ""

# Package the extension
echo "Step 3: Packaging extension..."
vsce package --allow-missing-repository
if [ $? -ne 0 ]; then
    echo "Error: Packaging failed"
    exit 1
fi
echo "✓ Extension packaged"
echo ""

# Install to VSCode
echo "Step 4: Installing to VSCode..."
VSIX_FILE=$(ls -t *.vsix | head -1)
code --install-extension "$VSIX_FILE"
if [ $? -ne 0 ]; then
    echo "Error: Installation failed"
    echo "Try manually: Extensions → ... → Install from VSIX → $VSIX_FILE"
    exit 1
fi
echo "✓ Extension installed"
echo ""

echo "========================================="
echo "Installation Complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "  1. Reload VSCode (Ctrl+Shift+P → 'Reload Window')"
echo "  2. Open a .selfies file"
echo "  3. The preview panel should open automatically"
echo ""
echo "The extension is now installed permanently in VSCode!"
echo ""
