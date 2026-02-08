/* eslint-disable no-underscore-dangle, class-methods-use-this */
import * as vscode from 'vscode';
import {
  loadWithImports, resolve, decode, getMolecularWeight, getFormula,
} from 'selfies-js';
import * as fs from 'fs';
import { pathToFileURL } from 'url';

/**
 * Tracks the current cursor position and provides information about the current line
 */
class LineTracker {
  constructor() {
    this._onDidChangeCurrentLine = new vscode.EventEmitter();
    this.onDidChangeCurrentLine = this._onDidChangeCurrentLine.event;

    this._currentLine = null;
    this._currentDocument = null;
    this._parseResult = null;

    // Listen for cursor position changes
    this._selectionChangeListener = vscode.window.onDidChangeTextEditorSelection((event) => {
      this._handleSelectionChange(event);
    });

    // Listen for document changes
    this._documentChangeListener = vscode.workspace.onDidChangeTextDocument((event) => {
      const currentUri = this._currentDocument?.uri.toString();
      if (currentUri && event.document.uri.toString() === currentUri) {
        this._handleDocumentChange(event.document);
      }
    });

    // Helper function to check if file is supported
    this._isSupportedFile = (document) => document.languageId === 'selfies'
                   || document.fileName.endsWith('.smiles.js');

    // Cache for loaded smiles-js modules
    this._smilesModuleCache = new Map();

    // Listen for active editor changes
    this._editorChangeListener = vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor && this._isSupportedFile(editor.document)) {
        // Check if document changed before updating
        const documentChanged = this._currentDocument !== editor.document;
        if (documentChanged) {
          this._parseResult = null;
          this._currentDocument = editor.document;
        }
        // Always update on editor change, even if line number is the same
        const position = editor.selections[0].active;
        this._currentLine = position.line;
        this._updateLineInfo();
      }
    });

    // Initialize with current editor
    const { activeTextEditor } = vscode.window;
    if (activeTextEditor && this._isSupportedFile(activeTextEditor.document)) {
      this._currentDocument = activeTextEditor.document;
      this._handleSelectionChange({
        textEditor: activeTextEditor,
        selections: activeTextEditor.selections,
      });
    }
  }

  /**
     * Handle cursor position changes
     */
  _handleSelectionChange(event) {
    const editor = event.textEditor;
    if (!editor || !this._isSupportedFile(editor.document)) {
      return;
    }

    const position = event.selections[0].active;
    const lineNumber = position.line;

    if (this._currentLine !== lineNumber) {
      this._currentLine = lineNumber;
      this._updateLineInfo();
    }
  }

  /**
     * Handle document changes
     */
  _handleDocumentChange(document) {
    if (!this._isSupportedFile(document)) {
      return;
    }

    // Reparse the document
    this._parseResult = null;
    this._updateLineInfo();
  }

  /**
     * Format tokens array into a display string
     * Handles both string tokens and REPEAT_CALL objects
     */
  _formatTokens(tokens) {
    return tokens.map((token) => {
      if (typeof token === 'string') {
        return token;
      } if (typeof token === 'object' && token.type === 'REPEAT_CALL') {
        return `repeat(${token.pattern}, ${token.count})`;
      }
      return String(token);
    }).join('');
  }

  /**
     * Load and get exports from a smiles-js file
     * Returns { module, error } object
     */
  async _loadSmilesModule(filePath) {
    // Check cache first
    const cacheKey = `${filePath}:${fs.statSync(filePath).mtimeMs}`;
    if (this._smilesModuleCache.has(cacheKey)) {
      return { module: this._smilesModuleCache.get(cacheKey), error: null };
    }

    try {
      // Clear require cache to get fresh module
      delete require.cache[require.resolve(filePath)];

      // Use dynamic import for ES modules
      const fileUrl = pathToFileURL(filePath).href;
      const module = await import(`${fileUrl}?t=${Date.now()}`);

      // Cache the result
      this._smilesModuleCache.clear(); // Clear old cache
      this._smilesModuleCache.set(cacheKey, module);

      return { module, error: null };
    } catch (err) {
      // Failed to load module, return the error with line number if available
      this._smilesModuleCache.clear(); // Clear cache on error

      // Try to extract line number from error stack or message
      let errorMessage = err.message;
      const lineMatch = err.stack?.match(/:(\d+):\d+/) || err.message?.match(/:(\d+):\d+/);
      if (lineMatch) {
        errorMessage = `Line ${lineMatch[1]}: ${err.message}`;
      }

      return { module: null, error: errorMessage };
    }
  }

  /**
     * Find the const declaration at a specific line
     * Returns { name, needsExport, constPosition } or null
     */
  _findConstAtLine(text, lineNumber) {
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
     * Update information about the current line
     */
  async _updateLineInfo() {
    if (!this._currentDocument || this._currentLine === null) {
      return;
    }

    const isSmilesJS = this._currentDocument.fileName.endsWith('.smiles.js');

    try {
      const lineText = this._currentDocument.lineAt(this._currentLine).text.trim();

      // Handle smiles-js files
      if (isSmilesJS) {
        // Skip empty lines and comments
        if (!lineText || lineText.startsWith('//') || lineText.startsWith('/*')) {
          this._onDidChangeCurrentLine.fire(null);
          return;
        }

        // Find the const declaration at this line
        const text = this._currentDocument.getText();
        const constInfo = this._findConstAtLine(text, this._currentLine);

        if (!constInfo) {
          this._onDidChangeCurrentLine.fire(null);
          return;
        }

        const { name: exportName, needsExport, constPosition } = constInfo;

        // If export is missing, add it automatically
        if (needsExport) {
          const editor = vscode.window.activeTextEditor;
          if (editor && editor.document === this._currentDocument) {
            const insertPos = new vscode.Position(this._currentLine, constPosition);
            await editor.edit((editBuilder) => {
              editBuilder.insert(insertPos, 'export ');
            });
            await this._currentDocument.save();
          }
        }

        // Load the module and get the export
        const { module, error: loadError } = await this._loadSmilesModule(
          this._currentDocument.fileName,
        );

        if (loadError) {
          this._onDidChangeCurrentLine.fire({
            line: this._currentLine,
            name: exportName,
            expression: lineText,
            error: loadError,
          });
          return;
        }

        if (!module || !module[exportName]) {
          this._onDidChangeCurrentLine.fire(null);
          return;
        }

        const fragment = module[exportName];

        // Check if it has the .smiles property (it's a Fragment)
        if (!fragment.smiles) {
          this._onDidChangeCurrentLine.fire(null);
          return;
        }

        // console.log('[LineTracker] Extracted fragment from smiles-js:', {
        //     exportName,
        //     smiles: fragment.smiles,
        //     formula: fragment.formula,
        //     molecularWeight: fragment.molecularWeight
        // });

        const lineInfo = {
          line: this._currentLine,
          name: exportName,
          expression: lineText,
          selfies: null,
          smiles: fragment.smiles,
          molecularWeight: fragment.molecularWeight,
          formula: fragment.formula,
          error: null,
        };

        this._onDidChangeCurrentLine.fire(lineInfo);
        return;
      }

      // Parse the document if not already parsed (for selfies files)
      if (!this._parseResult) {
        const text = this._currentDocument.getText();
        this._parseResult = loadWithImports(text, this._currentDocument.uri.fsPath);
      }

      // Skip empty lines and comments (for selfies files)
      if (!lineText || lineText.startsWith('#')) {
        this._onDidChangeCurrentLine.fire(null);
        return;
      }

      // Find the definition on this line
      // Note: VS Code uses 0-based line numbers, parser uses 1-based
      const definitions = this._parseResult.definitions || new Map();
      const definitionsArray = Array.from(definitions.values());
      const definition = definitionsArray.find((def) => def.line === this._currentLine + 1);

      if (!definition) {
        this._onDidChangeCurrentLine.fire(null);
        return;
      }

      // Resolve the definition to get the full SELFIES string
      let selfies = null;
      let smiles = null;
      let error = null;

      try {
        selfies = resolve(this._parseResult, definition.name, { validateValence: false });
      } catch (err) {
        error = err.message;
      }

      if (!selfies) {
        this._onDidChangeCurrentLine.fire({
          line: this._currentLine,
          name: definition.name,
          expression: definition.tokens ? this._formatTokens(definition.tokens) : '',
          error: error || 'Could not resolve definition',
        });
        return;
      }

      // Decode to SMILES
      try {
        smiles = decode(selfies);
      } catch (err) {
        error = err.message;
      }

      // Get molecular properties
      let molecularWeight = null;
      let formula = null;

      if (selfies && !error) {
        try {
          molecularWeight = getMolecularWeight(selfies);
          formula = getFormula(selfies);
        } catch (err) {
          // Properties might not be available
        }
      }

      const lineInfo = {
        line: this._currentLine,
        name: definition.name,
        expression: definition.tokens ? this._formatTokens(definition.tokens) : '',
        selfies,
        smiles,
        molecularWeight,
        formula,
        error,
      };

      this._onDidChangeCurrentLine.fire(lineInfo);
    } catch (err) {
      // Error handling
      this._onDidChangeCurrentLine.fire({
        line: this._currentLine,
        error: err.message,
      });
    }
  }

  /**
     * Get information about the current line
     */
  getCurrentLineInfo() {
    // Trigger update and return cached result
    this._updateLineInfo();
    return null; // The event will fire with the actual data
  }

  dispose() {
    this._selectionChangeListener.dispose();
    this._documentChangeListener.dispose();
    this._editorChangeListener.dispose();
    this._onDidChangeCurrentLine.dispose();
  }
}

export { LineTracker };
