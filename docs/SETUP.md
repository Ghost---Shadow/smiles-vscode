# SELFIES VSCode Extension Setup

This guide will help you set up and test the SELFIES VSCode extension.

## Prerequisites

- Node.js (v16 or later)
- VS Code (v1.85.0 or later)
- The `selfies-js` package (in the parent directory)

## Installation Steps

### 1. Install Dependencies

```bash
cd selfies-vscode
npm install
```

This will install the VSCode extension API and create a link to the `selfies-js` package.

### 2. Build the Extension

```bash
npm run package
```

This ensures the extension is ready to run.

### 3. Test in Development Mode

1. Open the `selfies-vscode` folder in VS Code
2. Press `F5` to launch the Extension Development Host
3. In the new VS Code window, open the `example.selfies` file
4. The preview panel should open automatically
5. Try moving your cursor to different lines to see the molecular structures

### 4. Package for Distribution (Optional)

To create a `.vsix` file for distribution:

```bash
# Install vsce (VSCode extension packager)
npm install -g @vscode/vsce

# Package the extension
vsce package
```

This creates a `.vsix` file that can be shared and installed in VS Code.

## Testing the Extension

### Open Example File

1. In the Extension Development Host, open `example.selfies`
2. Move your cursor to different definitions
3. The preview panel should update with:
   - 2D molecular structure
   - SMILES notation
   - Molecular formula
   - Molecular weight

### Test Diagnostics

Try adding errors to see the diagnostics in action:

```selfies
# This will show an error (forward reference)
[test] = [undefined_molecule]

# This will show an error (circular reference)
[circular1] = [circular2]
[circular2] = [circular1]
```

### Test Imports

Create a new file `fragments.selfies`:

```selfies
[methyl] = [C]
[ethyl] = [C][C]
```

Then in another file:

```selfies
import "./fragments.selfies"

[ethanol] = [ethyl][O][H]
```

## File Structure

```
selfies-vscode/
├── package.json              # Extension manifest
├── src/
│   ├── extension.js         # Entry point
│   ├── diagnostics.js       # Error reporting
│   ├── lineTracker.js       # Cursor tracking
│   └── webview/
│       ├── panel.js         # Preview panel manager
│       └── renderer.html    # HTML for preview
├── syntaxes/
│   └── selfies.tmLanguage.json  # Syntax highlighting
├── language-configuration.json   # Language config
├── example.selfies          # Example file
└── README.md                # Documentation
```

## Troubleshooting

### Extension doesn't activate

- Make sure you're opening a `.selfies` file
- Check the Output panel (View → Output) and select "SELFIES" from the dropdown

### Preview panel doesn't show

- Check Settings: `selfies.autoOpenPreview` should be `true`
- Manually open with: `Ctrl+Shift+P` → "SELFIES: Show Molecular Structure"

### Diagnostics not working

- Make sure `selfies-js` is properly installed
- Check the console in the Extension Development Host (Help → Toggle Developer Tools)

### Import resolution fails

- Make sure the imported file path is correct and relative to the current file
- Check that the imported file exists and has valid syntax

## Next Steps

Once the extension is working:

1. Test with more complex molecules
2. Try creating multi-file projects with imports
3. Customize the syntax highlighting colors in VS Code settings
4. Report any bugs or feature requests

## Publishing (For Maintainers)

To publish to the VS Code Marketplace:

```bash
# Login to your publisher account
vsce login your-publisher-name

# Publish
vsce publish
```

See the [VS Code Publishing Guide](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) for more details.
