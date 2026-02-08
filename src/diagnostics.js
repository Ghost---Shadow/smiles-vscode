import * as vscode from 'vscode';
import { loadWithImports } from 'selfies-js';

/**
 * Validate JavaScript imports in .smiles.js files
 * @param {string} text - File content
 * @returns {vscode.Diagnostic[]}
 */
function validateJavaScriptImports(text) {
  const diagnostics = [];
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const importMatch = line.match(/import\s+.*\s+from\s+['"](.+)['"]/);

    if (importMatch) {
      const importPath = importMatch[1];

      // Check for old API usage
      if (importPath.includes('/fragment')) {
        const range = new vscode.Range(
          new vscode.Position(i, 0),
          new vscode.Position(i, line.length),
        );

        const diagnostic = new vscode.Diagnostic(
          range,
          `Deprecated import path: '${importPath}'. Use './index.js' or 'smiles-js' instead. The Fragment API has been updated.`,
          vscode.DiagnosticSeverity.Error,
        );

        diagnostic.source = 'smiles-js';
        diagnostic.code = 'deprecated-import';

        // Suggest fix
        diagnostic.relatedInformation = [
          new vscode.DiagnosticRelatedInformation(
            new vscode.Location(vscode.Uri.file(''), range),
            "Replace with: import { parse, Ring, Linear, Fragment } from '../src/index.js';",
          ),
        ];

        diagnostics.push(diagnostic);
      }

      // Check for attachAt usage (old API)
      if (line.includes('.attachAt(')) {
        const match = line.match(/\.attachAt\(/);
        if (match) {
          const col = match.index;
          const range = new vscode.Range(
            new vscode.Position(i, col),
            new vscode.Position(i, col + 9),
          );

          const diagnostic = new vscode.Diagnostic(
            range,
            'Method .attachAt() has been replaced with .attach() in the new API',
            vscode.DiagnosticSeverity.Error,
          );

          diagnostic.source = 'smiles-js';
          diagnostic.code = 'deprecated-method';

          diagnostics.push(diagnostic);
        }
      }
    }

    // Check for old Ring constructor usage
    if (line.match(/Ring\(['"][a-z]['"],\s*\d+\)/)) {
      const match = line.match(/Ring\(/);
      if (match) {
        const col = match.index;
        const range = new vscode.Range(
          new vscode.Position(i, col),
          new vscode.Position(i, line.length),
        );

        const diagnostic = new vscode.Diagnostic(
          range,
          'Old Ring API: Use Ring({ atoms: \'c\', size: 6 }) instead of Ring(\'c\', 6)',
          vscode.DiagnosticSeverity.Error,
        );

        diagnostic.source = 'smiles-js';
        diagnostic.code = 'deprecated-api';

        diagnostics.push(diagnostic);
      }
    }
  }

  return diagnostics;
}

/**
 * Map error types to VS Code severity levels
 */
function getSeverity(type) {
  switch (type) {
    case 'error':
    case 'syntax':
    case 'undefined':
    case 'circular':
    case 'redefinition':
      return vscode.DiagnosticSeverity.Error;
    case 'warning':
    case 'chemistry':
      return vscode.DiagnosticSeverity.Warning;
    case 'info':
      return vscode.DiagnosticSeverity.Information;
    case 'hint':
      return vscode.DiagnosticSeverity.Hint;
    default:
      return vscode.DiagnosticSeverity.Error;
  }
}

/**
 * Create a diagnostics provider for SELFIES files
 * @returns {vscode.Disposable}
 */
function createDiagnosticsProvider() {
  const diagnosticCollection = vscode.languages.createDiagnosticCollection('selfies');

  // Helper function to check if file is supported
  const isSupportedFile = (document) => document.languageId === 'selfies'
               || document.fileName.endsWith('.smiles.js');

  // Update diagnostics when document changes
  const updateDiagnostics = (document) => {
    if (!isSupportedFile(document)) {
      return;
    }

    const text = document.getText();
    const { uri } = document;
    const diagnostics = [];

    // For smiles-js files, try to evaluate them and catch import/syntax errors
    if (document.fileName.endsWith('.smiles.js')) {
      try {
        // Try to dynamically import the file to catch syntax/import errors
        // This is a basic validation - actual imports will be handled by Node.js
        const importErrors = validateJavaScriptImports(text);
        if (importErrors.length > 0) {
          diagnostics.push(...importErrors);
        }
      } catch (err) {
        // Add a generic error if we can't validate
        const diagnostic = new vscode.Diagnostic(
          new vscode.Range(0, 0, 0, 1),
          `Validation error: ${err.message}`,
          vscode.DiagnosticSeverity.Warning,
        );
        diagnostic.source = 'selfies';
        diagnostics.push(diagnostic);
      }

      diagnosticCollection.set(uri, diagnostics);
      return;
    }

    try {
      // Parse the document with imports support
      const result = loadWithImports(text, uri.fsPath);

      // Convert selfies-js errors to VS Code diagnostics
      if (result.errors && result.errors.length > 0) {
        result.errors.forEach((error) => {
          // Parser uses 1-based line/column numbers, VS Code uses 0-based
          const line = error.line !== undefined ? error.line - 1 : 0;
          const column = error.column !== undefined ? error.column - 1 : 0;
          const endColumn = error.endColumn !== undefined ? error.endColumn - 1 : column + 1;

          const range = new vscode.Range(
            new vscode.Position(line, column),
            new vscode.Position(line, endColumn),
          );

          const severity = getSeverity(error.type || error.severity);

          const diagnostic = new vscode.Diagnostic(
            range,
            error.message,
            severity,
          );

          diagnostic.source = 'selfies';

          // Add error code if available
          if (error.code) {
            diagnostic.code = error.code;
          }

          diagnostics.push(diagnostic);
        });
      }

      // Add warnings for chemical validity issues
      if (result.warnings && result.warnings.length > 0) {
        result.warnings.forEach((warning) => {
          // Parser uses 1-based line/column numbers, VS Code uses 0-based
          const line = warning.line !== undefined ? warning.line - 1 : 0;
          const column = warning.column !== undefined ? warning.column - 1 : 0;
          const endColumn = warning.endColumn !== undefined ? warning.endColumn - 1 : column + 1;

          const range = new vscode.Range(
            new vscode.Position(line, column),
            new vscode.Position(line, endColumn),
          );

          const diagnostic = new vscode.Diagnostic(
            range,
            warning.message,
            vscode.DiagnosticSeverity.Warning,
          );

          diagnostic.source = 'selfies';
          diagnostics.push(diagnostic);
        });
      }
    } catch (err) {
      // If parsing fails completely, show a general error
      const diagnostic = new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, 1),
        `Failed to parse SELFIES file: ${err.message}`,
        vscode.DiagnosticSeverity.Error,
      );
      diagnostic.source = 'selfies';
      diagnostics.push(diagnostic);
    }

    diagnosticCollection.set(uri, diagnostics);
  };

  // Listen for document changes
  const documentChangeListener = vscode.workspace.onDidChangeTextDocument((event) => {
    updateDiagnostics(event.document);
  });

  // Listen for document open
  const documentOpenListener = vscode.workspace.onDidOpenTextDocument((document) => {
    updateDiagnostics(document);
  });

  // Listen for document close
  const documentCloseListener = vscode.workspace.onDidCloseTextDocument((document) => {
    diagnosticCollection.delete(document.uri);
  });

  // Update all currently open documents
  vscode.workspace.textDocuments.forEach(updateDiagnostics);

  return {
    dispose: () => {
      diagnosticCollection.dispose();
      documentChangeListener.dispose();
      documentOpenListener.dispose();
      documentCloseListener.dispose();
    },
  };
}

export { createDiagnosticsProvider };
