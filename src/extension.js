import * as vscode from 'vscode';
import { createDiagnosticsProvider } from './diagnostics';
import { createRoundTripDiagnosticsProvider } from './roundtripDiagnostics';
import { LineTracker } from './lineTracker';
import { PreviewPanel } from './webview/panel';
import { initRDKit } from './rdkitRenderer';
import { refactorMolecule } from './refactorMolecule';

/**
 * Activate the SMILES extension
 * @param {vscode.ExtensionContext} context
 */
export function activate(context) {
  // Initialize RDKit asynchronously
  initRDKit().catch(() => {
    vscode.window.showWarningMessage('SMILES: RDKit initialization failed, using fallback renderer');
  });

  // Create diagnostics provider
  const diagnosticsProvider = createDiagnosticsProvider();
  context.subscriptions.push(diagnosticsProvider);

  // Create round-trip diagnostics provider for SMILES validation
  const roundTripDiagnosticsProvider = createRoundTripDiagnosticsProvider();
  context.subscriptions.push(roundTripDiagnosticsProvider);

  // Create line tracker for cursor position
  const lineTracker = new LineTracker();
  context.subscriptions.push(lineTracker);

  // Create preview panel manager
  let previewPanel = null;

  // Helper function to check if file is supported
  const isSupportedFile = (editor) => {
    if (!editor) return false;
    return editor.document.languageId === 'selfies'
               || editor.document.fileName.endsWith('.smiles.js');
  };

  // Register command to show molecular structure
  const showMoleculeCommand = vscode.commands.registerCommand(
    'smiles.showMolecule',
    () => {
      const editor = vscode.window.activeTextEditor;
      if (!isSupportedFile(editor)) {
        vscode.window.showErrorMessage('Please open a .selfies or .smiles.js file first');
        return;
      }

      if (!previewPanel) {
        previewPanel = new PreviewPanel(context.extensionUri);
        previewPanel.onDidDispose(() => {
          previewPanel = null;
        });
      }

      previewPanel.reveal();

      // Update with current line
      const lineInfo = lineTracker.getCurrentLineInfo();
      if (lineInfo) {
        previewPanel.update(lineInfo);
      }
    },
  );

  // Register command to toggle preview
  const togglePreviewCommand = vscode.commands.registerCommand(
    'smiles.togglePreview',
    () => {
      if (previewPanel) {
        previewPanel.dispose();
        previewPanel = null;
      } else {
        vscode.commands.executeCommand('smiles.showMolecule');
      }
    },
  );

  // Auto-open preview if enabled in settings
  const autoOpenPreview = () => {
    const config = vscode.workspace.getConfiguration('smiles');
    if (config.get('autoOpenPreview', true)) {
      const editor = vscode.window.activeTextEditor;
      if (isSupportedFile(editor)) {
        // Only auto-open if panel doesn't exist
        if (!previewPanel) {
          vscode.commands.executeCommand('smiles.showMolecule');
        }
      }
    }
  };

  // Listen for active editor changes
  const editorChangeListener = vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (isSupportedFile(editor)) {
      autoOpenPreview();
    }
  });

  // Listen for cursor position changes
  const cursorChangeListener = lineTracker.onDidChangeCurrentLine((lineInfo) => {
    const config = vscode.workspace.getConfiguration('smiles');
    if (config.get('previewOnCursorMove', true) && previewPanel) {
      previewPanel.update(lineInfo);
    }
  });

  // Auto-open preview for currently active editor
  autoOpenPreview();

  // Register refactor molecule command
  const refactorMoleculeCommand = vscode.commands.registerCommand(
    'smiles.refactorMolecule',
    () => refactorMolecule(),
  );

  context.subscriptions.push(showMoleculeCommand);
  context.subscriptions.push(togglePreviewCommand);
  context.subscriptions.push(editorChangeListener);
  context.subscriptions.push(cursorChangeListener);
  context.subscriptions.push(refactorMoleculeCommand);
}

/**
 * Deactivate the extension
 */
export function deactivate() {
  // Cleanup is handled by dispose methods
}
