import * as vscode from 'vscode';
import { pathToFileURL } from 'url';

/**
 * Find the export name at a specific line
 * Returns { name, needsExport, constPosition } where:
 * - name: the variable name
 * - needsExport: true if 'export' keyword is missing
 * - constPosition: character position of 'const' keyword (for inserting 'export ')
 */
function findExportAtLine(text, lineNumber) {
  const lines = text.split('\n');
  const line = lines[lineNumber];

  if (!line) return null;

  // Match: export const NAME = ...
  const exportMatch = line.match(/export\s+const\s+(\w+)\s*=/);
  if (exportMatch) {
    return { name: exportMatch[1], needsExport: false, constPosition: null };
  }

  // Match: const NAME = ... (without export)
  const constMatch = line.match(/^(\s*)const\s+(\w+)\s*=/);
  if (constMatch) {
    const leadingWhitespace = constMatch[1].length;
    return { name: constMatch[2], needsExport: true, constPosition: leadingWhitespace };
  }

  return null;
}

/**
 * Extract which constructors are used in the generated code
 */
function extractUsedConstructors(code) {
  const constructors = ['Ring', 'Linear', 'FusedRing', 'Molecule'];
  return constructors.filter((c) => code.includes(`${c}(`));
}

/**
 * Find the position to insert import statement
 * Returns the line number after existing imports, or 0 if no imports exist
 */
function findImportInsertPosition(text) {
  const lines = text.split('\n');
  let lastImportLine = -1;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (line.startsWith('import ')) {
      lastImportLine = i;
    } else if (line && !line.startsWith('//') && !line.startsWith('/*') && lastImportLine >= 0) {
      // Found first non-import, non-comment line after imports
      break;
    }
  }

  return lastImportLine + 1;
}

/**
 * Check if an import for specific constructors from smiles-js already exists
 */
function getExistingImports(text) {
  const importRegex = /import\s*\{([^}]+)\}\s*from\s*['"]smiles-js['"]/g;
  const existing = new Set();

  let match = importRegex.exec(text);
  while (match) {
    const imports = match[1].split(',').map((s) => s.trim());
    imports.forEach((imp) => existing.add(imp));
    match = importRegex.exec(text);
  }

  return existing;
}

/**
 * Generate the import statement for missing constructors
 */
function generateImportStatement(needed, existing) {
  const missing = needed.filter((c) => !existing.has(c));
  if (missing.length === 0) return null;
  return `import { ${missing.join(', ')} } from 'smiles-js';\n`;
}

/**
 * Load a module dynamically with cache busting
 */
async function loadModule(filePath) {
  try {
    const fileUrl = pathToFileURL(filePath).href;
    const module = await import(`${fileUrl}?t=${Date.now()}`);
    return module;
  } catch (err) {
    return null;
  }
}

/**
 * Refactor the molecule on the current line to constructor code
 */
export async function refactorMolecule() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('No active editor');
    return;
  }

  const { document } = editor;
  if (!document.fileName.endsWith('.smiles.js')) {
    vscode.window.showErrorMessage('This command only works in .smiles.js files');
    return;
  }

  const lineNumber = editor.selection.active.line;
  let text = document.getText();
  const exportInfo = findExportAtLine(text, lineNumber);

  if (!exportInfo) {
    vscode.window.showErrorMessage('No const declaration found on the current line');
    return;
  }

  const { name: exportName, needsExport, constPosition } = exportInfo;

  // If export keyword is missing, add it first
  if (needsExport) {
    const insertPos = new vscode.Position(lineNumber, constPosition);
    await editor.edit((editBuilder) => {
      editBuilder.insert(insertPos, 'export ');
    });
    // Save and reload text after adding export
    await document.save();
    text = document.getText();
  } else {
    // Save the document first to ensure the module is up to date
    await document.save();
  }

  // Load the module
  const module = await loadModule(document.fileName);
  if (!module || !module[exportName]) {
    vscode.window.showErrorMessage(`Could not load export "${exportName}"`);
    return;
  }

  const fragment = module[exportName];

  // Check if fragment has toCode method
  if (typeof fragment.toCode !== 'function') {
    vscode.window.showErrorMessage(`Export "${exportName}" does not have a toCode() method`);
    return;
  }

  // Generate the code
  let code;
  try {
    code = fragment.toCode(exportName);
  } catch (err) {
    vscode.window.showErrorMessage(`Failed to generate code: ${err.message}`);
    return;
  }

  // Check which constructors are used and which need to be imported
  const usedConstructors = extractUsedConstructors(code);
  const existingImports = getExistingImports(text);
  const importStatement = generateImportStatement(usedConstructors, existingImports);

  // Find positions for insertions
  const codeInsertPosition = new vscode.Position(lineNumber + 1, 0);
  const importInsertPosition = new vscode.Position(findImportInsertPosition(text), 0);

  // Insert the generated code and import statement
  await editor.edit((editBuilder) => {
    // Add import statement if needed
    if (importStatement) {
      editBuilder.insert(importInsertPosition, importStatement);
    }

    // Add the generated code after current line
    const codeToInsert = `\n// Refactored from ${exportName}:\n${code}\n`;
    editBuilder.insert(codeInsertPosition, codeToInsert);
  });

  vscode.window.showInformationMessage(`Refactored "${exportName}" to constructor code`);
}
