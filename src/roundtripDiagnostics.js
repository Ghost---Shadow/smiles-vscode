/**
 * Round-Trip Validation Diagnostics for SMILES strings
 *
 * Integrates with smiles-js round-trip validation to show
 * warnings in VSCode for SMILES that don't round-trip perfectly.
 */

import * as vscode from 'vscode';
import { validateRoundTrip } from 'smiles-js';

/**
 * Check if a line contains a SMILES string
 * @param {string} line - Line of text
 * @returns {boolean}
 */
function looksLikeSMILES(line) {
  // SMILES patterns: contains typical SMILES characters and structure
  const smilesPattern = /[CNOPSFClBrI[\]()=@#\\/+-]/;
  const hasRingNumbers = /\d/;
  const hasBonds = /[=#]/;

  return smilesPattern.test(line) && (hasRingNumbers.test(line) || hasBonds.test(line));
}

/**
 * Extract SMILES strings from a line
 * @param {string} line - Line of text
 * @param {number} lineNumber - Line number (0-indexed)
 * @returns {Array<{smiles: string, start: number, end: number, line: number}>}
 */
function extractSMILESFromLine(line, lineNumber) {
  const smilesList = [];

  // Pattern 1: String literals ('...' or "...")
  const stringLiteralPattern = /(['"])(.*?)\1/g;
  let match = stringLiteralPattern.exec(line);

  while (match !== null) {
    const potentialSMILES = match[2];
    if (looksLikeSMILES(potentialSMILES)) {
      smilesList.push({
        smiles: potentialSMILES,
        start: match.index + 1, // +1 to skip quote
        end: match.index + match[0].length - 1, // -1 to skip closing quote
        line: lineNumber,
      });
    }
    match = stringLiteralPattern.exec(line);
  }

  // Pattern 2: SELFIES "smiles" field
  const smilesFieldPattern = /smiles\s*:\s*(['"])(.*?)\1/g;
  let match2 = smilesFieldPattern.exec(line);
  while (match2 !== null) {
    const smiles = match2[2];
    const start = match2.index + match2[0].indexOf(match2[1]) + 1;
    smilesList.push({
      smiles,
      start,
      end: start + smiles.length,
      line: lineNumber,
    });
    match2 = smilesFieldPattern.exec(line);
  }

  return smilesList;
}

/**
 * Create round-trip validation diagnostics for a document
 * @param {vscode.TextDocument} document
 * @returns {vscode.Diagnostic[]}
 */
function createRoundTripDiagnostics(document) {
  const diagnostics = [];

  // Only check .smiles.js files and .selfies files
  const isSmilesJS = document.fileName.endsWith('.smiles.js');
  const isSelfies = document.languageId === 'selfies';
  if (!isSmilesJS && !isSelfies) {
    return diagnostics;
  }

  const text = document.getText();
  const lines = text.split('\n');

  for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
    const line = lines[lineNumber];

    // Extract SMILES strings from this line
    const smilesList = extractSMILESFromLine(line, lineNumber);

    smilesList.forEach((smilesInfo) => {
      const {
        smiles, start, end, line: lineNum,
      } = smilesInfo;
      try {
        // Validate round-trip
        const result = validateRoundTrip(smiles);

        if (!result.perfect) {
          const range = new vscode.Range(
            new vscode.Position(lineNum, start),
            new vscode.Position(lineNum, end),
          );

          let message;
          let severity;
          let code;

          if (result.stabilizes) {
            // Warning: SMILES stabilizes on second parse
            message = `SMILES round-trip: Stabilizes to "${result.firstRoundTrip}" (${smiles.length - result.firstRoundTrip.length} char difference)`;
            severity = vscode.DiagnosticSeverity.Warning;
            code = 'smiles-stabilizes';
          } else {
            // Error: SMILES doesn't stabilize
            message = 'SMILES round-trip: Unstable after 2 parses. Please file a bug report.';
            severity = vscode.DiagnosticSeverity.Error;
            code = 'smiles-unstable';
          }

          const diagnostic = new vscode.Diagnostic(
            range,
            message,
            severity,
          );

          diagnostic.source = 'smiles-js';
          diagnostic.code = code;

          // Add code action for stabilized SMILES
          if (result.stabilizes) {
            diagnostic.tags = [vscode.DiagnosticTag.Unnecessary]; // Make it less prominent
            diagnostic.relatedInformation = [
              new vscode.DiagnosticRelatedInformation(
                new vscode.Location(document.uri, range),
                `Use normalized form: ${result.firstRoundTrip}`,
              ),
            ];
          }

          diagnostics.push(diagnostic);
        }
      } catch (err) {
        // If parsing fails, don't add round-trip diagnostic
        // (syntax errors will be caught by the main diagnostics provider)
        // Skip this SMILES string
      }
    });
  }

  return diagnostics;
}

/**
 * Create a round-trip diagnostics provider
 * @returns {vscode.Disposable}
 */
function createRoundTripDiagnosticsProvider() {
  const diagnosticCollection = vscode.languages.createDiagnosticCollection('smiles-roundtrip');

  const updateDiagnostics = (document) => {
    if (!document) return;

    const diagnostics = createRoundTripDiagnostics(document);
    diagnosticCollection.set(document.uri, diagnostics);
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

  // Register code action provider for quick fixes
  const codeActionProvider = vscode.languages.registerCodeActionsProvider(
    [
      { language: 'selfies' },
      { language: 'javascript', pattern: '**/*.smiles.js' },
    ],
    {
      provideCodeActions(document, range, context) {
        const codeActions = [];

        context.diagnostics.forEach((diagnostic) => {
          if (diagnostic.source === 'smiles-js' && diagnostic.code === 'smiles-stabilizes') {
            // Extract the normalized SMILES from the diagnostic message
            const match = diagnostic.message.match(/Stabilizes to "([^"]+)"/);
            if (match) {
              const normalized = match[1];

              const fix = new vscode.CodeAction(
                `Replace with normalized SMILES: ${normalized}`,
                vscode.CodeActionKind.QuickFix,
              );

              fix.edit = new vscode.WorkspaceEdit();
              fix.edit.replace(document.uri, diagnostic.range, normalized);

              fix.diagnostics = [diagnostic];
              codeActions.push(fix);
            }
          }
        });

        return codeActions;
      },
    },
  );

  return {
    dispose: () => {
      diagnosticCollection.dispose();
      documentChangeListener.dispose();
      documentOpenListener.dispose();
      documentCloseListener.dispose();
      codeActionProvider.dispose();
    },
  };
}

export { createRoundTripDiagnosticsProvider, createRoundTripDiagnostics };
