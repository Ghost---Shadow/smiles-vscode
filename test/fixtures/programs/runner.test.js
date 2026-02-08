/* eslint-disable */
/**
 * Test runner for VSCode extension fixture programs
 * Tests line number accuracy and diagnostic conversion
 */

import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  parse, loadWithImports, loadFile, resolve,
} from 'selfies-js';
import { Fragment } from 'smiles-js';
import { generateSVG, isValidSMILES } from '../../../src/rdkitRenderer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROGRAMS_DIR = __dirname;

function readProgram(filename) {
  const path = join(PROGRAMS_DIR, filename);
  return readFileSync(path, 'utf-8');
}

describe('VSCode Extension Fixture Programs', () => {
  describe('line-numbers-basic.selfies', () => {
    test('should parse without errors', () => {
      const source = readProgram('line-numbers-basic.selfies');
      const program = parse(source);

      expect(program.errors).toEqual([]);
      expect(program.definitions.size).toBe(7);
    });

    test('should have correct line numbers for all definitions', () => {
      const source = readProgram('line-numbers-basic.selfies');
      const program = parse(source);

      // Full dictionary match of line numbers
      const expectedLines = {
        methyl: 5, // Line 5: [methyl] = [C]
        ethyl: 6, // Line 6: [ethyl] = [C][C]
        propyl: 7, // Line 7: [propyl] = [C][C][C]
        hydroxyl: 10, // Line 10: [hydroxyl] = [O]
        amino: 11, // Line 11: [amino] = [N]
        methanol: 14, // Line 14: [methanol] = [methyl][hydroxyl]
        ethanol: 15, // Line 15: [ethanol] = [ethyl][hydroxyl]
      };

      for (const [name, expectedLine] of Object.entries(expectedLines)) {
        const def = program.definitions.get(name);
        expect(def.name).toBe(name);
        expect(def.line).toBe(expectedLine);
      }
    });

    test('should produce expected SELFIES', () => {
      const source = readProgram('line-numbers-basic.selfies');
      const program = parse(source);

      const expectedSelfies = {
        methyl: '[C]',
        ethyl: '[C][C]',
        propyl: '[C][C][C]',
        hydroxyl: '[O]',
        amino: '[N]',
        methanol: '[C][O]',
        ethanol: '[C][C][O]',
      };

      for (const [name, expected] of Object.entries(expectedSelfies)) {
        expect(resolve(program, name)).toBe(expected);
      }
    });

    test('should produce expected SMILES', () => {
      const source = readProgram('line-numbers-basic.selfies');
      const program = parse(source);

      const expectedSmiles = {
        methyl: 'C',
        ethyl: 'CC',
        propyl: 'CCC',
        hydroxyl: 'O',
        amino: 'N',
        methanol: 'CO',
        ethanol: 'CCO',
      };

      for (const [name, expected] of Object.entries(expectedSmiles)) {
        expect(resolve(program, name, { decode: true })).toBe(expected);
      }
    });

    test('VS Code diagnostic conversion', () => {
      const source = readProgram('line-numbers-basic.selfies');
      const program = parse(source);

      // Test that we can correctly convert parser line numbers to VS Code positions
      const expectedVSCodeLines = {
        methyl: 4, // Parser line 5 → VS Code line 4 (0-based)
        ethyl: 5, // Parser line 6 → VS Code line 5
        propyl: 6, // Parser line 7 → VS Code line 6
        hydroxyl: 9, // Parser line 10 → VS Code line 9
        amino: 10, // Parser line 11 → VS Code line 10
        methanol: 13, // Parser line 14 → VS Code line 13
        ethanol: 14, // Parser line 15 → VS Code line 14
      };

      for (const [name, expectedVSCodeLine] of Object.entries(expectedVSCodeLines)) {
        const def = program.definitions.get(name);
        const vscodeLine = def.line - 1; // Convert 1-based to 0-based
        expect(vscodeLine).toBe(expectedVSCodeLine);
      }
    });
  });

  describe('line-numbers-with-imports.selfies', () => {
    test('should parse with imports without errors', () => {
      const filepath = join(PROGRAMS_DIR, 'line-numbers-with-imports.selfies');
      const program = loadFile(filepath);

      expect(program.errors).toEqual([]);
      expect(program.definitions.size).toBeGreaterThan(3);
    });

    test('should have correct line numbers after import', () => {
      const filepath = join(PROGRAMS_DIR, 'line-numbers-with-imports.selfies');
      const program = loadFile(filepath);

      // Full dictionary match - line numbers should be preserved despite import
      const expectedLines = {
        compound1: 7, // Line 7: [compound1] = [base_frag1][O]
        compound2: 9, // Line 9: [compound2] = [base_frag2][N]
        compound3: 12, // Line 12: [compound3] = [base_frag1][base_frag2]
      };

      for (const [name, expectedLine] of Object.entries(expectedLines)) {
        const def = program.definitions.get(name);
        expect(def.name).toBe(name);
        expect(def.line).toBe(expectedLine);
      }
    });

    test('should produce expected SELFIES with imports', () => {
      const filepath = join(PROGRAMS_DIR, 'line-numbers-with-imports.selfies');
      const program = loadFile(filepath);

      const expectedSelfies = {
        base_frag1: '[C][C]',
        base_frag2: '[C][C][C]',
        compound1: '[C][C][O]',
        compound2: '[C][C][C][N]',
        compound3: '[C][C][C][C][C]',
      };

      for (const [name, expected] of Object.entries(expectedSelfies)) {
        expect(resolve(program, name)).toBe(expected);
      }
    });

    test('should produce expected SMILES with imports', () => {
      const filepath = join(PROGRAMS_DIR, 'line-numbers-with-imports.selfies');
      const program = loadFile(filepath);

      const expectedSmiles = {
        base_frag1: 'CC',
        base_frag2: 'CCC',
        compound1: 'CCO',
        compound2: 'CCCN',
        compound3: 'CCCCC',
      };

      for (const [name, expected] of Object.entries(expectedSmiles)) {
        expect(resolve(program, name, { decode: true })).toBe(expected);
      }
    });
  });

  describe('line-numbers-errors.selfies', () => {
    test('should detect duplicate definitions', () => {
      const source = readProgram('line-numbers-errors.selfies');
      const program = parse(source);

      expect(program.errors.length).toBeGreaterThan(0);
      expect(program.errors.length).toBe(2); // Two duplicate errors
    });

    test('should report errors on correct lines', () => {
      const source = readProgram('line-numbers-errors.selfies');
      const program = parse(source);

      // Full dictionary match of error line numbers and messages
      const expectedErrors = {
        methyl: {
          line: 6,
          message: "Duplicate definition of 'methyl'",
        },
        ethyl: {
          line: 10,
          message: "Duplicate definition of 'ethyl'",
        },
      };

      for (const [name, expected] of Object.entries(expectedErrors)) {
        const error = program.errors.find((e) => e.message.includes(`'${name}'`), // Match exact name in quotes
        );
        expect(error.message).toBe(expected.message);
        expect(error.line).toBe(expected.line);
      }
    });

    test('should report errors with correct column numbers', () => {
      const source = readProgram('line-numbers-errors.selfies');
      const program = parse(source);

      // All duplicate errors should be at column 1 (start of line)
      for (const error of program.errors) {
        expect(error.column).toBe(1); // Parser uses 1-based columns
      }
    });

    test('VS Code diagnostic conversion for errors', () => {
      const source = readProgram('line-numbers-errors.selfies');
      const program = parse(source);

      // Full dictionary match for VS Code position conversion
      const expectedVSCodePositions = {
        methyl: {
          line: 5,
          column: 0,
          message: "Duplicate definition of 'methyl'",
        },
        ethyl: {
          line: 9,
          column: 0,
          message: "Duplicate definition of 'ethyl'",
        },
      };

      for (const [name, expected] of Object.entries(expectedVSCodePositions)) {
        const error = program.errors.find((e) => e.message.includes(`'${name}'`), // Match exact name in quotes
        );
        expect(error.message).toBe(expected.message);

        const vscodeLine = error.line - 1;
        const vscodeColumn = error.column - 1;

        expect(vscodeLine).toBe(expected.line);
        expect(vscodeColumn).toBe(expected.column);
      }
    });
  });

  describe('Line number preservation edge cases', () => {
    test('file with only comments', () => {
      const source = `# Comment 1
# Comment 2
# Comment 3`;

      const program = parse(source);
      expect(program.definitions.size).toBe(0);
      expect(program.errors).toEqual([]);
    });

    test('file starting with definition (no comments)', () => {
      const source = `[test] = [C]
[another] = [N]`;

      const program = parse(source);

      const expectedLines = {
        test: 1,
        another: 2,
      };

      for (const [name, expectedLine] of Object.entries(expectedLines)) {
        expect(program.definitions.get(name).line).toBe(expectedLine);
      }
    });

    test('file with many blank lines', () => {
      const source = `# Header


[test1] = [C]



[test2] = [N]`;

      const program = parse(source);

      const expectedLines = {
        test1: 4, // Line 4
        test2: 8, // Line 8
      };

      for (const [name, expectedLine] of Object.entries(expectedLines)) {
        expect(program.definitions.get(name).line).toBe(expectedLine);
      }
    });

    test('inline comments preserve line numbers', () => {
      const source = `[a] = [C]  # Inline comment
[b] = [N]  # Another inline comment
[c] = [O]  # Third comment`;

      const program = parse(source);

      const expectedLines = {
        a: 1,
        b: 2,
        c: 3,
      };

      for (const [name, expectedLine] of Object.entries(expectedLines)) {
        expect(program.definitions.get(name).line).toBe(expectedLine);
      }
    });
  });

  describe('Integration with example.selfies', () => {
    test('example.selfies should parse without errors', () => {
      const examplePath = join(__dirname, '..', '..', '..', 'example.selfies');
      const source = readFileSync(examplePath, 'utf-8');
      const program = parse(source);

      expect(program.errors).toEqual([]);
      expect(program.definitions.size).toBeGreaterThan(20);
    });

    test('example.selfies should have correct line numbers', () => {
      const examplePath = join(__dirname, '..', '..', '..', 'example.selfies');
      const source = readFileSync(examplePath, 'utf-8');
      const program = parse(source);

      // Verify a subset of definitions have correct line numbers
      const expectedLines = {
        methyl: 5,
        ethyl: 6,
        propyl: 7,
        hydroxyl: 11,
        methanol: 17,
        benzene: 35,
        toluene: 36,
        furan: 41,
      };

      for (const [name, expectedLine] of Object.entries(expectedLines)) {
        const def = program.definitions.get(name);
        expect(def.name).toBe(name);
        expect(def.line).toBe(expectedLine);
      }
    });
  });

  describe('Samples Directory', () => {
    describe('samples/fragments.selfies', () => {
      test('should parse without errors', () => {
        const samplePath = join(__dirname, '..', '..', '..', 'samples', 'fragments.selfies');
        const source = readFileSync(samplePath, 'utf-8');
        const program = parse(source);

        expect(program.errors).toEqual([]);
        expect(program.definitions.size).toBe(9);
      });

      test('should have correct line numbers', () => {
        const samplePath = join(__dirname, '..', '..', '..', 'samples', 'fragments.selfies');
        const source = readFileSync(samplePath, 'utf-8');
        const program = parse(source);

        // Full dictionary match of all definitions and line numbers
        const expectedLines = {
          methyl: 5,
          ethyl: 6,
          propyl: 7,
          butyl: 8,
          hydroxyl: 11,
          amino: 12,
          carbonyl: 13,
          carboxyl: 14,
          phenyl: 17,
        };

        for (const [name, expectedLine] of Object.entries(expectedLines)) {
          const def = program.definitions.get(name);
          expect(def.name).toBe(name);
          expect(def.line).toBe(expectedLine);
        }
      });

      test('should produce expected SELFIES', () => {
        const samplePath = join(__dirname, '..', '..', '..', 'samples', 'fragments.selfies');
        const source = readFileSync(samplePath, 'utf-8');
        const program = parse(source);

        // Full dictionary match of all expected SELFIES outputs
        const expectedSelfies = {
          methyl: '[C]',
          ethyl: '[C][C]',
          propyl: '[C][C][C]',
          butyl: '[C][C][C][C]',
          hydroxyl: '[O]',
          amino: '[N]',
          carbonyl: '[=O]',
          carboxyl: '[C][=Branch1][C][=O][O]',
          phenyl: '[C][=C][C][=C][C][=C][Ring1][Branch1]',
        };

        for (const [name, expected] of Object.entries(expectedSelfies)) {
          expect(resolve(program, name)).toBe(expected);
        }
      });

      test('should produce expected SMILES', () => {
        const samplePath = join(__dirname, '..', '..', '..', 'samples', 'fragments.selfies');
        const source = readFileSync(samplePath, 'utf-8');
        const program = parse(source);

        // Full dictionary match of all expected SMILES outputs
        const expectedSmiles = {
          methyl: 'C',
          ethyl: 'CC',
          propyl: 'CCC',
          butyl: 'CCCC',
          hydroxyl: 'O',
          amino: 'N',
          carbonyl: 'O',
          carboxyl: 'C(=O)O',
          phenyl: 'C=C1C=CC=C1',
        };

        for (const [name, expected] of Object.entries(expectedSmiles)) {
          expect(resolve(program, name, { decode: true })).toBe(expected);
        }
      });
    });

    describe('samples/test-line-numbers.selfies', () => {
      test('should parse without errors', () => {
        const samplePath = join(__dirname, '..', '..', '..', 'samples', 'test-line-numbers.selfies');
        const source = readFileSync(samplePath, 'utf-8');
        const program = parse(source);

        expect(program.errors).toEqual([]);
        expect(program.definitions.size).toBe(10);
      });

      test('should have correct line numbers', () => {
        const samplePath = join(__dirname, '..', '..', '..', 'samples', 'test-line-numbers.selfies');
        const source = readFileSync(samplePath, 'utf-8');
        const program = parse(source);

        // Full dictionary match - this file specifically tests line number accuracy
        const expectedLines = {
          methyl: 6,
          ethyl: 7,
          propyl: 8,
          hydroxyl: 11,
          amino: 12,
          carbonyl: 13,
          methanol: 16,
          ethanol: 17,
          propanol: 18,
          acetone: 21,
        };

        for (const [name, expectedLine] of Object.entries(expectedLines)) {
          const def = program.definitions.get(name);
          expect(def.name).toBe(name);
          expect(def.line).toBe(expectedLine);
        }
      });

      test('should produce expected SELFIES', () => {
        const samplePath = join(__dirname, '..', '..', '..', 'samples', 'test-line-numbers.selfies');
        const source = readFileSync(samplePath, 'utf-8');
        const program = parse(source);

        // Full dictionary match
        const expectedSelfies = {
          methyl: '[C]',
          ethyl: '[C][C]',
          propyl: '[C][C][C]',
          hydroxyl: '[O]',
          amino: '[N]',
          carbonyl: '[=O]',
          methanol: '[C][O]',
          ethanol: '[C][C][O]',
          propanol: '[C][C][C][O]',
          acetone: '[C][C][=Branch1][C][=O][C]',
        };

        for (const [name, expected] of Object.entries(expectedSelfies)) {
          expect(resolve(program, name)).toBe(expected);
        }
      });

      test('should produce expected SMILES', () => {
        const samplePath = join(__dirname, '..', '..', '..', 'samples', 'test-line-numbers.selfies');
        const source = readFileSync(samplePath, 'utf-8');
        const program = parse(source);

        // Full dictionary match
        const expectedSmiles = {
          methyl: 'C',
          ethyl: 'CC',
          propyl: 'CCC',
          hydroxyl: 'O',
          amino: 'N',
          carbonyl: 'O',
          methanol: 'CO',
          ethanol: 'CCO',
          propanol: 'CCCO',
          acetone: 'CC(=O)C',
        };

        for (const [name, expected] of Object.entries(expectedSmiles)) {
          expect(resolve(program, name, { decode: true })).toBe(expected);
        }
      });
    });

    describe('samples/toluene.selfies', () => {
      test('should parse without errors', () => {
        const samplePath = join(__dirname, '..', '..', '..', 'samples', 'toluene.selfies');
        const source = readFileSync(samplePath, 'utf-8');
        const program = parse(source);

        expect(program.errors).toEqual([]);
        expect(program.definitions.size).toBe(10);
      });

      test('should have correct line numbers', () => {
        const samplePath = join(__dirname, '..', '..', '..', 'samples', 'toluene.selfies');
        const source = readFileSync(samplePath, 'utf-8');
        const program = parse(source);

        // Full dictionary match
        const expectedLines = {
          methyl: 2,
          ethyl: 3,
          propyl: 4,
          hydroxyl: 7,
          ethanol: 8,
          carbonyl: 11,
          carboxyl: 12,
          acetic_acid: 13,
          benzene: 16,
          toluene: 17,
        };

        for (const [name, expectedLine] of Object.entries(expectedLines)) {
          const def = program.definitions.get(name);
          expect(def.name).toBe(name);
          expect(def.line).toBe(expectedLine);
        }
      });

      test('should produce expected SELFIES', () => {
        const samplePath = join(__dirname, '..', '..', '..', 'samples', 'toluene.selfies');
        const source = readFileSync(samplePath, 'utf-8');
        const program = parse(source);

        // Full dictionary match
        const expectedSelfies = {
          methyl: '[C]',
          ethyl: '[C][C]',
          propyl: '[C][C][C]',
          hydroxyl: '[O]',
          ethanol: '[C][C][O]',
          carbonyl: '[C][=O]',
          carboxyl: '[C][=Branch1][C][=O][O]',
          acetic_acid: '[C][C][=Branch1][C][=O][O]',
          benzene: '[C][=C][C][=C][C][=C][Ring1][=Branch1]',
          toluene: '[C][C][=C][C][=C][C][=C][Ring1][=Branch1]',
        };

        for (const [name, expected] of Object.entries(expectedSelfies)) {
          expect(resolve(program, name)).toBe(expected);
        }
      });

      test('should produce expected SMILES', () => {
        const samplePath = join(__dirname, '..', '..', '..', 'samples', 'toluene.selfies');
        const source = readFileSync(samplePath, 'utf-8');
        const program = parse(source);

        // Full dictionary match
        const expectedSmiles = {
          methyl: 'C',
          ethyl: 'CC',
          propyl: 'CCC',
          hydroxyl: 'O',
          ethanol: 'CCO',
          carbonyl: 'C=O',
          carboxyl: 'C(=O)O',
          acetic_acid: 'CC(=O)O',
          benzene: 'C1=CC=CC=C1',
          toluene: 'CC1=CC=CC=C1',
        };

        for (const [name, expected] of Object.entries(expectedSmiles)) {
          expect(resolve(program, name, { decode: true })).toBe(expected);
        }
      });
    });
  });

  describe('SMILES-JS Support', () => {
    describe('example.smiles.js', () => {
      test('should load module and extract exports', async () => {
        const modulePath = join(PROGRAMS_DIR, 'example.smiles.js');

        // Dynamic import the module
        const { pathToFileURL } = await import('url');
        const fileUrl = pathToFileURL(modulePath).href;
        const module = await import(`${fileUrl}?t=${Date.now()}`);

        // Test that exports exist and have .smiles property
        expect(module.methane).toBeTruthy();
        expect(module.methane.smiles).toBe('C');
        expect(module.methane.formula).toBe('CH4');
        expect(module.methane.molecularWeight).toBeCloseTo(16.04, 1);

        expect(module.ethane).toBeTruthy();
        expect(module.ethane.smiles).toBe('CC');

        expect(module.propane).toBeTruthy();
        expect(module.propane.smiles).toBe('CCC');
      });

      test('should find export names at specific lines', () => {
        const source = readProgram('example.smiles.js');
        const lines = source.split('\n');

        const findExportAtLine = (lineNum) => {
          const line = lines[lineNum - 1];
          const match = line.match(/export\s+const\s+(\w+)\s*=/);
          return match ? match[1] : null;
        };

        // Test finding exports at specific lines
        expect(findExportAtLine(15)).toBe('methane');
        expect(findExportAtLine(16)).toBe('ethane');
        expect(findExportAtLine(17)).toBe('propane');
        expect(findExportAtLine(20)).toBe('water');
        expect(findExportAtLine(24)).toBe('benzeneRing');
      });

      test('should provide molecular properties for all fragments', async () => {
        const modulePath = join(PROGRAMS_DIR, 'example.smiles.js');
        const { pathToFileURL } = await import('url');
        const fileUrl = pathToFileURL(modulePath).href;
        const module = await import(`${fileUrl}?t=${Date.now()}`);

        // Test various exports
        const testCases = [
          { name: 'methane', smiles: 'C', formula: 'CH4' },
          { name: 'ethane', smiles: 'CC', formula: 'C2H6' },
          { name: 'propane', smiles: 'CCC', formula: 'C3H8' },
          { name: 'water', smiles: 'O', formula: 'O' },
          { name: 'ammonia', smiles: 'N', formula: 'N' },
        ];

        for (const { name, smiles, formula } of testCases) {
          const fragment = module[name];
          expect(fragment).toBeTruthy();
          expect(fragment.smiles).toBe(smiles);
          expect(fragment.formula).toBe(formula);
          expect(fragment.molecularWeight).toBeGreaterThan(0);
        }
      });

      test('should validate SMILES with RDKit', async () => {
        const modulePath = join(PROGRAMS_DIR, 'example.smiles.js');
        const { pathToFileURL } = await import('url');
        const fileUrl = pathToFileURL(modulePath).href;
        const module = await import(`${fileUrl}?t=${Date.now()}`);

        // Test that simple molecules are valid
        const validMolecules = ['methane', 'ethane', 'propane', 'water', 'ammonia', 'ethanol', 'toluene'];

        for (const name of validMolecules) {
          const fragment = module[name];
          expect(fragment).toBeTruthy();
          const isValid = await isValidSMILES(fragment.smiles);
          expect(isValid).toBe(true);
        }
      });

      test('should render molecules with RDKit', async () => {
        const modulePath = join(PROGRAMS_DIR, 'example.smiles.js');
        const { pathToFileURL } = await import('url');
        const fileUrl = pathToFileURL(modulePath).href;
        const module = await import(`${fileUrl}?t=${Date.now()}`);

        // Test that molecules can be rendered without errors
        const testMolecules = ['methane', 'ethane', 'toluene', 'aspirin', 'ibuprofen'];

        for (const name of testMolecules) {
          const fragment = module[name];
          expect(fragment).toBeTruthy();

          // Should not throw - just checking if rendering works
          await expect(generateSVG(fragment.smiles)).resolves.toBeTruthy();
        }
      });
    });
  });
});
